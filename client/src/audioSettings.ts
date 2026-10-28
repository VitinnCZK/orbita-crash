import { create } from 'zustand';

/**
 * Preferências de áudio (mudo e volumes), salvas no localStorage. Ficam num módulo
 * à parte do motor de som para a interface (SoundControl) não puxar o PixiJS no
 * carregamento inicial: o audio.ts, com o @pixi/sound, só chega depois.
 */
export interface AudioSettings {
  muted: boolean;
  music: number;
  sfx: number;
}

const SETTINGS_KEY = 'orbita:audio';
const DEFAULTS: AudioSettings = { muted: false, music: 0.4, sfx: 0.8 };

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AudioSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: AudioSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* modo privado: segue sem persistir */
  }
}

interface AudioStore extends AudioSettings {
  setMuted: (muted: boolean) => void;
  setMusic: (v: number) => void;
  setSfx: (v: number) => void;
}

export const useAudioSettings = create<AudioStore>((set) => ({
  ...loadSettings(),
  setMuted: (muted) => set({ muted }),
  setMusic: (music) => set({ music }),
  setSfx: (sfx) => set({ sfx }),
}));


// Persistir aqui garante que um ajuste feito antes do áudio carregar não se perde.
useAudioSettings.subscribe((s) => saveSettings({ muted: s.muted, music: s.music, sfx: s.sfx }));
