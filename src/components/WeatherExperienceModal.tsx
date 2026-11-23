import {
  Check,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Minimize2,
  Share2,
  Sun,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {LocationWeatherBundle, UnitSystem} from '../types/weather';
import {
  formatCoords,
  formatLocalTimeFromZone,
  formatPrecipValue,
  formatSpeedValue,
  formatTempDecimal,
  formatTempValue,
  formatVisibilityValue,
  precipUnitLabel,
  speedUnitLabel,
  tempUnitLabel,
  uvCategoryLabel,
  visibilityUnitLabel,
} from '../utils/weatherFormat';
import {shareWeatherReport} from '../utils/weatherShare';
import {WeatherIcon} from './WeatherIcon';
import {WeatherSoundPlayer} from './WeatherSoundPlayer';

interface WeatherExperienceModalProps {
  bundle: LocationWeatherBundle;
  units: UnitSystem;
  onUnitsChange: (u: UnitSystem) => void;
  onClose: () => void;
}

export function WeatherExperienceModal({
  bundle,
  units,
  onUnitsChange,
  onClose,
}: WeatherExperienceModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'shared' | 'copied'>('idle');

  const conditionUpper = `${bundle.current.conditionType} ${bundle.current.conditionDescription}`.toUpperCase();
  const isStorm = conditionUpper.includes('THUNDER') || conditionUpper.includes('STORM');
  const isRain = isStorm || conditionUpper.includes('RAIN') || conditionUpper.includes('DRIZZLE') || conditionUpper.includes('SHOWER');
  const isSnow = conditionUpper.includes('SNOW') || conditionUpper.includes('BLIZZARD') || conditionUpper.includes('ICE');

  // Escape key closes Experience Mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Ambient lightweight canvas particle simulation synchronized with live weather
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const count = isRain ? 110 : isSnow ? 75 : 55;
    const particles = Array.from({length: count}, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      len: isRain ? 12 + Math.random() * 14 : 2 + Math.random() * 2.5,
      speedY: isRain ? 8 + Math.random() * 7 : isSnow ? 0.9 + Math.random() * 1.4 : 0.15 + Math.random() * 0.25,
      speedX: isRain ? -1.4 : isSnow ? Math.random() * 0.8 - 0.4 : 0.3 + Math.random() * 0.5,
      alpha: 0.2 + Math.random() * 0.55,
    }));

    const renderFrame = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        if (isRain) {
          ctx.strokeStyle = `rgba(125, 211, 252, ${p.alpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.speedX * 1.5, p.y + p.len);
          ctx.stroke();
        } else {
          ctx.fillStyle = isSnow
            ? `rgba(224, 242, 254, ${p.alpha})`
            : bundle.current.isDaytime
              ? `rgba(253, 224, 71, ${p.alpha * 0.35})`
              : `rgba(226, 232, 240, ${p.alpha * 0.5})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, isSnow ? p.len : 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (!prefersReducedMotion) {
          p.x += p.speedX;
          p.y += p.speedY;
          if (p.y > h + 20) {
            p.y = -15;
            p.x = Math.random() * w;
          }
          if (p.x > w + 20) p.x = -10;
          if (p.x < -20) p.x = w + 10;
        }
      }

      if (!prefersReducedMotion) {
        animId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => {
      window.removeEventListener('resize', resize);
      if (animId) window.cancelAnimationFrame(animId);
    };
  }, [isRain, isSnow, bundle.current.isDaytime]);

  const handleShare = async () => {
    try {
      const result = await shareWeatherReport(bundle, units);
      setShareFeedback(result);
      window.setTimeout(() => setShareFeedback('idle'), 2600);
    } catch {
      // Ignore abort
    }
  };

  const today = bundle.daily[0];
  const sunrise = today?.sunriseIso
    ? formatLocalTimeFromZone(today.sunriseIso, bundle.current.timeZoneId)
    : '--:--';
  const sunset = today?.sunsetIso
    ? formatLocalTimeFromZone(today.sunsetIso, bundle.current.timeZoneId)
    : '--:--';

  const bgGradient = isStorm
    ? 'from-[#090C1C] via-[#0F172A] to-[#05070E]'
    : isRain
      ? 'from-[#071526] via-[#0A192F] to-[#060911]'
      : isSnow
        ? 'from-[#0E1B2E] via-[#132238] to-[#080D16]'
        : bundle.current.isDaytime
          ? 'from-[#0A1E36] via-[#091526] to-[#060911]'
          : 'from-[#050814] via-[#090D1C] to-[#04060C]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen Weather Experience Mode"
      className={`fixed inset-0 z-50 bg-gradient-to-br ${bgGradient} text-slate-100 overflow-y-auto maingo-scroll`}
    >
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" aria-hidden="true" />

      {/* Ambient Atmospheric Glow */}
      <div
        className="fixed -top-40 right-1/4 w-[520px] h-[520px] rounded-full blur-[140px] opacity-25 pointer-events-none"
        style={{
          background: bundle.current.isDaytime && !isRain && !isStorm ? '#F59E0B' : '#22D3EE',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-6xl mx-auto min-h-full p-4 sm:p-8 flex flex-col justify-between gap-6">
        {/* Top Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-400">
              MAIND GO · Weather Experience Mode
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
              {bundle.current.locationName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {bundle.current.regionSubtitle} ·{' '}
              <span className="font-mono tabular-nums">
                {formatCoords(bundle.current.lat, bundle.current.lng)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-0.5 bg-[#0B111E]/90 border border-slate-700/80 rounded-lg">
              <button
                type="button"
                onClick={() => onUnitsChange('METRIC')}
                className={`px-2.5 py-1.5 text-xs font-mono rounded-md transition-colors ${
                  units === 'METRIC' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300'
                }`}
              >
                °C
              </button>
              <button
                type="button"
                onClick={() => onUnitsChange('IMPERIAL')}
                className={`px-2.5 py-1.5 text-xs font-mono rounded-md transition-colors ${
                  units === 'IMPERIAL' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300'
                }`}
              >
                °F
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B111E]/90 border border-slate-700/80 hover:border-cyan-400/60 text-xs font-medium text-slate-200 transition-colors"
            >
              {shareFeedback !== 'idle' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{shareFeedback === 'shared' ? 'Shared' : 'Report Copied'}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Share Report</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* Centerpiece Weather Hero + Live Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 bg-[#0B111E]/70 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between">
              <WeatherIcon
                conditionType={bundle.current.conditionType}
                isDaytime={bundle.current.isDaytime}
                className="w-16 h-16"
              />
              <span className="font-mono tabular-nums text-xs text-slate-400">
                Local {formatLocalTimeFromZone(bundle.current.currentTimeIso, bundle.current.timeZoneId)}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono tabular-nums text-6xl sm:text-7xl font-bold tracking-tight text-white">
                  {formatTempValue(bundle.current.temperatureC, units)}
                </span>
                <span className="font-mono text-3xl text-slate-400">{tempUnitLabel(units)}</span>
              </div>
              <p className="font-display text-xl font-medium text-slate-100 mt-1">
                {bundle.current.conditionDescription}
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-400 mt-1">
                Feels like {formatTempDecimal(bundle.current.feelsLikeC, units)}
                {tempUnitLabel(units)} · Rain chance {bundle.current.precipitationProb}%
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Sunrise className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">Sunrise</div>
                  <div className="font-mono tabular-nums font-semibold text-white">{sunrise}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Sunset className="w-4 h-4 text-orange-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">Sunset</div>
                  <div className="font-mono tabular-nums font-semibold text-white">{sunset}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 6 Telemetry Cards + Hourly Strip */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-[#0B111E]/70 backdrop-blur-md border border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Wind</span>
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                  {formatSpeedValue(bundle.current.windSpeedKmh, units)} {speedUnitLabel(units)}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {bundle.current.windCardinal} ({Math.round(bundle.current.windDirectionDeg)}°)
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B111E]/70 backdrop-blur-md border border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Humidity</span>
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                  {bundle.current.relativeHumidity}%
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Precip {formatPrecipValue(bundle.current.precipitationMm, units)} {precipUnitLabel(units)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B111E]/70 backdrop-blur-md border border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Air Quality</span>
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                  {bundle.airQuality ? bundle.airQuality.aqiDisplay : 'N/A'}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {bundle.airQuality ? bundle.airQuality.category : 'Unavailable'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B111E]/70 backdrop-blur-md border border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Pressure</span>
                  <Gauge className="w-3.5 h-3.5 text-indigo-300" />
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                  {Math.round(bundle.current.pressureHpa)} hPa
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Sea level</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B111E]/70 backdrop-blur-md border border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>UV Index</span>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                  {bundle.current.uvIndex}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{uvCategoryLabel(bundle.current.uvIndex)}</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B111E]/70 backdrop-blur-md border border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Visibility</span>
                  <Eye className="w-3.5 h-3.5 text-slate-300" />
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                  {formatVisibilityValue(bundle.current.visibilityKm, units)} {visibilityUnitLabel(units)}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Cloud {bundle.current.cloudCoverPct}%
                </div>
              </div>
            </div>

            {/* Next 8 Hours Quick Strip */}
            <div className="p-4 rounded-xl bg-[#0B111E]/70 backdrop-blur-md border border-slate-800/80">
              <div className="text-xs text-slate-400 mb-2.5">Upcoming Hours</div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {bundle.hourly.slice(0, 8).map((h, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-[#070B14]/80 border border-slate-800/80 flex flex-col items-center gap-1 text-xs"
                  >
                    <span className="font-mono text-[10px] text-slate-400">{h.localHourLabel}</span>
                    <WeatherIcon conditionType={h.conditionType} isDaytime={h.isDaytime} className="w-4 h-4" />
                    <span className="font-mono tabular-nums font-semibold text-white">
                      {formatTempValue(h.temperatureC, units)}°
                    </span>
                    <span className="font-mono text-[10px] text-sky-400">{h.precipProb}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Weather Sound Console */}
        <WeatherSoundPlayer
          conditionType={bundle.current.conditionType}
          conditionDescription={bundle.current.conditionDescription}
          windSpeedKmh={bundle.current.windSpeedKmh}
        />
      </div>
    </div>
  );
}
