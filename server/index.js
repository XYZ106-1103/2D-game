// TETHERFALL co-op relay.
//
// Two players share a room identified by a 4-character code. The host creates
// the room, the guest joins it; after that the server forwards every game
// message from one to the other unchanged. It never runs game logic: the
// host's game is the authority for enemies, bosses and stage flow.
//
// Control messages (JSON, field `t`):
//   client → server   create | join {code} | leave | ping {c}
//   server → client   created {code} | joined {code} | peer {on} | closed |
//                     error {reason} | pong {c, s} | hello {v}
// Any other message is relayed verbatim to the other player in the room.
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8787;
const VERSION = 1;
const MAX_ROOMS = 500;
const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const CONTROL = new Set(['create', 'join', 'leave', 'ping']);

/** @type {Map<string, { host: any, guest: any, seen: number }>} */
const rooms = new Map();

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(code)) return code;
  }
  return null;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function peerOf(ws) {
  const room = ws.room && rooms.get(ws.room);
  if (!room) return null;
  return room.host === ws ? room.guest : room.host;
}

function leave(ws) {
  const code = ws.room;
  if (!code) return;
  ws.room = null;
  const room = rooms.get(code);
  if (!room) return;
  if (room.host === ws) {
    // the host's game is the world: without it the room is over
    send(room.guest, { t: 'closed' });
    if (room.guest) room.guest.room = null;
    rooms.delete(code);
  } else if (room.guest === ws) {
    room.guest = null;
    send(room.host, { t: 'peer', on: false });
  }
}

const server = http.createServer((req, res) => {
  // health check / wake-up probe (Render spins free services down when idle)
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify({ ok: true, service: 'tetherfall-coop', v: VERSION, rooms: rooms.size }));
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

wss.on('connection', (ws) => {
  ws.room = null;
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  send(ws, { t: 'hello', v: VERSION });

  ws.on('message', (data, isBinary) => {
    ws.alive = true;
    let msg = null;
    if (!isBinary) {
      try {
        msg = JSON.parse(data.toString());
      } catch {
        msg = null;
      }
    }
    if (msg && CONTROL.has(msg.t)) {
      if (msg.t === 'ping') return send(ws, { t: 'pong', c: msg.c, s: Date.now() });
      if (msg.t === 'leave') return leave(ws);
      if (msg.t === 'create') {
        leave(ws);
        if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'error', reason: 'busy' });
        const code = newCode();
        if (!code) return send(ws, { t: 'error', reason: 'busy' });
        rooms.set(code, { host: ws, guest: null, seen: Date.now() });
        ws.room = code;
        return send(ws, { t: 'created', code });
      }
      if (msg.t === 'join') {
        const code = String(msg.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return send(ws, { t: 'error', reason: 'nocode' });
        if (room.host === ws) return send(ws, { t: 'error', reason: 'self' });
        if (room.guest && room.guest !== ws) return send(ws, { t: 'error', reason: 'full' });
        leave(ws);
        room.guest = ws;
        room.seen = Date.now();
        ws.room = code;
        send(ws, { t: 'joined', code });
        return send(room.host, { t: 'peer', on: true });
      }
      return;
    }
    // game traffic: forward unchanged
    const peer = peerOf(ws);
    if (!peer) return;
    const room = rooms.get(ws.room);
    if (room) room.seen = Date.now();
    if (peer.readyState === 1) peer.send(data, { binary: isBinary });
  });

  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

// keep connections honest through proxies; drop dead sockets and idle rooms
const beat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.seen > ROOM_IDLE_MS) {
      send(room.host, { t: 'closed' });
      send(room.guest, { t: 'closed' });
      rooms.delete(code);
    }
  }
}, 15000);
wss.on('close', () => clearInterval(beat));

server.listen(PORT, () => console.log(`tetherfall co-op relay listening on :${PORT}`));
