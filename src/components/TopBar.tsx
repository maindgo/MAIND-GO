import {
  Bell,
  BellRing,
  Bookmark,
  Crown,
  Globe,
  LocateFixed,
  Maximize2,
  User,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {NotificationPermissionState} from '../services/notificationService';
import {AppPage} from '../types/weather';
import {PWAInstallButton} from './PWAInstallButton';

interface TopBarProps {
  activePage: AppPage;
  onSelectPage: (page: AppPage) => void;
  onEnableLocation: () => void;
  isLocating: boolean;
  hasLiveLocation: boolean;
  alertCount: number;
  voiceAlertsEnabled: boolean;
  onToggleVoiceAlerts: () => void;
  notificationPermission: NotificationPermissionState;
  phoneNotificationsEnabled: boolean;
  onRequestPhoneNotifications: () => void;
  onTogglePhoneNotifications: () => void;
  onTriggerTestAlert: () => void;
  monitoredLocationCount: number;
  canOpenExperience: boolean;
  onOpenExperience: () => void;
}

export function TopBar({
  activePage,
  onSelectPage,
  onEnableLocation,
  isLocating,
  hasLiveLocation,
  alertCount,
  voiceAlertsEnabled,
  onToggleVoiceAlerts,
  notificationPermission,
  phoneNotificationsEnabled,
  onRequestPhoneNotifications,
  onTogglePhoneNotifications,
  onTriggerTestAlert,
  monitoredLocationCount,
  canOpenExperience,
  onOpenExperience,
}: TopBarProps) {
  const {
    firebaseUser,
    isAdmin,
    userAccount,
    isConfirmedPremium,
    isConfirmedVip,
    hasPendingPayment,
    savedLocations,
    maintenanceConfig,
  } = useAuth();

  const [alertsMenuOpen, setAlertsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!alertsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setAlertsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [alertsMenuOpen]);

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
        : 'Sign In',
      icon: User,
    },
  ];

  const isPhoneBarActive = notificationPermission === 'granted' && phoneNotificationsEnabled;

  return (
    <header className="h-14 px-3 sm:px-6 bg-[#070B14]/95 backdrop-blur-xl border-b border-slate-800/80 flex items-center justify-between gap-3 sm:gap-6 shrink-0 z-30">
      {/* Zone 1: Wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectPage('map');
        }}
        className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
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

      {/* Zone 3: PWA Install, Alerts/Voice, Experience Mode & Primary GPS Action */}
      <div className="flex items-center gap-2 shrink-0">
        {isAdmin && maintenanceConfig.enabled && (
          <button
            type="button"
            onClick={() => onSelectPage('account')}
            title="Maintenance Mode is ON for public visitors — click to manage"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[38px] rounded-lg bg-amber-500/15 border border-amber-500/50 text-amber-200 hover:bg-amber-500/25 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline">Maintenance ON</span>
          </button>
        )}

        <PWAInstallButton />

        {canOpenExperience && (
          <button
            type="button"
            onClick={onOpenExperience}
            title="Full-screen Weather Experience Mode"
            aria-label="Open full-screen Weather Experience Mode"
            className="inline-flex items-center gap-1.5 p-2 sm:px-3 min-h-[38px] rounded-lg bg-[#111827] border border-slate-800 hover:border-cyan-500/50 text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline">Experience</span>
          </button>
        )}

        <div ref={menuContainerRef} className="relative">
          <button
            type="button"
            onClick={() => setAlertsMenuOpen((prev) => !prev)}
            aria-expanded={alertsMenuOpen}
            aria-label="Alert voice and mobile notification settings"
            className={`relative inline-flex items-center gap-1.5 p-2 sm:px-3 min-h-[38px] rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              alertCount > 0
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 hover:bg-amber-500/25'
                : isPhoneBarActive
                  ? 'bg-[#111827] border-slate-700 text-cyan-300 hover:border-slate-600'
                  : 'bg-[#111827] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
          >
            {alertCount > 0 || isPhoneBarActive ? (
              <BellRing className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Alerts</span>
            {alertCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-bold leading-none tabular-nums">
                {alertCount}
              </span>
            )}
          </button>

          {alertsMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-[#0B0E17] border border-slate-700/90 rounded-xl shadow-2xl p-4 space-y-3.5 z-50">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-white">Real-Time Weather Alert Settings</h3>
                <p className="text-[11px] text-slate-400">
                  Monitoring {monitoredLocationCount}{' '}
                  {monitoredLocationCount === 1 ? 'location' : 'locations'}.
                </p>
              </div>

              {/* Web Speech API TTS Toggle */}
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#111827] border border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  {voiceAlertsEnabled ? (
                    <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-100">Voice Alert Summary</div>
                    <div className="text-[11px] text-slate-400">Auto-speak alerts via Web Speech API</div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={voiceAlertsEnabled}
                  onClick={onToggleVoiceAlerts}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 ${
                    voiceAlertsEnabled
                      ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {voiceAlertsEnabled ? 'On' : 'Muted'}
                </button>
              </div>

              {/* Mobile Phone Notification Bar Permission */}
              <div className="p-2.5 rounded-lg bg-[#111827] border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-100">Phone Notification Bar</div>
                    <div className="text-[11px] text-slate-400">
                      {notificationPermission === 'granted'
                        ? phoneNotificationsEnabled
                          ? 'Active on mobile notification tray'
                          : 'Paused by preference'
                        : notificationPermission === 'denied'
                          ? 'Blocked in browser site settings'
                          : notificationPermission === 'unsupported'
                            ? 'Not supported on this browser'
                            : 'Allow OS notification bar alerts'}
                    </div>
                  </div>
                  {notificationPermission === 'granted' ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={phoneNotificationsEnabled}
                      onClick={onTogglePhoneNotifications}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 ${
                        phoneNotificationsEnabled
                          ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {phoneNotificationsEnabled ? 'On' : 'Off'}
                    </button>
                  ) : notificationPermission === 'default' ? (
                    <button
                      type="button"
                      onClick={onRequestPhoneNotifications}
                      className="px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 text-[11px] font-semibold hover:bg-amber-300 transition-colors shrink-0"
                    >
                      Enable
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Test Alert Pipeline Button */}
              <button
                type="button"
                onClick={() => {
                  setAlertsMenuOpen(false);
                  onTriggerTestAlert();
                }}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-100 flex items-center justify-center gap-2 transition-colors"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>Send Test Flash Flood Alert</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectPage('map');
            onEnableLocation();
          }}
          disabled={isLocating}
          className={`inline-flex items-center gap-1.5 px-3 sm:px-4 min-h-[38px] text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            hasLiveLocation
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25'
              : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
          } disabled:opacity-60`}
        >
          <LocateFixed className={`w-4 h-4 shrink-0 ${isLocating ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span className="hidden sm:inline">
            {isLocating ? 'Locating...' : hasLiveLocation ? 'My Location' : 'Enable Location'}
          </span>
        </button>
      </div>
    </header>
  );
}
