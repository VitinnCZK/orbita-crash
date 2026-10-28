import { create } from 'zustand';
import type { PublicBet, RoundSnapshot, ServerMessage } from '@crash/shared';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

interface GameState {
  status: ConnectionStatus;
  playerId: string | null;
  name: string;
  balance: number;
  round: RoundSnapshot | null;
  history: number[];
  /** Último multiplicador recebido do servidor. Garante que o número nunca anda para trás. */
  lastTick: number;
  /** serverTime - Date.now(), estimado via ping/pong. */
  clockOffset: number;
  error: { message: string; at: number } | null;
  /** Último saque do próprio jogador, com o valor oficial do servidor. A cena anima a partir dele. */
  lastCashout: { roundId: number; multiplier: number; payout: number; at: number } | null;

  setStatus: (s: ConnectionStatus) => void;
  setClockOffset: (offset: number) => void;
  apply: (msg: ServerMessage) => void;
}

const PLAYER_KEY = 'orbita:playerId';

export function loadPlayerId(): string | undefined {
  try {
    return localStorage.getItem(PLAYER_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function savePlayerId(id: string) {
  try {
    localStorage.setItem(PLAYER_KEY, id);
  } catch {
    /* modo privado: segue sem persistir */
  }
}

function upsertBet(bets: PublicBet[], bet: PublicBet) {
  const rest = bets.filter((b) => b.playerId !== bet.playerId);
  return [...rest, bet];
}

export const useGameStore = create<GameState>((set, get) => ({
  status: 'connecting',
  playerId: null,
  name: '',
  balance: 0,
  round: null,
  history: [],
  lastTick: 1,
  clockOffset: 0,
  error: null,
  lastCashout: null,

  setStatus: (status) => set({ status }),
  setClockOffset: (clockOffset) => set({ clockOffset }),

  apply: (msg) => {
    const { round } = get();
    switch (msg.type) {
      case 'welcome':
        savePlayerId(msg.playerId);
        return set({
          playerId: msg.playerId,
          name: msg.name,
          balance: msg.balance,
          round: msg.round,
          history: msg.history,
          lastTick: 1,
          clockOffset: msg.serverTime - Date.now(),
        });

      case 'round:betting':
        return set({ round: msg.round, lastTick: 1 });

      case 'round:flying':
        if (round?.id !== msg.roundId) return;
        return set({ round: { ...round, phase: 'flying', startedAt: msg.startedAt } });

      case 'round:tick':
        if (round?.id !== msg.roundId) return;
        return set({ lastTick: msg.multiplier });

      case 'round:crashed':
        if (round?.id !== msg.roundId) return;
        return set({
          round: { ...round, phase: 'crashed', crashPoint: msg.crashPoint, seed: msg.seed },
          history: [msg.crashPoint, ...get().history].slice(0, 20),
        });

      case 'bet:placed':
        if (round?.id !== msg.roundId) return;
        return set({ round: { ...round, bets: upsertBet(round.bets, msg.bet) } });

      case 'bet:cashedOut': {
        if (round?.id !== msg.roundId) return;
        const bets = round.bets.map((b) =>
          b.playerId === msg.playerId ? { ...b, cashedOutAt: msg.multiplier } : b,
        );
        if (msg.playerId !== get().playerId) return set({ round: { ...round, bets } });
        const { roundId, multiplier, payout } = msg;
        return set({ round: { ...round, bets }, lastCashout: { roundId, multiplier, payout, at: Date.now() } });
      }

      case 'balance':
        return set({ balance: msg.balance });

      case 'error':
        return set({ error: { message: msg.message, at: Date.now() } });

      case 'pong':
        return; // tratado no GameSocket
    }
  },
}));

export const serverNow = (offset: number) => Date.now() + offset;

export const selectMyBet = (s: GameState) =>
  s.round?.bets.find((b) => b.playerId === s.playerId) ?? null;
