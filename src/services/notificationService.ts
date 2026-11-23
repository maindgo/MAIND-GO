import {WeatherAlertItem} from '../types/weather';

const PHONE_NOTIF_PREF_KEY = 'maindgo_phone_notifications_enabled';

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export function isWebNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isWebNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export function getPhoneNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(PHONE_NOTIF_PREF_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function setPhoneNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PHONE_NOTIF_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

export async function registerAlertServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register('/sw.js', {scope: '/'})
      .then(async (reg) => {
        try {
          await navigator.serviceWorker.ready;
        } catch {
          // Ignore readiness race
        }
        return reg;
      })
      .catch(() => null);
  }
  return swRegistrationPromise;
}

export async function requestMobileNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isWebNotificationSupported()) return 'unsupported';
  await registerAlertServiceWorker();
  try {
    const result = await window.Notification.requestPermission();
    if (result === 'granted') {
      setPhoneNotificationsEnabled(true);
    }
    return result;
  } catch {
    return window.Notification.permission;
  }
}

function buildNotificationBody(
  alert: WeatherAlertItem,
  locationName: string,
  sourceTag: 'current' | 'saved' | 'viewed'
): string {
  const tagLabel =
    sourceTag === 'current'
      ? 'Current Location'
      : sourceTag === 'saved'
        ? 'Saved Location'
        : 'Map Location';
  const severity = alert.severity ? alert.severity.toUpperCase() : 'ALERT';
  const area = alert.areaName ? ` · ${alert.areaName}` : '';
  const detail =
    alert.instruction?.[0] ||
    alert.safetyRecommendations?.[0]?.directive ||
    alert.description ||
    'Tap to open live radar and full advisory details.';
  const clippedDetail = detail.length > 140 ? `${detail.slice(0, 137).trim()}...` : detail;

  return `[${tagLabel}: ${locationName}] ${severity}${area}\n${clippedDetail}`;
}

export interface MobileNotificationPayload {
  alert: WeatherAlertItem;
  locationName: string;
  lat: number;
  lng: number;
  sourceTag: 'current' | 'saved' | 'viewed';
  onSelectLocation?: () => void;
}

export async function showMobileWeatherAlertNotification(
  payload: MobileNotificationPayload
): Promise<{shown: boolean; via: 'service-worker' | 'window' | 'blocked' | 'disabled' | 'unsupported'}> {
  if (!isWebNotificationSupported()) {
    return {shown: false, via: 'unsupported'};
  }

  if (!getPhoneNotificationsEnabled()) {
    return {shown: false, via: 'disabled'};
  }

  if (window.Notification.permission !== 'granted') {
    return {shown: false, via: 'blocked'};
  }

  const {alert, locationName, lat, lng, sourceTag, onSelectLocation} = payload;
  const isHighSeverity =
    alert.severity.toUpperCase() === 'EXTREME' || alert.severity.toUpperCase() === 'SEVERE';

  const title = `⚠️ ${alert.title} — ${locationName}`;
  const body = buildNotificationBody(alert, locationName, sourceTag);
  const tag = `maindgo-alert-${alert.alertId}-${lat.toFixed(2)}_${lng.toFixed(2)}`;

  const swOptions: NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
    timestamp?: number;
  } = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    renotify: true,
    requireInteraction: isHighSeverity,
    vibrate: isHighSeverity ? [250, 100, 250, 100, 400] : [180, 80, 180],
    timestamp: Date.now(),
    data: {
      alertId: alert.alertId,
      locationName,
      lat,
      lng,
      sourceTag,
    },
  };

  // Prefer ServiceWorkerRegistration.showNotification so Android & iOS PWA notification bar displays it reliably
  try {
    const reg =
      (await registerAlertServiceWorker()) ||
      ('serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null);

    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, swOptions);
      return {shown: true, via: 'service-worker'};
    }
  } catch {
    // Fall through to window.Notification fallback
  }

  try {
    const notif = new window.Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
      requireInteraction: isHighSeverity,
    });
    notif.onclick = () => {
      window.focus();
      onSelectLocation?.();
      notif.close();
    };
    return {shown: true, via: 'window'};
  } catch {
    return {shown: false, via: 'blocked'};
  }
}
