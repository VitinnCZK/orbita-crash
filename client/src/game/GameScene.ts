import { Application, BitmapFont, BitmapText, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { ShockwaveFilter } from 'pixi-filters/shockwave';
import { BETTING_MS, elapsedFor, multiplierAt, rawMultiplier, type RoundPhase, type RoundSnapshot } from '@crash/shared';
import { serverNow, useGameStore } from '../store';
import { engineSound, playSfx } from '../audio';
import { PLANETS, ROCKET, asteroid, boom, coin, planet, puff, rocket } from './art';

const C = {
  gold: 0xffc93c,
  orange: 0xff8a1e,
  crash: 0xff4d6d,
  white: 0xffffff,
  lilac: 0xd9d0ff,
  grid: 0x8f7dff,
  outline: 0x1d1140,
};

const UI_FONT = 'Lilita One, Impact, sans-serif';

interface Star {
  sprite: Sprite;
  depth: number;
  base: number;
  phase: number;
}

interface Drifter {
  sprite: Sprite;
  /** Posição inicial na largura (0 a 1) e altura (0 a 1). */
  nx: number;
  ny: number;
  /** Raio desejado como fração do menor lado da tela. */
  size: number;
  baseR: number;
  depth: number;
  spin: number;
  offset: number;
}

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
  s0: number;
  s1: number;
}

interface BurstOptions {
  count: number;
  texture?: Texture;
  tints?: number[];
  speed: number;
  gravity?: number;
  s0?: number;
  s1?: number;
  /** Lança para cima (moedas) em vez de espalhar em todas as direções. */
  fountain?: boolean;
}

interface Toast {
  view: Container;
  x: number;
  y: number;
  life: number;
}

const GRID_LABELS = 6;
const TOAST_MS = 1600;
const BOOM_MS = 700;
const MULT_FONT = 'OrbitaMultiplicador';

let fontInstalled: Promise<void> | null = null;

/**
 * Gera a fonte bitmap do multiplicador (só dígitos, ponto, "x" e "s") com
 * contorno e sombra, no estilo de jogo casual. Espera a Lilita One carregar,
 * senão os glifos sairiam na fonte reserva; sem rede, desiste em 2 s. O
 * preenchimento é branco e a cor vem do tint (o contorno escuro continua escuro).
 */
function installMultiplierFont(resolution: number) {
  fontInstalled ??= (async () => {
    await Promise.race([
      Promise.all([document.fonts.load('112px "Lilita One"'), document.fonts.load('40px "Luckiest Guy"')]).catch(
        () => undefined,
      ),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    BitmapFont.install({
      name: MULT_FONT,
      style: {
        fontFamily: UI_FONT,
        fontSize: 112,
        fill: 0xffffff,
        stroke: { color: C.outline, width: 12, join: 'round' },
        dropShadow: { color: C.outline, alpha: 1, angle: Math.PI / 2, distance: 7, blur: 0 },
      },
      chars: [['0', '9'], '.xs'],
      resolution,
    });
  })();
  return fontInstalled;
}

/**
 * Cena PixiJS. Roda fora do ciclo de render do React: a cada frame lê o
 * estado direto da store (getState) e desenha. O React só re-renderiza o HUD
 * quando algo do HUD muda, nunca a 60 FPS.
 */
export class GameScene {
  private app = new Application();
  private ready = false;
  private disposed = false;

  private world = new Container();
  private planetLayer = new Container();
  private starLayer = new Container();
  private asteroidLayer = new Container();
  private grid = new Graphics();
  private area = new Graphics();
  private curveGlow = new Graphics();
  private curve = new Graphics();
  private rocket = new Container();
  private flame = new Graphics();
  private particleLayer = new Container();
  private boomSprite!: Sprite;
  private bar = new Graphics();
  private toastLayer = new Container();
  private gridLabels: Text[] = [];
  private mainText!: BitmapText;
  private subText!: Text;
  private fpsText!: Text;

  private tex!: { dot: Texture; coin: Texture; puff: Texture };
  private stars: Star[] = [];
  private planets: Drifter[] = [];
  private asteroids: Drifter[] = [];
  private particles: Particle[] = [];
  private spritePool: Sprite[] = [];
  private toasts: Toast[] = [];
  private shockwave = new ShockwaveFilter({ speed: 650, amplitude: 24, wavelength: 150, brightness: 1.25 });
  private shockTime = -1;
  private boomLife = -1;
  private prevPhase: RoundPhase | null = null;
  private prevRoundId = -1;
  private prevHadBet = false;
  private prevCashoutAt = 0;
  private rocketPos = { x: 0, y: 0 };
  private shake = 0;
  private fpsClock = 0;
  private time = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async mount(el: HTMLElement) {
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    await Promise.all([
      this.app.init({ resizeTo: el, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution }),
      installMultiplierFont(resolution),
    ]);
    if (this.disposed) {
      this.app.destroy(true, { children: true });
      return;
    }
    el.appendChild(this.app.canvas);
    this.build(resolution);
    this.app.ticker.add((t) => this.update(t.deltaMS));
    this.ready = true;
  }

  destroy() {
    this.disposed = true;
    engineSound.stop();
    if (!this.ready) return; // mount() termina a limpeza quando o init resolver
    this.ready = false;
    this.app.destroy(true, { children: true });
  }

  /* ---------- Montagem ---------- */

  private build(res: number) {
    const dotG = new Graphics().circle(0, 0, 8).fill(0xffffff);
    this.tex = { dot: this.app.renderer.generateTexture(dotG), coin: coin(10, res), puff: puff(18, res) };
    dotG.destroy();

    this.app.stage.addChild(this.world);
    this.world.addChild(
      this.starLayer,
      this.planetLayer,
      this.asteroidLayer,
      this.grid,
      this.area,
      this.curveGlow,
      this.curve,
      this.rocket,
      this.particleLayer,
    );

    const { width: w, height: h } = this.app.screen;
    const starCount = this.reducedMotion ? 40 : 90;
    const starTints = [0xffffff, 0xffffff, 0xd9d0ff, 0xa8e8ff, 0xfff1b0];
    for (let i = 0; i < starCount; i++) {
      const depth = Math.random();
      const sprite = new Sprite(this.tex.dot);
      sprite.anchor.set(0.5);
      sprite.scale.set(0.08 + depth * 0.2);
      sprite.tint = starTints[i % starTints.length]!;
      sprite.position.set(Math.random() * w, Math.random() * h);
      this.starLayer.addChild(sprite);
      this.stars.push({ sprite, depth, base: 0.3 + depth * 0.6, phase: Math.random() * Math.PI * 2 });
    }

    const addPlanet = (baseR: number, palette: (typeof PLANETS)[keyof typeof PLANETS], seed: number, d: Omit<Drifter, 'sprite' | 'baseR' | 'spin' | 'offset'>) => {
      const sprite = new Sprite(planet(baseR, palette, res, seed));
      sprite.anchor.set(0.5);
      this.planetLayer.addChild(sprite);
      this.planets.push({ sprite, baseR, spin: 0, offset: 0, ...d });
    };
    addPlanet(170, PLANETS.lilas, 11, { nx: 0.04, ny: 0.96, size: 0.36, depth: 0.12 });
    addPlanet(80, PLANETS.marte, 5, { nx: 0.84, ny: 0.2, size: 0.12, depth: 0.25 });
    addPlanet(40, PLANETS.lua, 3, { nx: 0.6, ny: 0.1, size: 0.045, depth: 0.4 });

    const rockTextures = [asteroid(28, res, 17), asteroid(28, res, 42), asteroid(28, res, 99)];
    const rockCount = this.reducedMotion ? 3 : 6;
    for (let i = 0; i < rockCount; i++) {
      const sprite = new Sprite(rockTextures[i % rockTextures.length]);
      sprite.anchor.set(0.5);
      sprite.rotation = Math.random() * Math.PI * 2;
      this.asteroidLayer.addChild(sprite);
      this.asteroids.push({
        sprite,
        baseR: 28,
        nx: Math.random(),
        ny: 0.15 + Math.random() * 0.75,
        size: 0.012 + Math.random() * 0.03,
        depth: 0.5 + Math.random() * 0.5,
        spin: (Math.random() - 0.5) * 0.0012,
        offset: 0,
      });
    }

    for (let i = 0; i < GRID_LABELS; i++) {
      const label = new Text({
        text: '',
        style: { fontFamily: UI_FONT, fontSize: 15, fill: C.lilac, stroke: { color: C.outline, width: 4 } },
      });
      label.anchor.set(1, 0.5);
      label.alpha = 0.85;
      this.world.addChild(label);
      this.gridLabels.push(label);
    }

    const ship = new Sprite(rocket(res));
    ship.anchor.set(0.5);
    this.rocket.addChild(this.flame, ship);

    this.boomSprite = new Sprite(boom(90, res));
    this.boomSprite.anchor.set(0.5);
    this.boomSprite.visible = false;
    this.world.addChild(this.boomSprite);

    // BitmapText: os glifos são gerados uma vez e o número só reposiciona quads,
    // em vez de redesenhar um canvas e reenviar a textura a cada centésimo.
    this.mainText = new BitmapText({ text: '1.00x', style: { fontFamily: MULT_FONT, fontSize: 96 } });
    this.mainText.anchor.set(0.5);
    this.mainText.tint = C.gold;
    this.subText = new Text({
      text: '',
      style: {
        fontFamily: UI_FONT,
        fontSize: 22,
        fill: C.white,
        letterSpacing: 1,
        stroke: { color: C.outline, width: 6, join: 'round' },
        dropShadow: { color: C.outline, alpha: 1, angle: Math.PI / 2, distance: 3, blur: 0 },
      },
    });
    this.subText.anchor.set(0.5);
    this.fpsText = new Text({ text: '', style: { fontFamily: UI_FONT, fontSize: 12, fill: C.lilac } });
    this.fpsText.anchor.set(1, 1);
    this.fpsText.alpha = 0.6;
    this.app.stage.addChild(this.mainText, this.subText, this.bar, this.fpsText, this.toastLayer);

    // Um saque anterior à montagem (ex.: remontagem do StrictMode) não deve animar de novo.
    this.prevCashoutAt = useGameStore.getState().lastCashout?.at ?? 0;
  }

  /* ---------- Loop ---------- */

  private update(dtMs: number) {
    const dt = Math.min(dtMs, 50);
    this.time += dt;
    const s = useGameStore.getState();
    const r = s.round;
    const { width: w, height: h } = this.app.screen;

    this.layoutText(w, h);
    this.updateFps(dt, w, h);

    // Sem conexão a rodada da store está parada no tempo: não anima um voo que
    // pode já ter explodido no servidor. O welcome da reconexão traz o estado novo.
    if (!r || s.status !== 'online') {
      engineSound.stop();
      this.mainText.text = '';
      this.subText.text = s.status === 'offline' ? 'SEM CONEXÃO. TENTANDO DE NOVO...' : 'CONECTANDO...';
      this.bar.clear();
      this.updateBackdrop(dt, w, h, 0.004);
      return;
    }

    this.detectEvents(r);

    const now = serverNow(s.clockOffset);
    let elapsed = 0;
    let m = 1;
    if (r.phase === 'flying' && r.startedAt !== null) {
      elapsed = Math.max(0, now - r.startedAt);
      m = Math.max(multiplierAt(elapsed), s.lastTick);
    } else if (r.phase === 'crashed' && r.crashPoint !== null) {
      m = r.crashPoint;
      elapsed = elapsedFor(Math.max(m, 1.0001));
    }

    // Eixos se expandem conforme o voo, como uma câmera recuando.
    const pad = { l: 56, r: 48, t: 64, b: 48 };
    const maxT = Math.max(10_000, elapsed * 1.18);
    const maxM = Math.max(2, 1 + (rawMultiplier(elapsed) - 1) * 1.3);
    const px = (t: number) => pad.l + (t / maxT) * (w - pad.l - pad.r);
    const py = (mm: number) => h - pad.b - ((mm - 1) / (maxM - 1)) * (h - pad.t - pad.b);

    this.drawGrid(w, pad, maxM, py);

    const color = r.phase === 'crashed' ? C.crash : C.gold;
    this.drawCurve(r.phase, elapsed, px, py, color);
    this.updateRocket(r.phase, elapsed, px, py, w, h);
    this.updateBackdrop(dt, w, h, r.phase === 'flying' ? 0.02 + Math.sqrt(m) * 0.03 : 0.005);
    this.updateParticles(dt);
    this.updateBoom(dt);
    this.updateShake(dt);
    this.updateShockwave(dt);
    this.updateToasts(dt);

    if (r.phase === 'flying') {
      engineSound.start();
      engineSound.setMultiplier(m);
    } else {
      engineSound.stop();
    }

    this.bar.clear();
    if (r.phase === 'betting') {
      const left = Math.max(0, r.bettingEndsAt - now);
      this.mainText.text = `${(left / 1000).toFixed(1)}s`;
      this.mainText.tint = C.white;
      this.subText.text = left > 0 ? 'APOSTAS ABERTAS!' : 'DECOLANDO!';
      this.drawBar(w, h, 1 - left / BETTING_MS);
    } else if (r.phase === 'flying') {
      this.mainText.text = `${m.toFixed(2)}x`;
      this.mainText.tint = C.gold;
      this.subText.text = '';
    } else {
      this.mainText.text = `${m.toFixed(2)}x`;
      this.mainText.tint = C.crash;
      this.subText.text = 'EXPLODIU!';
    }
  }

  /** Transforma mudanças da store em eventos únicos: som, explosão, saque. */
  private detectEvents(r: RoundSnapshot) {
    const s = useGameStore.getState();
    const hasBet = r.bets.some((b) => b.playerId === s.playerId);
    const sameRound = r.id === this.prevRoundId;

    if (!sameRound || r.phase !== this.prevPhase) {
      if (r.phase === 'betting') this.clearEffects();
      if (sameRound && r.phase === 'flying' && this.prevPhase === 'betting') playSfx('decolagem', { volume: 0.7 });
      if (r.phase === 'crashed' && this.prevPhase === 'flying') this.explode();
      this.prevRoundId = r.id;
      this.prevPhase = r.phase;
    }

    if (sameRound && hasBet && !this.prevHadBet) playSfx('aposta', { volume: 0.6 });
    this.prevHadBet = hasBet;

    const c = s.lastCashout;
    if (c && c.at !== this.prevCashoutAt) {
      this.prevCashoutAt = c.at;
      if (c.roundId === r.id) this.celebrate(c.payout);
    }
  }

  private layoutText(w: number, h: number) {
    const size = Math.round(Math.min(w * 0.16, h * 0.22, 112));
    // O setter de fontSize sempre invalida o texto, mesmo com o mesmo valor.
    if (this.mainText.style.fontSize !== size) this.mainText.style.fontSize = size;
    this.mainText.position.set(w / 2, h * 0.34);
    this.subText.position.set(w / 2, h * 0.34 + size * 0.7);
  }

  private updateFps(dt: number, w: number, h: number) {
    this.fpsClock += dt;
    if (this.fpsClock > 500) {
      this.fpsClock = 0;
      this.fpsText.text = `${Math.round(this.app.ticker.FPS)} fps`;
    }
    this.fpsText.position.set(w - 10, h - 8);
  }

  /** Barra de contagem no estilo de barra de loading de jogo: moldura clara, trilho lilás, preenchimento laranja. */
  private drawBar(w: number, h: number, progress: number) {
    const bw = Math.min(340, w * 0.6);
    const bh = 26;
    const x = (w - bw) / 2;
    const y = h * 0.34 + Math.min(w * 0.16, h * 0.22, 112) * 0.7 + 26;
    const fill = Math.max(0, Math.min(1, progress)) * (bw - 10);
    const g = this.bar;
    g.roundRect(x, y + 4, bw, bh, bh / 2).fill(0x9f94d8);
    g.roundRect(x, y, bw, bh, bh / 2).fill(0xffffff);
    g.roundRect(x + 5, y + 5, bw - 10, bh - 10, (bh - 10) / 2).fill(0xc9c1f2);
    if (fill > bh - 10) {
      g.roundRect(x + 5, y + 5, fill, bh - 10, (bh - 10) / 2).fill(C.orange);
      g.roundRect(x + 5, y + 5, fill, (bh - 10) / 2, (bh - 10) / 4).fill({ color: 0xffd76a, alpha: 0.9 });
    }
  }

  private drawGrid(w: number, pad: { l: number; r: number }, maxM: number, py: (m: number) => number) {
    this.grid.clear();
    const range = maxM - 1;
    const steps = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    const step = steps.find((s) => range / s <= 4) ?? 1000;
    let i = 0;
    for (let v = 1 + step; v < maxM && i < GRID_LABELS; v += step, i++) {
      const y = py(v);
      this.grid.moveTo(pad.l, y).lineTo(w - pad.r, y);
      const label = this.gridLabels[i]!;
      label.text = `${Number(v.toFixed(1))}x`;
      label.position.set(pad.l - 8, y);
      label.visible = true;
    }
    this.grid.stroke({ width: 2, color: C.grid, alpha: 0.28 });
    for (; i < GRID_LABELS; i++) this.gridLabels[i]!.visible = false;
  }

  private drawCurve(
    phase: RoundPhase,
    elapsed: number,
    px: (t: number) => number,
    py: (m: number) => number,
    color: number,
  ) {
    this.curve.clear();
    this.curveGlow.clear();
    this.area.clear();
    if (phase === 'betting' || elapsed <= 0) return;

    const N = 72;
    const pts: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (elapsed * i) / N;
      pts.push(px(t), py(rawMultiplier(t)));
    }
    this.area.poly([px(0), py(1), ...pts, px(elapsed), py(1)]).fill({ color, alpha: 0.18 });

    const trace = (g: Graphics) => {
      g.moveTo(pts[0]!, pts[1]!);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
    };
    trace(this.curveGlow);
    this.curveGlow.stroke({ width: 16, color, alpha: 0.22, cap: 'round', join: 'round' });
    trace(this.curve);
    this.curve.stroke({ width: 10, color: C.outline, cap: 'round', join: 'round' });
    trace(this.curve);
    this.curve.stroke({ width: 5, color, cap: 'round', join: 'round' });
  }

  private updateRocket(
    phase: RoundPhase,
    elapsed: number,
    px: (t: number) => number,
    py: (m: number) => number,
    w: number,
    h: number,
  ) {
    if (phase === 'crashed') {
      this.rocket.visible = false;
      return;
    }
    this.rocket.visible = true;
    this.rocket.scale.set(Math.max(0.6, Math.min(1, Math.min(w, h) / 560)));

    if (phase === 'betting') {
      const bob = this.reducedMotion ? 0 : Math.sin(this.time / 300) * 4;
      this.rocket.position.set(px(0) + 30, py(1) - 22 + bob);
      this.rocket.rotation = -Math.PI / 5;
      this.drawFlame(6 + Math.sin(this.time / 90) * 2);
      return;
    }

    const x = px(elapsed);
    const y = py(rawMultiplier(elapsed));
    const back = Math.max(0, elapsed - 250);
    const angle = Math.atan2(y - py(rawMultiplier(back)), x - px(back));
    this.rocket.position.set(x, y);
    this.rocket.rotation = Number.isFinite(angle) ? angle : -Math.PI / 6;
    this.rocketPos = { x, y };
    this.drawFlame(18 + Math.random() * 12);
  }

  /** Chama em gota, em camadas laranja, amarela e branca. */
  private drawFlame(len: number) {
    const x = ROCKET.tailX - 2;
    this.flame
      .clear()
      .ellipse(x - len / 2, 0, len / 2 + 7, 10)
      .fill(0xff6a1e)
      .ellipse(x - len * 0.36, 0, len * 0.36 + 5, 6.5)
      .fill(0xffd23f)
      .ellipse(x - len * 0.16, 0, len * 0.16 + 3, 3.5)
      .fill(0xffffff);
  }

  /** Estrelas piscando, planetas e asteroides em parallax: quanto mais perto, mais rápido. */
  private updateBackdrop(dt: number, w: number, h: number, speed: number) {
    for (const star of this.stars) {
      star.sprite.x -= speed * dt * (0.3 + star.depth);
      star.sprite.y += speed * dt * 0.35 * (0.3 + star.depth);
      if (star.sprite.x < -4) star.sprite.x = w + 4;
      if (star.sprite.y > h + 4) star.sprite.y = -4;
      star.sprite.alpha = this.reducedMotion
        ? star.base
        : star.base * (0.65 + 0.35 * Math.sin(this.time / 420 + star.phase));
    }

    const unit = Math.min(w, h);
    const place = (d: Drifter, drift: number) => {
      const r = d.size * unit;
      d.sprite.scale.set(r / d.baseR);
      d.offset += speed * dt * drift * d.depth;
      const margin = r * 1.5;
      const span = w + margin * 2;
      d.sprite.x = ((((d.nx * w - d.offset + margin) % span) + span) % span) - margin;
      d.sprite.y = d.ny * h;
      if (!this.reducedMotion) d.sprite.rotation += d.spin * dt;
    };
    for (const p of this.planets) place(p, 0.25);
    for (const a of this.asteroids) place(a, 1.2);
  }

  /* ---------- Explosão e saque ---------- */

  private explode() {
    const { x, y } = this.rocketPos;
    this.burst(x, y, { count: this.reducedMotion ? 4 : 9, texture: this.tex.puff, speed: 0.12, gravity: -0.3, s0: 0.5, s1: 1.3 });
    this.burst(x, y, { count: this.reducedMotion ? 12 : 40, tints: [C.crash, C.orange, C.gold], speed: 0.4 });
    this.boomSprite.position.set(x, y);
    this.boomSprite.rotation = Math.random() * Math.PI;
    this.boomSprite.visible = true;
    this.boomLife = 0;
    playSfx('explosao');
    if (this.reducedMotion) return;
    this.shake = 12;
    this.startShockwave(x, y);
  }

  /**
   * Com a aba em segundo plano o ticker quase para, e uma explosão de 700 ms
   * invadiria a rodada seguinte. Nova rodada começa sem efeitos pendentes.
   */
  private clearEffects() {
    for (const p of this.particles) {
      p.sprite.visible = false;
      this.spritePool.push(p.sprite);
    }
    this.particles = [];
    for (const t of this.toasts) t.view.destroy({ children: true });
    this.toasts = [];
    this.boomSprite.visible = false;
    this.boomLife = -1;
    this.shake = 0;
    if (this.shockTime >= 0) {
      this.app.stage.filters = [];
      this.shockTime = -1;
    }
  }

  private celebrate(payout: number) {
    const { width: w } = this.app.screen;
    const x = Math.min(Math.max(this.rocketPos.x, 100), w - 100);
    const y = Math.max(this.rocketPos.y - 36, 48);
    this.burst(this.rocketPos.x, this.rocketPos.y, {
      count: this.reducedMotion ? 4 : 12,
      texture: this.tex.coin,
      speed: 0.28,
      gravity: 1.6,
      s0: 1,
      s1: 0.7,
      fountain: true,
    });
    playSfx('saque');

    const view = new Container();
    const icon = new Sprite(this.tex.coin);
    icon.anchor.set(0.5);
    icon.scale.set(1.5);
    const text = new Text({
      text: `+${payout.toFixed(2)}`,
      style: {
        fontFamily: UI_FONT,
        fontSize: 36,
        fill: 0xffd23f,
        stroke: { color: C.outline, width: 7, join: 'round' },
        dropShadow: { color: C.outline, alpha: 1, angle: Math.PI / 2, distance: 4, blur: 0 },
      },
    });
    text.anchor.set(0, 0.5);
    text.x = 20;
    icon.x = 0;
    view.addChild(icon, text);
    view.pivot.x = (20 + text.width) / 2;
    this.toastLayer.addChild(view);
    this.toasts.push({ view, x, y, life: 0 });
  }

  private burst(x: number, y: number, o: BurstOptions) {
    const tints = o.tints ?? [C.white];
    for (let i = 0; i < o.count; i++) {
      const sprite = this.takeSprite(o.texture ?? this.tex.dot);
      sprite.tint = tints[i % tints.length]!;
      sprite.position.set(x, y);
      sprite.rotation = o.fountain ? (Math.random() - 0.5) * 0.6 : 0;
      const a = o.fountain ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
      const v = 0.08 + Math.random() * o.speed;
      const maxLife = 600 + Math.random() * 600;
      this.particles.push({
        sprite,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: maxLife,
        maxLife,
        gravity: o.gravity ?? 1,
        s0: o.s0 ?? 0.6,
        s1: o.s1 ?? 0.15,
      });
    }
  }

  /** Sprites de partícula são reaproveitados entre explosões, como no pool do Puzzling Potions. */
  private takeSprite(texture: Texture) {
    const sprite = this.spritePool.pop() ?? new Sprite();
    if (!sprite.parent) {
      sprite.anchor.set(0.5);
      this.particleLayer.addChild(sprite);
    }
    sprite.texture = texture;
    sprite.visible = true;
    return sprite;
  }

  private updateBoom(dt: number) {
    if (this.boomLife < 0) return;
    this.boomLife += dt;
    const k = this.boomLife / BOOM_MS;
    if (k >= 1) {
      this.boomSprite.visible = false;
      this.boomLife = -1;
      return;
    }
    // Estoura rápido além do tamanho final, assenta e some.
    const pop = k < 0.18 ? (k / 0.18) * 1.25 : 1.25 - Math.min(1, (k - 0.18) / 0.3) * 0.25;
    this.boomSprite.scale.set(this.reducedMotion ? 1 : pop);
    this.boomSprite.alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  }

  /** Onda de choque saindo do ponto da explosão, como no EffectsSystem do Bubbo Bubbo. */
  private startShockwave(x: number, y: number) {
    const { width: w, height: h } = this.app.screen;
    this.shockwave.center = { x, y };
    this.shockwave.radius = Math.hypot(w, h) * 0.6;
    this.shockwave.time = 0;
    this.shockTime = 0;
    this.app.stage.filterArea = this.app.screen;
    this.app.stage.filters = [this.shockwave];
  }

  private updateShockwave(dt: number) {
    if (this.shockTime < 0) return;
    this.shockTime += dt / 1000;
    this.shockwave.time = this.shockTime;
    if (this.shockTime * this.shockwave.speed > this.shockwave.radius) {
      this.app.stage.filters = [];
      this.shockTime = -1;
    }
  }

  private updateToasts(dt: number) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i]!;
      t.life += dt;
      const k = t.life / TOAST_MS;
      if (k >= 1) {
        t.view.destroy({ children: true });
        this.toasts.splice(i, 1);
        continue;
      }
      const rise = this.reducedMotion ? 0 : 1 - Math.pow(1 - k, 3);
      // Cresce até 1.2 e assenta em 1, como um "pop" de recompensa.
      const pop = this.reducedMotion ? 1 : k < 0.1 ? 0.5 + (k / 0.1) * 0.7 : k < 0.2 ? 1.2 - ((k - 0.1) / 0.1) * 0.2 : 1;
      t.view.position.set(t.x, t.y - rise * 70);
      t.view.scale.set(pop);
      t.view.alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.spritePool.push(p.sprite);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 0.0004 * p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      const k = p.life / p.maxLife;
      p.sprite.alpha = Math.min(1, k * 1.6);
      p.sprite.scale.set(p.s1 + (p.s0 - p.s1) * k);
    }
  }

  private updateShake(dt: number) {
    if (this.shake <= 0.1) {
      this.world.position.set(0, 0);
      return;
    }
    this.world.position.set((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.shake *= Math.pow(0.9, dt / 16);
  }
}
