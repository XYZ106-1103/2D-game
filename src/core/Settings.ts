import { audio } from '../audio/AudioEngine.ts';

export interface SettingsData {
  master: number;
  music: number;
  sfx: number;
  shake: boolean;
  flash: boolean;
}

const KEY = 'tetherfall.settings.v1';
const PROGRESS = 'tetherfall.progress.v1';

const defaults: SettingsData = { master: 0.8, music: 0.6, sfx: 0.8, shake: true, flash: true };

function load(): SettingsData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<SettingsData>) };
  } catch {
    /* storage unavailable */
  }
  return { ...defaults };
}

export const settings: SettingsData = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  applyAudioSettings();
}

export function applyAudioSettings(): void {
  audio.volumes.master = settings.master;
  audio.volumes.music = settings.music;
  audio.volumes.sfx = settings.sfx;
  audio.applyVolumes();
}

export interface Progress {
  level: string;
  checkpoint: number;
  logs: string[];
}

export function loadProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(PROGRESS);
    return raw ? (JSON.parse(raw) as Progress) : null;
  } catch {
    return null;
  }
}

export function saveProgress(p: Progress | null): void {
  try {
    if (p) localStorage.setItem(PROGRESS, JSON.stringify(p));
    else localStorage.removeItem(PROGRESS);
  } catch {
    /* ignore */
  }
}
