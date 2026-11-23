import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {HourlyForecastItem, UnitSystem} from '../types/weather';
import {formatSpeedValue, formatTempValue, speedUnitLabel, tempUnitLabel} from '../utils/weatherFormat';

interface HourlyChartProps {
  hourly: HourlyForecastItem[];
  units: UnitSystem;
}

interface ChartDatum {
  hour: string;
  date: string;
  temp: number;
  feelsLike: number;
  precipProb: number;
  condition: string;
  windSpeed: number;
  windCardinal: string;
}

interface TooltipPayloadEntry {
  payload?: ChartDatum;
}

function HourlyChartTooltip({
  active,
  payload,
  units,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  units: UnitSystem;
}) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }

  const d = payload[0].payload;
  const unit = tempUnitLabel(units);

  return (
    <div className="bg-[#0B0E17]/95 border border-slate-700/90 rounded-lg px-3 py-2 shadow-2xl text-xs space-y-1 pointer-events-none">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
        <span className="font-mono tabular-nums font-semibold text-white">
          {d.hour}
          {d.date ? ` · ${d.date}` : ''}
        </span>
        <span className="text-slate-400 truncate max-w-[130px]">{d.condition}</span>
      </div>
      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="text-slate-400">Temperature</span>
        <span className="text-cyan-300 font-semibold">
          {d.temp}
          {unit}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="text-slate-400">Feels like</span>
        <span className="text-slate-200">
          {d.feelsLike}
          {unit}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="text-slate-400">Rain chance</span>
        <span className="text-sky-400">{d.precipProb}%</span>
      </div>
      <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
        <span className="text-slate-400">Wind</span>
        <span className="text-slate-300">
          {d.windSpeed} {speedUnitLabel(units)} {d.windCardinal}
        </span>
      </div>
    </div>
  );
}

export function HourlyTemperatureChart({hourly, units}: HourlyChartProps) {
  const slice = hourly.slice(0, 24);
  if (slice.length < 2) return null;

  const data: ChartDatum[] = slice.map((h) => ({
    hour: h.localHourLabel,
    date: h.localDateLabel,
    temp: formatTempValue(h.temperatureC, units),
    feelsLike: formatTempValue(h.feelsLikeC, units),
    precipProb: Math.max(0, Math.min(100, Math.round(h.precipProb))),
    condition: h.conditionDescription,
    windSpeed: formatSpeedValue(h.windSpeedKmh, units),
    windCardinal: h.windCardinal,
  }));

  const temps = data.map((d) => d.temp);
  const minVal = Math.min(...temps);
  const maxVal = Math.max(...temps);
  const yMin = minVal - 2;
  const yMax = maxVal + 2;
  const unit = tempUnitLabel(units);

  return (
    <div className="select-none">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-2">
        <span>24-Hour Temperature Trend ({unit})</span>
        <span className="font-mono tabular-nums text-slate-400">
          <span className="text-cyan-300">{maxVal}°</span> / <span className="text-sky-300">{minVal}°</span> · Next 24h
        </span>
      </div>

      <div className="w-full h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{top: 8, right: 6, left: -24, bottom: 0}}>
            <defs>
              <linearGradient id="maingoRechartsTempGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#22D3EE" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="hour"
              tick={{fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace'}}
              tickLine={false}
              axisLine={{stroke: 'rgba(148,163,184,0.18)'}}
              interval={3}
              minTickGap={16}
            />

            <YAxis
              yAxisId="temp"
              domain={[yMin, yMax]}
              tick={{fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace'}}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${Math.round(v)}°`}
              allowDecimals={false}
            />

            <YAxis yAxisId="precip" orientation="right" domain={[0, 100]} hide />

            <Tooltip
              content={<HourlyChartTooltip units={units} />}
              cursor={{stroke: 'rgba(34, 211, 238, 0.45)', strokeDasharray: '3 3', strokeWidth: 1}}
            />

            <Bar
              yAxisId="precip"
              dataKey="precipProb"
              barSize={6}
              radius={[2, 2, 0, 0]}
              fill="rgba(56, 189, 248, 0.25)"
              isAnimationActive={false}
            />

            <Area
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              stroke="#22D3EE"
              strokeWidth={2.2}
              fill="url(#maingoRechartsTempGrad)"
              activeDot={{r: 4, fill: '#22D3EE', stroke: '#07090E', strokeWidth: 1.5}}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface WindCompassProps {
  directionDeg: number;
  cardinal: string;
  speedKmh: number;
  gustKmh: number;
  units: UnitSystem;
}

export function WindCompass({directionDeg, cardinal, speedKmh, gustKmh, units}: WindCompassProps) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="relative w-14 h-14 shrink-0">
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
          <text x="32" y="10" textAnchor="middle" className="fill-slate-500 text-[7px] font-mono">
            N
          </text>
          <text x="56" y="34.5" textAnchor="middle" className="fill-slate-500 text-[7px] font-mono">
            E
          </text>
          <text x="32" y="59" textAnchor="middle" className="fill-slate-500 text-[7px] font-mono">
            S
          </text>
          <text x="8" y="34.5" textAnchor="middle" className="fill-slate-500 text-[7px] font-mono">
            W
          </text>
          <g transform={`rotate(${directionDeg} 32 32)`}>
            <line x1="32" y1="48" x2="32" y2="16" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
            <polygon points="32,12 27.5,21 36.5,21" fill="#22D3EE" />
          </g>
        </svg>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold font-mono tabular-nums text-slate-100">
            {formatSpeedValue(speedKmh, units)}
          </span>
          <span className="text-xs font-mono text-slate-400">{speedUnitLabel(units)}</span>
        </div>
        <div className="text-xs text-slate-400 font-mono tabular-nums">
          {cardinal} ({Math.round(directionDeg)}°) · Gust {formatSpeedValue(gustKmh, units)} {speedUnitLabel(units)}
        </div>
      </div>
    </div>
  );
}
