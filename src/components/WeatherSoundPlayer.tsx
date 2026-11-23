import {
  CloudLightning,
  CloudRain,
  Pause,
  Play,
  Repeat,
  Snowflake,
  Sparkles,
  Sun,
  Trees,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {
  WEATHER_SOUND_OPTIONS,
  WeatherSoundState,
  suggestSoundForWeather,
  weatherSoundEngine,
} from '../services/weatherSoundService';
import {WeatherSoundId} from '../types/weather';

interface WeatherSoundPlayerProps {
  conditionType?: string;
  conditionDescription?: string;
  windSpeedKmh?: number;
  compact?: boolean;
}

const SOUND_ICON_MAP: Record<WeatherSoundId, typeof Sun> = {
  sunny: Sun,
  rainy: CloudRain,
  thunderstorm: CloudLightning,
  snow: Snowflake,
  windy: Wind,
  ocean: Waves,
  forest: Trees,
};

export function WeatherSoundPlayer({
  conditionType,
  conditionDescription,
  windSpeedKmh,
  compact = false,
}: WeatherSoundPlayerProps) {
  const [soundState, setSoundState] = useState<WeatherSoundState>(() => weatherSoundEngine.getState());

  useEffect(() => {
    return weatherSoundEngine.subscribe(setSoundState);
  }, []);

  const suggestedId = useMemo(
    () => suggestSoundForWeather(conditionType, conditionDescription, windSpeedKmh),
    [conditionType, conditionDescription, windSpeedKmh]
  );

  const activeOption = useMemo(
    () => WEATHER_SOUND_OPTIONS.find((o) => o.id === soundState.selectedSound) ?? WEATHER_SOUND_OPTIONS[0],
    [soundState.selectedSound]
  );

  const suggestedOption = useMemo(
    () => WEATHER_SOUND_OPTIONS.find((o) => o.id === suggestedId) ?? WEATHER_SOUND_OPTIONS[0],
    [suggestedId]
  );

  const ActiveIcon = SOUND_ICON_MAP[activeOption.id];
  const volumePercent = Math.round((soundState.isMuted ? 0 : soundState.volume) * 100);

  return (
    <section
      aria-label="Feel the Weather Sound audio player"
      className={`rounded-xl border transition-colors ${
        compact
          ? 'p-3.5 bg-[#0F1522] border-slate-800/90'
          : 'p-4 sm:p-5 bg-[#0B111E]/90 backdrop-blur-md border-slate-700/80 shadow-2xl'
      } space-y-3.5`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-lg border border-slate-700/80 bg-[#070B14] flex items-center justify-center shrink-0"
            style={{color: activeOption.accentColor}}
          >
            <ActiveIcon className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xs sm:text-sm font-semibold text-white truncate">
                Feel the Weather Sound
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {activeOption.label} · {activeOption.subtitle}
            </p>
          </div>
        </div>

        {/* Auto-suggestion action (user-triggered only, never autoplays) */}
        {soundState.selectedSound !== suggestedId && (
          <button
            type="button"
            onClick={() => weatherSoundEngine.selectSound(suggestedId, false)}
            title={`Match current weather (${suggestedOption.label})`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-[11px] font-medium text-cyan-300 shrink-0 transition-colors"
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            <span>Match: {suggestedOption.label}</span>
          </button>
        )}
      </div>

      {/* Soundscape Selector Grid */}
      <div
        role="radiogroup"
        aria-label="Select ambient weather soundscape"
        className="grid grid-cols-4 sm:grid-cols-7 gap-1.5"
      >
        {WEATHER_SOUND_OPTIONS.map((opt) => {
          const Icon = SOUND_ICON_MAP[opt.id];
          const isSelected = soundState.selectedSound === opt.id;
          const isSuggested = opt.id === suggestedId;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => weatherSoundEngine.selectSound(opt.id)}
              title={`${opt.label}: ${opt.subtitle}${isSuggested ? ' (Suggested for current weather)' : ''}`}
              className={`relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border text-[11px] font-medium transition-colors min-h-[50px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isSelected
                  ? 'bg-cyan-500/15 border-cyan-400/70 text-white'
                  : 'bg-[#070B14] border-slate-800/90 text-slate-400 hover:text-slate-100 hover:border-slate-700'
              }`}
            >
              <Icon
                className="w-3.5 h-3.5 shrink-0"
                style={isSelected ? {color: opt.accentColor} : undefined}
                aria-hidden="true"
              />
              <span className="truncate max-w-full leading-none">{opt.label}</span>
              {isSuggested && !isSelected && (
                <span
                  aria-label="Suggested"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400/80"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Transport & Volume Controls */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => weatherSoundEngine.togglePlay()}
          aria-label={soundState.isPlaying ? 'Pause weather sound' : 'Play weather sound'}
          className={`inline-flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-lg text-xs font-semibold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            soundState.isPlaying
              ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
          }`}
        >
          {soundState.isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Play</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => weatherSoundEngine.toggleMute()}
          aria-label={soundState.isMuted ? 'Unmute weather sound' : 'Mute weather sound'}
          title={soundState.isMuted ? 'Unmute' : 'Mute'}
          className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            soundState.isMuted
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : 'bg-[#070B14] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
          }`}
        >
          {soundState.isMuted ? (
            <VolumeX className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Volume2 className="w-4 h-4" aria-hidden="true" />
          )}
        </button>

        {/* Volume Slider */}
        <div className="flex-1 min-w-[110px] flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={volumePercent}
            onChange={(e) => weatherSoundEngine.setVolume(Number(e.target.value) / 100)}
            aria-label="Weather sound volume"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <span className="font-mono tabular-nums text-[11px] text-slate-400 w-8 text-right shrink-0">
            {volumePercent}%
          </span>
        </div>

        {/* Loop Playback Toggle */}
        <button
          type="button"
          aria-pressed={soundState.isLooping}
          onClick={() => weatherSoundEngine.toggleLoop()}
          title={soundState.isLooping ? 'Continuous loop enabled' : '30s session (Loop off)'}
          className={`inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border text-[11px] font-medium shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            soundState.isLooping
              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
              : 'bg-[#070B14] border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Loop</span>
        </button>
      </div>
    </section>
  );
}
