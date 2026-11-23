import {ChevronLeft, ChevronRight, Lock, Pause, Play} from 'lucide-react';
import {MapLayerMode, RainViewerFrame} from '../types/weather';
import {formatUtcTimeShort} from '../utils/weatherFormat';

interface TimelineControlsProps {
  layerMode: MapLayerMode;
  frames: RainViewerFrame[];
  frameIndex: number;
  onFrameChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: 1 | 2 | 3;
  onCyclePlaybackSpeed: () => void;
  isConfirmedPremium: boolean;
  onOpenVip: () => void;
  opacity: number;
  onOpacityChange: (val: number) => void;
}

export function TimelineControls({
  layerMode,
  frames,
  frameIndex,
  onFrameChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onCyclePlaybackSpeed,
  isConfirmedPremium,
  onOpenVip,
  opacity,
  onOpacityChange,
}: TimelineControlsProps) {
  const activeFrame = frames[frameIndex];
  const hasTimeline = (layerMode === 'radar' || layerMode === 'satellite_ir') && frames.length > 0;

  return (
    <div className="bg-[#0B0E17]/90 backdrop-blur-md border border-slate-800/90 rounded-xl px-4 py-2.5 shadow-2xl flex flex-col gap-2 max-w-2xl w-full">
      {hasTimeline ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onFrameChange((frameIndex - 1 + frames.length) % frames.length)}
              aria-label="Previous frame"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => onFrameChange((frameIndex + 1) % frames.length)}
              aria-label="Next frame"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => (isConfirmedPremium ? onCyclePlaybackSpeed() : onOpenVip())}
              title={
                isConfirmedPremium
                  ? `Radar playback speed ${playbackSpeed}x (click to cycle)`
                  : '2x / 3x Radar Playback Speed is a confirmed VIP feature'
              }
              className={`ml-1 px-2 h-8 rounded-lg border font-mono text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                isConfirmedPremium
                  ? 'bg-[#111827] border-amber-500/40 text-amber-300 hover:border-amber-400'
                  : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-amber-300 hover:border-slate-700'
              }`}
            >
              {!isConfirmedPremium && <Lock className="w-3 h-3" aria-hidden="true" />}
              <span>{isConfirmedPremium ? `${playbackSpeed}x` : '1x'}</span>
            </button>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono tabular-nums text-slate-200 font-medium">
                {activeFrame ? formatUtcTimeShort(activeFrame.time) : '--:--'}
                {activeFrame?.isForecast ? ' · Forecast' : ' · Observed'}
              </span>
              <span className="font-mono tabular-nums text-slate-400">
                Frame {frameIndex + 1}/{frames.length}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, frames.length - 1)}
              value={frameIndex}
              onChange={(e) => onFrameChange(Number(e.target.value))}
              aria-label="Radar timeline scrubber"
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
        {/* Calibrated Scale Legend */}
        <div className="flex items-center gap-2">
          {layerMode === 'radar' && (
            <>
              <span className="text-slate-300 font-medium">Precipitation</span>
              <div
                className="w-28 h-2 rounded-sm"
                style={{
                  background:
                    'linear-gradient(90deg, #38bdf8 0%, #22c55e 35%, #eab308 60%, #f97316 80%, #ef4444 100%)',
                }}
              />
              <span className="font-mono tabular-nums text-slate-400">Light · Heavy</span>
            </>
          )}
          {layerMode === 'satellite_ir' && (
            <>
              <span className="text-slate-300 font-medium">
                {frames.length > 0 ? 'Cloud Infrared' : 'NASA VIIRS Orbital'}
              </span>
              <div
                className="w-28 h-2 rounded-sm"
                style={{
                  background:
                    frames.length > 0
                      ? 'linear-gradient(90deg, #1e293b 0%, #64748b 45%, #cbd5e1 80%, #f8fafc 100%)'
                      : 'linear-gradient(90deg, #0f172a 0%, #1d4ed8 35%, #22c55e 65%, #f8fafc 100%)',
                }}
              />
              <span className="font-mono tabular-nums text-slate-400">
                {frames.length > 0 ? 'Low · High Tops' : 'Earth · Cloud Cover'}
              </span>
            </>
          )}
          {layerMode === 'wind' && (
            <>
              <span className="text-slate-300 font-medium">10m Wind Streamlines</span>
              <div
                className="w-28 h-2 rounded-sm"
                style={{
                  background: 'linear-gradient(90deg, #bae6fd 0%, #22d3ee 55%, #38bdf8 100%)',
                }}
              />
              <span className="font-mono tabular-nums text-slate-400">0 · 60+ km/h</span>
            </>
          )}
          {layerMode === 'temp' && (
            <>
              <span className="text-slate-300 font-medium">Surface Stations</span>
              <div
                className="w-28 h-2 rounded-sm"
                style={{
                  background: 'linear-gradient(90deg, #3b82f6 0%, #22d3ee 35%, #f59e0b 70%, #ef4444 100%)',
                }}
              />
              <span className="font-mono tabular-nums text-slate-400">Cold · Hot</span>
            </>
          )}
          {layerMode === 'aqi' && (
            <>
              <span className="text-slate-300 font-medium">Universal AQI</span>
              <div
                className="w-28 h-2 rounded-sm"
                style={{
                  background: 'linear-gradient(90deg, #10b981 0%, #eab308 40%, #f97316 70%, #ef4444 100%)',
                }}
              />
              <span className="font-mono tabular-nums text-slate-400">Good · Poor</span>
            </>
          )}
        </div>

        {/* Layer Opacity */}
        {layerMode !== 'temp' && (
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-slate-400">Opacity</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="w-20 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="font-mono tabular-nums w-8 text-right text-slate-300">{Math.round(opacity * 100)}%</span>
          </label>
        )}
      </div>
    </div>
  );
}
