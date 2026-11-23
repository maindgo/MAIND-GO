import {APIProvider} from '@vis.gl/react-google-maps';
import {Bookmark, Crown, Globe, Maximize2, User, X} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AccountAuthPage} from './components/AccountAuthPage';
import {ErrorBoundary} from './components/ErrorBoundary';
import {IntroSplashSequence} from './components/IntroSplashSequence';
import {MaintenancePage} from './components/MaintenancePage';
import {OfflineIndicator} from './components/OfflineIndicator';
import {RealTimeAlertToast, RealTimeAlertToastItem} from './components/RealTimeAlertToast';
import {SavedLocationsPage} from './components/SavedLocationsPage';
import {TopBar} from './components/TopBar';
import {VipSubscriptionPage} from './components/VipSubscriptionPage';
import {WeatherExperienceModal} from './components/WeatherExperienceModal';
import {WeatherPanel} from './components/WeatherPanel';
import {ZoomEarthMap} from './components/ZoomEarthMap';
import {AuthProvider, useAuth} from './context/AuthContext';
import {
  NotificationPermissionState,
  getNotificationPermission,
  getPhoneNotificationsEnabled,
  registerAlertServiceWorker,
  requestMobileNotificationPermission,
  setPhoneNotificationsEnabled,
  showMobileWeatherAlertNotification,
} from './services/notificationService';
import {
  getVoiceAlertsEnabled,
  setVoiceAlertsEnabled,
  speakWeatherAlertSummary,
  stopWeatherAlertSpeech,
  subscribeSpeechState,
} from './services/ttsService';
import {
  fetchGlobalStationBatch,
  fetchLocationWeatherBundle,
  fetchRainViewerMaps,
  fetchWeatherAlertsForCoords,
  fetchWindFieldGrid,
} from './services/weatherService';
import {
  AppPage,
  BaseMapStyle,
  LatLngPoint,
  LocationWeatherBundle,
  MapLayerMode,
  PanelTab,
  RainViewerData,
  StationWeatherPin,
  UnitSystem,
  WeatherAlertItem,
  WindGridSample,
} from './types/weather';

function resolveGoogleMapsApiKey(): string {
  const raw = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
  if (!raw) return '';
  if (/^(MY_|YOUR_|REPLACE_|undefined|null)$/i.test(raw)) return '';
  return raw;
}

const GOOGLE_MAPS_API_KEY = resolveGoogleMapsApiKey();

const DEFAULT_POINT: LatLngPoint = {lat: 37.7749, lng: -122.4194};
const REALTIME_ALERT_POLL_MS = 60_000;

function checkIsAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  const qs = new URLSearchParams(window.location.search);
  return p === '/admin' || p.startsWith('/admin/') || qs.get('admin') === '1';
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {GOOGLE_MAPS_API_KEY ? (
          <APIProvider
            apiKey={GOOGLE_MAPS_API_KEY}
            libraries={['places', 'marker']}
            onError={(err) => {
              console.error('Google Maps APIProvider load error:', err);
              window.dispatchEvent(
                new CustomEvent('gmp-auth-failure', {
                  detail: err instanceof Error ? err.message : 'Unable to initialize Google Maps SDK.',
                })
              );
            }}
          >
            <MaindGoWorkspace />
          </APIProvider>
        ) : (
          <MaindGoWorkspace />
        )}
      </AuthProvider>
    </ErrorBoundary>
  );
}

function MaindGoWorkspace() {
  const {
    userAccount,
    updatePreferences,
    firebaseUser,
    authReady,
    isAdmin,
    isConfirmedPremium,
    savedLocations,
    maintenanceConfig,
    maintenanceLoaded,
  } = useAuth();

  const isAdminUrlRoute = useMemo(() => checkIsAdminRoute(), []);
  const [introComplete, setIntroComplete] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [mapsAuthError, setMapsAuthError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>(() => (checkIsAdminRoute() ? 'account' : 'map'));
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [previewMaintenance, setPreviewMaintenance] = useState(false);

  const [mapCenter, setMapCenter] = useState<LatLngPoint>(DEFAULT_POINT);
  const [mapZoom, setMapZoom] = useState<number>(4);
  const [selectedPoint, setSelectedPoint] = useState<LatLngPoint>(DEFAULT_POINT);
  const [userLocation, setUserLocation] = useState<LatLngPoint | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const [bundle, setBundle] = useState<LocationWeatherBundle | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<PanelTab>('overview');
  const [units, setUnits] = useState<UnitSystem>('METRIC');
  const [layerMode, setLayerMode] = useState<MapLayerMode>('radar');
  const [baseMapStyle, setBaseMapStyle] = useState<BaseMapStyle>('hybrid');
  const [layerOpacity, setLayerOpacity] = useState<number>(0.72);

  const [stationPins, setStationPins] = useState<StationWeatherPin[]>([]);
  const [rainViewer, setRainViewer] = useState<RainViewerData | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 3>(1);
  const [windGrid, setWindGrid] = useState<WindGridSample[]>([]);

  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const syncedUnitsForUidRef = useRef<string | null>(null);

  // Real-time weather alert notification, TTS & mobile phone notification bar state
  const [activeAlertToasts, setActiveAlertToasts] = useState<RealTimeAlertToastItem[]>([]);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState<boolean>(() => getVoiceAlertsEnabled());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [phoneNotificationsEnabled, setPhoneNotificationsEnabledState] = useState<boolean>(() =>
    getPhoneNotificationsEnabled()
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingAlertId, setSpeakingAlertId] = useState<string | null>(null);
  const [speechBlockedNotice, setSpeechBlockedNotice] = useState<string | null>(null);
  const seenAlertKeysRef = useRef<Set<string>>(new Set());

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
  }, []);

  const isMaintenanceLockedForVisitor = Boolean(maintenanceConfig.enabled && !isAdmin);

  // When admin accesses /admin during maintenance, land on Admin Dashboard cleanly
  useEffect(() => {
    if (isAdmin && isAdminUrlRoute) {
      setActivePage('account');
    }
  }, [isAdmin, isAdminUrlRoute]);

  // Reset playback speed to 1x if premium is not confirmed
  useEffect(() => {
    if (!isConfirmedPremium && playbackSpeed !== 1) {
      setPlaybackSpeed(1);
    }
  }, [isConfirmedPremium, playbackSpeed]);

  // Sync preferred units from signed-in user's profile once per session login
  useEffect(() => {
    if (!firebaseUser || !userAccount) {
      syncedUnitsForUidRef.current = null;
      return;
    }
    if (syncedUnitsForUidRef.current !== userAccount.uid) {
      syncedUnitsForUidRef.current = userAccount.uid;
      if (userAccount.preferredUnits === 'METRIC' || userAccount.preferredUnits === 'IMPERIAL') {
        setUnits(userAccount.preferredUnits);
      }
    }
  }, [firebaseUser, userAccount]);

  const handleUnitsChange = useCallback(
    (nextUnits: UnitSystem) => {
      setUnits(nextUnits);
      if (firebaseUser) {
        void updatePreferences({preferredUnits: nextUnits}).catch(() => {
          // Non-blocking preference sync
        });
      }
    },
    [firebaseUser, updatePreferences]
  );

  // Listen for Google Maps Platform quota & authentication failure events
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    const handleAuthFailure = (ev: Event) => {
      const detail = (ev as CustomEvent<string | undefined>).detail;
      setMapsAuthError(
        detail ||
          'Google Maps API key authentication failed. Please verify VITE_GOOGLE_MAPS_API_KEY and API permissions.'
      );
    };
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    window.addEventListener('gmp-auth-failure', handleAuthFailure);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
      window.removeEventListener('gmp-auth-failure', handleAuthFailure);
    };
  }, []);

  const loadWeatherForCoords = useCallback(
    async (lat: number, lng: number, overrideName?: {name: string; subtitle: string}) => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setIsLoadingWeather(true);
      setWeatherError(null);
      try {
        const result = await fetchLocationWeatherBundle(
          lat,
          lng,
          GOOGLE_MAPS_API_KEY,
          overrideName,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setBundle(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setWeatherError(err instanceof Error ? err.message : 'Failed to retrieve weather telemetry.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingWeather(false);
        }
      }
    },
    []
  );

  // Initial telemetry bootstrap: defer when maintenance gate is active for non-admin visitors
  useEffect(() => {
    if (!maintenanceLoaded || isMaintenanceLockedForVisitor) return;

    void fetchGlobalStationBatch().then(setStationPins);
    void fetchRainViewerMaps().then((rv) => {
      if (rv) {
        setRainViewer(rv);
        const initialFrames = rv.radar.length > 0 ? rv.radar : rv.satellite;
        if (initialFrames.length > 0) {
          // Jump to the latest observed radar frame
          const latestObs = initialFrames.filter((f) => !f.isForecast).length - 1;
          setFrameIndex(Math.max(0, latestObs));
        }
      }
    });

    // Respect shareable weather URL parameters (?lat=...&lng=...) before falling back to GPS/default
    const params = new URLSearchParams(window.location.search);
    const sharedLat = Number(params.get('lat'));
    const sharedLng = Number(params.get('lng'));
    const sharedLoc = params.get('loc');
    if (
      params.has('lat') &&
      params.has('lng') &&
      Number.isFinite(sharedLat) &&
      Number.isFinite(sharedLng) &&
      sharedLat >= -90 &&
      sharedLat <= 90 &&
      sharedLng >= -180 &&
      sharedLng <= 180
    ) {
      const pt = {lat: sharedLat, lng: sharedLng};
      setSelectedPoint(pt);
      setMapCenter(pt);
      setMapZoom(10);
      setMobilePanelOpen(true);
      void loadWeatherForCoords(
        pt.lat,
        pt.lng,
        sharedLoc ? {name: sharedLoc, subtitle: 'Shared Location'} : undefined
      );
      return;
    }

    // Silently check if browser geolocation was already granted without prompting on first load
    if ('permissions' in navigator && 'geolocation' in navigator) {
      navigator.permissions
        .query({name: 'geolocation'})
        .then((status) => {
          if (status.state === 'granted') {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const pt = {lat: pos.coords.latitude, lng: pos.coords.longitude};
                setUserLocation(pt);
                setSelectedPoint(pt);
                setMapCenter(pt);
                setMapZoom(9);
                void loadWeatherForCoords(pt.lat, pt.lng);
              },
              () => {
                void loadWeatherForCoords(DEFAULT_POINT.lat, DEFAULT_POINT.lng, {
                  name: 'San Francisco',
                  subtitle: 'California, United States',
                });
              },
              {enableHighAccuracy: true, timeout: 7000}
            );
          } else {
            void loadWeatherForCoords(DEFAULT_POINT.lat, DEFAULT_POINT.lng, {
              name: 'San Francisco',
              subtitle: 'California, United States',
            });
          }
        })
        .catch(() => {
          void loadWeatherForCoords(DEFAULT_POINT.lat, DEFAULT_POINT.lng, {
            name: 'San Francisco',
            subtitle: 'California, United States',
          });
        });
    } else {
      void loadWeatherForCoords(DEFAULT_POINT.lat, DEFAULT_POINT.lng, {
        name: 'San Francisco',
        subtitle: 'California, United States',
      });
    }
  }, [loadWeatherForCoords, maintenanceLoaded, isMaintenanceLockedForVisitor]);

  const handleEnableLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationNotice('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = {lat: pos.coords.latitude, lng: pos.coords.longitude};
        setUserLocation(pt);
        setSelectedPoint(pt);
        setMapCenter(pt);
        setMapZoom(10);
        setIsLocating(false);
        setMobilePanelOpen(true);
        void loadWeatherForCoords(pt.lat, pt.lng);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationNotice('Location access was denied. Enable browser location permission to view your local weather.');
        } else {
          setLocationNotice('Unable to acquire GPS signal. Please search or click any location on the map.');
        }
      },
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000}
    );
  }, [loadWeatherForCoords]);

  const handleMapClickCoords = useCallback(
    (lat: number, lng: number) => {
      const pt = {lat, lng};
      setSelectedPoint(pt);
      void loadWeatherForCoords(lat, lng);
    },
    [loadWeatherForCoords]
  );

  const handleSelectSearchPlace = useCallback(
    (loc: {lat: number; lng: number; name: string; subtitle: string}) => {
      const pt = {lat: loc.lat, lng: loc.lng};
      setSelectedPoint(pt);
      setMapCenter(pt);
      setMapZoom(9);
      void loadWeatherForCoords(loc.lat, loc.lng, {name: loc.name, subtitle: loc.subtitle});
    },
    [loadWeatherForCoords]
  );

  const activeFrames = useMemo(() => {
    if (!rainViewer) return [];
    if (layerMode === 'satellite_ir') return rainViewer.satellite;
    if (layerMode === 'radar') return rainViewer.radar;
    return [];
  }, [rainViewer, layerMode]);

  useEffect(() => {
    if (activeFrames.length > 0 && frameIndex >= activeFrames.length) {
      setFrameIndex(activeFrames.length - 1);
    }
  }, [activeFrames, frameIndex]);

  useEffect(() => {
    if (!isPlaying || activeFrames.length <= 1) return;
    const effectiveSpeed = isConfirmedPremium ? playbackSpeed : 1;
    const delayMs = Math.round(650 / effectiveSpeed);
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % activeFrames.length);
    }, delayMs);
    return () => clearInterval(timer);
  }, [isPlaying, activeFrames.length, isConfirmedPremium, playbackSpeed]);

  const lastBoundsRef = useRef<{north: number; south: number; east: number; west: number} | null>(null);
  const handleBoundsIdle = useCallback(
    (bounds: {north: number; south: number; east: number; west: number}) => {
      lastBoundsRef.current = bounds;
      if (layerMode === 'wind') {
        void fetchWindFieldGrid(bounds).then(setWindGrid);
      }
    },
    [layerMode]
  );

  useEffect(() => {
    if (layerMode === 'wind' && lastBoundsRef.current) {
      void fetchWindFieldGrid(lastBoundsRef.current).then(setWindGrid);
    }
    if (layerMode === 'aqi') {
      setActiveTab('air');
    }
  }, [layerMode]);

  const isLiveUserLocation = Boolean(
    userLocation &&
      Math.abs(userLocation.lat - selectedPoint.lat) < 0.01 &&
      Math.abs(userLocation.lng - selectedPoint.lng) < 0.01
  );

  // Subscribe to Web Speech API playback state
  useEffect(() => {
    return subscribeSpeechState((speaking, activeId) => {
      setIsSpeaking(speaking);
      setSpeakingAlertId(activeId);
      if (speaking) {
        setSpeechBlockedNotice(null);
      }
    });
  }, []);

  // Register Service Worker for mobile phone notification bar & handle notification clicks
  useEffect(() => {
    void registerAlertServiceWorker();

    const params = new URLSearchParams(window.location.search);
    const alertLat = Number(params.get('alertLat'));
    const alertLng = Number(params.get('alertLng'));
    if (Number.isFinite(alertLat) && Number.isFinite(alertLng) && params.has('alertLat')) {
      const pt = {lat: alertLat, lng: alertLng};
      setSelectedPoint(pt);
      setMapCenter(pt);
      setMapZoom(10);
      setActivePage('map');
      setMobilePanelOpen(true);
      void loadWeatherForCoords(pt.lat, pt.lng);
    }

    if (!('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      const payload = event.data as {
        type?: string;
        data?: {lat?: number; lng?: number; locationName?: string};
      };
      if (payload?.type !== 'WEATHER_ALERT_NOTIFICATION_CLICK') return;
      const lat = payload.data?.lat;
      const lng = payload.data?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        const pt = {lat, lng};
        setSelectedPoint(pt);
        setMapCenter(pt);
        setMapZoom(10);
        setActivePage('map');
        setMobilePanelOpen(true);
        void loadWeatherForCoords(lat, lng);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [loadWeatherForCoords]);

  const jumpToAlertLocation = useCallback(
    (lat: number, lng: number) => {
      const pt = {lat, lng};
      setSelectedPoint(pt);
      setMapCenter(pt);
      setMapZoom(10);
      setActivePage('map');
      setMobilePanelOpen(true);
      void loadWeatherForCoords(lat, lng);
    },
    [loadWeatherForCoords]
  );

  const dispatchTriggeredAlerts = useCallback(
    (
      alerts: WeatherAlertItem[],
      target: {
        locationName: string;
        lat: number;
        lng: number;
        sourceTag: 'current' | 'saved' | 'viewed';
        isTest?: boolean;
      }
    ) => {
      if (!alerts || alerts.length === 0) return;

      const locKey = `${target.lat.toFixed(2)},${target.lng.toFixed(2)}`;
      const freshAlerts = target.isTest
        ? alerts
        : alerts.filter((alert) => {
            const key = `${locKey}::${alert.alertId}`;
            if (seenAlertKeysRef.current.has(key)) return false;
            seenAlertKeysRef.current.add(key);
            return true;
          });

      if (freshAlerts.length === 0) return;

      const now = Date.now();
      const newToasts: RealTimeAlertToastItem[] = freshAlerts.map((alert) => ({
        id: `${locKey}_${alert.alertId}_${now}_${Math.random().toString(36).slice(2, 6)}`,
        alert,
        locationName: target.locationName,
        lat: target.lat,
        lng: target.lng,
        sourceTag: target.sourceTag,
        triggeredAtMs: now,
        isTest: target.isTest,
      }));

      setActiveAlertToasts((prev) => [...newToasts, ...prev].slice(0, 4));

      // 1. Web Speech API brief audio summary of triggered weather alert(s)
      if (getVoiceAlertsEnabled()) {
        speakWeatherAlertSummary(freshAlerts, {
          locationName: target.locationName,
          alertId: freshAlerts[0].alertId,
          force: target.isTest,
          onBlockedOrError: () => {
            setSpeechBlockedNotice('Tap "Speak Summary" to hear the audio alert.');
          },
        });
      }

      // 2. Display alert on user's mobile phone notification bar via Service Worker Notification API
      freshAlerts.forEach((alert) => {
        void showMobileWeatherAlertNotification({
          alert,
          locationName: target.locationName,
          lat: target.lat,
          lng: target.lng,
          sourceTag: target.sourceTag,
          onSelectLocation: () => jumpToAlertLocation(target.lat, target.lng),
        });
      });
    },
    [jumpToAlertLocation]
  );

  // Trigger real-time notification pipeline whenever active bundle receives unseen alerts
  useEffect(() => {
    if (!bundle || bundle.alerts.length === 0) return;
    const isSavedMatch = savedLocations.some(
      (loc) =>
        Math.abs(loc.lat - bundle.current.lat) < 0.02 &&
        Math.abs(loc.lng - bundle.current.lng) < 0.02
    );
    const sourceTag: 'current' | 'saved' | 'viewed' = isLiveUserLocation
      ? 'current'
      : isSavedMatch
        ? 'saved'
        : 'viewed';

    dispatchTriggeredAlerts(bundle.alerts, {
      locationName: bundle.current.locationName,
      lat: bundle.current.lat,
      lng: bundle.current.lng,
      sourceTag,
    });
  }, [bundle, isLiveUserLocation, savedLocations, dispatchTriggeredAlerts]);

  // Build stable deduplicated list of current & saved locations to monitor in background
  // Decoupled from bundle clicks so panning/clicking the map does not trigger redundant batch alert fetches
  const monitoredLocations = useMemo(() => {
    const targets: Array<{
      key: string;
      locationName: string;
      lat: number;
      lng: number;
      sourceTag: 'current' | 'saved' | 'viewed';
    }> = [];

    const addUnique = (
      lat: number,
      lng: number,
      locationName: string,
      sourceTag: 'current' | 'saved' | 'viewed'
    ) => {
      const exists = targets.some(
        (t) => Math.abs(t.lat - lat) < 0.02 && Math.abs(t.lng - lng) < 0.02
      );
      if (!exists) {
        targets.push({
          key: `${lat.toFixed(2)},${lng.toFixed(2)}`,
          locationName,
          lat,
          lng,
          sourceTag,
        });
      }
    };

    if (userLocation) {
      addUnique(userLocation.lat, userLocation.lng, 'Current Location', 'current');
    }

    savedLocations.forEach((loc) => {
      addUnique(loc.lat, loc.lng, loc.name, 'saved');
    });

    return targets;
  }, [userLocation, savedLocations]);

  // Real-time background alert polling for current & saved locations
  useEffect(() => {
    if (monitoredLocations.length === 0 || !GOOGLE_MAPS_API_KEY || isMaintenanceLockedForVisitor) return;

    let activeController: AbortController | null = null;

    const pollAlerts = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      await Promise.all(
        monitoredLocations.map(async (target) => {
          try {
            const alerts = await fetchWeatherAlertsForCoords(
              target.lat,
              target.lng,
              GOOGLE_MAPS_API_KEY,
              controller.signal
            );
            if (!controller.signal.aborted && alerts.length > 0) {
              dispatchTriggeredAlerts(alerts, {
                locationName: target.locationName,
                lat: target.lat,
                lng: target.lng,
                sourceTag: target.sourceTag,
              });
            }
          } catch {
            // Non-blocking poll errors
          }
        })
      );
    };

    void pollAlerts();
    const intervalId = window.setInterval(() => {
      void pollAlerts();
    }, REALTIME_ALERT_POLL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void pollAlerts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      activeController?.abort();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [monitoredLocations, dispatchTriggeredAlerts]);

  const handleToggleVoiceAlerts = useCallback(() => {
    setVoiceAlertsEnabled((prev) => {
      const next = !prev;
      setVoiceAlertsEnabled(next);
      return next;
    });
  }, []);

  const handleRequestPhoneNotifications = useCallback(async () => {
    const result = await requestMobileNotificationPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
      setPhoneNotificationsEnabled(true);
      setPhoneNotificationsEnabledState(true);
    }
  }, []);

  const handleTogglePhoneNotifications = useCallback(() => {
    setPhoneNotificationsEnabledState((prev) => {
      const next = !prev;
      setPhoneNotificationsEnabled(next);
      return next;
    });
  }, []);

  const handleTriggerTestAlert = useCallback(async () => {
    if (getNotificationPermission() === 'default') {
      const res = await requestMobileNotificationPermission();
      setNotificationPermission(res);
      if (res === 'granted') {
        setPhoneNotificationsEnabled(true);
        setPhoneNotificationsEnabledState(true);
      }
    }

    const targetLat = userLocation?.lat ?? bundle?.current.lat ?? selectedPoint.lat;
    const targetLng = userLocation?.lng ?? bundle?.current.lng ?? selectedPoint.lng;
    const targetName =
      (isLiveUserLocation || !userLocation) && bundle?.current.locationName
        ? bundle.current.locationName
        : 'Current Location';

    const testAlert: WeatherAlertItem = {
      alertId: `drill_flash_flood_${Date.now()}`,
      title: 'Flash Flood Warning',
      eventType: 'FLASH_FLOOD',
      areaName: `${targetName} Metro & Low-Lying Basins`,
      severity: 'SEVERE',
      urgency: 'IMMEDIATE',
      certainty: 'LIKELY',
      description:
        'Rapidly rising water expected in low-lying urban drainage corridors and creeks due to intense rainfall rates.',
      instruction: [
        "Turn around, don't drown when encountering flooded roads. Move immediately to higher ground.",
      ],
      safetyRecommendations: [
        {
          directive: 'Move to higher ground immediately.',
          subtext: 'Avoid underpasses, creeks, and flood-prone roadways.',
        },
      ],
      startTimeIso: new Date().toISOString(),
      expirationTimeIso: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      dataSource: {
        publisher: 'NOAA',
        name: 'National Weather Service',
        authorityUri: 'https://www.weather.gov/',
      },
    };

    dispatchTriggeredAlerts([testAlert], {
      locationName: targetName,
      lat: targetLat,
      lng: targetLng,
      sourceTag: userLocation ? 'current' : 'viewed',
      isTest: true,
    });
  }, [userLocation, bundle?.current, selectedPoint, isLiveUserLocation, dispatchTriggeredAlerts]);

  const mobileNavItems: Array<{id: AppPage; label: string; icon: typeof Globe}> = [
    {id: 'map', label: 'Map', icon: Globe},
    {id: 'saved', label: 'Saved', icon: Bookmark},
    {id: 'vip', label: 'VIP', icon: Crown},
    {
      id: 'account',
      label: firebaseUser ? 'Account' : 'Sign In',
      icon: User,
    },
  ];

  // Hold normal UI behind crisp boot screen until Auth + Maintenance status resolve so maintenance cannot flicker
  if (!authReady || !maintenanceLoaded) {
    return (
      <div className="h-screen w-screen bg-[#040710] flex flex-col items-center justify-center gap-3 text-slate-300">
        <div className="font-display text-2xl font-bold tracking-[0.2em] text-white">MAIND GO</div>
        <div className="w-40 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full w-1/2 bg-cyan-400 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  // FULL-SCREEN MAINTENANCE MODE LOCKDOWN FOR PUBLIC VISITORS
  if (isMaintenanceLockedForVisitor) {
    return <MaintenancePage initialAdminRoute={isAdminUrlRoute} />;
  }

  // ADMIN PREVIEW OF MAINTENANCE PAGE
  if (isAdmin && previewMaintenance) {
    return (
      <div className="relative">
        <div className="fixed bottom-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setPreviewMaintenance(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-xs shadow-2xl hover:bg-amber-300 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Exit Maintenance Preview</span>
          </button>
        </div>
        <MaintenancePage
          initialAdminRoute={false}
          onEnterAdminApp={() => setPreviewMaintenance(false)}
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07090E] text-slate-100 overflow-hidden">
      {!introComplete && (
        <IntroSplashSequence
          isTelemetryReady={Boolean(authReady && (!isLoadingWeather || bundle !== null))}
          onComplete={handleIntroComplete}
        />
      )}

      {/* Standard Google Maps API Quota Banner */}
      {quotaExceeded && !mapsAuthError && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 text-amber-200 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0 flex items-center justify-center gap-3">
          <span>
            Unable to load full Google Maps telemetry. Please check your network connection or API quota.
          </span>
          <button
            type="button"
            onClick={() => setQuotaExceeded(false)}
            className="text-amber-300 hover:text-white underline text-xs shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <TopBar
        activePage={activePage}
        onSelectPage={(page) => {
          setActivePage(page);
          if (page !== 'map') {
            setMobilePanelOpen(false);
          }
        }}
        onEnableLocation={handleEnableLocation}
        isLocating={isLocating}
        hasLiveLocation={Boolean(userLocation)}
        alertCount={(bundle?.alerts.length ?? 0) + activeAlertToasts.filter((t) => t.isTest).length}
        voiceAlertsEnabled={voiceAlertsEnabled}
        onToggleVoiceAlerts={handleToggleVoiceAlerts}
        notificationPermission={notificationPermission}
        phoneNotificationsEnabled={phoneNotificationsEnabled}
        onRequestPhoneNotifications={() => void handleRequestPhoneNotifications()}
        onTogglePhoneNotifications={handleTogglePhoneNotifications}
        onTriggerTestAlert={() => void handleTriggerTestAlert()}
        monitoredLocationCount={Math.max(1, monitoredLocations.length)}
        canOpenExperience={Boolean(bundle)}
        onOpenExperience={() => setExperienceOpen(true)}
      />

      <OfflineIndicator />

      <RealTimeAlertToast
        toasts={activeAlertToasts}
        isSpeaking={isSpeaking}
        speakingAlertId={speakingAlertId}
        speechBlockedNotice={speechBlockedNotice}
        notificationPermission={notificationPermission}
        onSpeakAlert={(toast) => {
          setSpeechBlockedNotice(null);
          speakWeatherAlertSummary([toast.alert], {
            locationName: toast.locationName,
            alertId: toast.alert.alertId,
            force: true,
            onBlockedOrError: (reason) => setSpeechBlockedNotice(reason),
          });
        }}
        onStopSpeech={() => stopWeatherAlertSpeech()}
        onViewLocation={(toast) => {
          jumpToAlertLocation(toast.lat, toast.lng);
        }}
        onDismiss={(id) => {
          const target = activeAlertToasts.find((t) => t.id === id);
          if (target && speakingAlertId === target.alert.alertId) {
            stopWeatherAlertSpeech();
          }
          setActiveAlertToasts((prev) => prev.filter((t) => t.id !== id));
        }}
        onDismissAll={() => {
          stopWeatherAlertSpeech();
          setActiveAlertToasts([]);
        }}
        onEnablePhoneNotifications={() => void handleRequestPhoneNotifications()}
      />

      {locationNotice && (
        <div className="px-4 py-2 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-4 text-xs text-amber-300 shrink-0">
          <span>{locationNotice}</span>
          <button
            type="button"
            onClick={() => setLocationNotice(null)}
            className="text-slate-400 hover:text-white whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row relative overflow-hidden">
        {activePage === 'map' && (
          <>
            {/* Interactive Zoom Earth Satellite & Radar Map Stage */}
            <ZoomEarthMap
              apiKey={GOOGLE_MAPS_API_KEY}
              authError={mapsAuthError}
              center={mapCenter}
              zoom={mapZoom}
              onCameraChange={(c, z) => {
                setMapCenter(c);
                setMapZoom(z);
              }}
              onBoundsIdle={handleBoundsIdle}
              onMapClickCoords={handleMapClickCoords}
              onSelectSearchPlace={handleSelectSearchPlace}
              selectedBundle={bundle}
              selectedPoint={selectedPoint}
              userLocation={userLocation}
              onEnableLocation={handleEnableLocation}
              layerMode={layerMode}
              onLayerModeChange={(m) => {
                setLayerMode(m);
                if (m !== 'radar' && m !== 'satellite_ir') {
                  setIsPlaying(false);
                }
              }}
              baseMapStyle={baseMapStyle}
              onBaseMapStyleChange={setBaseMapStyle}
              units={units}
              stationPins={stationPins}
              rainViewerHost={rainViewer?.host || 'https://tilecache.rainviewer.com'}
              activeFrames={activeFrames}
              frameIndex={frameIndex}
              onFrameChange={(idx) => {
                setIsPlaying(false);
                setFrameIndex(idx);
              }}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              playbackSpeed={playbackSpeed}
              onCyclePlaybackSpeed={() =>
                setPlaybackSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 1))
              }
              isConfirmedPremium={isConfirmedPremium}
              onOpenVip={() => setActivePage('vip')}
              layerOpacity={layerOpacity}
              onOpacityChange={setLayerOpacity}
              windGrid={windGrid}
            />

            {/* Mobile Summary Strip to Open Full Weather Drawer or Experience Mode */}
            {!mobilePanelOpen && bundle && (
              <div className="lg:hidden px-3 py-2.5 bg-[#0B0E17] border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobilePanelOpen(true)}
                  className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left py-1 px-1"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {bundle.current.locationName}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {bundle.current.conditionDescription} · Rain {bundle.current.precipitationProb}%
                    </div>
                  </div>
                  <div className="font-mono tabular-nums text-xl font-bold text-white shrink-0">
                    {Math.round(
                      units === 'IMPERIAL'
                        ? (bundle.current.temperatureC * 9) / 5 + 32
                        : bundle.current.temperatureC
                    )}
                    °{units === 'IMPERIAL' ? 'F' : 'C'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExperienceOpen(true)}
                  aria-label="Open Weather Experience Mode"
                  className="p-2.5 rounded-lg bg-[#111827] border border-slate-700 text-cyan-400 shrink-0"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Desktop Side Telemetry Panel / Mobile Full Drawer */}
            <div
              className={`${
                mobilePanelOpen ? 'fixed inset-0 top-14 bottom-12 z-30 flex' : 'hidden'
              } lg:static lg:flex lg:z-auto`}
            >
              <WeatherPanel
                bundle={bundle}
                isLoading={isLoadingWeather}
                error={weatherError}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                units={units}
                onUnitsChange={handleUnitsChange}
                isLiveUserLocation={isLiveUserLocation}
                onRetry={() => void loadWeatherForCoords(selectedPoint.lat, selectedPoint.lng)}
                onEnableLocation={handleEnableLocation}
                onNavigatePage={setActivePage}
                onOpenExperience={() => setExperienceOpen(true)}
                onCloseMobile={() => setMobilePanelOpen(false)}
              />
            </div>
          </>
        )}

        {activePage === 'saved' && (
          <SavedLocationsPage
            currentBundle={bundle}
            units={units}
            onSelectLocation={(loc) => {
              handleSelectSearchPlace(loc);
              setActivePage('map');
            }}
            onNavigate={setActivePage}
          />
        )}

        {activePage === 'vip' && (
          <VipSubscriptionPage
            currentBundle={bundle}
            units={units}
            onNavigate={setActivePage}
          />
        )}

        {activePage === 'account' && (
          <AccountAuthPage
            units={units}
            onUnitsChange={handleUnitsChange}
            onNavigate={setActivePage}
            onPreviewMaintenance={() => setPreviewMaintenance(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Page Switcher */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden h-12 bg-[#07090E] border-t border-slate-800/80 grid grid-cols-4 shrink-0 z-40"
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActivePage(item.id);
                if (item.id !== 'map') setMobilePanelOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Full-Screen Weather Experience Mode */}
      {experienceOpen && bundle && (
        <WeatherExperienceModal
          bundle={bundle}
          units={units}
          onUnitsChange={handleUnitsChange}
          onClose={() => setExperienceOpen(false)}
        />
      )}
    </div>
  );
}
