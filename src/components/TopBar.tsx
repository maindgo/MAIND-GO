import {Bookmark, Crown, Globe, LocateFixed, User} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {AppPage} from '../types/weather';

interface TopBarProps {
  activePage: AppPage;
  onSelectPage: (page: AppPage) => void;
  onEnableLocation: () => void;
  isLocating: boolean;
  hasLiveLocation: boolean;
  alertCount: number;
  trialSecondsLeft: number | null;
}

export function TopBar({
  activePage,
  onSelectPage,
  onEnableLocation,
  isLocating,
  hasLiveLocation,
  alertCount,
  trialSecondsLeft,
}: TopBarProps) {
  const {
    firebaseUser,
    userAccount,
    isConfirmedPremium,
    isConfirmedVip,
    hasPendingPayment,
    savedLocations,
  } = useAuth();

  const navItems: Array<{id: AppPage; label: string; icon: typeof Globe}> = [
    {id: 'map', label: 'Live Map', icon: Globe},
    {
      id: 'saved',
      label: firebaseUser ? `Saved (${savedLocations.length})` : 'Saved',
      icon: Bookmark,
    },
    {
      id: 'vip',
      label: isConfirmedVip
        ? 'VIP Active'
        : isConfirmedPremium
          ? 'PRO Active'
          : hasPendingPayment
            ? 'VIP · Queued'
            : 'VIP & Plans',
      icon: Crown,
    },
    {
      id: 'account',
      label: firebaseUser
        ? userAccount?.displayName?.split(' ')[0] || 'Account'
        : trialSecondsLeft !== null && trialSecondsLeft > 0
          ? `Login (${trialSecondsLeft}s)`
          : 'Sign Up / Login',
      icon: User,
    },
  ];

  return (
    <header className="h-14 px-4 sm:px-6 bg-[#07090E] border-b border-slate-800/80 flex items-center justify-between gap-8 shrink-0 z-30">
      {/* Zone 1: Wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectPage('map');
        }}
        className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
      >
        MAIND GO
      </a>

      {/* Zone 2: Multi-Page Navigation */}
      <nav aria-label="Primary pages" className="hidden md:flex items-center gap-6">
        {navItems.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPage(item.id)}
              className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded ${
                active ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
              {item.id === 'map' && alertCount > 0 ? ` (${alertCount})` : ''}
              <span
                className={`absolute left-0 right-0 -bottom-0.5 h-0.5 bg-cyan-400 transition-opacity duration-150 ${
                  active ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Primary GPS Action */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            onSelectPage('map');
            onEnableLocation();
          }}
          disabled={isLocating}
          className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            hasLiveLocation
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25'
              : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
          } disabled:opacity-60`}
        >
          <LocateFixed className={`w-4 h-4 shrink-0 ${isLocating ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isLocating ? 'Locating...' : hasLiveLocation ? 'My Location' : 'Enable Location'}</span>
        </button>
      </div>
    </header>
  );
}
