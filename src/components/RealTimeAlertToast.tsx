import {
  AlertTriangle,
  BellRing,
  Bookmark,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  ShieldAlert,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {NotificationPermissionState} from '../services/notificationService';
import {WeatherAlertItem} from '../types/weather';

export interface RealTimeAlertToastItem {
  id: string;
  alert: WeatherAlertItem;
  locationName: string;
  lat: number;
  lng: number;
  sourceTag: 'current' | 'saved' | 'viewed';
  triggeredAtMs: number;
  isTest?: boolean;
}

interface RealTimeAlertToastProps {
  toasts: RealTimeAlertToastItem[];
  isSpeaking: boolean;
  speakingAlertId: string | null;
  speechBlockedNotice: string | null;
  notificationPermission: NotificationPermissionState;
  onSpeakAlert: (toast: RealTimeAlertToastItem) => void;
  onStopSpeech: () => void;
  onViewLocation: (toast: RealTimeAlertToastItem) => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onEnablePhoneNotifications: () => void;
}

function getToastTheme(severity: string) {
  const s = severity.toUpperCase();
  if (s === 'EXTREME') {
    return {
      Icon: ShieldAlert,
      border: 'border-rose-500/75',
      accentBg: 'bg-rose-500/15',
      iconColor: 'text-rose-400',
      badge: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
      label: 'Extreme Alert',
    };
  }
  if (s === 'SEVERE') {
    return {
      Icon: AlertTriangle,
      border: 'border-amber-500/75',
      accentBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
      label: 'Severe Warning',
    };
  }
  if (s === 'MODERATE') {
    return {
      Icon: AlertTriangle,
      border: 'border-amber-600/60',
      accentBg: 'bg-amber-500/10',
      iconColor: 'text-amber-300',
      badge: 'bg-amber-500/15 text-amber-200 border-amber-600/35',
      label: 'Moderate Advisory',
    };
  }
  return {
    Icon: BellRing,
    border: 'border-cyan-500/60',
    accentBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-300',
    badge: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/35',
    label: 'Weather Alert',
  };
}

export function RealTimeAlertToast({
  toasts,
  isSpeaking,
  speakingAlertId,
  speechBlockedNotice,
  notificationPermission,
  onSpeakAlert,
  onStopSpeech,
  onViewLocation,
  onDismiss,
  onDismissAll,
  onEnablePhoneNotifications,
}: RealTimeAlertToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      aria-label="Real-time severe weather alert notifications"
      className="fixed top-16 left-3 right-3 sm:left-auto sm:right-4 sm:w-[420px] z-50 space-y-2.5 pointer-events-none max-h-[calc(100vh-8rem)] overflow-y-auto maingo-scroll"
    >
      {toasts.length > 1 && (
        <div className="pointer-events-auto flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#0B0E17]/95 border border-slate-700/80 backdrop-blur-md text-[11px] text-slate-300 shadow-lg">
          <span className="font-medium text-amber-200">
            {toasts.length} Live Weather Alerts Received
          </span>
          <button
            type="button"
            onClick={onDismissAll}
            className="text-slate-400 hover:text-white transition-colors font-medium"
          >
            Dismiss all
          </button>
        </div>
      )}

      {toasts.map((toast) => {
        const theme = getToastTheme(toast.alert.severity);
        const SeverityIcon = theme.Icon;
        const isThisSpeaking = isSpeaking && speakingAlertId === toast.alert.alertId;
        const summaryLine =
          toast.alert.instruction?.[0] ||
          toast.alert.safetyRecommendations?.[0]?.directive ||
          toast.alert.description ||
          'Inspect live radar and safety directives for this location.';

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto rounded-xl bg-[#0B0E17]/95 backdrop-blur-md border ${theme.border} shadow-2xl p-3.5 space-y-2.5 transition-all`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${theme.accentBg}`}>
                  <SeverityIcon className={`w-4 h-4 ${theme.iconColor}`} aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded border font-semibold ${theme.badge}`}>
                      {theme.label}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700/80 text-slate-200 font-medium">
                      {toast.sourceTag === 'current' ? (
                        <LocateFixed className="w-3 h-3 text-cyan-400" aria-hidden="true" />
                      ) : toast.sourceTag === 'saved' ? (
                        <Bookmark className="w-3 h-3 text-amber-400" aria-hidden="true" />
                      ) : (
                        <MapPin className="w-3 h-3 text-slate-300" aria-hidden="true" />
                      )}
                      <span>
                        {toast.sourceTag === 'current'
                          ? 'Current Location'
                          : toast.sourceTag === 'saved'
                            ? 'Saved Location'
                            : 'Active View'}
                      </span>
                    </span>
                    {toast.isTest && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 font-mono text-[10px]">
                        TEST DRILL
                      </span>
                    )}
                  </div>

                  <h2 className="text-sm font-semibold text-white leading-snug">
                    {toast.alert.title} — <span className="text-cyan-300">{toast.locationName}</span>
                  </h2>

                  {toast.alert.areaName && (
                    <p className="text-[11px] text-slate-400 leading-snug truncate">
                      {toast.alert.areaName}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label={`Dismiss ${toast.alert.title} alert`}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{summaryLine}</p>

            {speechBlockedNotice && (
              <p className="text-[11px] text-amber-300 bg-amber-950/35 border border-amber-700/40 rounded-md px-2.5 py-1">
                {speechBlockedNotice}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => (isThisSpeaking ? onStopSpeech() : onSpeakAlert(toast))}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    isThisSpeaking
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 hover:bg-cyan-500/25'
                  }`}
                >
                  {isThisSpeaking ? (
                    <>
                      <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                      <span>Stop Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Speak Summary</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onViewLocation(toast)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-medium transition-colors"
                >
                  <Navigation className="w-3 h-3 text-cyan-400" aria-hidden="true" />
                  <span>Inspect Map</span>
                </button>

                {notificationPermission === 'default' && (
                  <button
                    type="button"
                    onClick={onEnablePhoneNotifications}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-semibold hover:bg-amber-300 transition-colors"
                  >
                    <BellRing className="w-3 h-3" aria-hidden="true" />
                    <span>Enable Phone Bar</span>
                  </button>
                )}
              </div>

              <a
                href={toast.alert.dataSource.authorityUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 underline ml-auto"
              >
                <span>{toast.alert.dataSource.name}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
