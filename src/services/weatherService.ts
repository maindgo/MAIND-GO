import {
  AirQualityData,
  DailyForecastItem,
  HourlyForecastItem,
  LocationWeatherBundle,
  PollutantReading,
  RainViewerData,
  StationWeatherPin,
  WeatherAlertItem,
  WeatherCurrentData,
  WindGridSample,
} from '../types/weather';
import {
  aqiColorForValue,
  degreesToCardinal,
  formatLocalTimeFromZone,
  normalizeCardinal,
  wmoCodeToCondition,
} from '../utils/weatherFormat';

const ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

function dispatchQuotaExceeded() {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

async function checkQuotaPayload(res: Response): Promise<boolean> {
  if (res.status === 429) {
    dispatchQuotaExceeded();
    return true;
  }
  if (!res.ok) {
    try {
      const cloned = res.clone();
      const body = await cloned.json();
      if (body?.error?.status === 'RESOURCE_EXHAUSTED') {
        dispatchQuotaExceeded();
        return true;
      }
    } catch {
      // Ignore parse failures on non-JSON errors
    }
  }
  return false;
}

function toCelsius(val: number | undefined, unit: string | undefined): number {
  if (typeof val !== 'number') return 0;
  if (unit === 'FAHRENHEIT') return ((val - 32) * 5) / 9;
  return val;
}

function toKmh(val: number | undefined, unit: string | undefined): number {
  if (typeof val !== 'number') return 0;
  if (unit === 'MILES_PER_HOUR') return val * 1.60934;
  return val;
}

function toMm(val: number | undefined, unit: string | undefined): number {
  if (typeof val !== 'number') return 0;
  if (unit === 'INCHES') return val * 25.4;
  return val;
}

function toKm(val: number | undefined, unit: string | undefined): number {
  if (typeof val !== 'number') return 16;
  if (unit === 'MILES') return val * 1.60934;
  return val;
}

export async function reverseGeocodeCoords(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<{name: string; subtitle: string}> {
  if (apiKey) {
    try {
      const url = new URL('https://geocode.googleapis.com/v4/geocode/location');
      url.searchParams.append('location.latitude', lat.toFixed(5));
      url.searchParams.append('location.longitude', lng.toFixed(5));
      url.searchParams.append('languageCode', 'en');

      const res = await fetch(url.toString(), {
        method: 'GET',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'results.formattedAddress,results.addressComponents,results.types',
          'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID,
        },
      });

      await checkQuotaPayload(res);
      if (res.ok) {
        const data = await res.json();
        const results = data?.results;
        if (Array.isArray(results) && results.length > 0) {
          const locality = results.find((r: {types?: string[]}) =>
            r.types?.some((t) => t === 'locality' || t === 'administrative_area_level_1')
          ) || results[0];

          const components: Array<{longText?: string; shortText?: string; types?: string[]}> =
            locality?.addressComponents || [];
          const city =
            components.find((c) => c.types?.includes('locality'))?.longText ||
            components.find((c) => c.types?.includes('administrative_area_level_2'))?.longText ||
            components.find((c) => c.types?.includes('administrative_area_level_1'))?.longText;
          const region = components.find((c) => c.types?.includes('administrative_area_level_1'))?.shortText;
          const country = components.find((c) => c.types?.includes('country'))?.longText;

          if (city) {
            const parts = [region && region !== city ? region : null, country].filter(Boolean);
            return {
              name: city,
              subtitle: parts.join(', ') || locality.formattedAddress || `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
            };
          }
          if (locality.formattedAddress) {
            return {
              name: locality.formattedAddress.split(',')[0],
              subtitle: locality.formattedAddress,
            };
          }
        }
      }
    } catch {
      // Fallback to CORS-safe reverse geocoder below
    }
  }

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&localityLanguage=en`,
      {signal}
    );
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || data.countryName;
      if (city) {
        const sub = [
          data.principalSubdivision && data.principalSubdivision !== city ? data.principalSubdivision : null,
          data.countryName && data.countryName !== city ? data.countryName : null,
        ]
          .filter(Boolean)
          .join(', ');
        return {name: city, subtitle: sub || 'Selected Coordinates'};
      }
    }
  } catch {
    // Ocean / remote fallback
  }

  return {
    name: `Point ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
    subtitle: 'Open Waters / Remote Telemetry',
  };
}

async function fetchGoogleWeatherCurrent(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  if (!apiKey) return null;
  try {
    const url = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('location.latitude', String(lat));
    url.searchParams.append('location.longitude', String(lng));
    url.searchParams.append('unitsSystem', 'METRIC');

    const res = await fetch(url.toString(), {
      method: 'GET',
      signal,
      headers: {
        'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID,
      },
    });
    await checkQuotaPayload(res);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchGoogleWeatherHourly(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  if (!apiKey) return null;
  try {
    const url = new URL('https://weather.googleapis.com/v1/forecast/hours:lookup');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('location.latitude', String(lat));
    url.searchParams.append('location.longitude', String(lng));
    url.searchParams.append('hours', '48');
    url.searchParams.append('pageSize', '24');

    const res = await fetch(url.toString(), {
      method: 'GET',
      signal,
      headers: {
        'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID,
      },
    });
    await checkQuotaPayload(res);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchGoogleWeatherDaily(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  if (!apiKey) return null;
  try {
    const url = new URL('https://weather.googleapis.com/v1/forecast/days:lookup');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('location.latitude', String(lat));
    url.searchParams.append('location.longitude', String(lng));
    url.searchParams.append('days', '10');
    url.searchParams.append('pageSize', '10');

    const res = await fetch(url.toString(), {
      method: 'GET',
      signal,
      headers: {
        'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID,
      },
    });
    await checkQuotaPayload(res);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchWeatherAlertsForCoords(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<WeatherAlertItem[]> {
  return fetchGoogleWeatherAlerts(lat, lng, apiKey, signal);
}

async function fetchGoogleWeatherAlerts(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<WeatherAlertItem[]> {
  if (!apiKey) return [];
  try {
    const url = new URL('https://weather.googleapis.com/v1/publicAlerts:lookup');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('location.latitude', String(lat));
    url.searchParams.append('location.longitude', String(lng));
    url.searchParams.append('languageCode', 'en');

    const res = await fetch(url.toString(), {
      method: 'GET',
      signal,
      headers: {
        'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID,
      },
    });
    await checkQuotaPayload(res);
    if (!res.ok) return [];
    const data = await res.json();
    const rawAlerts = data?.weatherAlerts;
    if (!Array.isArray(rawAlerts)) return [];

    return rawAlerts.map((a: Record<string, unknown>) => {
      const alertTitle = a.alertTitle as {text?: string} | undefined;
      const ds = (a.dataSource as {publisher?: string; name?: string; authorityUri?: string}) || {};
      return {
        alertId: String(a.alertId || Math.random()),
        title: alertTitle?.text || String(a.eventType || 'Weather Alert'),
        eventType: String(a.eventType || 'ADVISORY'),
        areaName: String(a.areaName || ''),
        severity: String(a.severity || 'MODERATE'),
        urgency: String(a.urgency || 'EXPECTED'),
        certainty: String(a.certainty || 'LIKELY'),
        description: typeof a.description === 'string' ? a.description : undefined,
        instruction: Array.isArray(a.instruction) ? (a.instruction as string[]) : undefined,
        safetyRecommendations: Array.isArray(a.safetyRecommendations)
          ? (a.safetyRecommendations as Array<{directive?: string; subtext?: string}>)
              .filter((r) => typeof r.directive === 'string')
              .map((r) => ({directive: r.directive as string, subtext: r.subtext}))
          : undefined,
        startTimeIso: typeof a.startTime === 'string' ? a.startTime : undefined,
        expirationTimeIso: typeof a.expirationTime === 'string' ? a.expirationTime : undefined,
        dataSource: {
          publisher: ds.publisher || 'Meteorological Authority',
          name: ds.name || ds.publisher || 'National Weather Authority',
          authorityUri: ds.authorityUri || 'https://www.weather.gov/',
        },
      };
    });
  } catch {
    return [];
  }
}

async function fetchGoogleAirQuality(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<AirQualityData | null> {
  if (!apiKey) return null;
  try {
    const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID,
      },
      body: JSON.stringify({
        universalAqi: true,
        location: {latitude: lat, longitude: lng},
        extraComputations: [
          'LOCAL_AQI',
          'HEALTH_RECOMMENDATIONS',
          'POLLUTANT_CONCENTRATION',
          'POLLUTANT_ADDITIONAL_INFO',
        ],
        languageCode: 'en',
      }),
    });
    await checkQuotaPayload(res);
    if (!res.ok) return null;
    const data = await res.json();
    const indexes = Array.isArray(data?.indexes) ? data.indexes : [];
    const primary = indexes.find((idx: {code?: string}) => idx.code === 'usa_epa') || indexes[0];
    if (!primary) return null;

    const aqiVal = Number(primary.aqi ?? 0);
    const c = primary.color || {};
    const to255 = (v?: number) => {
      if (typeof v !== 'number') return 0;
      return v <= 1 ? Math.round(v * 255) : Math.round(v);
    };
    const hasColor = typeof c.red === 'number' || typeof c.green === 'number' || typeof c.blue === 'number';
    const colorCss = hasColor
      ? `rgb(${to255(c.red)}, ${to255(c.green)}, ${to255(c.blue)})`
      : aqiColorForValue(aqiVal);

    const pollutants: PollutantReading[] = Array.isArray(data?.pollutants)
      ? data.pollutants.map((p: Record<string, unknown>) => {
          const conc = (p.concentration as {value?: number; units?: string}) || {};
          const add = (p.additionalInfo as {sources?: string; effects?: string}) || {};
          return {
            code: String(p.code || ''),
            displayName: String(p.displayName || p.code || ''),
            fullName: String(p.fullName || p.displayName || ''),
            value: Number(conc.value ?? 0),
            units: conc.units === 'PARTS_PER_BILLION' ? 'ppb' : 'µg/m³',
            sources: add.sources,
            effects: add.effects,
          };
        })
      : [];

    return {
      dateTimeIso: data.dateTime || new Date().toISOString(),
      regionCode: data.regionCode,
      aqi: aqiVal,
      aqiDisplay: String(primary.aqiDisplay ?? aqiVal),
      indexName: String(primary.displayName || 'Air Quality Index'),
      category: String(primary.category || 'Moderate'),
      dominantPollutant: String(primary.dominantPollutant || 'pm25').toUpperCase(),
      colorCss,
      pollutants,
      healthRecommendations: data.healthRecommendations,
      sourceName: 'Google Air Quality API',
    };
  } catch {
    return null;
  }
}

async function fetchOpenMeteoAirQuality(lat: number, lng: number, signal?: AbortSignal): Promise<AirQualityData | null> {
  try {
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`;
    const res = await fetch(url, {signal});
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data?.current;
    if (!cur) return null;

    const aqi = Math.round(Number(cur.us_aqi ?? 25));
    const category =
      aqi <= 50
        ? 'Good air quality'
        : aqi <= 100
          ? 'Moderate air quality'
          : aqi <= 150
            ? 'Unhealthy for sensitive groups'
            : aqi <= 200
              ? 'Unhealthy air quality'
              : 'Very unhealthy air quality';

    const pollutants: PollutantReading[] = [
      {code: 'pm25', displayName: 'PM2.5', fullName: 'Fine particulate matter (<2.5µm)', value: Number(cur.pm2_5 ?? 0), units: 'µg/m³'},
      {code: 'pm10', displayName: 'PM10', fullName: 'Particulate matter (<10µm)', value: Number(cur.pm10 ?? 0), units: 'µg/m³'},
      {code: 'o3', displayName: 'O3', fullName: 'Ozone', value: Number(cur.ozone ?? 0), units: 'µg/m³'},
      {code: 'no2', displayName: 'NO2', fullName: 'Nitrogen dioxide', value: Number(cur.nitrogen_dioxide ?? 0), units: 'µg/m³'},
      {code: 'so2', displayName: 'SO2', fullName: 'Sulfur dioxide', value: Number(cur.sulphur_dioxide ?? 0), units: 'µg/m³'},
      {code: 'co', displayName: 'CO', fullName: 'Carbon monoxide', value: Number(cur.carbon_monoxide ?? 0), units: 'µg/m³'},
    ];

    return {
      dateTimeIso: cur.time || new Date().toISOString(),
      aqi,
      aqiDisplay: String(aqi),
      indexName: 'US AQI',
      category,
      dominantPollutant: (cur.pm2_5 ?? 0) > 12 ? 'PM2.5' : 'O3',
      colorCss: aqiColorForValue(aqi),
      pollutants,
      healthRecommendations: {
        generalPopulation:
          aqi <= 50
            ? 'Air quality is satisfactory with minimal risk. Ideal conditions for outdoor activity.'
            : aqi <= 100
              ? 'Acceptable air quality; unusually sensitive individuals should consider limiting prolonged exertion.'
              : 'Sensitive groups should reduce prolonged or heavy outdoor exertion.',
      },
      sourceName: 'Copernicus / Open-Meteo AQ',
    };
  } catch {
    return null;
  }
}

async function fetchOpenMeteoWeather(lat: number, lng: number, signal?: AbortSignal) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,uv_index,visibility` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&forecast_days=10&timezone=auto`;

  const res = await fetch(url, {signal});
  if (!res.ok) {
    throw new Error(`Meteorological telemetry unavailable (${res.status})`);
  }
  return await res.json();
}

export async function fetchLocationWeatherBundle(
  lat: number,
  lng: number,
  apiKey: string,
  overrideName?: {name: string; subtitle: string},
  signal?: AbortSignal
): Promise<LocationWeatherBundle> {
  const [geoResult, googleCurrent, googleHourly, googleDaily, alerts, googleAq, openMeteo] = await Promise.all([
    overrideName ? Promise.resolve(overrideName) : reverseGeocodeCoords(lat, lng, apiKey, signal),
    fetchGoogleWeatherCurrent(lat, lng, apiKey, signal),
    fetchGoogleWeatherHourly(lat, lng, apiKey, signal),
    fetchGoogleWeatherDaily(lat, lng, apiKey, signal),
    fetchGoogleWeatherAlerts(lat, lng, apiKey, signal),
    fetchGoogleAirQuality(lat, lng, apiKey, signal),
    fetchOpenMeteoWeather(lat, lng, signal).catch(() => null),
  ]);

  const omCurrent = openMeteo?.current;
  const omTimeZone: string = openMeteo?.timezone || 'UTC';

  // Current weather: prefer Google Weather API, fill any gaps with Open-Meteo
  let current: WeatherCurrentData;
  if (googleCurrent) {
    const wc = (googleCurrent.weatherCondition as Record<string, unknown>) || {};
    const desc = (wc.description as {text?: string})?.text || 'Clear';
    const tempObj = googleCurrent.temperature as {degrees?: number; unit?: string} | undefined;
    const feelsObj = googleCurrent.feelsLikeTemperature as {degrees?: number; unit?: string} | undefined;
    const dewObj = googleCurrent.dewPoint as {degrees?: number; unit?: string} | undefined;
    const precipObj = googleCurrent.precipitation as {
      probability?: {percent?: number};
      qpf?: {quantity?: number; unit?: string};
    } | undefined;
    const windObj = googleCurrent.wind as {
      direction?: {degrees?: number; cardinal?: string};
      speed?: {value?: number; unit?: string};
      gust?: {value?: number; unit?: string};
    } | undefined;
    const visObj = googleCurrent.visibility as {distance?: number; unit?: string} | undefined;
    const pressureObj = googleCurrent.airPressure as {meanSeaLevelMillibars?: number} | undefined;
    const histObj = googleCurrent.currentConditionsHistory as {
      maxTemperature?: {degrees?: number; unit?: string};
      minTemperature?: {degrees?: number; unit?: string};
      temperatureChange?: {degrees?: number; unit?: string};
    } | undefined;
    const tzObj = googleCurrent.timeZone as {id?: string} | undefined;
    const windDeg = Number(windObj?.direction?.degrees ?? omCurrent?.wind_direction_10m ?? 0);

    current = {
      locationName: geoResult.name,
      regionSubtitle: geoResult.subtitle,
      lat,
      lng,
      currentTimeIso: String(googleCurrent.currentTime || new Date().toISOString()),
      timeZoneId: tzObj?.id || omTimeZone,
      isDaytime: Boolean(googleCurrent.isDaytime ?? true),
      conditionType: String(wc.type || 'CLEAR'),
      conditionDescription: desc,
      iconBaseUri: typeof wc.iconBaseUri === 'string' ? wc.iconBaseUri : undefined,
      temperatureC: toCelsius(tempObj?.degrees, tempObj?.unit),
      feelsLikeC: toCelsius(feelsObj?.degrees, feelsObj?.unit),
      dewPointC: toCelsius(dewObj?.degrees, dewObj?.unit),
      relativeHumidity: Number(googleCurrent.relativeHumidity ?? omCurrent?.relative_humidity_2m ?? 50),
      uvIndex: Number(googleCurrent.uvIndex ?? omCurrent?.uv_index ?? 0),
      precipitationProb: Number(precipObj?.probability?.percent ?? 0),
      precipitationMm: toMm(precipObj?.qpf?.quantity, precipObj?.qpf?.unit),
      thunderstormProb: Number(googleCurrent.thunderstormProbability ?? 0),
      pressureHpa: Number(pressureObj?.meanSeaLevelMillibars ?? omCurrent?.surface_pressure ?? 1013),
      windDirectionDeg: windDeg,
      windCardinal: normalizeCardinal(windObj?.direction?.cardinal, windDeg),
      windSpeedKmh: toKmh(windObj?.speed?.value, windObj?.speed?.unit),
      windGustKmh: toKmh(windObj?.gust?.value, windObj?.gust?.unit),
      visibilityKm: toKm(visObj?.distance, visObj?.unit),
      cloudCoverPct: Number(googleCurrent.cloudCover ?? omCurrent?.cloud_cover ?? 0),
      maxTemp24hC: histObj?.maxTemperature ? toCelsius(histObj.maxTemperature.degrees, histObj.maxTemperature.unit) : undefined,
      minTemp24hC: histObj?.minTemperature ? toCelsius(histObj.minTemperature.degrees, histObj.minTemperature.unit) : undefined,
      tempChange24hC: histObj?.temperatureChange ? toCelsius(histObj.temperatureChange.degrees, histObj.temperatureChange.unit) : undefined,
      sourceName: 'Google Weather API',
    };
  } else if (omCurrent) {
    const isDay = omCurrent.is_day === 1;
    const mapped = wmoCodeToCondition(Number(omCurrent.weather_code ?? 0), isDay);
    const windDeg = Number(omCurrent.wind_direction_10m ?? 0);
    const omDaily = openMeteo?.daily;
    current = {
      locationName: geoResult.name,
      regionSubtitle: geoResult.subtitle,
      lat,
      lng,
      currentTimeIso: new Date().toISOString(),
      timeZoneId: omTimeZone,
      isDaytime: isDay,
      conditionType: mapped.type,
      conditionDescription: mapped.description,
      temperatureC: Number(omCurrent.temperature_2m ?? 0),
      feelsLikeC: Number(omCurrent.apparent_temperature ?? omCurrent.temperature_2m ?? 0),
      dewPointC: Number(omCurrent.dew_point_2m ?? 0),
      relativeHumidity: Number(omCurrent.relative_humidity_2m ?? 0),
      uvIndex: Math.round(Number(omCurrent.uv_index ?? 0)),
      precipitationProb: Number(openMeteo?.hourly?.precipitation_probability?.[0] ?? 0),
      precipitationMm: Number(omCurrent.precipitation ?? 0),
      thunderstormProb: mapped.type === 'THUNDERSTORM' ? 80 : 0,
      pressureHpa: Number(omCurrent.surface_pressure ?? 1013),
      windDirectionDeg: windDeg,
      windCardinal: degreesToCardinal(windDeg),
      windSpeedKmh: Number(omCurrent.wind_speed_10m ?? 0),
      windGustKmh: Number(omCurrent.wind_gusts_10m ?? omCurrent.wind_speed_10m ?? 0),
      visibilityKm: typeof omCurrent.visibility === 'number' ? Number((omCurrent.visibility / 1000).toFixed(1)) : 16,
      cloudCoverPct: Number(omCurrent.cloud_cover ?? 0),
      maxTemp24hC: typeof omDaily?.temperature_2m_max?.[0] === 'number' ? omDaily.temperature_2m_max[0] : undefined,
      minTemp24hC: typeof omDaily?.temperature_2m_min?.[0] === 'number' ? omDaily.temperature_2m_min[0] : undefined,
      sourceName: 'Open-Meteo Live Telemetry',
    };
  } else {
    throw new Error('Unable to load weather telemetry for this coordinate.');
  }

  // Hourly forecast
  let hourly: HourlyForecastItem[] = [];
  const gHours = Array.isArray(googleHourly?.forecastHours) ? googleHourly.forecastHours : null;
  if (gHours && gHours.length > 0) {
    hourly = gHours.slice(0, 24).map((h: Record<string, unknown>) => {
      const interval = (h.interval as {startTime?: string}) || {};
      const startIso = interval.startTime || new Date().toISOString();
      const ddt = (h.displayDateTime as {hours?: number; month?: number; day?: number}) || {};
      const wc = (h.weatherCondition as Record<string, unknown>) || {};
      const tempObj = h.temperature as {degrees?: number; unit?: string} | undefined;
      const feelsObj = h.feelsLikeTemperature as {degrees?: number; unit?: string} | undefined;
      const precipObj = h.precipitation as {
        probability?: {percent?: number};
        qpf?: {quantity?: number; unit?: string};
      } | undefined;
      const windObj = h.wind as {
        direction?: {degrees?: number; cardinal?: string};
        speed?: {value?: number; unit?: string};
        gust?: {value?: number; unit?: string};
      } | undefined;
      const pressureObj = h.airPressure as {meanSeaLevelMillibars?: number} | undefined;
      const windDeg = Number(windObj?.direction?.degrees ?? 0);
      const localHour =
        typeof ddt.hours === 'number'
          ? `${String(ddt.hours).padStart(2, '0')}:00`
          : formatLocalTimeFromZone(startIso, current.timeZoneId);
      const localDate = ddt.month && ddt.day ? `${ddt.month}/${ddt.day}` : '';

      return {
        timeIso: startIso,
        localHourLabel: localHour,
        localDateLabel: localDate,
        isDaytime: Boolean(h.isDaytime ?? true),
        conditionType: String(wc.type || 'CLEAR'),
        conditionDescription: (wc.description as {text?: string})?.text || 'Clear',
        temperatureC: toCelsius(tempObj?.degrees, tempObj?.unit),
        feelsLikeC: toCelsius(feelsObj?.degrees, feelsObj?.unit),
        precipProb: Number(precipObj?.probability?.percent ?? 0),
        precipMm: toMm(precipObj?.qpf?.quantity, precipObj?.qpf?.unit),
        windSpeedKmh: toKmh(windObj?.speed?.value, windObj?.speed?.unit),
        windGustKmh: toKmh(windObj?.gust?.value, windObj?.gust?.unit),
        windDirectionDeg: windDeg,
        windCardinal: normalizeCardinal(windObj?.direction?.cardinal, windDeg),
        relativeHumidity: Number(h.relativeHumidity ?? 50),
        uvIndex: Number(h.uvIndex ?? 0),
        cloudCoverPct: Number(h.cloudCover ?? 0),
        pressureHpa: Number(pressureObj?.meanSeaLevelMillibars ?? 1013),
      };
    });
  } else if (openMeteo?.hourly?.time) {
    const h = openMeteo.hourly;
    const nowMs = Date.now() - 30 * 60 * 1000;
    const startIdx = Math.max(
      0,
      (h.time as string[]).findIndex((t) => new Date(t).getTime() >= nowMs)
    );
    for (let i = startIdx; i < Math.min(startIdx + 24, h.time.length); i++) {
      const iso = h.time[i];
      const isDay = h.is_day?.[i] === 1;
      const mapped = wmoCodeToCondition(Number(h.weather_code?.[i] ?? 0), isDay);
      const windDeg = Number(h.wind_direction_10m?.[i] ?? 0);
      const dt = new Date(iso);
      hourly.push({
        timeIso: iso,
        localHourLabel: `${String(dt.getHours()).padStart(2, '0')}:00`,
        localDateLabel: `${dt.getMonth() + 1}/${dt.getDate()}`,
        isDaytime: isDay,
        conditionType: mapped.type,
        conditionDescription: mapped.description,
        temperatureC: Number(h.temperature_2m?.[i] ?? 0),
        feelsLikeC: Number(h.apparent_temperature?.[i] ?? h.temperature_2m?.[i] ?? 0),
        precipProb: Number(h.precipitation_probability?.[i] ?? 0),
        precipMm: Number(h.precipitation?.[i] ?? 0),
        windSpeedKmh: Number(h.wind_speed_10m?.[i] ?? 0),
        windGustKmh: Number(h.wind_gusts_10m?.[i] ?? h.wind_speed_10m?.[i] ?? 0),
        windDirectionDeg: windDeg,
        windCardinal: degreesToCardinal(windDeg),
        relativeHumidity: Number(h.relative_humidity_2m?.[i] ?? 50),
        uvIndex: Math.round(Number(h.uv_index?.[i] ?? 0)),
        cloudCoverPct: Number(h.cloud_cover?.[i] ?? 0),
        pressureHpa: Number(h.surface_pressure?.[i] ?? 1013),
      });
    }
  }

  // Daily forecast
  let daily: DailyForecastItem[] = [];
  const gDays = Array.isArray(googleDaily?.forecastDays) ? googleDaily.forecastDays : null;
  if (gDays && gDays.length > 0) {
    daily = gDays.map((d: Record<string, unknown>, idx: number) => {
      const displayDate = (d.displayDate as {year?: number; month?: number; day?: number}) || {};
      const dateStr =
        displayDate.year && displayDate.month && displayDate.day
          ? `${displayDate.year}-${String(displayDate.month).padStart(2, '0')}-${String(displayDate.day).padStart(2, '0')}`
          : new Date(Date.now() + idx * 86400000).toISOString().slice(0, 10);
      const dateObj = new Date(`${dateStr}T12:00:00Z`);
      const dayName = idx === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', {weekday: 'short'});
      const dateShort = dateObj.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
      const dayFc = (d.daytimeForecast as Record<string, unknown>) || {};
      const wc = (dayFc.weatherCondition as Record<string, unknown>) || {};
      const maxT = d.maxTemperature as {degrees?: number; unit?: string} | undefined;
      const minT = d.minTemperature as {degrees?: number; unit?: string} | undefined;
      const precipObj = dayFc.precipitation as {
        probability?: {percent?: number};
        qpf?: {quantity?: number; unit?: string};
      } | undefined;
      const windObj = dayFc.wind as {speed?: {value?: number; unit?: string}} | undefined;
      const sunEvents = d.sunEvents as {sunriseTime?: string; sunsetTime?: string} | undefined;
      const moonEvents = d.moonEvents as {moonPhase?: string} | undefined;

      return {
        dateIso: dateStr,
        dayName,
        dateShort,
        conditionType: String(wc.type || 'CLEAR'),
        conditionDescription: (wc.description as {text?: string})?.text || 'Clear',
        maxTempC: toCelsius(maxT?.degrees, maxT?.unit),
        minTempC: toCelsius(minT?.degrees, minT?.unit),
        precipProb: Number(precipObj?.probability?.percent ?? 0),
        precipMm: toMm(precipObj?.qpf?.quantity, precipObj?.qpf?.unit),
        windSpeedKmh: toKmh(windObj?.speed?.value, windObj?.speed?.unit),
        uvIndexMax: Number(dayFc.uvIndex ?? 0),
        relativeHumidity: Number(dayFc.relativeHumidity ?? 50),
        sunriseIso: sunEvents?.sunriseTime,
        sunsetIso: sunEvents?.sunsetTime,
        moonPhase: moonEvents?.moonPhase,
      };
    });
  } else if (openMeteo?.daily?.time) {
    const d = openMeteo.daily;
    const offsetSec = Number(openMeteo.utc_offset_seconds ?? 0);
    const sign = offsetSec >= 0 ? '+' : '-';
    const absSec = Math.abs(offsetSec);
    const offH = String(Math.floor(absSec / 3600)).padStart(2, '0');
    const offM = String(Math.floor((absSec % 3600) / 60)).padStart(2, '0');
    const offsetStr = `${sign}${offH}:${offM}`;
    const attachOffset = (val?: string) => {
      if (!val) return undefined;
      if (val.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(val)) return val;
      return val.length === 16 ? `${val}:00${offsetStr}` : `${val}${offsetStr}`;
    };

    daily = (d.time as string[]).map((dateStr, idx) => {
      const dateObj = new Date(`${dateStr}T12:00:00Z`);
      const mapped = wmoCodeToCondition(Number(d.weather_code?.[idx] ?? 0), true);
      return {
        dateIso: dateStr,
        dayName: idx === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', {weekday: 'short'}),
        dateShort: dateObj.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}),
        conditionType: mapped.type,
        conditionDescription: mapped.description,
        maxTempC: Number(d.temperature_2m_max?.[idx] ?? 0),
        minTempC: Number(d.temperature_2m_min?.[idx] ?? 0),
        precipProb: Number(d.precipitation_probability_max?.[idx] ?? 0),
        precipMm: Number(d.precipitation_sum?.[idx] ?? 0),
        windSpeedKmh: Number(d.wind_speed_10m_max?.[idx] ?? 0),
        uvIndexMax: Math.round(Number(d.uv_index_max?.[idx] ?? 0)),
        relativeHumidity: current.relativeHumidity,
        sunriseIso: attachOffset(d.sunrise?.[idx]),
        sunsetIso: attachOffset(d.sunset?.[idx]),
      };
    });
  }

  // Air quality: Google Air Quality API with Open-Meteo AQ fallback
  const airQuality = googleAq || (await fetchOpenMeteoAirQuality(lat, lng, signal));

  return {
    current,
    hourly,
    daily,
    alerts,
    airQuality,
  };
}

export async function fetchRainViewerMaps(): Promise<RainViewerData | null> {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!res.ok) return null;
    const data = await res.json();
    const host = data.host || 'https://tilecache.rainviewer.com';
    const past = Array.isArray(data?.radar?.past)
      ? data.radar.past.map((f: {time: number; path: string}) => ({
          time: f.time,
          path: f.path,
          isForecast: false,
        }))
      : [];
    const nowcast = Array.isArray(data?.radar?.nowcast)
      ? data.radar.nowcast.map((f: {time: number; path: string}) => ({
          time: f.time,
          path: f.path,
          isForecast: true,
        }))
      : [];
    const satellite = Array.isArray(data?.satellite?.infrared)
      ? data.satellite.infrared.map((f: {time: number; path: string}) => ({
          time: f.time,
          path: f.path,
          isForecast: false,
        }))
      : [];
    return {
      host,
      radar: [...past, ...nowcast],
      satellite,
    };
  } catch {
    return null;
  }
}

export const GLOBAL_ANCHOR_CITIES: Array<{id: string; name: string; lat: number; lng: number}> = [
  {id: 'sf', name: 'San Francisco', lat: 37.7749, lng: -122.4194},
  {id: 'nyc', name: 'New York', lat: 40.7128, lng: -74.006},
  {id: 'lon', name: 'London', lat: 51.5074, lng: -0.1278},
  {id: 'par', name: 'Paris', lat: 48.8566, lng: 2.3522},
  {id: 'tyo', name: 'Tokyo', lat: 35.6762, lng: 139.6503},
  {id: 'sin', name: 'Singapore', lat: 1.3521, lng: 103.8198},
  {id: 'syd', name: 'Sydney', lat: -33.8688, lng: 151.2093},
  {id: 'dxb', name: 'Dubai', lat: 25.2048, lng: 55.2708},
  {id: 'mum', name: 'Mumbai', lat: 19.076, lng: 72.8777},
  {id: 'kath', name: 'Kathmandu', lat: 27.7172, lng: 85.324},
  {id: 'rio', name: 'São Paulo', lat: -23.5505, lng: -46.6333},
  {id: 'cai', name: 'Cairo', lat: 30.0444, lng: 31.2357},
  {id: 'nbo', name: 'Nairobi', lat: -1.2921, lng: 36.8219},
  {id: 'rek', name: 'Reykjavik', lat: 64.1466, lng: -21.9426},
  {id: 'tor', name: 'Toronto', lat: 43.6532, lng: -79.3832},
  {id: 'mex', name: 'Mexico City', lat: 19.4326, lng: -99.1332},
  {id: 'seo', name: 'Seoul', lat: 37.5665, lng: 126.978},
  {id: 'ber', name: 'Berlin', lat: 52.52, lng: 13.405},
];

export async function fetchGlobalStationBatch(): Promise<StationWeatherPin[]> {
  try {
    const lats = GLOBAL_ANCHOR_CITIES.map((c) => c.lat.toFixed(3)).join(',');
    const lngs = GLOBAL_ANCHOR_CITIES.map((c) => c.lng.toFixed(3)).join(',');
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : [data];

    return GLOBAL_ANCHOR_CITIES.map((city, idx) => {
      const item = list[idx]?.current;
      const isDay = item?.is_day === 1;
      const cond = wmoCodeToCondition(Number(item?.weather_code ?? 0), isDay);
      return {
        id: city.id,
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        temperatureC: Number(item?.temperature_2m ?? 18),
        windSpeedKmh: Number(item?.wind_speed_10m ?? 12),
        windDirectionDeg: Number(item?.wind_direction_10m ?? 180),
        conditionType: cond.type,
        conditionDescription: cond.description,
        isDaytime: isDay,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchWindFieldGrid(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): Promise<WindGridSample[]> {
  try {
    const clampLat = (v: number) => Math.max(-82, Math.min(82, v));
    const s = clampLat(bounds.south);
    const n = clampLat(bounds.north);
    const w = bounds.west;
    let e = bounds.east;
    if (e < w) e += 360;
    const spanLng = Math.min(340, Math.max(2, e - w));
    const spanLat = Math.max(2, n - s);

    const rows = 5;
    const cols = 5;
    const points: Array<{lat: number; lng: number}> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lat = s + (spanLat * (r + 0.5)) / rows;
        let lng = w + (spanLng * (c + 0.5)) / cols;
        while (lng > 180) lng -= 360;
        while (lng < -180) lng += 360;
        points.push({lat: Number(lat.toFixed(2)), lng: Number(lng.toFixed(2))});
      }
    }

    const lats = points.map((p) => p.lat).join(',');
    const lngs = points.map((p) => p.lng).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=wind_speed_10m,wind_direction_10m`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : [data];

    return points.map((p, idx) => ({
      lat: p.lat,
      lng: p.lng,
      speedKmh: Number(list[idx]?.current?.wind_speed_10m ?? 14),
      directionDeg: Number(list[idx]?.current?.wind_direction_10m ?? 240),
    }));
  } catch {
    return [];
  }
}
