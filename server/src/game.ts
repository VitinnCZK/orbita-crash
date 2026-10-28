import {
  BETTING_MS,
  CRASHED_PAUSE_MS,
  MIN_BET,
  START_BALANCE,
  TICK_MS,
  elapsedFor,
  multiplierAt,
  type ErrorCode,
  type PublicBet,
  type RoundPhase,
  type RoundSnapshot,
  type ServerMessage,
} from '@crash/shared';
import { crashPointFrom, hashSeed, newSeed } from './fairness.js';

export interface Player {
  id: string;
  name: string;
  balance: number;
  isBot?: boolean;
}

interface Bet {
  playerId: string;
  amount: number;
  autoCashout?: number;
  cashedOutAt: number | null;
}

interface Round {
  id: number;
  phase: RoundPhase;
  seed: string;
  hash: string;
  crashPoint: number;
  bettingEndsAt: number;
  startedAt: number | null;
  bets: Map<string, Bet>;
}

type Broadcast = (msg: ServerMessage) => void;
type SendTo = (playerId: string, msg: ServerMessage) => void;

const money = (v: number) => Math.round(v * 100) / 100;

/** Máquina de estados da rodada. O servidor é a única fonte da verdade. */
export class CrashGame {
  private round: Round | null = null;
  private history: number[] = [];
  private ticker: ReturnType<typeof setInterval> | null = null;
  private crashTimer: ReturnType<typeof setTimeout> | null = null;
  private openListeners: Array<() => void> = [];

  constructor(
    readonly players: Map<string, Player>,
    private readonly broadcast: Broadcast,
    private readonly sendTo: SendTo,
  ) {}

  start() {
    this.openBetting();
  }

  onRoundOpen(fn: () => void) {
    this.openListeners.push(fn);
  }

  getHistory() {
    return [...this.history];
  }

  snapshot(): RoundSnapshot {
    const r = this.round;
    if (!r) throw new Error('Jogo não iniciado');
    const revealed = r.phase === 'crashed';
    return {
      id: r.id,
      phase: r.phase,
      hash: r.hash,
      bettingEndsAt: r.bettingEndsAt,
      startedAt: r.startedAt,
      crashPoint: revealed ? r.crashPoint : null,
      seed: revealed ? r.seed : null,
      bets: [...r.bets.values()].map((b) => this.publicBet(b)),
    };
  }

  placeBet(playerId: string, amount: number, autoCashout?: number): ErrorCode | null {
    const r = this.round;
    const player = this.players.get(playerId);
    if (!r || !player) return 'NOT_IDENTIFIED';
    if (r.phase !== 'betting' || Date.now() >= r.bettingEndsAt) return 'NOT_BETTING_PHASE';
    if (r.bets.has(playerId)) return 'ALREADY_BET';
    if (player.balance < amount) return 'INSUFFICIENT_BALANCE';

    player.balance = money(player.balance - amount);
    const bet: Bet = { playerId, amount, autoCashout, cashedOutAt: null };
    r.bets.set(playerId, bet);

    this.broadcast({ type: 'bet:placed', roundId: r.id, bet: this.publicBet(bet) });
    this.sendTo(playerId, { type: 'balance', balance: player.balance });
    return null;
  }

  cashout(playerId: string): ErrorCode | null {
    const r = this.round;
    if (!r || r.phase !== 'flying' || r.startedAt === null) return 'NOT_FLYING';
    const bet = r.bets.get(playerId);
    if (!bet || bet.cashedOutAt !== null) return 'NO_ACTIVE_BET';

    // O multiplicador vem do relógio do servidor, nunca do cliente.
    const m = multiplierAt(Date.now() - r.startedAt);
    if (m >= r.crashPoint) {
      this.crash();
      return 'TOO_LATE';
    }
    this.settle(r, bet, m);
    return null;
  }

  /* ---------- Fases ---------- */

  private openBetting() {
    for (const p of this.players.values()) {
      if (p.balance < MIN_BET) {
        p.balance = START_BALANCE; // recarga da demo
        this.sendTo(p.id, { type: 'balance', balance: p.balance });
      }
    }

    const seed = newSeed();
    this.round = {
      id: (this.round?.id ?? 0) + 1,
      phase: 'betting',
      seed,
      hash: hashSeed(seed),
      crashPoint: crashPointFrom(seed),
      bettingEndsAt: Date.now() + BETTING_MS,
      startedAt: null,
      bets: new Map(),
    };

    this.broadcast({ type: 'round:betting', round: this.snapshot() });
    this.openListeners.forEach((fn) => fn());
    setTimeout(() => this.takeOff(), BETTING_MS);
  }

  private takeOff() {
    const r = this.round;
    if (!r) return;
    r.phase = 'flying';
    r.startedAt = Date.now();
    this.broadcast({ type: 'round:flying', roundId: r.id, startedAt: r.startedAt });
    this.ticker = setInterval(() => this.tick(), TICK_MS);
    // Explode no instante exato, sem esperar o próximo tick (até 250 ms de atraso).
    this.crashTimer = setTimeout(() => this.crash(), elapsedFor(r.crashPoint));
    this.tick();
  }

  private tick() {
    const r = this.round;
    if (!r || r.phase !== 'flying' || r.startedAt === null) return;
    const now = Date.now();
    const m = multiplierAt(now - r.startedAt);

    for (const bet of r.bets.values()) {
      if (bet.cashedOutAt === null && bet.autoCashout && bet.autoCashout < r.crashPoint && m >= bet.autoCashout) {
        this.settle(r, bet, bet.autoCashout);
      }
    }

    if (m >= r.crashPoint) {
      this.crash();
      return;
    }
    this.broadcast({ type: 'round:tick', roundId: r.id, multiplier: m, serverTime: now });
  }

  private crash() {
    const r = this.round;
    if (!r || r.phase !== 'flying') return;
    if (this.ticker) clearInterval(this.ticker);
    if (this.crashTimer) clearTimeout(this.crashTimer);
    this.ticker = null;
    this.crashTimer = null;

    // Saques automáticos abaixo do ponto de explosão foram atingidos mesmo que
    // nenhum tick tenha caído entre o alvo e a explosão.
    for (const bet of r.bets.values()) {
      if (bet.cashedOutAt === null && bet.autoCashout && bet.autoCashout < r.crashPoint) {
        this.settle(r, bet, bet.autoCashout);
      }
    }

    r.phase = 'crashed';
    this.history = [r.crashPoint, ...this.history].slice(0, 20);
    this.broadcast({
      type: 'round:crashed',
      roundId: r.id,
      crashPoint: r.crashPoint,
      seed: r.seed,
      serverTime: Date.now(),
    });
    setTimeout(() => this.openBetting(), CRASHED_PAUSE_MS);
  }

  private settle(r: Round, bet: Bet, multiplier: number) {
    const player = this.players.get(bet.playerId);
    if (!player) return;
    const payout = money(bet.amount * multiplier);
    bet.cashedOutAt = multiplier;
    player.balance = money(player.balance + payout);

    this.broadcast({ type: 'bet:cashedOut', roundId: r.id, playerId: bet.playerId, multiplier, payout });
    this.sendTo(bet.playerId, { type: 'balance', balance: player.balance });
  }

  private publicBet(b: Bet): PublicBet {
    return {
      playerId: b.playerId,
      name: this.players.get(b.playerId)?.name ?? 'Piloto',
      amount: b.amount,
      cashedOutAt: b.cashedOutAt,
    };
  }
}
