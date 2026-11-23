import {
  Bug,
  CloudSun,
  Compass,
  Globe2,
  Headphones,
  LayoutGrid,
  LogIn,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Zap,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {useAuth} from '../context/AuthContext';

interface MaintenancePageProps {
  initialAdminRoute?: boolean;
  onEnterAdminApp?: () => void;
}

const MARQUEE_TEXT =
  'NEW UPDATE COMING SOON • WITH THE BEST EXPERIENCE • HAVE ANY QUERY OR SUGGESTION ABOUT IMPROVEMENT OF THE PAGE? CONTACT US ON support.maindgo@gmail.com';

const NEW_UPDATES_ITEMS = [
  {
    title: 'Complete UI Redesign',
    icon: LayoutGrid,
    description: 'Precision dark glass interface with clearer atmospheric telemetry hierarchy.',
  },
  {
    title: 'Weather Sounds – Feel the Weather',
    icon: Headphones,
    description: 'Ambient sunny birds, rainfall, thunder, ocean waves, and forest soundscapes.',
  },
  {
    title: 'Guest Mode',
    icon: UserCheck,
    description: 'Explore live radar, search global cities, and inspect forecasts without login.',
  },
  {
    title: 'Bug Fixes',
    icon: Bug,
    description: 'Resolved alert polling spikes, overlay glitches, and session edge cases.',
  },
  {
    title: 'Performance Improvements',
    icon: Zap,
    description: 'Faster initial startup, reduced network overhead, and lighter asset loading.',
  },
  {
    title: 'Advanced Weather Experience',
    icon: CloudSun,
    description: 'Full-screen Weather Experience Mode, 7-day breakdown, and shareable reports.',
  },
  {
    title: 'Improved Mobile Experience',
    icon: Smartphone,
    description: 'Cleaner mobile drawers, touch-friendly controls, and PWA installation support.',
  },
  {
    title: 'New Features Coming Soon',
    icon: Sparkles,
    description: 'Continuous atmospheric intelligence upgrades preparing for launch.',
  },
];

export function MaintenancePage({initialAdminRoute = false, onEnterAdminApp}: MaintenancePageProps) {
  const {firebaseUser, isAdmin, authBusy, authError, signInWithGoogle, signOutUser, maintenanceConfig} =
    useAuth();

  const [showAdminPanel, setShowAdminPanel] = useState(initialAdminRoute);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync URL signal if admin query/path was visited
  useEffect(() => {
    if (initialAdminRoute) {
      setShowAdminPanel(true);
    }
  }, [initialAdminRoute]);

  // Subtle animated Earth starfield & atmospheric particles canvas background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({length: 85}, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.7 + Math.random() * 1.4,
      vy: 0.08 + Math.random() * 0.16,
      alpha: 0.2 + Math.random() * 0.65,
    }));

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        ctx.fillStyle = `rgba(186, 230, 253, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (!prefersReducedMotion) {
          s.y -= s.vy;
          if (s.y < -5) {
            s.y = h + 5;
            s.x = Math.random() * w;
          }
        }
      }

      if (!prefersReducedMotion) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#040710] text-slate-100 flex flex-col relative overflow-x-hidden">
      {/* Animated Starfield Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" aria-hidden="true" />

      {/* Glowing Orbital Earth Horizon Visual */}
      <div
        className="fixed inset-x-0 -bottom-[52vw] sm:-bottom-[56vw] h-[75vw] rounded-[100%] pointer-events-none z-0 border-t border-cyan-400/35"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(34,211,238,0.18) 0%, rgba(14,116,144,0.12) 28%, rgba(4,7,16,0.98) 70%)',
          boxShadow: '0 -20px 120px rgba(34, 211, 238, 0.22)',
        }}
        aria-hidden="true"
      />

      {/* Ambient Atmospheric Glow Orbs */}
      <div
        className="fixed top-20 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none z-0"
        aria-hidden="true"
      />
      <div
        className="fixed top-1/3 -right-24 w-96 h-96 rounded-full bg-indigo-500/12 blur-[140px] pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* 1. MOVING RIGHT-TO-LEFT ANNOUNCEMENT BANNER */}
      <div
        role="region"
        aria-label="Maintenance announcement"
        className="maingo-marquee-wrap sticky top-0 z-30 w-full bg-[#080F1E]/95 backdrop-blur-md border-b border-cyan-500/30 py-2.5 overflow-hidden select-none"
      >
        <div className="maingo-marquee-track items-center text-xs sm:text-sm font-mono tracking-wide text-cyan-200">
          <span className="px-8 whitespace-nowrap inline-flex items-center gap-2">
            <span>{MARQUEE_TEXT.replace('support.maindgo@gmail.com', '')}</span>
            <a
              href="mailto:support.maindgo@gmail.com"
              className="underline decoration-cyan-400/70 underline-offset-4 text-white hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-0.5"
            >
              support.maindgo@gmail.com
            </a>
          </span>
          <span
            aria-hidden="true"
            className="maingo-marquee-duplicate px-8 whitespace-nowrap inline-flex items-center gap-2"
          >
            <span>{MARQUEE_TEXT.replace('support.maindgo@gmail.com', '')}</span>
            <span className="underline decoration-cyan-400/70 underline-offset-4 text-white">
              support.maindgo@gmail.com
            </span>
          </span>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-12">
        {/* 2. HERO MAINTENANCE SECTION */}
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="maingo-orbit-ring absolute inset-0 rounded-full border border-dashed border-cyan-400/45" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-indigo-500/20 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_35px_rgba(34,211,238,0.28)]">
                <Globe2 className="w-7 h-7 text-cyan-300" aria-hidden="true" />
              </div>
            </div>

            <div className="font-display text-lg sm:text-xl font-bold tracking-[0.22em] text-cyan-300 uppercase">
              MAIND GO
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white [text-wrap:balance] drop-shadow-[0_0_24px_rgba(34,211,238,0.2)]">
              NEW UPDATE COMING SOON
            </h1>
            <p className="font-display text-lg sm:text-2xl font-medium text-cyan-200">
              Something Amazing Is Coming!
            </p>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
              We&apos;re upgrading your experience. MAIND GO is getting a brand-new look with exciting features and an even better weather experience. We&apos;ll be back soon!
            </p>
            {maintenanceConfig.message && (
              <p className="text-xs sm:text-sm font-mono text-cyan-300/90 pt-1">
                {maintenanceConfig.message}
              </p>
            )}
          </div>
        </section>

        {/* 3. NEW UPDATES SECTION */}
        <section aria-labelledby="new-updates-heading" className="space-y-5">
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-cyan-500/50" />
            <h2
              id="new-updates-heading"
              className="font-display text-xl sm:text-2xl font-bold tracking-wider text-white uppercase text-center"
            >
              NEW UPDATES
            </h2>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-cyan-500/50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {NEW_UPDATES_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="group bg-[#0B111E]/85 backdrop-blur-md border border-slate-800/90 hover:border-cyan-500/45 rounded-xl p-4 space-y-2.5 transition-colors shadow-lg"
                >
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 group-hover:bg-cyan-500/20 transition-colors">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-white leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. CONTACT AND SUPPORT SECTION */}
        <section
          aria-labelledby="support-heading"
          className="max-w-2xl mx-auto bg-[#0B111E]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-2xl"
        >
          <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center mx-auto text-cyan-300">
            <Mail className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 id="support-heading" className="font-display text-xl sm:text-2xl font-bold text-white">
            Have a Question or Suggestion?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            We&apos;d love to hear your feedback and ideas for improving MAIND GO.
          </p>
          <div className="pt-1">
            <a
              href="mailto:support.maindgo@gmail.com"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs sm:text-sm hover:bg-cyan-400 transition-colors shadow-[0_0_25px_rgba(34,211,238,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>support.maindgo@gmail.com</span>
            </a>
          </div>
        </section>

        {/* 5. AUTHORIZED ADMIN ACCESS PANEL (Accessible via /admin, ?admin=1, or discreet footer toggle) */}
        {showAdminPanel && (
          <section
            aria-label="Authorized Administrator Access"
            className="max-w-md mx-auto bg-[#0B0E17]/95 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-white">
                  Authorized Admin Access
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminPanel(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {!firebaseUser ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Public visitors cannot access the platform while Maintenance Mode is active. Sign in with the verified administrator Google account to manage maintenance settings and access the dashboard.
                </p>
                {authError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-200">
                    {authError}
                  </div>
                )}
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void signInWithGoogle()}
                  className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-white text-slate-950 text-xs sm:text-sm font-semibold hover:bg-slate-100 disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>{authBusy ? 'Authenticating...' : 'Admin Sign In with Google'}</span>
                </button>
              </div>
            ) : isAdmin ? (
              <div className="space-y-3">
                <p className="text-xs text-emerald-300">
                  Verified administrator session active ({firebaseUser.email}).
                </p>
                {onEnterAdminApp && (
                  <button
                    type="button"
                    onClick={onEnterAdminApp}
                    className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-cyan-500 text-slate-950 text-xs sm:text-sm font-semibold hover:bg-cyan-400 inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <Compass className="w-4 h-4" aria-hidden="true" />
                    <span>Open Admin Dashboard</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-700/50 flex items-start gap-2.5 text-xs text-rose-200">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Signed in as {firebaseUser.email}. Only authorized administrators can bypass Maintenance Mode.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/70 bg-[#050811]/85 backdrop-blur-sm py-5 px-4 text-center space-y-2">
        <p className="text-xs sm:text-sm font-medium text-slate-200">
          Thank you for being a part of MAIND GO ❤️
        </p>
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
          <span>MAIND GO Atmospheric Platform</span>
          <span>·</span>
          <button
            type="button"
            onClick={() => setShowAdminPanel((prev) => !prev)}
            className="text-slate-400 hover:text-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1"
          >
            Admin Access
          </button>
        </div>
      </footer>
    </div>
  );
}
