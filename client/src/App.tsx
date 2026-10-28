import { useEffect } from 'react';
import { socket } from './net/GameSocket';
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

  useEffect(() => {
    void import('./audio').then((m) => m.initAudio());
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
