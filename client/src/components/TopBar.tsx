import logo from '../assets/images/orbita-logo.webp';
import logoSmall from '../assets/images/orbita-logo-64.webp';
import { useGameStore } from '../store';
import { ExternalLinks } from './ExternalLinks';
import { SoundControl } from './SoundControl';

const STATUS_LABEL = { connecting: 'Conectando', online: 'Online', offline: 'Reconectando' } as const;

export function TopBar() {
  const status = useGameStore((s) => s.status);
  const name = useGameStore((s) => s.name);
  const balance = useGameStore((s) => s.balance);

  return (
    <header className="topbar">
      <h1 className="logo">
        {/* Larguras exibidas: 92 px (≤440), 109 px (≤860) e 132 px; a versão de 64 px de altura cobre celulares. */}
        <img
          src={logo}
          srcSet={`${logoSmall} 183w, ${logo} 275w`}
          sizes="(max-width: 440px) 92px, (max-width: 860px) 109px, 132px"
          alt="Órbita"
          width={275}
          height={96}
        />
      </h1>
      <div className="topbar-right">
        <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
        {name && <span className="pilot">{name}</span>}
        <span className="coins" aria-label={`Saldo: ${balance.toFixed(2)} pts`}>
          <i className="coin" aria-hidden="true" />
          {balance.toFixed(2)}
        </span>
        <SoundControl />
        <ExternalLinks />
      </div>
    </header>
  );
}
