import { useEffect, useState } from 'react';
import { multiplierAt } from '@crash/shared';
import { serverNow, useGameStore } from '../store';

/** Multiplicador ao vivo para o HUD, atualizado a ~15 Hz (suficiente para texto). */
export function useLiveMultiplier(enabled: boolean) {
  const [value, setValue] = useState(1);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const { round, clockOffset, lastTick } = useGameStore.getState();
      if (round?.phase !== 'flying' || round.startedAt === null) return;
      setValue(Math.max(multiplierAt(serverNow(clockOffset) - round.startedAt), lastTick));
    }, 66);
    return () => clearInterval(id);
  }, [enabled]);

  return value;
}
