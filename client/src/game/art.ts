import { CanvasSource, Texture } from 'pixi.js';

/**
 * Arte cartoon gerada por código: cada peça é desenhada uma vez num canvas 2D
 * (que tem gradientes radiais e sombras de graça) e vira textura. Nada de
 * imagem externa para baixar, e a nitidez acompanha a resolução da tela.
 */

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
    ctx.fillStyle = radial(ctx, -r * 0.3, -r * 0.35, 1, r, [[0, '#f2e8ff'], [0.6, '#b7a3dc'], [1, '#7d68ae']]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = r * 0.1;
    ctx.stroke();
  });
}
