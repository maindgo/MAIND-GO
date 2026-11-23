import {motion, useReducedMotion} from 'motion/react';
import {useCallback, useEffect, useRef, useState} from 'react';

type IntroStage = 'brand' | 'slogan' | 'loading' | 'exiting';

interface IntroSplashSequenceProps {
  isTelemetryReady: boolean;
  onComplete: () => void;
}

const BRAND_LETTERS = ['M', 'A', 'I', 'N', 'D', ' ', 'G', 'O'];

const LOADING_STEPS = [
  {threshold: 0, label: 'Connecting to live weather satellites'},
  {threshold: 38, label: 'Loading Doppler radar and wind streams'},
  {threshold: 76, label: 'Preparing your interactive forecast map'},
  {threshold: 100, label: 'Launching MAIND GO'},
];

export function IntroSplashSequence({isTelemetryReady, onComplete}: IntroSplashSequenceProps) {
  const prefersReducedMotion = useReducedMotion();
  const [stage, setStage] = useState<IntroStage>('brand');
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);
  const telemetryReadyRef = useRef(isTelemetryReady);

  useEffect(() => {
    telemetryReadyRef.current = isTelemetryReady;
  }, [isTelemetryReady]);

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setStage('exiting');
    window.setTimeout(() => {
      onComplete();
    }, prefersReducedMotion ? 120 : 480);
  }, [onComplete, prefersReducedMotion]);

  // Stage progression: 1) MAIND GO -> 2) Slogan -> 3) Loading Screen
  useEffect(() => {
    if (prefersReducedMotion) {
      const t1 = window.setTimeout(() => setStage('slogan'), 450);
      const t2 = window.setTimeout(() => setStage('loading'), 1100);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }

    const brandTimer = window.setTimeout(() => {
      setStage('slogan');
    }, 1750);

    const loadingTimer = window.setTimeout(() => {
      setStage('loading');
    }, 3950);

    return () => {
      window.clearTimeout(brandTimer);
      window.clearTimeout(loadingTimer);
    };
  }, [prefersReducedMotion]);

  // Smooth calibrated loading progression once Stage 3 starts
  useEffect(() => {
    if (stage !== 'loading') return;

    const startTime = performance.now();
    const minDurationMs = prefersReducedMotion ? 700 : 2100;
    const maxHoldCap = 92;
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const timeFraction = Math.min(1, elapsed / minDurationMs);
      const eased = 1 - Math.pow(1 - timeFraction, 3);

      let nextProgress = Math.round(eased * 100);
      if (!telemetryReadyRef.current && elapsed < minDurationMs + 1400) {
        nextProgress = Math.min(maxHoldCap, nextProgress);
      }

      setProgress(nextProgress);

      if (nextProgress >= 100 && timeFraction >= 1) {
        window.setTimeout(() => {
          finishIntro();
        }, prefersReducedMotion ? 80 : 260);
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [stage, prefersReducedMotion, finishIntro]);

  const currentLoadingLabel =
    [...LOADING_STEPS].reverse().find((step) => progress >= step.threshold)?.label ??
    LOADING_STEPS[0].label;

  const showSlogan = stage === 'slogan' || stage === 'loading' || stage === 'exiting';
  const showLoading = stage === 'loading' || stage === 'exiting';

  return (
    <motion.div
      initial={{opacity: 1}}
      animate={{
        opacity: stage === 'exiting' ? 0 : 1,
        scale: stage === 'exiting' && !prefersReducedMotion ? 1.02 : 1,
      }}
      transition={{duration: prefersReducedMotion ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1]}}
      role="region"
      aria-label="MAIND GO introduction"
      className="fixed inset-0 z-[100] bg-[#07090E] text-slate-100 flex flex-col items-center justify-between px-6 py-8 sm:py-10 overflow-hidden select-none"
    >
        {/* Atmospheric Radial Radar & Orbital Geometry Backdrop */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 48%, rgba(6, 182, 212, 0.11) 0%, rgba(11, 14, 23, 0.55) 42%, rgba(7, 9, 14, 1) 78%)',
            }}
          />

          {/* Concentric orbital radar rings */}
          <motion.div
            initial={{opacity: 0, scale: 0.72}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 1.4, ease: [0.16, 1, 0.3, 1]}}
            className="relative flex items-center justify-center"
          >
            <div className="w-[300px] h-[300px] sm:w-[460px] sm:h-[460px] rounded-full border border-cyan-500/12" />
            <div className="absolute w-[440px] h-[440px] sm:w-[680px] sm:h-[680px] rounded-full border border-slate-700/25" />
            <div className="absolute w-[600px] h-[600px] sm:w-[920px] sm:h-[920px] rounded-full border border-slate-800/30" />

            {/* Subtle rotating radar sweep arc */}
            {!prefersReducedMotion && (
              <motion.div
                animate={{rotate: 360}}
                transition={{duration: 14, repeat: Infinity, ease: 'linear'}}
                className="absolute w-[300px] h-[300px] sm:w-[460px] sm:h-[460px] rounded-full"
                style={{
                  background:
                    'conic-gradient(from 0deg, rgba(6, 182, 212, 0.22) 0deg, rgba(6, 182, 212, 0.04) 48deg, transparent 78deg, transparent 360deg)',
                  maskImage: 'radial-gradient(circle, transparent 42%, black 43%, black 100%)',
                  WebkitMaskImage: 'radial-gradient(circle, transparent 42%, black 43%, black 100%)',
                }}
              />
            )}
          </motion.div>
        </div>

        {/* Top spacer for balanced vertical framing */}
        <div className="h-10 shrink-0" aria-hidden="true" />

        {/* Central Focal Anchor: Brand -> Slogan -> Loading */}
        <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center">
          {/* Precision Satellite / Compass Emblem */}
          <motion.div
            initial={{opacity: 0, scale: 0.65, y: 12}}
            animate={{
              opacity: 1,
              scale: showLoading ? 0.88 : 1,
              y: showSlogan ? -6 : 0,
            }}
            transition={{duration: 0.85, ease: [0.16, 1, 0.3, 1]}}
            className="mb-6 relative flex items-center justify-center"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0B0E17] border border-cyan-500/35 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.16)]">
              <svg
                viewBox="0 0 48 48"
                className="w-9 h-9 sm:w-11 sm:h-11 text-cyan-400"
                fill="none"
                aria-hidden="true"
              >
                <motion.circle
                  cx="24"
                  cy="24"
                  r="17"
                  stroke="currentColor"
                  strokeOpacity="0.32"
                  strokeWidth="1.5"
                  initial={{pathLength: 0}}
                  animate={{pathLength: 1}}
                  transition={{duration: 1.1, ease: [0.16, 1, 0.3, 1]}}
                />
                <motion.path
                  d="M24 7V12M24 36V41M7 24H12M36 24H41"
                  stroke="currentColor"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  transition={{delay: 0.3, duration: 0.6}}
                />
                <motion.path
                  d="M29.5 18.5L26 26L18.5 29.5L22 22L29.5 18.5Z"
                  fill="currentColor"
                  fillOpacity="0.22"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                  initial={{scale: 0.6, opacity: 0}}
                  animate={{scale: 1, opacity: 1}}
                  transition={{delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1]}}
                />
                <circle cx="24" cy="24" r="2" fill="#22D3EE" />
              </svg>
            </div>
          </motion.div>

          {/* Stage 1: MAIND GO Kinetic Brand Reveal */}
          <motion.h1
            animate={{y: showSlogan ? -6 : 0}}
            transition={{duration: 0.7, ease: [0.16, 1, 0.3, 1]}}
            className="font-display font-bold tracking-tight text-white flex items-center justify-center flex-wrap"
            style={{fontSize: 'clamp(2.5rem, 6.5vw, 4.5rem)', lineHeight: 1.05}}
            aria-label="MAIND GO"
          >
            {BRAND_LETTERS.map((char, idx) =>
              char === ' ' ? (
                <span key={`space-${idx}`} className="w-3 sm:w-4 inline-block" aria-hidden="true" />
              ) : (
                <motion.span
                  key={`${char}-${idx}`}
                  initial={{opacity: 0, y: 20}}
                  animate={{opacity: 1, y: 0}}
                  transition={{
                    delay: prefersReducedMotion ? 0 : 0.18 + idx * 0.065,
                    duration: prefersReducedMotion ? 0.2 : 0.65,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={idx >= 6 ? 'text-cyan-400' : 'text-white'}
                >
                  {char}
                </motion.span>
              )
            )}
          </motion.h1>

          {/* Calibrated Horizon Hairline */}
          <motion.div
            initial={{scaleX: 0, opacity: 0}}
            animate={{
              scaleX: showSlogan ? 1 : 0.28,
              opacity: showSlogan ? 1 : 0.45,
            }}
            transition={{duration: 0.75, ease: [0.16, 1, 0.3, 1]}}
            className="mt-5 mb-5 h-px w-48 sm:w-64 origin-center bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent"
          />

          {/* Stage 2: Persuasive App Slogan */}
          <div className="min-h-[104px] sm:min-h-[112px] flex flex-col items-center justify-start">
            {showSlogan && (
              <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: prefersReducedMotion ? 0.2 : 0.8, ease: [0.16, 1, 0.3, 1]}}
                className="space-y-3 max-w-xl"
              >
                <p
                  className="font-display font-semibold text-slate-100 text-balance"
                  style={{fontSize: 'clamp(1.375rem, 3.2vw, 2.125rem)', lineHeight: 1.2}}
                >
                  See Every Storm Before It Arrives.
                </p>
                <motion.p
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{
                    delay: prefersReducedMotion ? 0 : 0.25,
                    duration: prefersReducedMotion ? 0.2 : 0.7,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg mx-auto"
                >
                  Live satellite radar, animated wind streamlines, and hyperlocal forecasts—built for every mile ahead.
                </motion.p>
              </motion.div>
            )}
          </div>

          {/* Stage 3: Calibrated Loading Screen */}
          <div className="mt-8 w-full max-w-sm min-h-[82px] flex flex-col items-center justify-start">
            {showLoading && (
              <motion.div
                initial={{opacity: 0, y: 12}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: prefersReducedMotion ? 0.2 : 0.55, ease: [0.16, 1, 0.3, 1]}}
                className="w-full space-y-2.5"
                aria-live="polite"
              >
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-slate-300 truncate">{currentLoadingLabel}</span>
                  <span className="font-mono tabular-nums font-semibold text-cyan-300 shrink-0">
                    {progress}%
                  </span>
                </div>

                {/* Progress Track using compositor-only scaleX */}
                <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden border border-slate-700/60">
                  <div
                    className="h-full w-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-300 origin-left transition-transform duration-150 ease-out"
                    style={{transform: `scaleX(${Math.max(0.02, progress / 100)})`}}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Bottom Quiet Control */}
        <div className="relative z-10 flex items-center justify-center">
          <button
            type="button"
            onClick={finishIntro}
            className="min-h-[44px] px-5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg whitespace-nowrap"
          >
            Skip intro
          </button>
        </div>
    </motion.div>
  );
}
