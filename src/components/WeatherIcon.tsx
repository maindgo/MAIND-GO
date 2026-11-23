import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';

interface WeatherIconProps {
  conditionType: string;
  isDaytime?: boolean;
  className?: string;
}

export function WeatherIcon({conditionType, isDaytime = true, className = 'w-5 h-5'}: WeatherIconProps) {
  const t = (conditionType || '').toUpperCase();

  if (t.includes('THUNDER') || t.includes('STORM')) {
    return <CloudLightning className={`${className} text-amber-400`} aria-hidden="true" />;
  }
  if (t.includes('SNOW') || t.includes('ICE') || t.includes('SLEET') || t.includes('BLIZZARD')) {
    return <CloudSnow className={`${className} text-sky-200`} aria-hidden="true" />;
  }
  if (t.includes('HEAVY_RAIN') || t === 'RAIN' || t.includes('SHOWER')) {
    return <CloudRain className={`${className} text-cyan-400`} aria-hidden="true" />;
  }
  if (t.includes('DRIZZLE') || t.includes('LIGHT_RAIN')) {
    return <CloudDrizzle className={`${className} text-sky-300`} aria-hidden="true" />;
  }
  if (t.includes('FOG') || t.includes('MIST') || t.includes('HAZE')) {
    return <CloudFog className={`${className} text-slate-400`} aria-hidden="true" />;
  }
  if (t === 'CLOUDY' || t === 'OVERCAST') {
    return <Cloud className={`${className} text-slate-300`} aria-hidden="true" />;
  }
  if (t.includes('PARTLY') || t.includes('MOSTLY_CLOUDY') || t.includes('SCATTERED')) {
    return isDaytime ? (
      <CloudSun className={`${className} text-amber-300`} aria-hidden="true" />
    ) : (
      <CloudMoon className={`${className} text-slate-300`} aria-hidden="true" />
    );
  }
  if (t.includes('CLEAR') || t.includes('SUNNY')) {
    return isDaytime ? (
      <Sun className={`${className} text-amber-400`} aria-hidden="true" />
    ) : (
      <Moon className={`${className} text-indigo-200`} aria-hidden="true" />
    );
  }

  return isDaytime ? (
    <CloudSun className={`${className} text-amber-300`} aria-hidden="true" />
  ) : (
    <CloudMoon className={`${className} text-slate-300`} aria-hidden="true" />
  );
}
