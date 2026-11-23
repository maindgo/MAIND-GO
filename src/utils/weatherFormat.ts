import {UnitSystem} from '../types/weather';

export function formatTempValue(tempC: number, units: UnitSystem): number {
  if (units === 'IMPERIAL') {
    return Math.round((tempC * 9) / 5 + 32);
  }
  return Math.round(tempC);
}

export function formatTempDecimal(tempC: number, units: UnitSystem): string {
  if (units === 'IMPERIAL') {
    return ((tempC * 9) / 5 + 32).toFixed(1);
  }
  return tempC.toFixed(1);
}

export function tempUnitLabel(units: UnitSystem): string {
  return units === 'IMPERIAL' ? '°F' : '°C';
}

export function formatSpeedValue(kmh: number, units: UnitSystem): number {
  if (units === 'IMPERIAL') {
    return Math.round(kmh * 0.621371);
  }
  return Math.round(kmh);
}

export function speedUnitLabel(units: UnitSystem): string {
  return units === 'IMPERIAL' ? 'mph' : 'km/h';
}

export function formatPrecipValue(mm: number, units: UnitSystem): string {
  if (units === 'IMPERIAL') {
    return (mm * 0.0393701).toFixed(2);
  }
  return mm.toFixed(1);
}

export function precipUnitLabel(units: UnitSystem): string {
  return units === 'IMPERIAL' ? 'in' : 'mm';
}

export function formatVisibilityValue(km: number, units: UnitSystem): string {
  if (units === 'IMPERIAL') {
    return (km * 0.621371).toFixed(1);
  }
  return km.toFixed(1);
}

export function visibilityUnitLabel(units: UnitSystem): string {
  return units === 'IMPERIAL' ? 'mi' : 'km';
}

export function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const normalized = ((deg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 22.5) % 16];
}

export function normalizeCardinal(cardinal?: string, deg?: number): string {
  if (!cardinal && typeof deg === 'number') return degreesToCardinal(deg);
  if (!cardinal) return 'N';
  const map: Record<string, string> = {
    NORTH: 'N',
    NORTH_NORTHEAST: 'NNE',
    NORTHEAST: 'NE',
    EAST_NORTHEAST: 'ENE',
    EAST: 'E',
    EAST_SOUTHEAST: 'ESE',
    SOUTHEAST: 'SE',
    SOUTH_SOUTHEAST: 'SSE',
    SOUTH: 'S',
    SOUTH_SOUTHWEST: 'SSW',
    SOUTHWEST: 'SW',
    WEST_SOUTHWEST: 'WSW',
    WEST: 'W',
    WEST_NORTHWEST: 'WNW',
    NORTHWEST: 'NW',
    NORTH_NORTHWEST: 'NNW',
  };
  return map[cardinal] ?? (typeof deg === 'number' ? degreesToCardinal(deg) : cardinal);
}

export function formatCoords(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr} · ${lngStr}`;
}

export function wmoCodeToCondition(code: number, isDay = true): {type: string; description: string} {
  if (code === 0) return {type: 'CLEAR', description: isDay ? 'Clear sky' : 'Clear night'};
  if (code === 1) return {type: 'MOSTLY_CLEAR', description: 'Mainly clear'};
  if (code === 2) return {type: 'PARTLY_CLOUDY', description: 'Partly cloudy'};
  if (code === 3) return {type: 'CLOUDY', description: 'Overcast'};
  if (code === 45 || code === 48) return {type: 'FOG', description: 'Foggy'};
  if (code >= 51 && code <= 55) return {type: 'LIGHT_RAIN', description: 'Drizzle'};
  if (code === 56 || code === 57) return {type: 'FREEZING_RAIN', description: 'Freezing drizzle'};
  if (code >= 61 && code <= 63) return {type: 'RAIN', description: 'Rain'};
  if (code === 65) return {type: 'HEAVY_RAIN', description: 'Heavy rain'};
  if (code === 66 || code === 67) return {type: 'FREEZING_RAIN', description: 'Freezing rain'};
  if (code >= 71 && code <= 75) return {type: 'SNOW', description: 'Snowfall'};
  if (code === 77) return {type: 'SNOW', description: 'Snow grains'};
  if (code >= 80 && code <= 82) return {type: 'RAIN_SHOWERS', description: 'Rain showers'};
  if (code === 85 || code === 86) return {type: 'SNOW_SHOWERS', description: 'Snow showers'};
  if (code === 95) return {type: 'THUNDERSTORM', description: 'Thunderstorm'};
  if (code === 96 || code === 99) return {type: 'THUNDERSTORM', description: 'Severe thunderstorm'};
  return {type: 'PARTLY_CLOUDY', description: 'Variable clouds'};
}

export function formatLocalTimeFromZone(isoTime: string, timeZoneId?: string): string {
  try {
    const d = new Date(isoTime);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timeZoneId || undefined,
    }).format(d);
  } catch {
    return new Date(isoTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }
}

export function formatUtcTimeShort(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

export function uvCategoryLabel(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

export function aqiColorForValue(aqi: number): string {
  if (aqi <= 50) return '#10B981';
  if (aqi <= 100) return '#F59E0B';
  if (aqi <= 150) return '#F97316';
  if (aqi <= 200) return '#EF4444';
  if (aqi <= 300) return '#A855F7';
  return '#991B1B';
}
