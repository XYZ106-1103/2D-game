// Online co-op connection: a WebSocket to the relay server (server/), which
// pairs two players in a room and forwards their messages.

export type Role = 'host' | 'guest';
export type NetMsg = { t: string; [k: string]: unknown };
type Handler = (m: NetMsg) => void;

const STORE = 'tetherfall.coopServer.v1';
/** The project's relay on Render (server/, render.yaml). */
const DEFAULT_SERVER = 'https://tetherfall-coop.onrender.com';

/** Relay address: ?coop=… in the URL, a saved override, the build setting, or the project relay. */
export function coopServerUrl(): string {
  const param = new URLSearchParams(location.search).get('coop');
  if (param) return param;
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) return saved;
  } catch {
    /* storage unavailable */
  }
  return (import.meta.env.VITE_COOP_SERVER as string | undefined) || DEFAULT_SERVER;
}

export function saveCoopServerUrl(url: string): void {
  try {
    if (url) localStorage.setItem(STORE, url);
    else localStorage.removeItem(STORE);
  } catch {
    /* storage unavailable */
  }
}

function toWs(url: string): string {
  return url.replace(/^http(s?):\/\//, (_m, s: string) => `ws${s}://`);
}
function toHttp(url: string): string {
  return url.replace(/^ws(s?):\/\//, (_m, s: string) => `http${s}://`);
}

class NetClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private pingTimer: number | null = null;
  role: Role | null = null;
  code = '';
  /** The other player is in the room. */
  peer = false;
  /** Round-trip time to the relay, ms. */
  rtt = 0;
  status: 'idle' | 'waking' | 'connecting' | 'open' | 'closed' = 'idle';

  get active(): boolean {
    return this.status === 'open' && this.role !== null;
  }

  on(t: string, h: Handler): () => void {
    let set = this.handlers.get(t);
    if (!set) {
      set = new Set();
      this.handlers.set(t, set);
    }
    set.add(h);
    return () => set.delete(h);
  }

  private emit(m: NetMsg): void {
    for (const h of this.handlers.get(m.t) ?? []) h(m);
    for (const h of this.handlers.get('*') ?? []) h(m);
  }

  send(m: NetMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  /**
   * Wake the relay (free hosts sleep when idle; the first request can take
   * up to a minute), then open the socket.
   */
  async connect(url = coopServerUrl(), onStatus?: (s: string) => void): Promise<void> {
    if (!url) throw new Error('noserver');
    this.close();
    this.status = 'waking';
    onStatus?.('waking');
    const deadline = Date.now() + 75000;
    // health probe until it answers
    for (;;) {
      try {
        const ctrl = new AbortController();
        const to = window.setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(toHttp(url), { signal: ctrl.signal, cache: 'no-store' });
        window.clearTimeout(to);
        if (res.ok) break;
      } catch {
        /* still asleep */
      }
      if (Date.now() > deadline) {
        this.status = 'closed';
        throw new Error('unreachable');
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    this.status = 'connecting';
    onStatus?.('connecting');
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(toWs(url));
      this.ws = ws;
      const fail = () => {
        if (this.status !== 'open') {
          this.status = 'closed';
          reject(new Error('unreachable'));
        }
      };
      ws.onerror = fail;
      ws.onclose = () => {
        const was = this.status;
        this.status = 'closed';
        this.peer = false;
        if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
        this.pingTimer = null;
        if (was === 'open') this.emit({ t: 'disconnected' });
        fail();
      };
      ws.onmessage = (ev) => {
        let m: NetMsg;
        try {
          m = JSON.parse(String(ev.data)) as NetMsg;
        } catch {
          return;
        }
        if (m.t === 'hello') {
          this.status = 'open';
          resolve();
        } else if (m.t === 'pong') this.rtt = Date.now() - Number(m.c);
        else if (m.t === 'peer') this.peer = !!m.on;
        else if (m.t === 'closed') {
          this.peer = false;
          this.role = null;
        }
        this.emit(m);
      };
    });
    this.pingTimer = window.setInterval(() => this.send({ t: 'ping', c: Date.now() }), 2000);
  }

  /** Create a room; resolves with its code. */
  create(): Promise<string> {
    return new Promise((resolve, reject) => {
      const off1 = this.on('created', (m) => {
        off1();
        off2();
        this.role = 'host';
        this.code = String(m.code);
        this.peer = false;
        resolve(this.code);
      });
      const off2 = this.on('error', (m) => {
        off1();
        off2();
        reject(new Error(String(m.reason)));
      });
      this.send({ t: 'create' });
    });
  }

  /** Join a room by code. Rejects with 'nocode' | 'full' | 'self'. */
  join(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const off1 = this.on('joined', (m) => {
        off1();
        off2();
        this.role = 'guest';
        this.code = String(m.code);
        this.peer = true;
        resolve();
      });
      const off2 = this.on('error', (m) => {
        off1();
        off2();
        reject(new Error(String(m.reason)));
      });
      this.send({ t: 'join', code });
    });
  }

  close(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
    if (this.ws) {
      this.ws.onclose = null;
      try {
        this.send({ t: 'leave' });
        this.ws.close();
      } catch {
        /* already closed */
      }
    }
    this.ws = null;
    this.role = null;
    this.code = '';
    this.peer = false;
    this.status = 'idle';
  }
}

export const net = new NetClient();
