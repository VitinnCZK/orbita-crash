import { useGameStore } from '../store';

const tone = (v: number) => (v < 2 ? 'low' : v < 10 ? 'mid' : 'high');

export function History() {
  const history = useGameStore((s) => s.history);
  if (history.length === 0) return <div className="history history-empty">As últimas rodadas aparecem aqui.</div>;

  return (
    <ol className="history" aria-label="Últimos resultados">
      {history.map((v, i) => (
        <li key={`${i}-${v}`} className={`chip chip-${tone(v)}`}>
          {v.toFixed(2)}x
        </li>
      ))}
    </ol>
  );
}
