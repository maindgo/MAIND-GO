import {WeatherSoundId} from '../types/weather';

export interface WeatherSoundOption {
  id: WeatherSoundId;
  label: string;
  subtitle: string;
  accentColor: string;
}

export const WEATHER_SOUND_OPTIONS: WeatherSoundOption[] = [
  {
    id: 'sunny',
    label: 'Sunny',
    subtitle: 'Birds chirping & gentle breeze',
    accentColor: '#F59E0B',
  },
  {
    id: 'rainy',
    label: 'Rainy',
    subtitle: 'Realistic rainfall & raindrops',
    accentColor: '#22D3EE',
  },
  {
    id: 'thunderstorm',
    label: 'Thunderstorm',
    subtitle: 'Thunder, rain & strong wind',
    accentColor: '#818CF8',
  },
  {
    id: 'snow',
    label: 'Snow',
    subtitle: 'Cold winter wind ambience',
    accentColor: '#BAE6FD',
  },
  {
    id: 'windy',
    label: 'Windy',
    subtitle: 'Natural wind & rustling leaves',
    accentColor: '#38BDF8',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    subtitle: 'Relaxing ocean waves',
    accentColor: '#0EA5E9',
  },
  {
    id: 'forest',
    label: 'Forest',
    subtitle: 'Birds & deep forest ambience',
    accentColor: '#10B981',
  },
];

export function suggestSoundForWeather(
  conditionType?: string,
  description?: string,
  windSpeedKmh = 0
): WeatherSoundId {
  const combined = `${conditionType || ''} ${description || ''}`.toUpperCase();

  if (
    combined.includes('THUNDER') ||
    combined.includes('STORM') ||
    combined.includes('LIGHTNING')
  ) {
    return 'thunderstorm';
  }
  if (
    combined.includes('SNOW') ||
    combined.includes('BLIZZARD') ||
    combined.includes('SLEET') ||
    combined.includes('ICE') ||
    combined.includes('FREEZ')
  ) {
    return 'snow';
  }
  if (
    combined.includes('RAIN') ||
    combined.includes('DRIZZLE') ||
    combined.includes('SHOWER')
  ) {
    return 'rainy';
  }
  if (windSpeedKmh >= 28 || combined.includes('WIND') || combined.includes('GALE')) {
    return 'windy';
  }
  if (combined.includes('CLEAR') || combined.includes('SUNNY')) {
    return 'sunny';
  }
  if (combined.includes('FOG') || combined.includes('MIST') || combined.includes('CLOUD')) {
    return 'forest';
  }
  return 'sunny';
}

export interface WeatherSoundState {
  selectedSound: WeatherSoundId;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;
}

type SoundListener = (state: WeatherSoundState) => void;

const STORAGE_KEY_VOL = 'maindgo_sound_volume';
const STORAGE_KEY_MUTE = 'maindgo_sound_muted';

class WeatherSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sceneCleanup: (() => void) | null = null;
  private loopTimerId: number | null = null;
  private listeners = new Set<SoundListener>();

  private state: WeatherSoundState = {
    selectedSound: 'rainy',
    isPlaying: false,
    volume: this.loadVolume(),
    isMuted: this.loadMuted(),
    isLooping: true,
  };

  private loadVolume(): number {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_VOL);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage failure
    }
    return 0.65;
  }

  private loadMuted(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY_MUTE) === 'true';
    } catch {
      return false;
    }
  }

  private emit() {
    const snapshot = {...this.state};
    this.listeners.forEach((fn) => fn(snapshot));
  }

  subscribe(listener: SoundListener): () => void {
    this.listeners.add(listener);
    listener({...this.state});
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): WeatherSoundState {
    return {...this.state};
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private applyMasterGain(rampSec = 0.25) {
    if (!this.ctx || !this.masterGain) return;
    const target = this.state.isPlaying && !this.state.isMuted ? this.state.volume : 0;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(target, now, Math.max(0.02, rampSec / 3));
  }

  private clearActiveNodes() {
    if (this.loopTimerId !== null) {
      window.clearTimeout(this.loopTimerId);
      this.loopTimerId = null;
    }
    if (this.sceneCleanup) {
      try {
        this.sceneCleanup();
      } catch {
        // Ignore cleanup errors
      }
      this.sceneCleanup = null;
    }
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number, color: 'pink' | 'brown' | 'white'): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      if (color === 'white') {
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      } else if (color === 'brown') {
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.025 * white) / 1.025;
          data[i] = lastOut * 3.2;
        }
      } else {
        // Pink noise (Paul Kellet's refined filter)
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        let b6 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }

      // Smooth crossfade loop seam over final 0.1s so loop boundaries are inaudible
      const fadeSamples = Math.min(Math.floor(sampleRate * 0.1), Math.floor(length * 0.1));
      for (let i = 0; i < fadeSamples; i++) {
        const ratio = i / fadeSamples;
        const endIdx = length - fadeSamples + i;
        data[i] = data[i] * ratio + data[endIdx] * (1 - ratio);
      }
    }

    return buffer;
  }

  private buildSoundScene(soundId: WeatherSoundId) {
    this.clearActiveNodes();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const sceneGain = ctx.createGain();
    sceneGain.gain.value = 0.85;
    sceneGain.connect(this.masterGain);

    const sources: AudioScheduledSourceNode[] = [];
    const intervals: number[] = [];
    const timeouts: number[] = [];

    const startNoiseLoop = (
      color: 'pink' | 'brown' | 'white',
      filterType: BiquadFilterType,
      freq: number,
      q: number,
      gainVal: number,
      lfoRateHz?: number,
      lfoDepthHz?: number
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 4, color);
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;

      const g = ctx.createGain();
      g.gain.value = gainVal;

      if (lfoRateHz && lfoDepthHz) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = lfoRateHz;
        lfoGain.gain.value = lfoDepthHz;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        sources.push(lfo);
      }

      src.connect(filter);
      filter.connect(g);
      g.connect(sceneGain);
      src.start();
      sources.push(src);
      return {src, filter, gain: g};
    };

    const scheduleBirdChirp = (baseFreqMin: number, baseFreqMax: number, level = 0.045) => {
      const now = ctx.currentTime;
      const notes = 2 + Math.floor(Math.random() * 3);
      for (let n = 0; n < notes; n++) {
        const t0 = now + n * (0.09 + Math.random() * 0.05);
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const pan = ctx.createStereoPanner();

        const fStart = baseFreqMin + Math.random() * (baseFreqMax - baseFreqMin);
        const fPeak = fStart * (1.12 + Math.random() * 0.25);

        osc.type = Math.random() > 0.35 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(fStart, t0);
        osc.frequency.exponentialRampToValueAtTime(fPeak, t0 + 0.04);
        osc.frequency.exponentialRampToValueAtTime(fStart * 0.92, t0 + 0.085);

        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(level * (0.6 + Math.random() * 0.4), t0 + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);

        pan.pan.value = Math.random() * 1.4 - 0.7;

        osc.connect(env);
        env.connect(pan);
        pan.connect(sceneGain);

        osc.start(t0);
        osc.stop(t0 + 0.1);
      }
    };

    const scheduleRaindrop = (level = 0.04) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const pan = ctx.createStereoPanner();

      const freq = 950 + Math.random() * 1900;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.45, now + 0.032);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(level, now + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      pan.pan.value = Math.random() * 1.6 - 0.8;
      osc.connect(env);
      env.connect(pan);
      pan.connect(sceneGain);

      osc.start(now);
      osc.stop(now + 0.055);
    };

    const triggerThunderClap = () => {
      const now = ctx.currentTime;
      const rumble = ctx.createBufferSource();
      rumble.buffer = this.createNoiseBuffer(ctx, 5, 'brown');

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(190, now);
      lowpass.frequency.exponentialRampToValueAtTime(55, now + 4.2);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.75, now + 0.18);
      env.gain.exponentialRampToValueAtTime(0.28, now + 1.4);
      env.gain.exponentialRampToValueAtTime(0.001, now + 4.6);

      rumble.connect(lowpass);
      lowpass.connect(env);
      env.connect(sceneGain);

      rumble.start(now);
      rumble.stop(now + 4.8);
    };

    if (soundId === 'sunny') {
      // Gentle warm breeze + sunny songbirds
      startNoiseLoop('pink', 'lowpass', 360, 0.6, 0.2, 0.14, 120);
      scheduleBirdChirp(2300, 3900, 0.042);
      const iv = window.setInterval(() => {
        if (Math.random() < 0.72) {
          scheduleBirdChirp(2200, 4200, 0.04);
        }
      }, 1700);
      intervals.push(iv);
    } else if (soundId === 'rainy') {
      // Steady rain wash + crisp roof/puddle raindrop pings
      startNoiseLoop('pink', 'bandpass', 1100, 0.5, 0.42, 0.09, 240);
      startNoiseLoop('brown', 'lowpass', 420, 0.7, 0.25);
      const iv = window.setInterval(() => {
        scheduleRaindrop(0.032 + Math.random() * 0.025);
        if (Math.random() > 0.55) {
          const t = window.setTimeout(() => scheduleRaindrop(0.025), 95);
          timeouts.push(t);
        }
      }, 240);
      intervals.push(iv);
    } else if (soundId === 'thunderstorm') {
      // Heavy storm rain + howling gusts + rolling thunder
      startNoiseLoop('pink', 'bandpass', 1350, 0.45, 0.46, 0.18, 350);
      startNoiseLoop('brown', 'lowpass', 260, 1.1, 0.48, 0.12, 130);
      const tInit = window.setTimeout(() => triggerThunderClap(), 650);
      timeouts.push(tInit);
      const iv = window.setInterval(() => {
        if (Math.random() < 0.68) {
          triggerThunderClap();
        }
      }, 6800);
      intervals.push(iv);
    } else if (soundId === 'snow') {
      // Crisp cold winter wind with airy sweep
      startNoiseLoop('pink', 'bandpass', 520, 2.2, 0.28, 0.16, 260);
      startNoiseLoop('white', 'highpass', 3400, 0.7, 0.035, 0.22, 900);
      startNoiseLoop('brown', 'lowpass', 180, 0.9, 0.22);
    } else if (soundId === 'windy') {
      // Natural gusting wind + rustling foliage
      startNoiseLoop('brown', 'bandpass', 310, 1.4, 0.42, 0.21, 180);
      startNoiseLoop('pink', 'highpass', 2200, 0.8, 0.12, 0.35, 700);
    } else if (soundId === 'ocean') {
      // Slow rhythmic ocean surf swells
      const surf = startNoiseLoop('pink', 'lowpass', 480, 0.7, 0.38);
      const foam = startNoiseLoop('white', 'bandpass', 2400, 0.7, 0.06);

      const waveLfo = ctx.createOscillator();
      waveLfo.type = 'sine';
      waveLfo.frequency.value = 0.12; // ~8.3s wave cycle
      const surfMod = ctx.createGain();
      surfMod.gain.value = 0.24;
      const foamMod = ctx.createGain();
      foamMod.gain.value = 0.055;
      const freqMod = ctx.createGain();
      freqMod.gain.value = 340;

      waveLfo.connect(surfMod);
      surfMod.connect(surf.gain.gain);
      waveLfo.connect(freqMod);
      freqMod.connect(surf.filter.frequency);
      waveLfo.connect(foamMod);
      foamMod.connect(foam.gain.gain);

      waveLfo.start();
      sources.push(waveLfo);
    } else if (soundId === 'forest') {
      // Deep canopy rustle + varied woodland birds
      startNoiseLoop('pink', 'lowpass', 480, 0.65, 0.22, 0.11, 160);
      startNoiseLoop('brown', 'lowpass', 170, 0.7, 0.16);
      scheduleBirdChirp(1800, 3400, 0.048);
      const iv = window.setInterval(() => {
        if (Math.random() < 0.85) {
          scheduleBirdChirp(1700, 3800, 0.045);
        }
      }, 1350);
      intervals.push(iv);
    }

    // If loop is off, automatically stop playback after a full natural 30s session
    if (!this.state.isLooping) {
      this.loopTimerId = window.setTimeout(() => {
        this.pause();
      }, 30_000);
    }

    this.sceneCleanup = () => {
      intervals.forEach((id) => window.clearInterval(id));
      timeouts.forEach((id) => window.clearTimeout(id));
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          // Already stopped
        }
        try {
          s.disconnect();
        } catch {
          // Ignore
        }
      });
      try {
        sceneGain.disconnect();
      } catch {
        // Ignore
      }
    };
  }

  play(soundId?: WeatherSoundId) {
    if (soundId) {
      this.state.selectedSound = soundId;
    }
    this.state.isPlaying = true;
    this.buildSoundScene(this.state.selectedSound);
    this.applyMasterGain(0.35);
    this.emit();
  }

  pause() {
    this.state.isPlaying = false;
    this.applyMasterGain(0.2);
    window.setTimeout(() => {
      if (!this.state.isPlaying) {
        this.clearActiveNodes();
      }
    }, 260);
    this.emit();
  }

  togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  selectSound(soundId: WeatherSoundId, startIfPaused = false) {
    const changed = this.state.selectedSound !== soundId;
    this.state.selectedSound = soundId;
    if (this.state.isPlaying || startIfPaused) {
      this.state.isPlaying = true;
      if (changed || !this.sceneCleanup) {
        this.buildSoundScene(soundId);
      }
      this.applyMasterGain(0.3);
    }
    this.emit();
  }

  setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    this.state.volume = clamped;
    if (clamped > 0 && this.state.isMuted) {
      this.state.isMuted = false;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY_VOL, String(clamped));
      window.localStorage.setItem(STORAGE_KEY_MUTE, String(this.state.isMuted));
    } catch {
      // Ignore
    }
    this.applyMasterGain(0.1);
    this.emit();
  }

  toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    try {
      window.localStorage.setItem(STORAGE_KEY_MUTE, String(this.state.isMuted));
    } catch {
      // Ignore
    }
    this.applyMasterGain(0.15);
    this.emit();
  }

  toggleLoop() {
    this.state.isLooping = !this.state.isLooping;
    if (this.state.isPlaying) {
      if (this.loopTimerId !== null) {
        window.clearTimeout(this.loopTimerId);
        this.loopTimerId = null;
      }
      if (!this.state.isLooping) {
        this.loopTimerId = window.setTimeout(() => this.pause(), 30_000);
      }
    }
    this.emit();
  }
}

export const weatherSoundEngine = new WeatherSoundEngine();
