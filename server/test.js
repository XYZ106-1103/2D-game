// Smoke test: start the relay, connect a host and a guest, exchange messages.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 8899;
const srv = spawn(process.execPath, ['index.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = () =>
  new Promise((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    const inbox = [];
    ws.on('message', (d) => inbox.push(JSON.parse(d.toString())));
    ws.on('open', () => res({ ws, inbox }));
    ws.on('error', rej);
  });
const until = async (box, pred, ms = 2000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const m = box.find(pred);
    if (m) return m;
    await wait(10);
  }
  throw new Error('timeout waiting for message');
};
let ok = true;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) ok = false;
};
try {
  await wait(400);
  const h = await open();
  const g = await open();
  check('hello', !!(await until(h.inbox, (m) => m.t === 'hello')));
  h.ws.send(JSON.stringify({ t: 'create' }));
  const created = await until(h.inbox, (m) => m.t === 'created');
  check('room code is 4 chars', /^[A-Z2-9]{4}$/.test(created.code));
  g.ws.send(JSON.stringify({ t: 'join', code: 'ZZZZ' }));
  check('unknown code refused', (await until(g.inbox, (m) => m.t === 'error')).reason === 'nocode');
  g.ws.send(JSON.stringify({ t: 'join', code: created.code.toLowerCase() }));
  check('guest joined', !!(await until(g.inbox, (m) => m.t === 'joined')));
  check('host told peer arrived', (await until(h.inbox, (m) => m.t === 'peer')).on === true);
  const third = await open();
  third.ws.send(JSON.stringify({ t: 'join', code: created.code }));
  check('third player refused', (await until(third.inbox, (m) => m.t === 'error')).reason === 'full');
  h.ws.send(JSON.stringify({ t: 'st', x: 12 }));
  check('host → guest relay', (await until(g.inbox, (m) => m.t === 'st')).x === 12);
  g.ws.send(JSON.stringify({ t: 'in', k: 3 }));
  check('guest → host relay', (await until(h.inbox, (m) => m.t === 'in')).k === 3);
  g.ws.send(JSON.stringify({ t: 'ping', c: 5 }));
  const pong = await until(g.inbox, (m) => m.t === 'pong');
  check('ping/pong', pong.c === 5 && typeof pong.s === 'number');
  g.ws.close();
  check('host told peer left', !!(await until(h.inbox, (m) => m.t === 'peer' && m.on === false)));
  const g2 = await open();
  g2.ws.send(JSON.stringify({ t: 'join', code: created.code }));
  check('guest can rejoin', !!(await until(g2.inbox, (m) => m.t === 'joined')));
  h.ws.close();
  check('guest told room closed', !!(await until(g2.inbox, (m) => m.t === 'closed')));
  const res = await fetch(`http://localhost:${PORT}/`);
  check('health check', (await res.json()).ok === true);
  third.ws.close();
  g2.ws.close();
} catch (e) {
  console.log('FAIL ', e.message);
  ok = false;
}
srv.kill();
console.log(ok ? 'All relay checks passed.' : 'Relay checks failed.');
process.exit(ok ? 0 : 1);
