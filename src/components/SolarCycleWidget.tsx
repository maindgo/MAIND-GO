import {Moon, Sunrise, Sunset} from 'lucide-react';
import {DailyForecastItem} from '../types/weather';
import {formatLocalTimeFromZone} from '../utils/weatherFormat';

interface SolarCycleWidgetProps {
  todayForecast?: DailyForecastItem;
  currentTimeIso: string;
  timeZoneId: string;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function formatMoonPhaseLabel(raw?: string): string {
  if (!raw) {
    // Synodic lunar cycle estimation fallback (reference new moon: 2000-01-06 18:14 UTC)
    const synodicDays = 29.53058867;
    const knownNewMoonMs = Date.UTC(2000, 0, 6, 18, 14, 0);
    const daysSince = (Date.now() - knownNewMoonMs) / 86400000;
    const phase = ((daysSince % synodicDays) + synodicDays) % synodicDays / synodicDays;
    if (phase < 0.0625 || phase >= 0.9375) return 'New Moon';
    if (phase < 0.1875) return 'Waxing Crescent';
    if (phase < 0.3125) return 'First Quarter';
    if (phase < 0.4375) return 'Waxing Gibbous';
    if (phase < 0.5625) return 'Full Moon';
    if (phase < 0.6875) return 'Waning Gibbous';
    if (phase < 0.8125) return 'Last Quarter';
    return 'Waning Crescent';
  }
  return raw
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function SolarCycleWidget({todayForecast, currentTimeIso, timeZoneId}: SolarCycleWidgetProps) {
  const sunriseIso = todayForecast?.sunriseIso;
  const sunsetIso = todayForecast?.sunsetIso;

  if (!sunriseIso || !sunsetIso) {
    return null;
  }

  const sunriseMs = new Date(sunriseIso).getTime();
  const sunsetMs = new Date(sunsetIso).getTime();
  const nowMs = new Date(currentTimeIso).getTime();

  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs) || sunsetMs <= sunriseMs) {
    return null;
  }

  const daylightMs = sunsetMs - sunriseMs;
  const isDaytime = nowMs >= sunriseMs && nowMs <= sunsetMs;
  const rawProgress = (nowMs - sunriseMs) / daylightMs;
  const clampedDayProgress = Math.max(0, Math.min(1, rawProgress));

  // SVG coordinate system for sinusoidal solar trajectory
  const width = 340;
  const height = 108;
  const horizonY = 74;
  const padX = 28;
  const spanW = width - padX * 2;
  const amplitude = 48;

  // Build day arc (t from 0..1 across [padX, padX + spanW])
  const steps = 40;
  const arcPoints: Array<{x: number; y: number}> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = padX + t * spanW;
    const y = horizonY - Math.sin(t * Math.PI) * amplitude;
    arcPoints.push({x, y});
  }

  const fullArcPath = arcPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Progressed daylight path & area up to current sun x
  const sunX = padX + clampedDayProgress * spanW;
  const sunY = horizonY - Math.sin(clampedDayProgress * Math.PI) * amplitude;

  const progressPoints: Array<{x: number; y: number}> = [];
  if (isDaytime) {
    const progSteps = Math.max(2, Math.round(clampedDayProgress * steps));
    for (let i = 0; i <= progSteps; i++) {
      const t = (i / progSteps) * clampedDayProgress;
      const x = padX + t * spanW;
      const y = horizonY - Math.sin(t * Math.PI) * amplitude;
      progressPoints.push({x, y});
    }
  }

  const progressLinePath =
    progressPoints.length >= 2
      ? progressPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';
  const progressAreaPath =
    progressPoints.length >= 2
      ? `${progressLinePath} L ${sunX.toFixed(1)} ${horizonY} L ${padX} ${horizonY} Z`
      : '';

  const sunriseLabel = formatLocalTimeFromZone(sunriseIso, timeZoneId);
  const sunsetLabel = formatLocalTimeFromZone(sunsetIso, timeZoneId);
  const solarNoonIso = new Date(sunriseMs + daylightMs / 2).toISOString();
  const solarNoonLabel = formatLocalTimeFromZone(solarNoonIso, timeZoneId);
  const moonLabel = formatMoonPhaseLabel(todayForecast?.moonPhase);

  const statusText = isDaytime
    ? `${formatDuration(sunsetMs - nowMs)} daylight left`
    : nowMs < sunriseMs
      ? `Sunrise in ${formatDuration(sunriseMs - nowMs)}`
      : `Post-sunset · ${formatDuration(daylightMs)} day`;

  return (
    <div className="p-3.5 bg-[#111827] border border-slate-800/90 rounded-lg space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-400">Solar & Astronomical Cycle</span>
        <span className="font-mono tabular-nums text-[11px] text-amber-300">{statusText}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="maingoSolarArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.02" />
          </linearGradient>
          <radialGradient id="maingoSunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#F59E0B" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sub-horizon night twilight wings */}
        <path
          d={`M 8 ${horizonY + 12} Q 18 ${horizonY + 12} ${padX} ${horizonY}`}
          fill="none"
          stroke="rgba(148,163,184,0.22)"
          strokeDasharray="2 3"
          strokeWidth="1.2"
        />
        <path
          d={`M ${padX + spanW} ${horizonY} Q ${width - 18} ${horizonY + 12} ${width - 8} ${horizonY + 12}`}
          fill="none"
          stroke="rgba(148,163,184,0.22)"
          strokeDasharray="2 3"
          strokeWidth="1.2"
        />

        {/* Horizon line */}
        <line
          x1="8"
          y1={horizonY}
          x2={width - 8}
          y2={horizonY}
          stroke="rgba(148,163,184,0.28)"
          strokeWidth="1"
        />

        {/* Solar noon vertical tick */}
        <line
          x1={padX + spanW / 2}
          y1={horizonY - amplitude}
          x2={padX + spanW / 2}
          y2={horizonY}
          stroke="rgba(148,163,184,0.16)"
          strokeDasharray="2 2"
          strokeWidth="1"
        />

        {/* Full unelapsed solar path */}
        <path
          d={fullArcPath}
          fill="none"
          stroke="rgba(245,158,11,0.25)"
          strokeDasharray="3 3"
          strokeWidth="1.5"
        />

        {/* Elapsed daylight area + path */}
        {isDaytime && progressAreaPath && (
          <>
            <path d={progressAreaPath} fill="url(#maingoSolarArea)" />
            <path d={progressLinePath} fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
            <line
              x1={sunX}
              y1={sunY}
              x2={sunX}
              y2={horizonY}
              stroke="rgba(251,191,36,0.4)"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          </>
        )}

        {/* Horizon anchor dots */}
        <circle cx={padX} cy={horizonY} r="3" fill="#F59E0B" />
        <circle cx={padX + spanW} cy={horizonY} r="3" fill="#F97316" />

        {/* Current sun position marker */}
        {isDaytime ? (
          <g>
            <circle cx={sunX} cy={sunY} r="13" fill="url(#maingoSunGlow)" />
            <circle cx={sunX} cy={sunY} r="5" fill="#FBBF24" stroke="#0B0E17" strokeWidth="1.5" />
          </g>
        ) : (
          <circle
            cx={nowMs < sunriseMs ? 16 : width - 16}
            cy={horizonY + 10}
            r="3.5"
            fill="#64748B"
            stroke="#0B0E17"
            strokeWidth="1.5"
          />
        )}

        {/* Bottom axis timestamps */}
        <text x={padX} y={horizonY + 24} textAnchor="middle" className="fill-slate-200 text-[10px] font-mono tabular-nums">
          {sunriseLabel}
        </text>
        <text
          x={padX + spanW / 2}
          y={horizonY + 24}
          textAnchor="middle"
          className="fill-slate-500 text-[9px] font-mono tabular-nums"
        >
          Noon {solarNoonLabel}
        </text>
        <text
          x={padX + spanW}
          y={horizonY + 24}
          textAnchor="middle"
          className="fill-slate-200 text-[10px] font-mono tabular-nums"
        >
          {sunsetLabel}
        </text>
      </svg>

      {/* Sunrise / Daylight / Sunset / Moon Metadata Footer */}
      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sunrise className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-400">Sunrise</div>
            <div className="font-mono tabular-nums font-semibold text-slate-100">{sunriseLabel}</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 min-w-0">
          <Moon className="w-3.5 h-3.5 text-indigo-300 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-400">Lunar Phase</div>
            <div className="text-[11px] font-medium text-slate-200 truncate">{moonLabel}</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 min-w-0">
          <div className="text-right min-w-0">
            <div className="text-[10px] text-slate-400">Sunset</div>
            <div className="font-mono tabular-nums font-semibold text-slate-100">{sunsetLabel}</div>
          </div>
          <Sunset className="w-3.5 h-3.5 text-orange-400 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
