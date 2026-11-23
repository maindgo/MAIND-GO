import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {MapPin, Search, X} from 'lucide-react';
import {FormEvent, useCallback, useEffect, useRef, useState} from 'react';

interface PlaceSelection {
  lat: number;
  lng: number;
  name: string;
  subtitle: string;
}

interface PlaceSearchBoxProps {
  onSelectLocation: (loc: PlaceSelection) => void;
}

export function PlaceSearchBox({onSelectLocation}: PlaceSearchBoxProps) {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsOpen(false);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const {AutocompleteSessionToken, AutocompleteSuggestion} = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setIsLoading(true);
        setSearchError(null);
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions || []);
        setIsOpen(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT') || msg.includes('429')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [placesLib, query]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
    setIsOpen(false);
  }, []);

  const handleSuggestionPick = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        const loc = place.location;
        if (loc) {
          const fullText = suggestion.placePrediction.text?.text || place.formattedAddress || '';
          const parts = fullText.split(',');
          onSelectLocation({
            lat: loc.lat(),
            lng: loc.lng(),
            name: place.displayName || parts[0]?.trim() || 'Selected Place',
            subtitle: parts.slice(1).join(',').trim() || place.formattedAddress || '',
          });
          setQuery('');
          setSearchError(null);
        }
        resetSession();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT') || msg.includes('429')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSearchError('Could not load coordinates for that place.');
      }
    },
    [placesLib, onSelectLocation, resetSession]
  );

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      await handleSuggestionPick(suggestions[0]);
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) return;

    // Fallback geocoding search via Open-Meteo geocoding if Places predictions are unavailable
    try {
      setIsLoading(true);
      setSearchError(null);
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        const first = data?.results?.[0];
        if (first) {
          onSelectLocation({
            lat: first.latitude,
            lng: first.longitude,
            name: first.name,
            subtitle: [first.admin1, first.country].filter(Boolean).join(', '),
          });
          setQuery('');
          resetSession();
          return;
        }
      }
      setSearchError('No matching city or region found.');
    } catch {
      setSearchError('Search service temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleFormSubmit} className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder="Search city, region, or coordinates..."
          aria-label="Search global weather location"
          className="w-full h-10 pl-9 pr-9 bg-[#111827]/95 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setIsOpen(false);
              setSearchError(null);
            }}
            aria-label="Clear search"
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {searchError && <p className="mt-1.5 text-xs text-amber-400">{searchError}</p>}

      {isOpen && (suggestions.length > 0 || isLoading) && (
        <div className="absolute left-0 right-0 top-11 z-40 bg-[#0F1420] border border-slate-700/90 rounded-lg shadow-2xl overflow-hidden">
          {isLoading && suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-400">Searching locations...</div>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-y-auto divide-y divide-slate-800/70">
              {suggestions.map((s, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => void handleSuggestionPick(s)}
                    className="w-full px-3 py-2.5 text-left flex items-start gap-2.5 hover:bg-slate-800/70 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-xs sm:text-sm text-slate-200 leading-snug">
                      {s.placePrediction?.text?.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
