import { useEffect, useRef } from 'react';
import type { GameScene } from '../game/GameScene';

export function Stage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // O PixiJS é a maior parte do JS: carrega depois do primeiro desenho da interface.
    let scene: GameScene | undefined;
    let cancelled = false;
    void import('../game/GameScene').then(({ GameScene }) => {
      if (cancelled) return;
      scene = new GameScene();
      void scene.mount(el);
    });
    return () => {
      cancelled = true;
      scene?.destroy();
    };
  }, []);

  return <div className="stage" ref={ref} aria-label="Voo do foguete" role="img" />;
}
