import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  ShieldAlert,
  X,
} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {WeatherAlertItem} from '../types/weather';

interface WeatherAlertNotificationProps {
  alerts: WeatherAlertItem[];
  timeZoneId?: string;
  isConfirmedPremium?: boolean;
}

const SEVERITY_RANK: Record<string, number> = {
  EXTREME: 0,
  SEVERE: 1,
  MODERATE: 2,
  MINOR: 3,
  UNKNOWN: 4,
};

function formatHumanEnum(raw: string): string {
  return raw
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatAlertWindow(startIso?: string, endIso?: string, timeZoneId?: string): string | null {
  if (!startIso && !endIso) return null;

  const fmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timeZoneId || undefined,
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  if (startIso && endIso) {
    return `${fmt(startIso)} – ${fmt(endIso)}`;
  }
  if (endIso) {
    return `Until ${fmt(endIso)}`;
  }
  return `Effective ${fmt(startIso as string)}`;
}

function getSeverityStyle(severity: string) {
  const s = severity.toUpperCase();
  if (s === 'EXTREME') {
    return {
      label: 'Extreme Alert',
      Icon: ShieldAlert,
      containerClass: 'bg-rose-950/35 border-rose-700/60',
      iconClass: 'text-rose-400',
      titleClass: 'text-rose-100',
      labelClass: 'text-rose-300',
      linkClass: 'text-rose-300 hover:text-rose-200',
    };
  }
  if (s === 'SEVERE') {
    return {
      label: 'Severe Warning',
      Icon: AlertTriangle,
      containerClass: 'bg-amber-950/35 border-amber-600/60',
      iconClass: 'text-amber-400',
      titleClass: 'text-amber-100',
      labelClass: 'text-amber-300',
      linkClass: 'text-amber-300 hover:text-amber-200',
    };
  }
  if (s === 'MODERATE') {
    return {
      label: 'Moderate Advisory',
      Icon: AlertCircle,
      containerClass: 'bg-amber-950/20 border-amber-700/45',
      iconClass: 'text-amber-300',
      titleClass: 'text-slate-100',
      labelClass: 'text-amber-200',
      linkClass: 'text-amber-300 hover:text-amber-200',
    };
  }
  return {
    label: 'Weather Notice',
    Icon: Info,
    containerClass: 'bg-sky-950/25 border-sky-700/45',
    iconClass: 'text-sky-400',
    titleClass: 'text-slate-100',
    labelClass: 'text-sky-300',
    linkClass: 'text-sky-300 hover:text-sky-200',
  };
}

export function WeatherAlertNotification({
  alerts,
  timeZoneId,
  isConfirmedPremium = false,
}: WeatherAlertNotificationProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const alertKey = useMemo(() => alerts.map((a) => a.alertId).join('|'), [alerts]);

  useEffect(() => {
    setDismissedIds([]);
    if (alerts.length === 1) {
      setExpandedIds([alerts[0].alertId]);
    } else {
      setExpandedIds([]);
    }
  }, [alertKey, alerts]);

  const visibleAlerts = useMemo(() => {
    return [...alerts]
      .filter((a) => !dismissedIds.includes(a.alertId))
      .sort((a, b) => {
        const ra = SEVERITY_RANK[a.severity.toUpperCase()] ?? 4;
        const rb = SEVERITY_RANK[b.severity.toUpperCase()] ?? 4;
        return ra - rb;
      });
  }, [alerts, dismissedIds]);

  if (visibleAlerts.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const dismissAlert = (id: string) => {
    setDismissedIds((prev) => [...prev, id]);
  };

  return (
    <section aria-label="Active severe weather notifications" className="space-y-2.5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium text-amber-200">
          Active Weather Alerts ({visibleAlerts.length})
          {isConfirmedPremium ? ' · VIP Priority Telemetry' : ''}
        </span>
        {visibleAlerts.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setExpandedIds((prev) =>
                prev.length === visibleAlerts.length ? [] : visibleAlerts.map((a) => a.alertId)
              )
            }
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            {expandedIds.length === visibleAlerts.length ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {visibleAlerts.map((alert) => {
        const style = getSeverityStyle(alert.severity);
        const SeverityIcon = style.Icon;
        const isExpanded = expandedIds.includes(alert.alertId);
        const windowText = formatAlertWindow(alert.startTimeIso, alert.expirationTimeIso, timeZoneId);
        const hasDetails = Boolean(
          alert.description ||
            (alert.instruction && alert.instruction.length > 0) ||
            (alert.safetyRecommendations && alert.safetyRecommendations.length > 0)
        );

        return (
          <div
            key={alert.alertId}
            role="alert"
            className={`p-3.5 border rounded-lg space-y-2 transition-colors ${style.containerClass}`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <SeverityIcon className={`w-4 h-4 shrink-0 mt-0.5 ${style.iconClass}`} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
                    <span className={`font-semibold ${style.labelClass}`}>{style.label}</span>
                    {alert.urgency && alert.urgency !== 'UNKNOWN' && (
                      <>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className="text-slate-300">{formatHumanEnum(alert.urgency)}</span>
                      </>
                    )}
                    {alert.certainty && alert.certainty !== 'UNKNOWN' && (
                      <>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className="text-slate-400">{formatHumanEnum(alert.certainty)}</span>
                      </>
                    )}
                  </div>

                  <h2 className={`text-xs sm:text-sm font-semibold mt-0.5 leading-snug ${style.titleClass}`}>
                    {alert.title}
                  </h2>

                  {alert.areaName && (
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{alert.areaName}</p>
                  )}

                  {windowText && (
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">{windowText}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissAlert(alert.alertId)}
                aria-label={`Dismiss ${alert.title}`}
                className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {hasDetails && (
              <div>
                <button
                  type="button"
                  onClick={() => toggleExpand(alert.alertId)}
                  aria-expanded={isExpanded}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <span>{isExpanded ? 'Hide advisory details' : 'View advisory details'}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-800/70 space-y-2 text-xs text-slate-300 leading-relaxed">
                    {alert.description && <p className="whitespace-pre-line">{alert.description}</p>}

                    {alert.instruction && alert.instruction.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-200">Recommended Actions</p>
                        <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
                          {alert.instruction.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {alert.safetyRecommendations && alert.safetyRecommendations.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-200">Safety Directives</p>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                          {alert.safetyRecommendations.map((rec, idx) => (
                            <li key={idx}>
                              <span className="font-medium text-slate-100">{rec.directive}</span>
                              {rec.subtext ? ` — ${rec.subtext}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="truncate">
                Source:{' '}
                <a
                  href={alert.dataSource.authorityUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 underline ${style.linkClass}`}
                >
                  <span>{alert.dataSource.name}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                </a>
              </span>
              <span className="font-mono text-[10px] text-slate-500 shrink-0">
                {formatHumanEnum(alert.eventType)}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
