import {LocationWeatherBundle, UnitSystem} from '../types/weather';
import {
  formatLocalTimeFromZone,
  formatSpeedValue,
  formatTempValue,
  speedUnitLabel,
  tempUnitLabel,
} from './weatherFormat';

export function buildWeatherReportUrl(bundle: LocationWeatherBundle): string {
  const url = new URL(window.location.origin);
  url.searchParams.set('lat', bundle.current.lat.toFixed(4));
  url.searchParams.set('lng', bundle.current.lng.toFixed(4));
  url.searchParams.set('loc', bundle.current.locationName);
  return url.toString();
}

export function buildWeatherReportText(bundle: LocationWeatherBundle, units: UnitSystem): string {
  const tUnit = tempUnitLabel(units);
  const sUnit = speedUnitLabel(units);
  const temp = formatTempValue(bundle.current.temperatureC, units);
  const feels = formatTempValue(bundle.current.feelsLikeC, units);
  const wind = formatSpeedValue(bundle.current.windSpeedKmh, units);
  const today = bundle.daily[0];
  const sunrise = today?.sunriseIso
    ? formatLocalTimeFromZone(today.sunriseIso, bundle.current.timeZoneId)
    : null;
  const sunset = today?.sunsetIso
    ? formatLocalTimeFromZone(today.sunsetIso, bundle.current.timeZoneId)
    : null;

  const lines = [
    `MAIND GO Weather Report — ${bundle.current.locationName} (${bundle.current.regionSubtitle})`,
    `Condition: ${bundle.current.conditionDescription} · ${temp}${tUnit} (Feels like ${feels}${tUnit})`,
    `Rain Probability: ${bundle.current.precipitationProb}% · Humidity: ${bundle.current.relativeHumidity}%`,
    `Wind: ${wind} ${sUnit} ${bundle.current.windCardinal} · UV Index: ${bundle.current.uvIndex}`,
  ];

  if (bundle.airQuality) {
    lines.push(`Air Quality: ${bundle.airQuality.aqiDisplay} (${bundle.airQuality.category})`);
  }
  if (sunrise && sunset) {
    lines.push(`Sunrise: ${sunrise} · Sunset: ${sunset}`);
  }
  lines.push(`Explore live map: ${buildWeatherReportUrl(bundle)}`);
  return lines.join('\n');
}

export async function shareWeatherReport(
  bundle: LocationWeatherBundle,
  units: UnitSystem
): Promise<'shared' | 'copied'> {
  const shareUrl = buildWeatherReportUrl(bundle);
  const reportText = buildWeatherReportText(bundle, units);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `MAIND GO Weather: ${bundle.current.locationName}`,
        text: reportText,
        url: shareUrl,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      // Fall back to clipboard if Web Share failed in iframe
    }
  }

  await navigator.clipboard.writeText(reportText);
  return 'copied';
}
