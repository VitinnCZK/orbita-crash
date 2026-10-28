import { Assets } from 'pixi.js';
import { sound, type PlayOptions, type Sound, type webaudio } from '@pixi/sound';
import { create } from 'zustand';
import apostaUrl from './assets/sons/aposta.mp3';
import decolagemUrl from './assets/sons/decolagem.mp3';
import explosaoUrl from './assets/sons/explosao.mp3';
import motorUrl from './assets/sons/motor.wav';
import musicaUrl from './assets/sons/musica.mp3';
import saqueUrl from './assets/sons/saque.mp3';

/**
 * Áudio do jogo, no modelo dos PixiJS Open Games: música (BGM) e efeitos
 * (SFX) com volumes separados, mais um mudo geral. Tudo fica salvo no
 * localStorage. Para trocar um som, substitua o arquivo em assets/sons e,
 * se mudar a extensão, o import acima. Efeitos e música em MP3; o motor fica em
 * WAV porque o MP3 insere silêncio nas pontas e o loop contínuo daria um "tique".
 */
const SOUNDS = {
  aposta: apostaUrl,
  decolagem: decolagemUrl,
  explosao: explosaoUrl,
  motor: motorUrl,
  musica: musicaUrl,
  saque: saqueUrl,
} as const;

export type SfxName = Exclude<keyof typeof SOUNDS, 'musica' | 'motor'>;

/* ---------- Preferências (React lê daqui) ---------- */

interface AudioSettings {
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

/* ---------- Motor de som ---------- */

let loaded = false;
let started = false;
let music: Sound | null = null;
let engine: Sound | null = null;
let engineOn = false;
const fades = new Map<Sound, number>();

const ENGINE_VOLUME = 0.35;

/** O navegador só libera áudio depois de um gesto do usuário. */
function audioRunning() {
  const ctx = (sound.context as webaudio.WebAudioContext).audioContext;
  return !ctx || ctx.state === 'running';
}

function fadeTo(s: Sound, target: number, ms: number, then?: () => void) {
  cancelAnimationFrame(fades.get(s) ?? 0);
  const from = s.volume;
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    s.volume = from + (target - from) * k;
    if (k < 1) fades.set(s, requestAnimationFrame(step));
    else {
      fades.delete(s);
      then?.();
    }
  };
  fades.set(s, requestAnimationFrame(step));
}

function applySettings({ muted, music: musicVol, sfx: sfxVol }: AudioSettings) {
  if (muted || document.visibilityState === 'hidden') sound.muteAll();
  else sound.unmuteAll();
  if (music && !fades.has(music)) music.volume = musicVol;
  if (engine && engineOn && !fades.has(engine)) engine.volume = ENGINE_VOLUME * sfxVol;
}

/** Carrega os sons e prepara mudo, aba oculta e desbloqueio. Chamar uma vez. */
export async function initAudio() {
  if (loaded) return;
  loaded = true;
  await Assets.load(Object.entries(SOUNDS).map(([alias, src]) => ({ alias, src })));
  music = sound.find('musica');
  engine = sound.find('motor');

  useAudioSettings.subscribe((s) => {
    saveSettings({ muted: s.muted, music: s.music, sfx: s.sfx });
    applySettings(s);
  });
  applySettings(useAudioSettings.getState());

  // Mesmo padrão do Bubbo Bubbo: silencia com a aba oculta.
  document.addEventListener('visibilitychange', () => applySettings(useAudioSettings.getState()));

  // O @pixi/sound só desbloqueia em mouse/toque; a barra de espaço também conta.
  const unlock = () => {
    const ctx = (sound.context as webaudio.WebAudioContext).audioContext;
    void ctx?.resume().then(startMusic);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}

function startMusic() {
  if (started || !music || !audioRunning()) return;
  started = true;
  music.volume = 0;
  void music.play({ loop: true });
  fadeTo(music, useAudioSettings.getState().music, 1500);
}

/** Efeito curto. Ignorado enquanto o áudio está bloqueado, para não tocar tudo de uma vez no desbloqueio. */
export function playSfx(name: SfxName, options: PlayOptions = {}) {
  if (!loaded || !audioRunning() || !sound.exists(name)) return;
  const volume = (options.volume ?? 1) * useAudioSettings.getState().sfx;
  void sound.play(name, { ...options, volume });
}

/** Ronco do motor em loop, com o tom subindo junto com o multiplicador. */
export const engineSound = {
  start() {
    if (engineOn || !engine || !audioRunning()) return;
    engineOn = true;
    engine.stop(); // encerra um fade-out que ainda não terminou
    engine.speed = 0.8;
    engine.volume = 0;
    void engine.play({ loop: true });
    fadeTo(engine, ENGINE_VOLUME * useAudioSettings.getState().sfx, 400);
  },
  setMultiplier(m: number) {
    if (engineOn && engine) engine.speed = Math.min(2.2, 0.8 + Math.log(m) * 0.45);
  },
  stop(ms = 150) {
    if (!engineOn || !engine) return;
    engineOn = false;
    const s = engine;
    fadeTo(s, 0, ms, () => s.stop());
  },
};
