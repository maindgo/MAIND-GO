import {
  AdvancedMarker,
  CollisionBehavior,
  InfoWindow,
  Map as GoogleMap,
  MapCameraChangedEvent,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Cloud,
  CloudRain,
  Compass,
  Layers,
  LocateFixed,
  Minus,
  Plus,
  Thermometer,
  Wind,
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BaseMapStyle,
  LatLngPoint,
  LocationWeatherBundle,
  MapLayerMode,
  RainViewerFrame,
  StationWeatherPin,
  UnitSystem,
  WindGridSample,
} from '../types/weather';
import {formatCoords, formatSpeedValue, formatTempValue, speedUnitLabel, tempUnitLabel} from '../utils/weatherFormat';
import {PlaceSearchBox} from './PlaceSearchBox';
import {TimelineControls} from './TimelineControls';
import {WeatherIcon} from './WeatherIcon';
import {WindParticleOverlay} from './WindParticleOverlay';

interface ZoomEarthMapProps {
  apiKey: string;
  authError?: string | null;
  center: LatLngPoint;
  zoom: number;
  onCameraChange: (center: LatLngPoint, zoom: number) => void;
  onBoundsIdle: (bounds: {north: number; south: number; east: number; west: number}) => void;
  onMapClickCoords: (lat: number, lng: number) => void;
  onSelectSearchPlace: (loc: {lat: number; lng: number; name: string; subtitle: string}) => void;
  selectedBundle: LocationWeatherBundle | null;
  selectedPoint: LatLngPoint;
  userLocation: LatLngPoint | null;
  onEnableLocation: () => void;
  layerMode: MapLayerMode;
  onLayerModeChange: (mode: MapLayerMode) => void;
  baseMapStyle: BaseMapStyle;
  onBaseMapStyleChange: (style: BaseMapStyle) => void;
  units: UnitSystem;
  stationPins: StationWeatherPin[];
  rainViewerHost: string;
  activeFrames: RainViewerFrame[];
  frameIndex: number;
  onFrameChange: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: 1 | 2 | 3;
  onCyclePlaybackSpeed: () => void;
  isConfirmedPremium: boolean;
  onOpenVip: () => void;
  layerOpacity: number;
  onOpacityChange: (val: number) => void;
  windGrid: WindGridSample[];
}

interface OverzoomTileLayerOptions {
  name: string;
  maxNativeZoom: number;
  maxZoom: number;
  initialOpacity: number;
  getTileUrl: (zoom: number, x: number, y: number) => string;
}

interface OverzoomMapType extends google.maps.MapType {
  setOpacity: (nextOpacity: number) => void;
  dispose: () => void;
}

function createOverzoomTileLayer(opts: OverzoomTileLayerOptions): OverzoomMapType {
  const TILE_SIZE = 256;
  let currentOpacity = opts.initialOpacity;
  let disposed = false;

  const activeTiles = new Set<HTMLElement>();
  const releasedTiles = new WeakSet<Element>();
  const parentImageCache = new Map<string, Promise<HTMLImageElement | null>>();

  const loadParentImage = (url: string): Promise<HTMLImageElement | null> => {
    const cached = parentImageCache.get(url);
    if (cached) return cached;

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
      img.onerror = () => resolve(null);
      img.src = url;
    });

    if (parentImageCache.size >= 48) {
      const oldestKey = parentImageCache.keys().next().value;
      if (oldestKey) parentImageCache.delete(oldestKey);
    }
    parentImageCache.set(url, promise);
    return promise;
  };

  const mapType: OverzoomMapType = {
    tileSize: new google.maps.Size(TILE_SIZE, TILE_SIZE),
    minZoom: 0,
    maxZoom: opts.maxZoom,
    name: opts.name,
    alt: opts.name,
    projection: null,
    radius: 6378137,

    setOpacity(nextOpacity: number) {
      currentOpacity = nextOpacity;
      activeTiles.forEach((tile) => {
        tile.style.opacity = String(nextOpacity);
      });
    },

    dispose() {
      disposed = true;
      activeTiles.forEach((tile) => releasedTiles.add(tile));
      activeTiles.clear();
      parentImageCache.clear();
    },

    getTile(coord: google.maps.Point | null, zoom: number, ownerDocument: Document): Element {
      const empty = ownerDocument.createElement('div');
      empty.style.width = `${TILE_SIZE}px`;
      empty.style.height = `${TILE_SIZE}px`;

      if (!coord || disposed || zoom < 0 || zoom > opts.maxZoom) {
        return empty;
      }

      const numTiles = 1 << zoom;
      if (coord.y < 0 || coord.y >= numTiles) {
        return empty;
      }

      const wrappedX = ((coord.x % numTiles) + numTiles) % numTiles;

      if (zoom <= opts.maxNativeZoom) {
        const img = ownerDocument.createElement('img');
        img.style.width = `${TILE_SIZE}px`;
        img.style.height = `${TILE_SIZE}px`;
        img.style.display = 'block';
        img.style.opacity = String(currentOpacity);
        img.style.pointerEvents = 'none';
        img.alt = '';
        img.decoding = 'async';
        img.onerror = () => {
          img.style.display = 'none';
        };
        img.src = opts.getTileUrl(zoom, wrappedX, coord.y);
        activeTiles.add(img);
        return img;
      }

      // Overzoom cleanly from maxNativeZoom so zoomed-in views never trigger
      // upstream "Zoom level not supported" errors.
      const zoomDiff = zoom - opts.maxNativeZoom;
      const scale = 1 << zoomDiff;
      const parentX = Math.floor(wrappedX / scale);
      const parentY = Math.floor(coord.y / scale);
      const subX = wrappedX % scale;
      const subY = coord.y % scale;

      const canvas = ownerDocument.createElement('canvas');
      canvas.width = TILE_SIZE;
      canvas.height = TILE_SIZE;
      canvas.style.width = `${TILE_SIZE}px`;
      canvas.style.height = `${TILE_SIZE}px`;
      canvas.style.display = 'block';
      canvas.style.opacity = String(currentOpacity);
      canvas.style.pointerEvents = 'none';
      activeTiles.add(canvas);

      const parentUrl = opts.getTileUrl(opts.maxNativeZoom, parentX, parentY);
      void loadParentImage(parentUrl).then((img) => {
        if (!img || disposed || releasedTiles.has(canvas)) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const sw = img.naturalWidth / scale;
        const sh = img.naturalHeight / scale;
        const sx = subX * sw;
        const sy = subY * sh;

        ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TILE_SIZE, TILE_SIZE);
      });

      return canvas;
    },

    releaseTile(tile: Element | null) {
      if (!tile) return;
      releasedTiles.add(tile);
      if (tile instanceof HTMLElement) {
        activeTiles.delete(tile);
      }
      if (tile instanceof HTMLImageElement) {
        tile.src = '';
      }
    },
  };

  return mapType;
}

function getLatestNasaGibsDate(): string {
  // NASA GIBS near-real-time global composites stabilize within ~24h UTC
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function TileOverlayController({
  apiKey,
  layerMode,
  rainViewerHost,
  activeFrame,
  opacity,
}: {
  apiKey: string;
  layerMode: MapLayerMode;
  rainViewerHost: string;
  activeFrame?: RainViewerFrame;
  opacity: number;
}) {
  const map = useMap();
  const activeLayerRef = useRef<OverzoomMapType | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    if (!map) return;
    map.overlayMapTypes.clear();
    activeLayerRef.current?.dispose();
    activeLayerRef.current = null;

    let nextLayer: OverzoomMapType | null = null;

    if (layerMode === 'radar' && activeFrame && rainViewerHost) {
      // RainViewer free public radar tiles support up to zoom 7 (returning a
      // "Zoom level not supported" placeholder PNG for z >= 8). Using 512px
      // native tiles at z <= 7 and canvas overzooming up to z18 keeps radar crisp.
      nextLayer = createOverzoomTileLayer({
        name: 'Precipitation Radar',
        maxNativeZoom: 7,
        maxZoom: 18,
        initialOpacity: opacityRef.current,
        getTileUrl: (z, x, y) => `${rainViewerHost}${activeFrame.path}/512/${z}/${x}/${y}/6/1_1.png`,
      });
    } else if (layerMode === 'satellite_ir') {
      if (activeFrame && rainViewerHost) {
        nextLayer = createOverzoomTileLayer({
          name: 'Infrared Satellite',
          maxNativeZoom: 7,
          maxZoom: 18,
          initialOpacity: opacityRef.current,
          getTileUrl: (z, x, y) => `${rainViewerHost}${activeFrame.path}/256/${z}/${x}/${y}/0/0_0.png`,
        });
      } else {
        const gibsDate = getLatestNasaGibsDate();
        nextLayer = createOverzoomTileLayer({
          name: 'NASA VIIRS Orbital Satellite',
          maxNativeZoom: 9,
          maxZoom: 18,
          initialOpacity: opacityRef.current,
          getTileUrl: (z, x, y) =>
            `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/${z}/${y}/${x}.jpg`,
        });
      }
    } else if (layerMode === 'aqi' && apiKey) {
      nextLayer = createOverzoomTileLayer({
        name: 'Air Quality Heatmap',
        maxNativeZoom: 16,
        maxZoom: 18,
        initialOpacity: opacityRef.current,
        getTileUrl: (z, x, y) =>
          `https://airquality.googleapis.com/v1/mapTypes/UAQI_RED_GREEN/heatmapTiles/${z}/${x}/${y}?key=${apiKey}`,
      });
    }

    if (nextLayer) {
      activeLayerRef.current = nextLayer;
      map.overlayMapTypes.insertAt(0, nextLayer);
    }

    return () => {
      map.overlayMapTypes.clear();
      activeLayerRef.current?.dispose();
      activeLayerRef.current = null;
    };
  }, [map, apiKey, layerMode, rainViewerHost, activeFrame]);

  useEffect(() => {
    activeLayerRef.current?.setOpacity(opacity);
  }, [opacity]);

  return null;
}

function MapImperativeBridge({
  onBoundsIdle,
  zoomRef,
}: {
  onBoundsIdle: (bounds: {north: number; south: number; east: number; west: number}) => void;
  zoomRef: React.MutableRefObject<{zoomIn: () => void; zoomOut: () => void} | null>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    zoomRef.current = {
      zoomIn: () => map.setZoom(Math.min(18, (map.getZoom() ?? 4) + 1)),
      zoomOut: () => map.setZoom(Math.max(2, (map.getZoom() ?? 4) - 1)),
    };

    const listener = map.addListener('idle', () => {
      const b = map.getBounds();
      if (!b) return;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      onBoundsIdle({
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      });
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onBoundsIdle, zoomRef]);

  return null;
}

export function ZoomEarthMap({
  apiKey,
  authError,
  center,
  zoom,
  onCameraChange,
  onBoundsIdle,
  onMapClickCoords,
  onSelectSearchPlace,
  selectedBundle,
  selectedPoint,
  userLocation,
  onEnableLocation,
  layerMode,
  onLayerModeChange,
  baseMapStyle,
  onBaseMapStyleChange,
  units,
  stationPins,
  rainViewerHost,
  activeFrames,
  frameIndex,
  onFrameChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onCyclePlaybackSpeed,
  isConfirmedPremium,
  onOpenVip,
  layerOpacity,
  onOpacityChange,
  windGrid,
}: ZoomEarthMapProps) {
  const isApiLoaded = useApiIsLoaded();
  const loadingStatus = useApiLoadingStatus();
  const [infoOpen, setInfoOpen] = useState(false);
  const [markerRef, markerInstance] = useAdvancedMarkerRef();
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const zoomBridgeRef = useRef<{zoomIn: () => void; zoomOut: () => void} | null>(null);

  const handleCameraChanged = useCallback(
    (ev: MapCameraChangedEvent) => {
      onCameraChange(ev.detail.center, ev.detail.zoom);
    },
    [onCameraChange]
  );

  const activeFrame = useMemo(() => activeFrames[frameIndex], [activeFrames, frameIndex]);

  const layerOptions: Array<{id: MapLayerMode; label: string; icon: typeof CloudRain}> = [
    {id: 'radar', label: 'Radar', icon: CloudRain},
    {id: 'satellite_ir', label: 'Satellite', icon: Cloud},
    {id: 'wind', label: 'Wind', icon: Wind},
    {id: 'temp', label: 'Temp', icon: Thermometer},
    {id: 'aqi', label: 'Air Quality', icon: Compass},
  ];

  const baseStyles: Array<{id: BaseMapStyle; label: string}> = [
    {id: 'hybrid', label: 'Satellite + Labels'},
    {id: 'satellite', label: 'Pure Satellite'},
    {id: 'terrain', label: 'Terrain'},
    {id: 'roadmap', label: 'Map'},
  ];

  return (
    <div className="relative flex-1 h-full min-h-[420px] bg-[#07090E] overflow-hidden">
      {!apiKey && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#07090E] z-20 p-6 text-center">
          <div className="max-w-md space-y-2.5 bg-[#0B0E17] border border-slate-800/90 rounded-2xl p-6 shadow-2xl">
            <p className="text-sm font-semibold text-slate-100">Google Maps API key not configured</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ensure <span className="font-mono text-cyan-300">VITE_GOOGLE_MAPS_API_KEY</span> is available to render
              the interactive satellite map.
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Add <span className="font-mono text-slate-300">VITE_GOOGLE_MAPS_API_KEY</span> to your{' '}
              <span className="font-mono text-slate-300">.env</span> file or deployment environment variables and rebuild
              or restart the server.
            </p>
          </div>
        </div>
      )}

      {apiKey &&
        (Boolean(authError) ||
          loadingStatus === APILoadingStatus.FAILED ||
          loadingStatus === APILoadingStatus.AUTH_FAILURE) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#07090E]/92 z-20 p-6 text-center">
            <div className="max-w-md space-y-2.5 bg-[#0B0E17] border border-amber-500/35 rounded-2xl p-6 shadow-2xl">
              <p className="text-sm font-semibold text-amber-300">
                {authError || loadingStatus === APILoadingStatus.AUTH_FAILURE
                  ? 'Google Maps API key is invalid or unauthorized'
                  : 'Unable to load satellite map tiles'}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {authError || loadingStatus === APILoadingStatus.AUTH_FAILURE
                  ? 'Verify that VITE_GOOGLE_MAPS_API_KEY is valid, Maps JavaScript API and Places API (New) are enabled in Google Cloud, billing is active, and HTTP referrer restrictions allow this domain.'
                  : 'Please check your network connection or Google Maps Platform API quota.'}
              </p>
            </div>
          </div>
        )}

      {apiKey && !authError && loadingStatus !== APILoadingStatus.AUTH_FAILURE && (
        <GoogleMap
          mapId="DEMO_MAP_ID"
          center={center}
          zoom={zoom}
          minZoom={2}
          maxZoom={18}
          mapTypeId={baseMapStyle}
          gestureHandling="greedy"
          disableDefaultUI={true}
          clickableIcons={false}
          onCameraChanged={handleCameraChanged}
          onClick={(ev) => {
            const latLng = ev.detail.latLng;
            if (latLng) {
              onMapClickCoords(latLng.lat, latLng.lng);
              setInfoOpen(true);
            }
          }}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full"
        >
          <TileOverlayController
            apiKey={apiKey}
            layerMode={layerMode}
            rainViewerHost={rainViewerHost}
            activeFrame={activeFrame}
            opacity={layerOpacity}
          />

          <MapImperativeBridge onBoundsIdle={onBoundsIdle} zoomRef={zoomBridgeRef} />

          <WindParticleOverlay
            active={layerMode === 'wind'}
            windGrid={windGrid}
            opacity={layerOpacity}
          />

          {/* Live Global Weather Station Pins */}
          {stationPins.map((pin) => (
            <AdvancedMarker
              key={pin.id}
              position={{lat: pin.lat, lng: pin.lng}}
              collisionBehavior={CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
              onClick={() => {
                onSelectSearchPlace({
                  lat: pin.lat,
                  lng: pin.lng,
                  name: pin.name,
                  subtitle: 'Live Weather Station',
                });
                setInfoOpen(true);
              }}
              title={`${pin.name}: ${formatTempValue(pin.temperatureC, units)}${tempUnitLabel(units)}`}
            >
              <div className="px-2 py-1 rounded-md bg-[#0B0E17]/90 border border-slate-700/90 hover:border-cyan-400 shadow-lg flex items-center gap-1.5 cursor-pointer transition-colors">
                <WeatherIcon conditionType={pin.conditionType} isDaytime={pin.isDaytime} className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums text-[11px] font-semibold text-white">
                  {formatTempValue(pin.temperatureC, units)}°
                </span>
                <span className="text-[10px] text-slate-300 font-medium hidden sm:inline max-w-[74px] truncate">
                  {pin.name}
                </span>
              </div>
            </AdvancedMarker>
          ))}

          {/* User Live GPS Location Beacon */}
          {userLocation && (
            <AdvancedMarker
              position={userLocation}
              zIndex={40}
              title="Your Live Location"
              onClick={() => onMapClickCoords(userLocation.lat, userLocation.lng)}
            >
              <div className="relative flex items-center justify-center">
                <span className="w-6 h-6 rounded-full bg-cyan-400/25 border border-cyan-400/60" />
                <span className="absolute w-3 h-3 rounded-full bg-cyan-400 border-2 border-white shadow" />
              </div>
            </AdvancedMarker>
          )}

          {/* Active Selected Location Crosshair Marker */}
          <AdvancedMarker
            ref={markerRef}
            position={selectedPoint}
            zIndex={50}
            onClick={() => setInfoOpen((prev) => !prev)}
            title={selectedBundle?.current.locationName || 'Selected Coordinate'}
          >
            <div className="flex flex-col items-center -translate-y-1/2 cursor-pointer">
              <div className="px-2.5 py-1 rounded-md bg-cyan-500 text-slate-950 font-mono tabular-nums text-xs font-bold shadow-xl border border-cyan-200/70">
                {selectedBundle
                  ? `${formatTempValue(selectedBundle.current.temperatureC, units)}${tempUnitLabel(units)}`
                  : 'Inspect'}
              </div>
              <div className="w-0.5 h-2.5 bg-cyan-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-[#07090E]" />
            </div>
          </AdvancedMarker>

          {infoOpen && markerInstance && selectedBundle && (
            <InfoWindow anchor={markerInstance} onCloseClick={() => setInfoOpen(false)} maxWidth={240}>
              <div className="space-y-1.5 text-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display font-semibold text-sm text-white truncate">
                    {selectedBundle.current.locationName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(false)}
                    className="text-xs text-slate-400 hover:text-white"
                    aria-label="Close popup"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <WeatherIcon
                    conditionType={selectedBundle.current.conditionType}
                    isDaytime={selectedBundle.current.isDaytime}
                    className="w-5 h-5"
                  />
                  <span className="font-mono tabular-nums text-lg font-bold text-white">
                    {formatTempValue(selectedBundle.current.temperatureC, units)}
                    {tempUnitLabel(units)}
                  </span>
                  <span className="text-xs text-slate-300">{selectedBundle.current.conditionDescription}</span>
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400">
                  Wind {formatSpeedValue(selectedBundle.current.windSpeedKmh, units)} {speedUnitLabel(units)}{' '}
                  {selectedBundle.current.windCardinal} · RH {selectedBundle.current.relativeHumidity}%
                </div>
                <div className="text-[10px] font-mono tabular-nums text-slate-500">
                  {formatCoords(selectedBundle.current.lat, selectedBundle.current.lng)}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}

      {/* Top-Left Search Bar Overlay */}
      <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-80 z-20">
        {!apiKey ||
        Boolean(authError) ||
        isApiLoaded ||
        loadingStatus === APILoadingStatus.FAILED ||
        loadingStatus === APILoadingStatus.AUTH_FAILURE ? (
          <PlaceSearchBox onSelectLocation={onSelectSearchPlace} />
        ) : (
          <div className="h-10 bg-[#111827]/90 border border-slate-800 rounded-lg px-3 flex items-center text-xs text-slate-500">
            Initializing map search...
          </div>
        )}
      </div>

      {/* Left Edge Zoom-Earth Layer Dock */}
      <div className="absolute left-4 top-20 z-20 flex flex-col gap-1.5 bg-[#0B0E17]/90 backdrop-blur-md border border-slate-800/90 rounded-xl p-1.5 shadow-2xl">
        {layerOptions.map((opt) => {
          const Icon = opt.icon;
          const active = layerMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onLayerModeChange(opt.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}

        <div className="h-px bg-slate-800 my-0.5" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBasemapMenu((v) => !v)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white whitespace-nowrap transition-colors"
          >
            <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Map Style</span>
          </button>

          {showBasemapMenu && (
            <div className="absolute left-full top-0 ml-2 w-44 bg-[#0B0E17] border border-slate-700/90 rounded-lg shadow-2xl p-1 z-30">
              {baseStyles.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    onBaseMapStyleChange(st.id);
                    setShowBasemapMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors ${
                    baseMapStyle === st.id
                      ? 'bg-cyan-500/15 text-cyan-300 font-medium'
                      : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Edge Map Zoom & Locate Controls */}
      <div className="absolute right-4 top-20 sm:top-4 z-20 flex flex-col gap-1.5 bg-[#0B0E17]/90 backdrop-blur-md border border-slate-800/90 rounded-xl p-1 shadow-2xl">
        <button
          type="button"
          onClick={() => zoomBridgeRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-200 hover:bg-slate-800/80 hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomBridgeRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-200 hover:bg-slate-800/80 hover:text-white transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-800 mx-1" />
        <button
          type="button"
          onClick={onEnableLocation}
          aria-label="Center on my live location"
          title="Center on my live location"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-cyan-400 hover:bg-slate-800/80 hover:text-cyan-300 transition-colors"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Radar/Satellite Timeline & Legend */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl flex justify-center">
          <TimelineControls
            layerMode={layerMode}
            frames={activeFrames}
            frameIndex={frameIndex}
            onFrameChange={onFrameChange}
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            playbackSpeed={playbackSpeed}
            onCyclePlaybackSpeed={onCyclePlaybackSpeed}
            isConfirmedPremium={isConfirmedPremium}
            onOpenVip={onOpenVip}
            opacity={layerOpacity}
            onOpacityChange={onOpacityChange}
          />
        </div>
      </div>
    </div>
  );
}
