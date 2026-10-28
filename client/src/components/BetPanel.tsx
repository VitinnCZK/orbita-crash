import { useEffect, useState } from 'react';
import { MAX_BET, MIN_BET } from '@crash/shared';
import { selectMyBet, useGameStore } from '../store';
import { socket } from '../net/GameSocket';
import { useLiveMultiplier } from '../hooks/useLiveMultiplier';

const MIN_AUTO = 1.01;
const MAX_AUTO = 1000;

const clampBet = (v: number) => Math.min(MAX_BET, Math.max(MIN_BET, Math.round(v) || MIN_BET));
const clampAuto = (v: number) => Math.min(MAX_AUTO, Math.max(MIN_AUTO, Math.round(v * 100) / 100 || MIN_AUTO));

export function BetPanel() {
  const phase = useGameStore((s) => s.round?.phase ?? null);
  const balance = useGameStore((s) => s.balance);
  const myBet = useGameStore(selectMyBet);
  const error = useGameStore((s) => s.error);
  const status = useGameStore((s) => s.status);

  // Os campos guardam o texto digitado; o valor só é normalizado ao sair do
  // campo ou ao apostar, senão apagar "10" para digitar "50" virava "150".
  const [amountText, setAmountText] = useState('10');
  const [autoOn, setAutoOn] = useState(false);
  const [autoText, setAutoText] = useState('2');
  const amount = clampBet(Number(amountText));
  const autoValue = clampAuto(Number(autoText));
  const setAmount = (v: number) => setAmountText(String(clampBet(v)));
  const [visibleError, setVisibleError] = useState<string | null>(null);

  const flyingWithBet = phase === 'flying' && myBet !== null && myBet.cashedOutAt === null;
  const live = useLiveMultiplier(flyingWithBet);

  useEffect(() => {
    if (!error) return;
    setVisibleError(error.message);
    const id = setTimeout(() => setVisibleError(null), 3000);
    return () => clearTimeout(id);
  }, [error]);

  let label = 'Aguarde a próxima rodada';
  let value: string | null = null;
  let action: (() => void) | null = null;
  let variant = 'idle';

  if (status !== 'online') {
    label = 'Sem conexão';
  } else if (phase === 'betting' && !myBet) {
    label = 'Apostar';
    value = String(amount);
    variant = 'bet';
    action = () => {
      setAmountText(String(amount));
      setAutoText(String(autoValue));
      socket.placeBet(amount, autoOn ? autoValue : undefined);
    };
  } else if (phase === 'betting' && myBet) {
    label = 'Aposta feita! Aguarde a decolagem';
  } else if (flyingWithBet) {
    label = 'Sacar';
    value = (myBet.amount * live).toFixed(2);
    variant = 'cashout';
    action = () => socket.cashout();
  } else if (myBet?.cashedOutAt) {
    label = `Você sacou em ${myBet.cashedOutAt.toFixed(2)}x!`;
    variant = 'won';
  } else if (phase === 'crashed' && myBet) {
    label = 'Explodiu! Tente na próxima';
    variant = 'lost';
  }

  const color = { idle: 'gray', bet: 'orange', cashout: 'green', won: 'green', lost: 'red' }[variant];

  // Espaço faz a ação principal (apostar ou sacar), fora de campos de texto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if ((e.target as HTMLElement).closest('input, textarea, button')) return;
      e.preventDefault();
      action?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action]);

  const locked = phase !== 'betting' || myBet !== null;

  return (
    <section className="panel" aria-label="Aposta">
      <h2 className="panel-title">Sua aposta</h2>

      <div className="amount-row">
        <label className="well">
          <i className="coin" aria-hidden="true" />
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BET}
            max={MAX_BET}
            value={amountText}
            disabled={locked}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={() => setAmountText(String(amount))}
            aria-label="Valor da aposta"
          />
        </label>
        <button type="button" className="jelly jelly-blue jelly-sm" disabled={locked} onClick={() => setAmount(amount / 2)}>
          ½
        </button>
        <button type="button" className="jelly jelly-blue jelly-sm" disabled={locked} onClick={() => setAmount(amount * 2)}>
          2×
        </button>
        <button
          type="button"
          className="jelly jelly-blue jelly-sm"
          disabled={locked}
          onClick={() => setAmount(Math.min(Math.floor(balance), MAX_BET))}
        >
          Máx
        </button>
      </div>

      <div className="auto">
        <label className="switch">
          <input type="checkbox" checked={autoOn} disabled={locked} onChange={(e) => setAutoOn(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          <span>Saque automático</span>
        </label>
        <label className="well">
          <input
            type="number"
            step="0.1"
            min={MIN_AUTO}
            max={MAX_AUTO}
            value={autoText}
            disabled={locked || !autoOn}
            onChange={(e) => setAutoText(e.target.value)}
            onBlur={() => setAutoText(String(autoValue))}
            aria-label="Multiplicador do saque automático"
          />
          <span className="suffix">x</span>
        </label>
      </div>

      <button
        type="button"
        className={`jelly jelly-${color} primary primary-${variant}`}
        disabled={!action}
        onClick={() => action?.()}
      >
        <span>{label}</span>
        {value && (
          <span className="btn-value">
            <i className="coin" aria-hidden="true" />
            {value}
          </span>
        )}
      </button>
      <p className="hint">Atalho: barra de espaço</p>
      <p className="error" role="status" aria-live="polite">
        {visibleError ?? ''}
      </p>
    </section>
  );
}
