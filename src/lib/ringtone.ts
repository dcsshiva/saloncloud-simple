/**
 * Audible alert helper for booking notifications.
 *
 * Browsers block autoplay until the user interacts with the page, so the audio
 * context is "unlocked" once from a user gesture (the Enable notification sound
 * toggle in Settings, or the customer's Enable alerts button) and the unlock is
 * remembered for the session.
 */

const STORAGE_KEY = "salonbook.ringtone";

export type RingtonePrefs = {
  enabled: boolean;
  muted: boolean;
  volume: number;
  /** Data URL of a custom uploaded ringtone; falls back to the built-in chime. */
  customSrc: string | null;
  customName: string | null;
};

export const defaultPrefs: RingtonePrefs = {
  enabled: false,
  muted: false,
  volume: 0.8,
  customSrc: null,
  customName: null,
};

export function readPrefs(): RingtonePrefs {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    return { ...defaultPrefs, ...(JSON.parse(raw) as Partial<RingtonePrefs>) };
  } catch {
    return defaultPrefs;
  }
}

export function writePrefs(prefs: RingtonePrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — prefs stay in memory only */
  }
}

let audioContext: AudioContext | null = null;
let audioElement: HTMLAudioElement | null = null;
let unlocked = false;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

/** Must be called from a user gesture. Returns true when audio can now play. */
export async function unlockAudio(prefs: RingtonePrefs): Promise<boolean> {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (prefs.customSrc) {
    audioElement = new Audio(prefs.customSrc);
    audioElement.volume = prefs.volume;
    try {
      await audioElement.play();
      audioElement.pause();
      audioElement.currentTime = 0;
    } catch {
      /* the synthesized chime still works */
    }
  }
  unlocked = Boolean(ctx) || Boolean(audioElement);
  return unlocked;
}

export function isUnlocked() {
  return unlocked;
}

/** Plays a short repeating chime (or the uploaded ringtone) for a few seconds. */
export function playRingtone(prefs: RingtonePrefs = readPrefs(), seconds = 4) {
  if (!prefs.enabled || prefs.muted || prefs.volume <= 0) return;

  if (prefs.customSrc) {
    const element = audioElement && audioElement.src === prefs.customSrc ? audioElement : new Audio(prefs.customSrc);
    audioElement = element;
    element.loop = true;
    element.volume = prefs.volume;
    void element.play().catch(() => undefined);
    window.setTimeout(() => {
      element.pause();
      element.currentTime = 0;
      element.loop = false;
    }, seconds * 1000);
    return;
  }

  const ctx = getContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  // Three-note chime, repeated until `seconds` elapse.
  for (let repeat = 0; repeat * 1.2 < seconds; repeat += 1) {
    [880, 1174.7, 1567.98].forEach((frequency, index) => {
      const at = start + repeat * 1.2 + index * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.01, prefs.volume) * 0.35, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.4);
    });
  }
}

/** Requests OS notification permission; safe to call when unsupported. */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** Shows an OS notification (when granted) and plays the audible alert. */
export function alertUser(title: string, body: string, prefs: RingtonePrefs = readPrefs()) {
  playRingtone(prefs);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: title, icon: "/favicon.ico" });
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }
}
