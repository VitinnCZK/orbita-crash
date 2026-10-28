import { z } from 'zod';

/* ---------- Regras da rodada (fonte única para cliente e servidor) ---------- */

export const GROWTH_RATE = 0.00006; // crescimento exponencial por ms
export const BETTING_MS = 6000;
export const CRASHED_PAUSE_MS = 3000;
export const TICK_MS = 250;
export const START_BALANCE = 1000;
export const MIN_BET = 1;
export const MAX_BET = 500;

/** Multiplicador contínuo, usado para desenhar a curva. */
export function rawMultiplier(elapsedMs: number): number {
  return Math.exp(GROWTH_RATE * Math.max(0, elapsedMs));
}

/** Multiplicador oficial (2 casas, sempre arredondado para baixo). */
export function multiplierAt(elapsedMs: number): number {
  return Math.floor(rawMultiplier(elapsedMs) * 100) / 100;
}

/** Tempo de voo necessário para atingir um multiplicador. */
export function elapsedFor(multiplier: number): number {
  return Math.log(multiplier) / GROWTH_RATE;
}

/* ---------- Tipos de estado ---------- */

export type RoundPhase = 'betting' | 'flying' | 'crashed';

export interface PublicBet {
  playerId: string;
  name: string;
  amount: number;
  cashedOutAt: number | null;
}

export interface RoundSnapshot {
  id: number;
  phase: RoundPhase;
  /** sha256(seed), publicado antes da rodada (commit). */
  hash: string;
  bettingEndsAt: number;
  startedAt: number | null;
  /** Só revelado depois da explosão. */
  crashPoint: number | null;
  /** Só revelado depois da explosão (reveal). */
  seed: string | null;
  bets: PublicBet[];
}

/* ---------- Cliente -> Servidor (validado com zod no servidor) ---------- */

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    playerId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(20).optional(),
  }),
  z.object({
    type: z.literal('bet:place'),
    amount: z.number().int().min(MIN_BET).max(MAX_BET),
    autoCashout: z.number().min(1.01).max(1000).optional(),
  }),
  z.object({ type: z.literal('bet:cashout') }),
  z.object({ type: z.literal('ping'), t: z.number() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

/* ---------- Servidor -> Cliente ---------- */

export type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'NOT_IDENTIFIED'
  | 'RATE_LIMITED'
  | 'NOT_BETTING_PHASE'
  | 'ALREADY_BET'
  | 'INSUFFICIENT_BALANCE'
  | 'NOT_FLYING'
  | 'NO_ACTIVE_BET'
  | 'TOO_LATE';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_MESSAGE: 'Mensagem inválida.',
  NOT_IDENTIFIED: 'Conexão ainda não identificada. Aguarde um instante.',
  RATE_LIMITED: 'Muitas ações seguidas. Espere um pouco.',
  NOT_BETTING_PHASE: 'As apostas fecharam. Tente na próxima rodada.',
  ALREADY_BET: 'Você já apostou nesta rodada.',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente para essa aposta.',
  NOT_FLYING: 'Não há voo em andamento.',
  NO_ACTIVE_BET: 'Você não tem aposta ativa nesta rodada.',
  TOO_LATE: 'O foguete explodiu antes do saque.',
};

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      name: string;
      balance: number;
      serverTime: number;
      round: RoundSnapshot;
      history: number[];
    }
  | { type: 'round:betting'; round: RoundSnapshot }
  | { type: 'round:flying'; roundId: number; startedAt: number }
  | { type: 'round:tick'; roundId: number; multiplier: number; serverTime: number }
  | { type: 'round:crashed'; roundId: number; crashPoint: number; seed: string; serverTime: number }
  | { type: 'bet:placed'; roundId: number; bet: PublicBet }
  | { type: 'bet:cashedOut'; roundId: number; playerId: string; multiplier: number; payout: number }
  | { type: 'balance'; balance: number }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'pong'; t: number; serverTime: number };
