import { CanvasSource, Texture } from 'pixi.js';
import asteroid1Url from '../assets/images/game/asteroid-1.webp';
import asteroid2Url from '../assets/images/game/asteroid-2.webp';
import asteroid3Url from '../assets/images/game/asteroid-3.webp';
import boomUrl from '../assets/images/game/boom.webp';
import coinUrl from '../assets/images/game/coin.webp';
import planetLilasUrl from '../assets/images/game/planet-lilas.webp';
import planetLuaUrl from '../assets/images/game/planet-lua.webp';
import planetMarteUrl from '../assets/images/game/planet-marte.webp';
import puffUrl from '../assets/images/game/puff.webp';
import rocketUrl from '../assets/images/game/rocket.webp';

/**
 * Arte cartoon do jogo. Cada peça vira uma textura de duas formas possíveis:
 *  - USE_SPRITES = true: usa as imagens WebP geradas por IA (assets/images/game),
 *    carregadas uma vez por loadArt();
 *  - USE_SPRITES = false: desenha tudo por código num canvas 2D (gradientes
 *    radiais e sombras de graça), sem baixar imagem nenhuma.
 * As funções têm a mesma assinatura nos dois modos, então o GameScene não muda.
 */
export const USE_SPRITES = true;

const SPRITE_URLS = {
  rocket: rocketUrl,
  boom: boomUrl,
  coin: coinUrl,
  puff: puffUrl,
  lilas: planetLilasUrl,
  marte: planetMarteUrl,
  lua: planetLuaUrl,
  asteroid1: asteroid1Url,
  asteroid2: asteroid2Url,
  asteroid3: asteroid3Url,
};
type SpriteKey = keyof typeof SPRITE_URLS;

const images = {} as Record<SpriteKey, HTMLImageElement>;

/** Decodifica as imagens antes de montar a cena. Não faz nada no modo canvas. */
export async function loadArt() {
  if (!USE_SPRITES) return;
  await Promise.all(
    (Object.entries(SPRITE_URLS) as [SpriteKey, string][]).map(async ([key, url]) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      images[key] = img;
    }),
  );
}

/** Desenha a imagem centralizada, mantendo a proporção dentro de w x h. */
function drawFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
}

const OUTLINE = '#1d1140';

type Draw = (ctx: CanvasRenderingContext2D) => void;

function bake(w: number, h: number, resolution: number, draw: Draw): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * resolution);
  canvas.height = Math.ceil(h * resolution);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(resolution, resolution);
  ctx.translate(w / 2, h / 2);
  draw(ctx);
  return new Texture({ source: new CanvasSource({ resource: canvas, resolution }) });
}

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/* ---------- Planetas ---------- */

interface PlanetPalette {
  light: string;
  base: string;
  dark: string;
  glow: string;
  detail: 'craters' | 'bands' | 'spots';
}

export const PLANETS = {
  lilas: { light: '#c9a8e8', base: '#8a63b8', dark: '#3e2466', glow: 'rgba(214,170,255,0.55)', detail: 'craters' },
  marte: { light: '#ff9a7a', base: '#c4405a', dark: '#5a1636', glow: 'rgba(255,110,90,0.6)', detail: 'bands' },
  lua: { light: '#8fe8ff', base: '#2f8de0', dark: '#16306e', glow: 'rgba(80,190,255,0.6)', detail: 'spots' },
} satisfies Record<string, PlanetPalette>;

export function planet(r: number, p: PlanetPalette, resolution: number, seed = 7) {
  const size = r * 2.9;
  return bake(size, size, resolution, (ctx) => {
    // Halo
    ctx.fillStyle = radial(ctx, 0, 0, r * 0.9, r * 1.45, [[0, p.glow], [1, 'rgba(0,0,0,0)']]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
    ctx.fill();

    if (USE_SPRITES) {
      const key = p.detail === 'craters' ? 'lilas' : p.detail === 'bands' ? 'marte' : 'lua';
      drawFit(ctx, images[key], r * 2, r * 2);
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = radial(ctx, -r * 0.35, -r * 0.4, r * 0.1, r * 1.3, [[0, p.light], [0.55, p.base], [1, p.dark]]);
    ctx.fillRect(-r, -r, r * 2, r * 2);

    const rnd = rand(seed);
    if (p.detail === 'bands') {
      for (let i = 0; i < 7; i++) {
        const y = -r + (i + 0.5) * ((r * 2) / 7) + (rnd() - 0.5) * r * 0.1;
        ctx.strokeStyle = i % 2 ? 'rgba(255,220,200,0.18)' : 'rgba(60,0,30,0.22)';
        ctx.lineWidth = r * (0.08 + rnd() * 0.1);
        ctx.beginPath();
        for (let x = -r; x <= r; x += r / 10) ctx.lineTo(x, y + Math.sin(x / r * 4 + i) * r * 0.05);
        ctx.stroke();
      }
    } else {
      const n = p.detail === 'craters' ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * r * 0.75;
        const cr = r * (p.detail === 'craters' ? 0.08 + rnd() * 0.16 : 0.1 + rnd() * 0.12);
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        ctx.fillStyle = p.detail === 'craters' ? 'rgba(40,10,70,0.35)' : 'rgba(180,240,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y, cr, cr * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (p.detail === 'craters') {
          ctx.strokeStyle = 'rgba(255,230,255,0.35)';
          ctx.lineWidth = cr * 0.22;
          ctx.beginPath();
          ctx.ellipse(x, y, cr, cr * 0.8, 0, 0.2, Math.PI * 0.9);
          ctx.stroke();
        }
      }
    }

    // Sombra do lado oposto à luz
    ctx.fillStyle = radial(ctx, -r * 0.5, -r * 0.5, r * 0.9, r * 2.1, [[0, 'rgba(10,0,30,0)'], [1, 'rgba(10,0,30,0.65)']]);
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    // Luz de borda
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, r * 0.035);
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth / 2, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
  });
}

/* ---------- Foguete (aponta para a direita) ---------- */

export const ROCKET = { width: 92, height: 64, tailX: -34 };

export function rocket(resolution: number) {
  return bake(ROCKET.width, ROCKET.height, resolution, (ctx) => {
    if (USE_SPRITES) {
      drawFit(ctx, images.rocket, ROCKET.width, ROCKET.height);
      return;
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;

    const fin = (dir: 1 | -1) => {
      ctx.beginPath();
      ctx.moveTo(-10, 10 * dir);
      ctx.quadraticCurveTo(-26, 14 * dir, -36, 27 * dir);
      ctx.lineTo(-28, 11 * dir);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 8 * dir, 0, 27 * dir);
      g.addColorStop(0, '#8b6cff');
      g.addColorStop(1, '#4a2fc0');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.stroke();
    };
    fin(-1);
    fin(1);

    // Bocal
    ctx.fillStyle = '#4b4a6e';
    ctx.beginPath();
    ctx.roundRect(-36, -8, 8, 16, 3);
    ctx.fill();
    ctx.stroke();

    // Corpo
    const body = new Path2D();
    body.moveTo(-30, -13);
    body.lineTo(8, -14);
    body.quadraticCurveTo(36, -12, 42, 0);
    body.quadraticCurveTo(36, 12, 8, 14);
    body.lineTo(-30, 13);
    body.quadraticCurveTo(-34, 0, -30, -13);

    const bg = ctx.createLinearGradient(0, -14, 0, 14);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.55, '#dcd6ff');
    bg.addColorStop(1, '#9d93e0');
    ctx.fillStyle = bg;
    ctx.fill(body);

    ctx.save();
    ctx.clip(body);
    // Ponta
    const ng = ctx.createLinearGradient(0, -14, 0, 14);
    ng.addColorStop(0, '#ffb15c');
    ng.addColorStop(1, '#ff4d6d');
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.ellipse(44, 0, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Faixa traseira
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(-24, -16, 6, 32);
    ctx.strokeRect(-24, -16, 6, 32);
    // Brilho
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(0, -8, 16, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke(body);

    // Janela
    ctx.fillStyle = '#2a3c9c';
    ctx.beginPath();
    ctx.arc(6, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = radial(ctx, 4, -2, 1, 7, [[0, '#c9fbff'], [0.5, '#4fd6ff'], [1, '#1a7fd1']]);
    ctx.beginPath();
    ctx.arc(6, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(4, -2.2, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ---------- Asteroide ---------- */

export function asteroid(r: number, resolution: number, seed: number) {
  const size = r * 2.4;
  return bake(size, size, resolution, (ctx) => {
    if (USE_SPRITES) {
      // as 3 seeds usadas pelo GameScene (17, 42, 99) viram os 3 formatos
      const shapes = [images.asteroid1, images.asteroid2, images.asteroid3];
      drawFit(ctx, shapes[[17, 42, 99].indexOf(seed) === -1 ? seed % 3 : [17, 42, 99].indexOf(seed)]!, r * 2.1, r * 2.1);
      return;
    }
    const rnd = rand(seed);
    const n = 9;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const d = r * (0.72 + rnd() * 0.3);
      pts.push([Math.cos(a) * d, Math.sin(a) * d]);
    }
    const path = new Path2D();
    pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();

    ctx.fillStyle = radial(ctx, -r * 0.3, -r * 0.35, r * 0.1, r * 1.2, [[0, '#a07a9e'], [0.6, '#6b4670'], [1, '#3a2342']]);
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    for (let i = 0; i < 3; i++) {
      const x = (rnd() - 0.5) * r;
      const y = (rnd() - 0.5) * r;
      const cr = r * (0.12 + rnd() * 0.12);
      ctx.fillStyle = 'rgba(30,10,40,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, cr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.strokeStyle = OUTLINE;
    ctx.stroke(path);
  });
}

/* ---------- Efeitos ---------- */

export function coin(r: number, resolution: number) {
  const size = r * 2 + 4;
  return bake(size, size, resolution, (ctx) => {
    if (USE_SPRITES) {
      drawFit(ctx, images.coin, size - 2, size - 2);
      return;
    }
    ctx.fillStyle = '#b86a00';
    ctx.beginPath();
    ctx.arc(0, 1.5, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = radial(ctx, -r * 0.3, -r * 0.4, 1, r * 1.1, [[0, '#fff3a6'], [0.5, '#ffd23f'], [1, '#f29b0c']]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e08600';
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Estrela de "BOOM" da explosão. */
export function boom(r: number, resolution: number) {
  const size = r * 2.2;
  const star = (outer: number, inner: number, n: number) => {
    const p = new Path2D();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const d = i % 2 ? inner : outer;
      p.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    p.closePath();
    return p;
  };
  return bake(size, size, resolution, (ctx) => {
    if (USE_SPRITES) {
      drawFit(ctx, images.boom, r * 2.1, r * 2.1);
      return;
    }
    ctx.lineJoin = 'round';
    const outer = star(r, r * 0.62, 11);
    ctx.fillStyle = radial(ctx, 0, 0, r * 0.1, r, [[0, '#ffe066'], [0.6, '#ff8a1e'], [1, '#ff4d3d']]);
    ctx.fill(outer);
    ctx.lineWidth = r * 0.06;
    ctx.strokeStyle = '#9c1f2e';
    ctx.stroke(outer);
    ctx.fillStyle = radial(ctx, 0, 0, 0, r * 0.55, [[0, '#ffffff'], [1, '#fff3a6']]);
    ctx.fill(star(r * 0.55, r * 0.36, 9));
  });
}

/** Fumaça arredondada (puff) da explosão. */
export function puff(r: number, resolution: number) {
  const size = r * 2 + 4;
  return bake(size, size, resolution, (ctx) => {
    if (USE_SPRITES) {
      drawFit(ctx, images.puff, r * 2, r * 2);
      return;
    }
    ctx.fillStyle = radial(ctx, -r * 0.3, -r * 0.35, 1, r, [[0, '#f2e8ff'], [0.6, '#b7a3dc'], [1, '#7d68ae']]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = r * 0.1;
    ctx.stroke();
  });
}

/** Bolha macia sem contorno, usada no rastro de fumaça do foguete (sempre por canvas, tingida no jogo). */
export function smoke(r: number, resolution: number) {
  const size = r * 2 + 2;
  return bake(size, size, resolution, (ctx) => {
    ctx.fillStyle = radial(ctx, 0, 0, 0, r, [[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Pedaços do foguete que ficam flutuando depois da explosão (sempre por canvas, no mesmo estilo do foguete). */
export type DebrisKind = 'nose' | 'fin' | 'porthole' | 'shard' | 'nozzle';

export function debris(kind: DebrisKind, resolution: number) {
  const size = kind === 'shard' ? [30, 22] : kind === 'nose' ? [34, 32] : kind === 'porthole' ? [34, 34] : kind === 'fin' ? [26, 24] : [16, 22];
  return bake(size[0]!, size[1]!, resolution, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    const fill = (path: Path2D, from: string, to: string, y0: number, y1: number) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, from);
      g.addColorStop(1, to);
      ctx.fillStyle = g;
      ctx.fill(path);
      ctx.stroke(path);
    };
    if (kind === 'fin') {
      const p = new Path2D();
      p.moveTo(-10, 8);
      p.quadraticCurveTo(-6, -4, 10, -9);
      p.lineTo(7, 4);
      p.lineTo(2, 9);
      p.closePath();
      fill(p, '#8b6cff', '#4a2fc0', -9, 9);
    } else if (kind === 'nose') {
      const p = new Path2D();
      p.moveTo(-12, -12);
      p.quadraticCurveTo(6, -12, 15, 0);
      p.quadraticCurveTo(6, 12, -12, 12);
      p.lineTo(-7, 7);
      p.lineTo(-12, 2);
      p.lineTo(-6, -4);
      p.closePath();
      fill(p, '#ffb15c', '#ff4d6d', -12, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(3, -6, 6, 2, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'porthole') {
      const p = new Path2D();
      const rnd = rand(5);
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        const d = 12 + rnd() * 4;
        p.lineTo(Math.cos(ang) * d, Math.sin(ang) * d);
      }
      p.closePath();
      fill(p, '#ffffff', '#9d93e0', -14, 14);
      ctx.fillStyle = '#2a3c9c';
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = radial(ctx, -1, -2, 1, 6, [[0, '#c9fbff'], [0.5, '#4fd6ff'], [1, '#1a7fd1']]);
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.4; // vidro trincado
      ctx.beginPath();
      ctx.moveTo(-4, -3);
      ctx.lineTo(0, 0);
      ctx.lineTo(3, -4);
      ctx.moveTo(0, 0);
      ctx.lineTo(1, 5);
      ctx.stroke();
    } else if (kind === 'shard') {
      const p = new Path2D();
      p.moveTo(-13, -7);
      p.lineTo(-3, -9);
      p.lineTo(4, -6);
      p.lineTo(13, -8);
      p.lineTo(9, 1);
      p.lineTo(13, 8);
      p.lineTo(0, 6);
      p.lineTo(-6, 9);
      p.lineTo(-11, 3);
      p.closePath();
      fill(p, '#ffffff', '#9d93e0', -9, 9);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(-1, -8, 5, 15);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-1, -8, 5, 15);
    } else {
      const p = new Path2D();
      p.roundRect(-4, -8, 8, 16, 3);
      fill(p, '#6c6a94', '#3e3d5e', -8, 8);
    }
  });
}

/** Vinheta branca (centro transparente, bordas opacas); o jogo tinge e estica para a tela. */
export function vignette() {
  const s = 256;
  return bake(s, s, 1, (ctx) => {
    ctx.fillStyle = radial(ctx, 0, 0, s * 0.28, s * 0.72, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,1)']]);
    ctx.fillRect(-s / 2, -s / 2, s, s);
  });
}

/** Rastro das estrelas em alta velocidade: afunila e some. A ponta cheia fica à esquerda, no centro da estrela. */
export function streak() {
  return bake(64, 8, 2, (ctx) => {
    const g = ctx.createLinearGradient(-32, 0, 32, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-32, -4);
    ctx.lineTo(32, 0);
    ctx.lineTo(-32, 4);
    ctx.closePath();
    ctx.fill();
  });
}
