import { useGameStore } from '../store';

const AVATAR_COLORS = ['#ff9f1c', '#22b4f5', '#2fcf5a', '#ff3b5c', '#9b86ff', '#ffd23f'];

function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function PlayersList() {
  const round = useGameStore((s) => s.round);
  const me = useGameStore((s) => s.playerId);
  const bets = [...(round?.bets ?? [])].sort((a, b) => b.amount - a.amount);

  return (
    <section className="panel panel-purple players" aria-label="Apostas da rodada">
      <div className="players-head">
        <h2 className="panel-title">Nesta rodada</h2>
        <span className="count">{bets.length}</span>
      </div>
      {bets.length === 0 ? (
        <p className="empty">Ninguém apostou ainda. Seja o primeiro!</p>
      ) : (
        <ul>
          {bets.map((b) => {
            const lost = round?.phase === 'crashed' && b.cashedOutAt === null;
            return (
              <li key={b.playerId} className={b.playerId === me ? 'me' : undefined}>
                <span className="avatar" style={{ background: avatarColor(b.name) }} aria-hidden="true">
                  {b.name.charAt(0)}
                </span>
                <span className="who">{b.name}</span>
                <span className="amt">
                  <i className="coin" aria-hidden="true" />
                  {b.amount}
                </span>
                <span className={b.cashedOutAt ? 'res won' : lost ? 'res lost' : 'res'}>
                  {b.cashedOutAt
                    ? `${b.cashedOutAt.toFixed(2)}x`
                    : lost
                      ? 'perdeu'
                      : round?.phase === 'betting'
                        ? 'pronto'
                        : 'voando'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
