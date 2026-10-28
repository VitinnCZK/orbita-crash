import { useEffect, useRef } from 'react';
import { GameScene } from '../game/GameScene';

export function Stage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scene = new GameScene();
    void scene.mount(el);
    return () => scene.destroy();
  }, []);

  return <div className="stage" ref={ref} aria-label="Voo do foguete" role="img" />;
}
