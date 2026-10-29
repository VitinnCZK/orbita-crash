import type * as Audio from './audio';

/**
 * Ponte leve para o áudio. O GameScene chama estas funções sem importar o
 * @pixi/sound: até o módulo de áudio carregar (ver loadAudio), elas não fazem nada.
 */
let audio: typeof Audio | null = null;
let loading: Promise<void> | null = null;

export function loadAudio() {
  loading ??= import('./audio').then((m) => {
    audio = m;
    return m.initAudio();
  });
  return loading;
}

export function playSfx(...args: Parameters<typeof Audio.playSfx>) {
  audio?.playSfx(...args);
}

export const engineSound = {
  start: () => audio?.engineSound.start(),
  setMultiplier: (m: number) => audio?.engineSound.setMultiplier(m),
  stop: (ms?: number) => audio?.engineSound.stop(ms),
};
