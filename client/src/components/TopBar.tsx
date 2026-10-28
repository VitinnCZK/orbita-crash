import { useGameStore } from '../store';
import { SoundControl } from './SoundControl';

const STATUS_LABEL = { connecting: 'Conectando', online: 'Online', offline: 'Reconectando' } as const;

export function TopBar() {
  const status = useGameStore((s) => s.status);
  const name = useGameStore((s) => s.name);
  const balance = useGameStore((s) => s.balance);

  return (
    <header className="topbar">
      <h1 className="logo">Órbita</h1>
      <div className="topbar-right">
        <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
        {name && <span className="pilot">{name}</span>}
        <span className="coins" aria-label={`Saldo: ${balance.toFixed(2)} pts`}>
          <i className="coin" aria-hidden="true" />
          {balance.toFixed(2)}
        </span>
        <SoundControl />
      </div>
    </header>
  );
}
