import {
  Bookmark,
  Check,
  Clock,
  Crown,
  Download,
  Droplets,
  Eye,
  Gauge,
  LocateFixed,
  Lock,
  RefreshCw,
  Sun,
  Wind,
  X,
} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {AppPage, LocationWeatherBundle, PanelTab, UnitSystem} from '../types/weather';
import {exportDailyTelemetryCsv, exportHourlyTelemetryCsv} from '../utils/telemetryExport';
import {WeatherAlertNotification} from './WeatherAlertNotification';
import {
  formatCoords,
  formatLocalTimeFromZone,
  formatPrecipValue,
  formatSpeedValue,
  formatTempDecimal,
  formatTempValue,
  formatVisibilityValue,
  precipUnitLabel,
  speedUnitLabel,
  tempUnitLabel,
  uvCategoryLabel,
  visibilityUnitLabel,
} from '../utils/weatherFormat';
import {SolarCycleWidget} from './SolarCycleWidget';
import {HourlyTemperatureChart, WindCompass} from './WeatherCharts';
import {WeatherIcon} from './WeatherIcon';

interface WeatherPanelProps {
  bundle: LocationWeatherBundle | null;
  isLoading: boolean;
  error: string | null;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  units: UnitSystem;
  onUnitsChange: (u: UnitSystem) => void;
  isLiveUserLocation: boolean;
  onRetry: () => void;
  onEnableLocation: () => void;
  onNavigatePage: (page: AppPage) => void;
  trialSecondsLeft: number | null;
  onCloseMobile?: () => void;
}

export function WeatherPanel({
  bundle,
  isLoading,
  error,
  activeTab,
  onTabChange,
  units,
  onUnitsChange,
  isLiveUserLocation,
  onRetry,
  onEnableLocation,
  onNavigatePage,
  trialSecondsLeft,
  onCloseMobile,
}: WeatherPanelProps) {
  const {
    firebaseUser,
    savedLocations,
    saveLocation,
    isConfirmedPremium,
    isConfirmedVip,
    hasPendingPayment,
  } = useAuth();

  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [savingLoc, setSavingLoc] = useState(false);

  useEffect(() => {
    setSaveNotice(null);
  }, [bundle?.current.lat, bundle?.current.lng]);

  const isAlreadySaved = Boolean(
    bundle &&
      savedLocations.some(
        (loc) =>
          Math.abs(loc.lat - bundle.current.lat) < 0.02 &&
          Math.abs(loc.lng - bundle.current.lng) < 0.02
      )
  );

  const handleBookmarkClick = async () => {
    if (!bundle) return;
    setSaveNotice(null);
    if (!firebaseUser) {
      onNavigatePage('account');
      return;
    }
    if (isAlreadySaved) {
      onNavigatePage('saved');
      return;
    }
    setSavingLoc(true);
    try {
      await saveLocation({
        name: bundle.current.locationName,
        subtitle: bundle.current.regionSubtitle,
        lat: bundle.current.lat,
        lng: bundle.current.lng,
      });
      setSaveNotice(`Saved "${bundle.current.locationName}"`);
    } catch (err) {
      setSaveNotice(err instanceof Error ? err.message : 'Unable to save location.');
    } finally {
      setSavingLoc(false);
    }
  };

  const tabs: Array<{id: PanelTab; label: string}> = [
    {id: 'overview', label: 'Overview'},
    {id: 'hourly', label: 'Hourly'},
    {id: 'daily', label: '10-Day'},
    {id: 'air', label: 'Air Quality'},
  ];

  return (
    <aside
      aria-label="Location weather telemetry"
      className="w-full lg:w-[410px] xl:w-[430px] h-full bg-[#0B0E17] border-l border-slate-800/80 flex flex-col overflow-hidden shrink-0"
    >
      {/* Top Unit & Location Header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          {bundle ? (
            <>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-semibold text-white truncate">
                  {bundle.current.locationName}
                </h1>
                {isLiveUserLocation && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 whitespace-nowrap shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
                    Live GPS
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {bundle.current.regionSubtitle}
                <span aria-hidden="true"> · </span>
                <span className="font-mono tabular-nums">{formatCoords(bundle.current.lat, bundle.current.lng)}</span>
              </p>
            </>
          ) : (
            <div className="h-10 flex flex-col justify-center">
              <div className="h-4 w-36 bg-slate-800 rounded animate-pulse" />
              <div className="h-3 w-48 bg-slate-800/70 rounded mt-1.5 animate-pulse" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {bundle && (
            <button
              type="button"
              disabled={savingLoc}
              onClick={() => void handleBookmarkClick()}
              title={
                !firebaseUser
                  ? 'Sign in to save location'
                  : isAlreadySaved
                    ? 'View saved locations'
                    : 'Save this location'
              }
              aria-label={isAlreadySaved ? 'Location saved' : 'Save location'}
              className={`p-1.5 rounded-lg border transition-colors ${
                isAlreadySaved
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {isAlreadySaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}

          <div className="inline-flex p-0.5 bg-[#111827] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => onUnitsChange('METRIC')}
              className={`px-2 py-1 text-xs font-mono rounded-md transition-colors ${
                units === 'METRIC' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => onUnitsChange('IMPERIAL')}
              className={`px-2 py-1 text-xs font-mono rounded-md transition-colors ${
                units === 'IMPERIAL' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              °F
            </button>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close weather panel"
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="px-5 py-2.5 border-b border-slate-800/80 flex items-center gap-1 shrink-0 bg-[#080B12]">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-100 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto maingo-scroll px-5 py-4 space-y-5">
        {!firebaseUser && trialSecondsLeft !== null && trialSecondsLeft > 0 && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#111827] border border-amber-500/35 rounded-lg">
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-200 font-mono tabular-nums">
                Free watch trial · {trialSecondsLeft}s left
              </p>
              <p className="text-[11px] text-slate-400">Sign up or log in to keep watching uninterrupted.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigatePage('account')}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-400 text-slate-950 rounded-md hover:bg-amber-300 whitespace-nowrap shrink-0 transition-colors"
            >
              Sign Up / Login
            </button>
          </div>
        )}

        {saveNotice && (
          <div className="px-3.5 py-2.5 bg-[#111827] border border-cyan-500/35 rounded-lg flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-200">{saveNotice}</span>
            <div className="flex items-center gap-2 shrink-0">
              {saveNotice.includes('Upgrade') ? (
                <button
                  type="button"
                  onClick={() => onNavigatePage('vip')}
                  className="text-amber-300 hover:text-amber-200 font-medium"
                >
                  Plans
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigatePage('saved')}
                  className="text-cyan-300 hover:text-cyan-200 font-medium"
                >
                  View
                </button>
              )}
              <button
                type="button"
                onClick={() => setSaveNotice(null)}
                aria-label="Dismiss notice"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {!isLiveUserLocation && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#111827] border border-slate-800 rounded-lg">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200">See your local live weather</p>
              <p className="text-[11px] text-slate-400">Enable GPS to track weather at your exact location.</p>
            </div>
            <button
              type="button"
              onClick={onEnableLocation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 whitespace-nowrap shrink-0 transition-colors"
            >
              <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Locate</span>
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-950/30 border border-rose-800/60 rounded-lg space-y-2">
            <p className="text-xs text-rose-200">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry weather fetch</span>
            </button>
          </div>
        )}

        {isLoading && !bundle ? (
          <div className="space-y-4">
            <div className="h-24 bg-[#111827] rounded-lg animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 bg-[#111827] rounded-lg animate-pulse" />
              <div className="h-20 bg-[#111827] rounded-lg animate-pulse" />
              <div className="h-20 bg-[#111827] rounded-lg animate-pulse" />
              <div className="h-20 bg-[#111827] rounded-lg animate-pulse" />
            </div>
            <div className="h-36 bg-[#111827] rounded-lg animate-pulse" />
          </div>
        ) : bundle ? (
          <>
            {/* Active Severe Weather Alerts Notification */}
            <WeatherAlertNotification
              alerts={bundle.alerts}
              timeZoneId={bundle.current.timeZoneId}
              isConfirmedPremium={isConfirmedPremium}
            />

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <>
                {/* Hero Condition Block */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono tabular-nums text-5xl font-semibold tracking-tight text-white">
                        {formatTempValue(bundle.current.temperatureC, units)}
                      </span>
                      <span className="font-mono text-xl text-slate-400">{tempUnitLabel(units)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 mt-1">{bundle.current.conditionDescription}</p>
                    <p className="text-xs text-slate-400 font-mono tabular-nums mt-1">
                      Feels like {formatTempDecimal(bundle.current.feelsLikeC, units)}
                      {tempUnitLabel(units)}
                      {typeof bundle.current.maxTemp24hC === 'number' &&
                      typeof bundle.current.minTemp24hC === 'number'
                        ? ` · H ${formatTempValue(bundle.current.maxTemp24hC, units)}° / L ${formatTempValue(bundle.current.minTemp24hC, units)}°`
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-[#111827] border border-slate-800 flex items-center justify-center">
                      <WeatherIcon
                        conditionType={bundle.current.conditionType}
                        isDaytime={bundle.current.isDaytime}
                        className="w-7 h-7"
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      Local {formatLocalTimeFromZone(bundle.current.currentTimeIso, bundle.current.timeZoneId)}
                    </span>
                  </div>
                </div>

                {/* Hourly Temperature Sparkline */}
                <div className="p-3.5 bg-[#111827] border border-slate-800/90 rounded-lg">
                  <HourlyTemperatureChart hourly={bundle.hourly} units={units} />
                </div>

                {/* Wind Compass Panel */}
                <div className="p-3.5 bg-[#111827] border border-slate-800/90 rounded-lg">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Wind Vector & Gusts</span>
                    <Wind className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  </div>
                  <WindCompass
                    directionDeg={bundle.current.windDirectionDeg}
                    cardinal={bundle.current.windCardinal}
                    speedKmh={bundle.current.windSpeedKmh}
                    gustKmh={bundle.current.windGustKmh}
                    units={units}
                  />
                </div>

                {/* 6-Metric Telemetry Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-[#111827] border border-slate-800/90 rounded-lg">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Humidity</span>
                      <Droplets className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    </div>
                    <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                      {bundle.current.relativeHumidity}
                      <span className="text-xs text-slate-400 ml-1">%</span>
                    </div>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                      Dew point {formatTempValue(bundle.current.dewPointC, units)}
                      {tempUnitLabel(units)}
                    </p>
                  </div>

                  <div className="p-3 bg-[#111827] border border-slate-800/90 rounded-lg">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Pressure</span>
                      <Gauge className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    </div>
                    <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                      {Math.round(bundle.current.pressureHpa)}
                      <span className="text-xs text-slate-400 ml-1">hPa</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Mean sea level</p>
                  </div>

                  <div className="p-3 bg-[#111827] border border-slate-800/90 rounded-lg">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>UV Index</span>
                      <Sun className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    </div>
                    <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                      {bundle.current.uvIndex}
                      <span className="text-xs text-slate-400 ml-1.5">{uvCategoryLabel(bundle.current.uvIndex)}</span>
                    </div>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                      Cloud cover {bundle.current.cloudCoverPct}%
                    </p>
                  </div>

                  <div className="p-3 bg-[#111827] border border-slate-800/90 rounded-lg">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Visibility</span>
                      <Eye className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    </div>
                    <div className="mt-1.5 font-mono tabular-nums text-xl font-semibold text-white">
                      {formatVisibilityValue(bundle.current.visibilityKm, units)}
                      <span className="text-xs text-slate-400 ml-1">{visibilityUnitLabel(units)}</span>
                    </div>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                      Precip {formatPrecipValue(bundle.current.precipitationMm, units)} {precipUnitLabel(units)}
                    </p>
                  </div>
                </div>

                {/* Solar & Astronomical Sunrise/Sunset Cycle */}
                <SolarCycleWidget
                  todayForecast={bundle.daily[0]}
                  currentTimeIso={bundle.current.currentTimeIso}
                  timeZoneId={bundle.current.timeZoneId}
                />

                {/* Quick Air Quality Summary Row */}
                {bundle.airQuality && (
                  <button
                    type="button"
                    onClick={() => onTabChange('air')}
                    className="w-full p-3.5 bg-[#111827] border border-slate-800/90 hover:border-slate-700 rounded-lg flex items-center justify-between text-left transition-colors"
                  >
                    <div>
                      <p className="text-xs text-slate-400">Air Quality ({bundle.airQuality.indexName})</p>
                      <p className="text-sm font-medium text-slate-100 mt-0.5">{bundle.airQuality.category}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{backgroundColor: bundle.airQuality.colorCss}}
                        aria-hidden="true"
                      />
                      <span className="font-mono tabular-nums text-2xl font-semibold text-white">
                        {bundle.airQuality.aqiDisplay}
                      </span>
                    </div>
                  </button>
                )}

                {/* Pending / Confirmed / Locked VIP Telemetry Strip */}
                {hasPendingPayment && !isConfirmedPremium ? (
                  <button
                    type="button"
                    onClick={() => onNavigatePage('vip')}
                    className="w-full p-3.5 bg-amber-950/25 border border-amber-500/35 hover:border-amber-500/55 rounded-lg flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-amber-200">UPI Payment Queued for Confirmation</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          VIP telemetry &amp; exports unlock after verification
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-amber-300 shrink-0">Queue →</span>
                  </button>
                ) : isConfirmedPremium ? (
                  <div className="p-3.5 bg-[#111827] border border-amber-500/40 rounded-lg space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Crown className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                        <span className="text-xs font-semibold text-amber-200">
                          {isConfirmedVip ? 'VIP Atmospheric Telemetry' : 'PRO Atmospheric Telemetry'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigatePage('vip')}
                        className="text-[11px] font-mono text-amber-300 hover:text-amber-200 shrink-0"
                      >
                        Vault →
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                      <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400">Dew Spread</div>
                        <div className="text-cyan-300 font-semibold mt-0.5">
                          {(
                            units === 'IMPERIAL'
                              ? ((bundle.current.temperatureC - bundle.current.dewPointC) * 9) / 5
                              : bundle.current.temperatureC - bundle.current.dewPointC
                          ).toFixed(1)}
                          {tempUnitLabel(units)}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400">Storm Risk</div>
                        <div className="text-amber-300 font-semibold mt-0.5">
                          {bundle.current.thunderstormProb}%
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400">Feel Delta</div>
                        <div className="text-slate-100 font-semibold mt-0.5">
                          {bundle.current.feelsLikeC - bundle.current.temperatureC >= 0 ? '+' : ''}
                          {(
                            units === 'IMPERIAL'
                              ? ((bundle.current.feelsLikeC - bundle.current.temperatureC) * 9) / 5
                              : bundle.current.feelsLikeC - bundle.current.temperatureC
                          ).toFixed(1)}
                          {tempUnitLabel(units)}
                        </div>
                      </div>
                    </div>
                    <div className="px-2.5 py-1.5 rounded bg-[#07090E] border border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Stability &amp; Fog Risk</span>
                      <span className="text-emerald-300 font-medium">
                        {bundle.current.temperatureC - bundle.current.dewPointC <= 2.5
                          ? 'High Fog Risk'
                          : bundle.current.pressureHpa < 1006
                            ? 'Unstable Low'
                            : 'Stable'}{' '}
                        · {Math.round(bundle.current.pressureHpa)} hPa
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => exportHourlyTelemetryCsv(bundle, units)}
                        className="py-1.5 px-2.5 rounded-md bg-amber-400 text-slate-950 text-[11px] font-semibold hover:bg-amber-300 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>24h CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportDailyTelemetryCsv(bundle, units)}
                        className="py-1.5 px-2.5 rounded-md bg-cyan-500 text-slate-950 text-[11px] font-semibold hover:bg-cyan-400 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>10-Day CSV</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigatePage('vip')}
                    className="w-full p-3 bg-[#111827] border border-slate-800 hover:border-amber-500/40 rounded-lg flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200">VIP Atmospheric Telemetry Locked</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          Dew-point spread, storm risk, 2x/3x radar &amp; CSV exports
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-amber-300 shrink-0">Unlock →</span>
                  </button>
                )}

                <p className="text-[11px] text-slate-500 font-mono">
                  Source: {bundle.current.sourceName} · Click anywhere on the map to inspect
                </p>
              </>
            )}

            {/* TAB 2: HOURLY */}
            {activeTab === 'hourly' && (
              <div className="space-y-3">
                <div className="p-3.5 bg-[#111827] border border-slate-800/90 rounded-lg">
                  <HourlyTemperatureChart hourly={bundle.hourly} units={units} />
                </div>

                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#111827] border border-slate-800/90 rounded-lg">
                  <span className="text-[11px] text-slate-400">24-Hour Telemetry Dataset</span>
                  {isConfirmedPremium ? (
                    <button
                      type="button"
                      onClick={() => exportHourlyTelemetryCsv(bundle, units)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-400 text-slate-950 text-[11px] font-semibold hover:bg-amber-300 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export 24h CSV</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigatePage('vip')}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 hover:text-amber-200"
                    >
                      <Lock className="w-3 h-3" />
                      <span>{hasPendingPayment ? 'Queued · Locked' : 'VIP CSV Export'}</span>
                    </button>
                  )}
                </div>

                <div className="border border-slate-800/90 rounded-lg divide-y divide-slate-800/70 bg-[#111827]">
                  {bundle.hourly.map((h, i) => (
                    <div key={i} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0 w-24 shrink-0">
                        <span className="font-mono tabular-nums text-slate-300 font-medium">{h.localHourLabel}</span>
                        <WeatherIcon
                          conditionType={h.conditionType}
                          isDaytime={h.isDaytime}
                          className="w-4 h-4 shrink-0"
                        />
                      </div>
                      <span className="text-slate-400 truncate flex-1">{h.conditionDescription}</span>
                      <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                        <span className="text-sky-400 w-9 text-right">{h.precipProb}%</span>
                        <span className="text-slate-400 w-16 text-right">
                          {formatSpeedValue(h.windSpeedKmh, units)} {speedUnitLabel(units)}
                        </span>
                        <span className="text-white font-semibold w-10 text-right">
                          {formatTempValue(h.temperatureC, units)}°
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: 10-DAY DAILY */}
            {activeTab === 'daily' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#111827] border border-slate-800/90 rounded-lg">
                  <span className="text-[11px] text-slate-400">10-Day Forecast Dataset</span>
                  {isConfirmedPremium ? (
                    <button
                      type="button"
                      onClick={() => exportDailyTelemetryCsv(bundle, units)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-500 text-slate-950 text-[11px] font-semibold hover:bg-cyan-400 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export 10-Day CSV</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigatePage('vip')}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 hover:text-amber-200"
                    >
                      <Lock className="w-3 h-3" />
                      <span>{hasPendingPayment ? 'Queued · Locked' : 'VIP CSV Export'}</span>
                    </button>
                  )}
                </div>

                <div className="border border-slate-800/90 rounded-lg divide-y divide-slate-800/70 bg-[#111827]">
                  {(() => {
                    const globalMin = Math.min(...bundle.daily.map((d) => d.minTempC));
                    const globalMax = Math.max(...bundle.daily.map((d) => d.maxTempC));
                    const span = Math.max(1, globalMax - globalMin);

                    return bundle.daily.map((d, i) => {
                      const leftPct = ((d.minTempC - globalMin) / span) * 100;
                      const widthPct = Math.max(8, ((d.maxTempC - d.minTempC) / span) * 100);
                      return (
                        <div key={i} className="px-3.5 py-3 flex items-center gap-3 text-xs">
                          <div className="w-20 shrink-0">
                            <div className="font-medium text-slate-100">{d.dayName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{d.dateShort}</div>
                          </div>

                          <div className="flex items-center gap-1.5 w-16 shrink-0">
                            <WeatherIcon conditionType={d.conditionType} isDaytime={true} className="w-4 h-4" />
                            {d.precipProb > 0 && (
                              <span className="font-mono tabular-nums text-[11px] text-sky-400">{d.precipProb}%</span>
                            )}
                          </div>

                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <span className="font-mono tabular-nums text-slate-400 w-7 text-right">
                              {formatTempValue(d.minTempC, units)}°
                            </span>
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full relative overflow-hidden">
                              <div
                                className="absolute top-0 bottom-0 rounded-full"
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  background: 'linear-gradient(90deg, #38bdf8, #f59e0b)',
                                }}
                              />
                            </div>
                            <span className="font-mono tabular-nums text-white font-semibold w-7">
                              {formatTempValue(d.maxTempC, units)}°
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* TAB 4: AIR QUALITY */}
            {activeTab === 'air' && (
              <div className="space-y-4">
                {bundle.airQuality ? (
                  <>
                    <div className="p-4 bg-[#111827] border border-slate-800/90 rounded-lg flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-400">{bundle.airQuality.indexName}</p>
                        <p className="text-base font-semibold text-white mt-0.5">{bundle.airQuality.category}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Dominant pollutant:{' '}
                          <span className="font-mono text-slate-200">{bundle.airQuality.dominantPollutant}</span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span
                          className="font-mono tabular-nums text-4xl font-bold"
                          style={{color: bundle.airQuality.colorCss}}
                        >
                          {bundle.airQuality.aqiDisplay}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">AQI</span>
                      </div>
                    </div>

                    {bundle.airQuality.healthRecommendations?.generalPopulation && (
                      <div className="p-3.5 bg-[#111827] border border-slate-800/90 rounded-lg space-y-1.5">
                        <p className="text-xs font-medium text-slate-200">Health Guidance</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {bundle.airQuality.healthRecommendations.generalPopulation}
                        </p>
                      </div>
                    )}

                    {bundle.airQuality.pollutants.length > 0 && (
                      <div className="border border-slate-800/90 rounded-lg divide-y divide-slate-800/70 bg-[#111827]">
                        {bundle.airQuality.pollutants.map((p) => (
                          <div key={p.code} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-200">{p.displayName}</div>
                              <div className="text-[11px] text-slate-500 truncate">{p.fullName}</div>
                            </div>
                            <div className="font-mono tabular-nums text-sm font-semibold text-white shrink-0">
                              {p.value.toFixed(1)}{' '}
                              <span className="text-[11px] font-normal text-slate-400">{p.units}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 font-mono">Source: {bundle.airQuality.sourceName}</p>
                  </>
                ) : (
                  <div className="p-4 bg-[#111827] border border-slate-800/90 rounded-lg text-xs text-slate-400">
                    Air quality telemetry is unavailable for this remote coordinate.
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
}
