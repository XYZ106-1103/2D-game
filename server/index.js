// TETHERFALL co-op relay.
//
// Up to three players share a room identified by a 4-character code. The
// host (slot 0) creates the room; guests take slots 1 and 2. The server never
// runs game logic — the host's game is the authority for enemies, bosses and
// stage flow — it only forwards messages:
//   • a message with a numeric `to` goes to that slot only,
//   • anything else goes to everyone else in the room.
//
// Control messages (JSON, field `t`):
//   client → server   create | join {code} | leave | ping {c}
//   server → client   created {code, slot} | joined {code, slot, slots}
//                     peer {on, slot, slots} | closed | error {reason}
//                     pong {c, s} | hello {v}
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8787;
const VERSION = 2;
const MAX_ROOMS = 500;
const ROOM_SIZE = 3;
const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const CONTROL = new Set(['create', 'join', 'leave', 'ping']);

/** @type {Map<string, { slots: any[], seen: number }>} */
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

const present = (room) => room.slots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);

function leave(ws) {
  const code = ws.room;
  if (!code) return;
  ws.room = null;
  const room = rooms.get(code);
  if (!room) return;
  const slot = room.slots.indexOf(ws);
  if (slot < 0) return;
  room.slots[slot] = null;
  if (slot === 0) {
    // the host's game is the world: without it the room is over
    for (const g of room.slots) {
      if (!g) continue;
      send(g, { t: 'closed' });
      g.room = null;
    }
    rooms.delete(code);
    return;
  }
  for (const other of room.slots) send(other, { t: 'peer', on: false, slot, slots: present(room) });
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
        rooms.set(code, { slots: [ws, null, null], seen: Date.now() });
        ws.room = code;
        return send(ws, { t: 'created', code, slot: 0 });
      }
      if (msg.t === 'join') {
        const code = String(msg.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return send(ws, { t: 'error', reason: 'nocode' });
        if (room.slots.includes(ws)) return send(ws, { t: 'error', reason: 'self' });
        const slot = room.slots.findIndex((s, i) => i > 0 && !s);
        if (slot < 0 || slot >= ROOM_SIZE) return send(ws, { t: 'error', reason: 'full' });
        leave(ws);
        room.slots[slot] = ws;
        room.seen = Date.now();
        ws.room = code;
        send(ws, { t: 'joined', code, slot, slots: present(room) });
        for (const other of room.slots) if (other && other !== ws) send(other, { t: 'peer', on: true, slot, slots: present(room) });
        return;
      }
      return;
    }
    // game traffic: forward unchanged — to one slot, or to everyone else
    const room = ws.room && rooms.get(ws.room);
    if (!room) return;
    room.seen = Date.now();
    const to = msg && typeof msg.to === 'number' ? msg.to : -1;
    room.slots.forEach((other, i) => {
      if (!other || other === ws || other.readyState !== 1) return;
      if (to >= 0 && i !== to) return;
      other.send(data, { binary: isBinary });
    });
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
      for (const s of room.slots) send(s, { t: 'closed' });
      rooms.delete(code);
    }
  }
}, 15000);
wss.on('close', () => clearInterval(beat));

server.listen(PORT, () => console.log(`tetherfall co-op relay listening on :${PORT}`));
