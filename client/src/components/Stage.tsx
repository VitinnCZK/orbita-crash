import { useEffect, useRef } from 'react';
import type { GameScene } from '../game/GameScene';

/** Chama `fn` quando o navegador registrar o first-contentful-paint (ou em 1 s, sem Paint Timing). */
function afterFirstContentfulPaint(fn: () => void) {
  let done = false;
  let observer: PerformanceObserver | undefined;
  const run = () => {
    if (done) return;
    done = true;
    observer?.disconnect();
    clearTimeout(fallback);
    fn();
  };
  const fallback = window.setTimeout(run, 1000);
  try {
    observer = new PerformanceObserver((list) => {
      if (list.getEntriesByName('first-contentful-paint').length) run();
    });
    observer.observe({ type: 'paint', buffered: true });
  } catch {
    // sem PerformanceObserver de paint: fica o fallback
  }
  return () => {
    done = true;
    observer?.disconnect();
    clearTimeout(fallback);
  };
}

export function Stage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // O PixiJS é a maior parte do JS e criar o contexto WebGL ocupa a GPU: a cena só
    // começa depois que a interface aparece na tela (first-contentful-paint).
    let scene: GameScene | undefined;
    let cancelled = false;
    const stopWaiting = afterFirstContentfulPaint(() => {
      void import('../game/GameScene').then(({ GameScene }) => {
        // Uma tarefa nova: a avaliação do módulo e o início do mount não somam numa tarefa longa só.
        setTimeout(() => {
          if (cancelled) return;
          scene = new GameScene();
          void scene.mount(el);
        }, 0);
      });
    });
    return () => {
      cancelled = true;
      stopWaiting();
      scene?.destroy();
    };
  }, []);

  return <div className="stage" ref={ref} aria-label="Voo do foguete" role="img" />;
}
