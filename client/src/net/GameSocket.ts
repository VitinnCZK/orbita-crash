import type { ClientMessage, ServerMessage } from '@crash/shared';
import { loadPlayerId, useGameStore } from '../store';

interface ClockSample {
  rtt: number;
  offset: number;
}

/**
 * Conexão WebSocket com reconexão (backoff exponencial com jitter) e
 * sincronização de relógio estilo NTP: guardamos as últimas amostras e
 * usamos a de menor RTT, que é a mais confiável.
 */
export class GameSocket {
  private ws: WebSocket | null = null;
  private retry = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private samples: ClockSample[] = [];
  private stopped = false;

  constructor(private readonly url: string) {}

  connect() {
    this.stopped = false;
    const store = useGameStore.getState();
    // Nas novas tentativas o status fica em "offline" (Reconectando), sem piscar.
    if (this.retry === 0) store.setStatus('connecting');

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retry = 0;
      store.setStatus('online');
      this.send({ type: 'hello', playerId: loadPlayerId() });
      this.ping();
      this.pingTimer = setInterval(() => this.ping(), 2000);
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === 'pong') return this.onPong(msg.t, msg.serverTime);
      useGameStore.getState().apply(msg);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return; // socket antigo (ex.: StrictMode)
      this.clearPing();
      useGameStore.getState().setStatus('offline');
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  close() {
    this.stopped = true;
    this.clearPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    // Fechar ainda em CONNECTING gera aviso no console (acontece no StrictMode).
    if (ws.readyState === WebSocket.CONNECTING) ws.addEventListener('open', () => ws.close());
    else ws.close();
  }

  placeBet(amount: number, autoCashout?: number) {
    this.send({ type: 'bet:place', amount, autoCashout });
  }

  cashout() {
    this.send({ type: 'bet:cashout' });
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private ping() {
    this.send({ type: 'ping', t: Date.now() });
  }

  private onPong(t: number, serverTime: number) {
    const now = Date.now();
    const rtt = now - t;
    this.samples = [...this.samples, { rtt, offset: serverTime - (t + rtt / 2) }].slice(-8);
    const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    useGameStore.getState().setClockOffset(best.offset);
  }

  private scheduleReconnect() {
    const delay = Math.min(10_000, 500 * 2 ** this.retry) + Math.random() * 300;
    this.retry += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
}

const defaultUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8080`;
export const socket = new GameSocket(import.meta.env.VITE_WS_URL ?? defaultUrl);
