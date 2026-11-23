import {WeatherAlertItem} from '../types/weather';

const VOICE_PREF_KEY = 'maindgo_voice_alerts_enabled';

type SpeechStateListener = (speaking: boolean, activeAlertId: string | null) => void;

const listeners = new Set<SpeechStateListener>();
let activeSpeaking = false;
let currentAlertId: string | null = null;

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb(activeSpeaking, currentAlertId);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function getVoiceAlertsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(VOICE_PREF_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function setVoiceAlertsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOICE_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
  if (!enabled) {
    stopWeatherAlertSpeech();
  }
}

export function isSpeechSpeaking(): boolean {
  return activeSpeaking;
}

export function getActiveSpeakingAlertId(): string | null {
  return currentAlertId;
}

export function subscribeSpeechState(listener: SpeechStateListener): () => void {
  listeners.add(listener);
  listener(activeSpeaking, currentAlertId);
  return () => {
    listeners.delete(listener);
  };
}

function selectPreferredVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  return (
    voices.find((v) => v.lang.toLowerCase() === 'en-us' && v.localService) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
    voices[0] ||
    null
  );
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\.\.\./g, '.')
    .trim();
}

function formatSeverityWord(severity: string): string {
  const s = severity.trim().toUpperCase();
  if (s === 'EXTREME') return 'Extreme';
  if (s === 'SEVERE') return 'Severe';
  if (s === 'MODERATE') return 'Moderate';
  if (s === 'MINOR') return 'Minor';
  return '';
}

function formatUrgencyPhrase(urgency: string): string {
  const u = urgency.trim().toUpperCase();
  if (u === 'IMMEDIATE') return 'Immediate action recommended.';
  if (u === 'EXPECTED') return 'Expected soon.';
  if (u === 'FUTURE') return 'Upcoming advisory.';
  return '';
}

export function buildWeatherAlertSpeechSummary(
  alerts: WeatherAlertItem[],
  locationName?: string
): string {
  if (!alerts || alerts.length === 0) return '';

  const severityRank: Record<string, number> = {
    EXTREME: 0,
    SEVERE: 1,
    MODERATE: 2,
    MINOR: 3,
    UNKNOWN: 4,
  };

  const sorted = [...alerts].sort((a, b) => {
    const ra = severityRank[a.severity.toUpperCase()] ?? 4;
    const rb = severityRank[b.severity.toUpperCase()] ?? 4;
    return ra - rb;
  });

  const primary = sorted[0];
  const locClause = locationName ? ` for ${cleanTextForSpeech(locationName)}` : '';
  const sevWord = formatSeverityWord(primary.severity);
  const sevPrefix = sevWord ? `${sevWord} ` : '';
  const title = cleanTextForSpeech(primary.title);
  const sourceName = primary.dataSource?.name ? ` issued by ${cleanTextForSpeech(primary.dataSource.name)}` : '';
  const urgencyClause = formatUrgencyPhrase(primary.urgency);

  const instructionText = primary.instruction?.[0]
    ? cleanTextForSpeech(primary.instruction[0])
    : primary.safetyRecommendations?.[0]?.directive
      ? cleanTextForSpeech(primary.safetyRecommendations[0].directive)
      : primary.description
        ? cleanTextForSpeech(primary.description.split(/[.!?]\s+/)[0] || '')
        : '';

  const clippedInstruction =
    instructionText.length > 160 ? `${instructionText.slice(0, 157).trim()}...` : instructionText;

  if (sorted.length === 1) {
    return cleanTextForSpeech(
      `Weather alert${locClause}. ${sevPrefix}${title}${sourceName}. ${urgencyClause} ${clippedInstruction}`
    );
  }

  const extraCount = sorted.length - 1;
  return cleanTextForSpeech(
    `${sorted.length} weather alerts${locClause}. Priority alert: ${sevPrefix}${title}${sourceName}, plus ${extraCount} additional ${
      extraCount === 1 ? 'advisory' : 'advisories'
    }. ${urgencyClause} ${clippedInstruction}`
  );
}

export interface SpeakAlertOptions {
  locationName?: string;
  alertId?: string;
  force?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onBlockedOrError?: (reason: string) => void;
}

export function stopWeatherAlertSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors
    }
  }
  activeSpeaking = false;
  currentAlertId = null;
  notifyListeners();
}

export function speakWeatherAlertSummary(
  alerts: WeatherAlertItem[],
  options: SpeakAlertOptions = {}
): boolean {
  if (!isSpeechSynthesisSupported()) {
    options.onBlockedOrError?.('Web Speech API is not supported in this browser.');
    return false;
  }

  if (!options.force && !getVoiceAlertsEnabled()) {
    return false;
  }

  const summary = buildWeatherAlertSpeechSummary(alerts, options.locationName);
  if (!summary) return false;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(summary);
    const voice = selectPreferredVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const targetAlertId = options.alertId || alerts[0]?.alertId || null;

    utterance.onstart = () => {
      activeSpeaking = true;
      currentAlertId = targetAlertId;
      notifyListeners();
      options.onStart?.();
    };

    utterance.onend = () => {
      activeSpeaking = false;
      currentAlertId = null;
      notifyListeners();
      options.onEnd?.();
    };

    utterance.onerror = (event) => {
      activeSpeaking = false;
      currentAlertId = null;
      notifyListeners();
      const errCode = (event as SpeechSynthesisErrorEvent).error || 'unknown';
      if (errCode !== 'interrupted' && errCode !== 'canceled') {
        options.onBlockedOrError?.(`Audio playback blocked or unavailable (${errCode}).`);
      }
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    activeSpeaking = false;
    currentAlertId = null;
    notifyListeners();
    options.onBlockedOrError?.(err instanceof Error ? err.message : 'Unable to start speech synthesis.');
    return false;
  }
}
