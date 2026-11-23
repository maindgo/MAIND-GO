import {
  Bookmark,
  Crown,
  Home,
  Lock,
  MapPin,
  Navigation,
  Plus,
  Trash2,
} from 'lucide-react';
import {useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {AppPage, LocationWeatherBundle, SavedLocation, UnitSystem} from '../types/weather';
import {formatCoords, formatTempValue, tempUnitLabel} from '../utils/weatherFormat';

interface SavedLocationsPageProps {
  currentBundle: LocationWeatherBundle | null;
  units: UnitSystem;
  onSelectLocation: (loc: {lat: number; lng: number; name: string; subtitle: string}) => void;
  onNavigate: (page: AppPage) => void;
}

export function SavedLocationsPage({
  currentBundle,
  units,
  onSelectLocation,
  onNavigate,
}: SavedLocationsPageProps) {
  const {
    firebaseUser,
    isConfirmedPremium,
    hasPendingPayment,
    savedLocations,
    saveLocation,
    setHomeLocation,
    removeSavedLocation,
  } = useAuth();

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingCurrent, setSavingCurrent] = useState(false);

  const handleSaveCurrent = async () => {
    if (!currentBundle) return;
    setActionError(null);
    setSavingCurrent(true);
    try {
      await saveLocation({
        name: currentBundle.current.locationName,
        subtitle: currentBundle.current.regionSubtitle,
        lat: currentBundle.current.lat,
        lng: currentBundle.current.lng,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save location.');
    } finally {
      setSavingCurrent(false);
    }
  };

  const handleSetHome = async (loc: SavedLocation) => {
    setActionError(null);
    setBusyId(loc.id);
    try {
      await setHomeLocation(loc.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update home location.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (loc: SavedLocation) => {
    setActionError(null);
    setBusyId(loc.id);
    try {
      await removeSavedLocation(loc.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove location.');
    } finally {
      setBusyId(null);
    }
  };

  if (!firebaseUser) {
    return (
      <div className="flex-1 overflow-y-auto maingo-scroll bg-[#07090E] p-6 sm:p-10 flex items-center justify-center">
        <div className="max-w-md w-full bg-[#0B0E17] border border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mx-auto">
            <Bookmark className="w-6 h-6 text-cyan-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Saved Locations</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Sign up or log in to bookmark your favorite cities, set a home forecast station, and sync locations across devices.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('account')}
            className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Sign Up / Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto maingo-scroll bg-[#07090E] p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Saved Locations</h1>
            <p className="text-sm text-slate-400 mt-1">
              Jump directly to any saved coordinate on the interactive satellite map.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono tabular-nums text-slate-300 flex items-center gap-2">
              {isConfirmedPremium ? (
                <>
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>{savedLocations.length} Saved · Unlimited VIP</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{savedLocations.length} / 3 Free Slots</span>
                </>
              )}
            </div>

            {currentBundle && (
              <button
                type="button"
                onClick={handleSaveCurrent}
                disabled={savingCurrent}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs sm:text-sm font-semibold hover:bg-cyan-400 disabled:opacity-60 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {savingCurrent
                    ? 'Saving...'
                    : `Save ${currentBundle.current.locationName} (${formatTempValue(
                        currentBundle.current.temperatureC,
                        units
                      )}${tempUnitLabel(units)})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Notice if user hit free quota or has queued payment */}
        {!isConfirmedPremium && savedLocations.length >= 3 && (
          <div className="p-4 rounded-xl bg-[#111827] border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-amber-200 space-y-0.5">
              <p className="font-semibold">
                {hasPendingPayment
                  ? 'Free 3-location limit reached (Payment queued for confirmation)'
                  : 'Free 3-location limit reached'}
              </p>
              <p className="text-slate-400">
                {hasPendingPayment
                  ? 'Unlimited saved locations unlock as soon as your pending payment is confirmed.'
                  : 'Upgrade to PRO or VIP to unlock unlimited saved weather locations.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('vip')}
              className="px-3.5 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 shrink-0 transition-colors"
            >
              {hasPendingPayment ? 'Check Queue Status' : 'Upgrade to VIP'}
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-center justify-between gap-4">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} className="text-rose-300 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Saved Locations Grid */}
        {savedLocations.length === 0 ? (
          <div className="bg-[#0B0E17] border border-slate-800/90 rounded-2xl p-10 text-center space-y-3">
            <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
            <h2 className="font-display text-lg font-semibold text-white">No saved locations yet</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Save your current viewing point above, or click the bookmark button in the Weather Panel while exploring the Live Map.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('map')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              <span>Explore Live Map</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedLocations.map((loc) => (
              <div
                key={loc.id}
                className={`bg-[#0B0E17] border rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                  loc.isHome ? 'border-cyan-500/50' : 'border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold text-white truncate">{loc.name}</h2>
                    {loc.isHome && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[11px] font-medium text-cyan-300 shrink-0">
                        <Home className="w-3 h-3" />
                        <span>Home</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{loc.subtitle}</p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500">
                    {formatCoords(loc.lat, loc.lng)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectLocation({
                        lat: loc.lat,
                        lng: loc.lng,
                        name: loc.name,
                        subtitle: loc.subtitle,
                      });
                      onNavigate('map');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Open on Map</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {!loc.isHome && (
                      <button
                        type="button"
                        disabled={busyId === loc.id}
                        onClick={() => void handleSetHome(loc)}
                        title="Set as Home station"
                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors disabled:opacity-50"
                      >
                        <Home className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === loc.id}
                      onClick={() => void handleRemove(loc)}
                      title="Remove saved location"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
