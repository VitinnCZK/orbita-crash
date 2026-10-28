import { useEffect, useRef, useState } from 'react';
import { useAudioSettings } from '../audio';

function SpeakerIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      {off ? <path d="m16 9 6 6m0-6-6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}

export function SoundControl() {
  const { muted, music, sfx, setMuted, setMusic, setSfx } = useAudioSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="sound" ref={ref}>
      <button
        type="button"
        className="jelly jelly-blue jelly-icon"
        aria-label="Som"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SpeakerIcon off={muted} />
      </button>
      {open && (
        <div className="panel sound-panel" role="group" aria-label="Volume">
          <label className="switch">
            <input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>Som ligado</span>
          </label>
          <label className="slider">
            <span>Música</span>
            <input type="range" min={0} max={1} step={0.05} value={music} disabled={muted} onChange={(e) => setMusic(Number(e.target.value))} />
          </label>
          <label className="slider">
            <span>Efeitos</span>
            <input type="range" min={0} max={1} step={0.05} value={sfx} disabled={muted} onChange={(e) => setSfx(Number(e.target.value))} />
          </label>
        </div>
      )}
    </div>
  );
}
