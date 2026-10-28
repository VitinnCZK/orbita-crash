import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import {
  ClientMessage,
  ERROR_MESSAGES,
  START_BALANCE,
  type ErrorCode,
  type ServerMessage,
} from '@crash/shared';
import { CrashGame, type Player } from './game.js';
import { startBots } from './bots.js';

const PORT = Number(process.env.PORT ?? 8080);
const RATE_LIMIT_PER_SEC = 20;

const players = new Map<string, Player>();
const socketsByPlayer = new Map<string, Set<WebSocket>>();
const allSockets = new Set<WebSocket>();
const alive = new WeakMap<WebSocket, boolean>();

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg: ServerMessage) {
  const data = JSON.stringify(msg);
  for (const ws of allSockets) if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

function sendTo(playerId: string, msg: ServerMessage) {
  socketsByPlayer.get(playerId)?.forEach((ws) => send(ws, msg));
}

function sendError(ws: WebSocket, code: ErrorCode) {
  send(ws, { type: 'error', code, message: ERROR_MESSAGES[code] });
}

function resolvePlayer(id: string | undefined, name: string | undefined): Player {
  const existing = id ? players.get(id) : undefined;
  if (existing && !existing.isBot) {
    if (name) existing.name = name;
    return existing;
  }
  const player: Player = {
    id: randomUUID(),
    name: name ?? `Piloto-${Math.floor(1000 + Math.random() * 9000)}`,
    balance: START_BALANCE,
  };
  players.set(player.id, player);
  return player;
}

const game = new CrashGame(players, broadcast, sendTo);
startBots(game);
game.start();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, round: game.snapshot().id, clients: allSockets.size }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 });

wss.on('connection', (ws) => {
  let playerId: string | null = null;
  let tokens = RATE_LIMIT_PER_SEC;
  let lastRefill = Date.now();

  allSockets.add(ws);
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));

  ws.on('message', (raw: RawData) => {
    // Token bucket simples por conexão.
    const now = Date.now();
    tokens = Math.min(RATE_LIMIT_PER_SEC, tokens + ((now - lastRefill) / 1000) * RATE_LIMIT_PER_SEC);
    lastRefill = now;
    if (tokens < 1) return sendError(ws, 'RATE_LIMITED');
    tokens -= 1;

    let json: unknown;
    try {
      json = JSON.parse(raw.toString());
    } catch {
      return sendError(ws, 'INVALID_MESSAGE');
    }
    const parsed = ClientMessage.safeParse(json);
    if (!parsed.success) return sendError(ws, 'INVALID_MESSAGE');
    const msg = parsed.data;

    switch (msg.type) {
      case 'ping':
        return send(ws, { type: 'pong', t: msg.t, serverTime: Date.now() });

      case 'hello': {
        const player = resolvePlayer(msg.playerId, msg.name);
        if (playerId && playerId !== player.id) socketsByPlayer.get(playerId)?.delete(ws);
        playerId = player.id;
        if (!socketsByPlayer.has(player.id)) socketsByPlayer.set(player.id, new Set());
        socketsByPlayer.get(player.id)!.add(ws);
        return send(ws, {
          type: 'welcome',
          playerId: player.id,
          name: player.name,
          balance: player.balance,
          serverTime: Date.now(),
          round: game.snapshot(),
          history: game.getHistory(),
        });
      }

      case 'bet:place': {
        if (!playerId) return sendError(ws, 'NOT_IDENTIFIED');
        const err = game.placeBet(playerId, msg.amount, msg.autoCashout);
        if (err) sendError(ws, err);
        return;
      }

      case 'bet:cashout': {
        if (!playerId) return sendError(ws, 'NOT_IDENTIFIED');
        const err = game.cashout(playerId);
        if (err) sendError(ws, err);
        return;
      }
    }
  });

  ws.on('close', () => {
    allSockets.delete(ws);
    if (playerId) socketsByPlayer.get(playerId)?.delete(ws);
  });
});

// Derruba conexões mortas (Wi-Fi caiu sem fechar o socket).
setInterval(() => {
  for (const ws of allSockets) {
    if (!alive.get(ws)) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 15_000);

server.listen(PORT, () => {
  console.log(`[orbita] servidor em ws://localhost:${PORT}  (health: /health)`);
});
