import {Gift, RotateCw, Sparkles} from 'lucide-react';
import {useMemo, useState} from 'react';

export const WHEEL_DISCOUNT_SLICES = [1, 23, 73, 38, 92, 68, 85, 90, 95, 99, 100] as const;

// Winning pool strictly above 85% in the 90–95% VIP discount band
const WINNING_POOL = [90, 92, 95] as const;

const SLICE_COLORS = [
  '#1e293b',
  '#0f766e',
  '#334155',
  '#1d4ed8',
  '#d97706',
  '#0e7490',
  '#475569',
  '#059669',
  '#e11d48',
  '#4338ca',
  '#0f172a',
];

interface SpinDiscountWheelProps {
  currentDiscount: number | null;
  onWinDiscount: (discountPct: number) => void;
  disabled?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeWedge(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export function SpinDiscountWheel({
  currentDiscount,
  onWinDiscount,
  disabled = false,
}: SpinDiscountWheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);

  const sliceAngle = 360 / WHEEL_DISCOUNT_SLICES.length;

  const slices = useMemo(
    () =>
      WHEEL_DISCOUNT_SLICES.map((pct, index) => {
        const startAngle = index * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const midAngle = startAngle + sliceAngle / 2;
        const labelPos = polarToCartesian(150, 150, 102, midAngle);
        return {
          pct,
          index,
          startAngle,
          endAngle,
          midAngle,
          path: describeWedge(150, 150, 138, startAngle, endAngle),
          labelPos,
          color: SLICE_COLORS[index % SLICE_COLORS.length],
        };
      }),
    [sliceAngle]
  );

  const handleSpin = () => {
    if (spinning || disabled) return;
    const pickedPct = WINNING_POOL[Math.floor(Math.random() * WINNING_POOL.length)];
    const targetIdx = WHEEL_DISCOUNT_SLICES.indexOf(pickedPct);
    const sliceCenterAngle = targetIdx * sliceAngle + sliceAngle / 2;

    // Normalize rotation so target slice center lands directly under top pointer (0 deg)
    const desiredMod = (360 - sliceCenterAngle + 360) % 360;
    const currentMod = ((rotationDeg % 360) + 360) % 360;
    const deltaMod = (desiredMod - currentMod + 360) % 360;
    const extraSpins = 6 * 360;
    const nextRotation = rotationDeg + extraSpins + deltaMod;

    setSpinning(true);
    setRotationDeg(nextRotation);

    window.setTimeout(() => {
      setSpinning(false);
      onWinDiscount(pickedPct);
    }, 4200);
  };

  return (
    <div className="bg-[#0B0E17] border border-amber-500/35 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row items-center gap-6">
      {/* Interactive SVG Spin Wheel */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 shrink-0 flex items-center justify-center">
        {/* Top Pointer Needle */}
        <div
          aria-hidden="true"
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-400 drop-shadow"
        />

        <div
          className="w-full h-full rounded-full border-4 border-slate-700/90 shadow-2xl overflow-hidden"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transition: spinning ? 'transform 4.1s cubic-bezier(0.12, 0.85, 0.18, 1)' : 'none',
          }}
        >
          <svg viewBox="0 0 300 300" className="w-full h-full">
            {slices.map((s) => (
              <g key={`${s.pct}-${s.index}`}>
                <path d={s.path} fill={s.color} stroke="#07090E" strokeWidth="1.5" />
                <text
                  x={s.labelPos.x}
                  y={s.labelPos.y}
                  fill="#f8fafc"
                  fontSize="11.5"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${s.midAngle - 90}, ${s.labelPos.x}, ${s.labelPos.y})`}
                >
                  {s.pct}%
                </text>
              </g>
            ))}
            <circle cx="150" cy="150" r="24" fill="#07090E" stroke="#f59e0b" strokeWidth="3" />
          </svg>
        </div>

        {/* Center Spin Trigger Hub */}
        <button
          type="button"
          onClick={handleSpin}
          disabled={spinning || disabled}
          aria-label="Spin VIP discount wheel"
          className="absolute z-10 w-12 h-12 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] font-mono shadow-lg disabled:opacity-60 flex items-center justify-center transition-colors"
        >
          {spinning ? '...' : 'SPIN'}
        </button>
      </div>

      {/* Spin Copy & Active Discount Readout */}
      <div className="flex-1 space-y-3 text-center lg:text-left">
        <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-amber-400">
          <Gift className="w-3.5 h-3.5" />
          <span>VIP Spin &amp; Save Offer</span>
        </div>

        <h2 className="font-display text-xl sm:text-2xl font-bold text-white text-balance">
          Spin the Wheel for 90%–95% Off Your VIP Pack
        </h2>

        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
          Every spin checks across 1%, 23%, 38%, 68%, 73%, 85%, 90%, 92%, 95%, 99%, and 100% segments and applies your instant VIP discount automatically to the live UPI checkout price.
        </p>

        {currentDiscount !== null ? (
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 inline-flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Unlocked {currentDiscount}% OFF on PRO &amp; VIP Plans!</span>
            </div>
            <span className="text-xs font-mono text-slate-300">
              All plan prices &amp; UPI link updated below.
            </span>
          </div>
        ) : null}

        <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-3">
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || disabled}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-semibold disabled:opacity-60 transition-colors"
          >
            <RotateCw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
            <span>
              {spinning
                ? 'Spinning Wheel...'
                : currentDiscount !== null
                  ? 'Spin Again for Another Offer'
                  : 'Spin Now & Unlock VIP Discount'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
