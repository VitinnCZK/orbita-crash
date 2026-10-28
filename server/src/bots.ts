import { BETTING_MS, START_BALANCE } from '@crash/shared';
import type { CrashGame } from './game.js';

const NAMES = ['Kessel', 'Nimbus', 'Orion', 'Vega', 'Lyra', 'Atlas', 'Tétis'];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Pilotos simulados para a mesa não ficar vazia na demo. */
export function startBots(game: CrashGame) {
  const bots = NAMES.map((name, i) => {
    const id = `bot-${i}`;
    game.players.set(id, { id, name, balance: START_BALANCE * 5, isBot: true });
    return id;
  });

  game.onRoundOpen(() => {
    for (const id of bots) {
      if (Math.random() > 0.65) continue;
      const amount = Math.round(rand(5, 120));
      // Distribuição com cauda longa: a maioria saca cedo, alguns arriscam alto.
      const auto = Math.min(25, Math.round((1.1 - Math.log(Math.random()) * 0.9) * 100) / 100);
      setTimeout(() => game.placeBet(id, amount, auto), rand(300, BETTING_MS - 600));
    }
  });
}
