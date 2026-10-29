import { useEffect } from 'react';
import { socket } from './net/GameSocket';
import { loadAudio } from './sfx';
import { TopBar } from './components/TopBar';
import { History } from './components/History';
import { Stage } from './components/Stage';
import { BetPanel } from './components/BetPanel';
import { PlayersList } from './components/PlayersList';

export function App() {
  useEffect(() => {
    socket.connect();
    return () => socket.close();
  }, []);

  // O áudio (@pixi/sound + decodificação dos sons) não é preciso para o primeiro desenho:
  // começa no primeiro gesto do usuário ou, no mais tardar, 4 s depois, quando o navegador estiver ocioso.
  useEffect(() => {
    let started = false;
    let idleId = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      if (idleId) window.cancelIdleCallback?.(idleId);
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
    };
    const start = () => {
      if (started) return;
      started = true;
      cleanup();
      void loadAudio();
    };
    const timer = window.setTimeout(() => {
      if (window.requestIdleCallback) idleId = window.requestIdleCallback(start, { timeout: 2000 });
      else start();
    }, 4000);
    document.addEventListener('pointerdown', start);
    document.addEventListener('keydown', start);
    return cleanup;
  }, []);

  return (
    <div className="app">
      <TopBar />
      <main className="layout">
        <div className="play">
          <History />
          <Stage />
        </div>
        <aside className="side">
          <BetPanel />
          <PlayersList />
        </aside>
      </main>
    </div>
  );
}
