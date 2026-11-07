import audioRegistryData from "@/data/audioRegistry.json";

const audioRegistry: Record<string, string> = audioRegistryData;

let cachedVoice: SpeechSynthesisVoice | null = null;
let currentAudio: HTMLAudioElement | null = null;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/^["'\s.,!?:;]+|["'\s.,!?:;]+$/g, "")
    .trim();
}

export function getAudioUrl(text: string): string | undefined {
  if (!text) return undefined;
  const norm = normalizeText(text);
  return audioRegistry[norm];
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang === "en-GB") ||
    voices.find((v) => v.lang?.startsWith("en")) ||
    voices[0] ||
    null;
  cachedVoice = preferred;
  return preferred;
}

export function stopSpeaking() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.onended = null;
      currentAudio.onerror = null;
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export type SpeakOptions = {
  rate?: number;
  audioUrl?: string;
  onEnd?: () => void;
};

/**
 * Plays pre-recorded studio audio if available; otherwise falls back to Web Speech API.
 * Returns true if playback was initiated.
 */
export function speakLine(
  text: string,
  options: SpeakOptions = {}
): boolean {
  if (typeof window === "undefined") return false;
  stopSpeaking();

  const targetAudioUrl = options.audioUrl || getAudioUrl(text);

  if (targetAudioUrl) {
    try {
      const audio = new Audio(targetAudioUrl);
      currentAudio = audio;
      if (options.rate && options.rate !== 1) {
        audio.playbackRate = options.rate;
      }
      let finished = false;
      const cleanupAndEnd = () => {
        if (finished) return;
        finished = true;
        if (currentAudio === audio) {
          currentAudio = null;
        }
        options.onEnd?.();
      };

      audio.onended = cleanupAndEnd;
      audio.onerror = () => {
        if (currentAudio === audio) currentAudio = null;
        fallbackWebSpeech(text, options);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (currentAudio === audio) currentAudio = null;
          fallbackWebSpeech(text, options);
        });
      }
      return true;
    } catch {
      return fallbackWebSpeech(text, options);
    }
  }

  return fallbackWebSpeech(text, options);
}

function fallbackWebSpeech(text: string, options: SpeakOptions): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    options.onEnd?.();
    return false;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickEnglishVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = options.rate ?? 0.9;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      options.onEnd?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    options.onEnd?.();
    return false;
  }
}

export function speak(
  text: string,
  rateOrOptions: number | SpeakOptions = 0.95
) {
  const options: SpeakOptions =
    typeof rateOrOptions === "number"
      ? { rate: rateOrOptions }
      : rateOrOptions ?? {};
  speakLine(text, options);
}

export function isTtsSupported(): boolean {
  return true;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
  };
}
