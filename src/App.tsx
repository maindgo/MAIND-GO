import {APIProvider} from '@vis.gl/react-google-maps';
import {Bookmark, ChevronUp, Crown, Globe, User} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AccountAuthPage} from './components/AccountAuthPage';
import {ErrorBoundary} from './components/ErrorBoundary';
import {IntroSplashSequence} from './components/IntroSplashSequence';
import {MandatoryAuthGate} from './components/MandatoryAuthGate';
import {SavedLocationsPage} from './components/SavedLocationsPage';
import {TopBar} from './components/TopBar';
import {VipSubscriptionPage} from './components/VipSubscriptionPage';
import {WeatherPanel} from './components/WeatherPanel';
import {ZoomEarthMap} from './components/ZoomEarthMap';
import {AuthProvider, useAuth} from './context/AuthContext';
import {
  fetchGlobalStationBatch,
  fetchLocationWeatherBundle,
  fetchRainViewerMaps,
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
  WindGridSample,
} from './types/weather';

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

const DEFAULT_POINT: LatLngPoint = {lat: 37.7749, lng: -122.4194};
const FREE_TRIAL_SECONDS = 45;
const TRIAL_STORAGE_KEY = 'maindgo_trial_start_ms';

function getOrCreateTrialStartMs(fallbackMs: number): number {
  try {
    const raw = window.localStorage.getItem(TRIAL_STORAGE_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    window.localStorage.setItem(TRIAL_STORAGE_KEY, String(fallbackMs));
    return fallbackMs;
  } catch {
    return fallbackMs;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker']}>
          <MaindGoWorkspace />
        </APIProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function MaindGoWorkspace() {
  const {userAccount, updatePreferences, firebaseUser, authReady, isConfirmedPremium} = useAuth();

  const [introComplete, setIntroComplete] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>('map');

  const trialFallbackRef = useRef<number>(Date.now());
  const [trialSecondsLeft, setTrialSecondsLeft] = useState<number | null>(null);

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

  const handleIntroComplete = useCallback(() => {
    trialFallbackRef.current = Date.now();
    setIntroComplete(true);
  }, []);

  // Enforce 45-second free watch trial before mandatory Sign-Up / Login (starts after intro completes)
  useEffect(() => {
    if (!introComplete || !authReady) return;
    if (firebaseUser) {
      setTrialSecondsLeft(null);
      return;
    }

    const startMs = getOrCreateTrialStartMs(trialFallbackRef.current);
    const computeRemaining = () => {
      const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
      return Math.max(0, FREE_TRIAL_SECONDS - elapsedSec);
    };

    setTrialSecondsLeft(computeRemaining());
    const timer = window.setInterval(() => {
      const next = computeRemaining();
      setTrialSecondsLeft(next);
      if (next <= 0) {
        setIsPlaying(false);
        window.clearInterval(timer);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [introComplete, authReady, firebaseUser]);

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

  // Listen for Tier 1 & Tier 2 GMP Quota Exceeded events
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
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

  // Initial telemetry bootstrap: global station pins + RainViewer frames + default or already-granted GPS
  useEffect(() => {
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
  }, [loadWeatherForCoords]);

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

  const isTrialExpiredGateOpen = Boolean(authReady && !firebaseUser && trialSecondsLeft === 0);

  const mobileNavItems: Array<{id: AppPage; label: string; icon: typeof Globe}> = [
    {id: 'map', label: 'Map', icon: Globe},
    {id: 'saved', label: 'Saved', icon: Bookmark},
    {id: 'vip', label: 'VIP', icon: Crown},
    {
      id: 'account',
      label: firebaseUser
        ? 'Account'
        : trialSecondsLeft !== null && trialSecondsLeft > 0
          ? `Login (${trialSecondsLeft}s)`
          : 'Login',
      icon: User,
    },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07090E] text-slate-100 overflow-hidden">
      {!introComplete && (
        <IntroSplashSequence
          isTelemetryReady={Boolean(authReady && (!isLoadingWeather || bundle !== null))}
          onComplete={handleIntroComplete}
        />
      )}

      {/* Required GMP Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
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
        alertCount={bundle?.alerts.length ?? 0}
        trialSecondsLeft={trialSecondsLeft}
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

            {/* Mobile Summary Strip to Open Full Weather Drawer */}
            {!mobilePanelOpen && bundle && (
              <button
                type="button"
                onClick={() => setMobilePanelOpen(true)}
                className="lg:hidden px-4 py-3 bg-[#0B0E17] border-t border-slate-800 flex items-center justify-between gap-4 text-left shrink-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{bundle.current.locationName}</div>
                  <div className="text-xs text-slate-400 truncate">{bundle.current.conditionDescription}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono tabular-nums text-xl font-bold text-white">
                    {Math.round(
                      units === 'IMPERIAL' ? (bundle.current.temperatureC * 9) / 5 + 32 : bundle.current.temperatureC
                    )}
                    °{units === 'IMPERIAL' ? 'F' : 'C'}
                  </span>
                  <ChevronUp className="w-4 h-4 text-cyan-400" />
                </div>
              </button>
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
                trialSecondsLeft={trialSecondsLeft}
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

      {/* Mandatory Login / Sign-Up Gate After 45s Free Watch Trial */}
      {isTrialExpiredGateOpen && <MandatoryAuthGate units={units} />}
    </div>
  );
}
