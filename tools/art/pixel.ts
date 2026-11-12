// Low-level pixel canvas + raster primitives used by every art generator.
// Colors are 0xRRGGBB numbers; alpha is stored separately (0..255).

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: number, a = 255): void {
    x |= 0;
    y |= 0;
    if (!this.inside(x, y)) return;
    const o = (y * this.w + x) * 4;
    if (a >= 255 || this.data[o + 3] === 0) {
      this.data[o] = (c >> 16) & 255;
      this.data[o + 1] = (c >> 8) & 255;
      this.data[o + 2] = c & 255;
      this.data[o + 3] = a;
      return;
    }
    // Simple "over" blend (used only by glow / gradient generators).
    const sa = a / 255;
    const da = this.data[o + 3] / 255;
    const oa = sa + da * (1 - sa);
    const blend = (s: number, d: number) => (s * sa + d * da * (1 - sa)) / oa;
    this.data[o] = blend((c >> 16) & 255, this.data[o]);
    this.data[o + 1] = blend((c >> 8) & 255, this.data[o + 1]);
    this.data[o + 2] = blend(c & 255, this.data[o + 2]);
    this.data[o + 3] = oa * 255;
  }

  /** Additive blend, alpha becomes max. */
  add(x: number, y: number, c: number, a = 255): void {
    x |= 0;
    y |= 0;
    if (!this.inside(x, y)) return;
    const o = (y * this.w + x) * 4;
    const k = a / 255;
    this.data[o] = Math.min(255, this.data[o] + ((c >> 16) & 255) * k);
    this.data[o + 1] = Math.min(255, this.data[o + 1] + ((c >> 8) & 255) * k);
    this.data[o + 2] = Math.min(255, this.data[o + 2] + (c & 255) * k);
    this.data[o + 3] = Math.max(this.data[o + 3], a);
  }

  get(x: number, y: number): number {
    if (!this.inside(x, y)) return -1;
    const o = (y * this.w + x) * 4;
    if (this.data[o + 3] === 0) return -1;
    return (this.data[o] << 16) | (this.data[o + 1] << 8) | this.data[o + 2];
  }

  alpha(x: number, y: number): number {
    if (!this.inside(x, y)) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  clear(x: number, y: number): void {
    if (!this.inside(x, y)) return;
    this.data[(y * this.w + x) * 4 + 3] = 0;
  }

  fillRect(x: number, y: number, w: number, h: number, c: number, a = 255): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }

  hline(x0: number, x1: number, y: number, c: number, a = 255): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c, a);
  }

  vline(x: number, y0: number, y1: number, c: number, a = 255): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c, a);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number, a = 255): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: number, a = 255): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c, a);
      }
    }
  }

  fillPoly(pts: [number, number][], c: number, a = 255): void {
    forEachPolyPixel(pts, (x, y) => this.set(x, y, c, a));
  }

  blit(src: PixelCanvas, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const sx = flipX ? src.w - 1 - x : x;
        const o = (y * src.w + sx) * 4;
        const a = src.data[o + 3];
        if (!a) continue;
        this.set(dx + x, dy + y, (src.data[o] << 16) | (src.data[o + 1] << 8) | src.data[o + 2], a);
      }
    }
  }

  /** Copy raw (including alpha) — replaces destination pixels. */
  copyFrom(src: PixelCanvas, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!src.inside(sx + x, sy + y) || !this.inside(dx + x, dy + y)) continue;
        const so = ((sy + y) * src.w + sx + x) * 4;
        const d = ((dy + y) * this.w + dx + x) * 4;
        this.data[d] = src.data[so];
        this.data[d + 1] = src.data[so + 1];
        this.data[d + 2] = src.data[so + 2];
        this.data[d + 3] = src.data[so + 3];
      }
    }
  }

  /** Add a 1px outline around every opaque region (4-neighbourhood). */
  outline(color: number, diagonal = false): void {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y)) continue;
        let n = this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1);
        if (!n && diagonal) n = this.alpha(x - 1, y - 1) || this.alpha(x + 1, y - 1) || this.alpha(x - 1, y + 1) || this.alpha(x + 1, y + 1);
        if (n) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], color);
  }
}

export function forEachPolyPixel(pts: [number, number][], fn: (x: number, y: number) => void): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) {
        xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) fn(x, y);
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministic RNG & noise
// ---------------------------------------------------------------------------

export class RNG {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    // mulberry32
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function valueNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}

export function fbm(x: number, y: number, seed = 0, oct = 4): number {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * valueNoise(x * f, y * f, seed + i * 17);
    f *= 2;
    amp *= 0.5;
  }
  return v;
}

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Ordered dither threshold in [0,1). */
export function bayer(x: number, y: number): number {
  return (BAYER4[y & 3][x & 3] + 0.5) / 16;
}

/** Pick a ramp color for value t∈[0,1] with ordered dithering between steps. */
export function rampDither(ramp: readonly number[], t: number, x: number, y: number): number {
  const f = Math.max(0, Math.min(0.9999, t)) * (ramp.length - 1);
  const i = Math.floor(f);
  const frac = f - i;
  return frac > bayer(x, y) ? ramp[Math.min(ramp.length - 1, i + 1)] : ramp[i];
}

// ---------------------------------------------------------------------------
// Indexed stamps + RotSprite-style rotation
// ---------------------------------------------------------------------------

/** A hand-authored indexed sprite (palette char per pixel, '.' = transparent). */
export interface Stamp {
  w: number;
  h: number;
  px: Int32Array; // color or -1
  /** Optional part id per pixel (for shading/occlusion bookkeeping). */
  pivot: [number, number];
}

export function stampFromRows(rows: string[], pal: Record<string, number>, pivot: [number, number]): Stamp {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const px = new Int32Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (c === undefined) throw new Error(`Unknown palette char '${ch}' in stamp`);
      px[y * w + x] = c;
    }
  }
  return { w, h, px, pivot };
}

function scale2x(src: Int32Array, w: number, h: number): Int32Array {
  const out = new Int32Array(w * 2 * h * 2);
  const at = (x: number, y: number) => src[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = at(x, y);
      const A = at(x, y - 1);
      const B = at(x + 1, y);
      const C = at(x - 1, y);
      const D = at(x, y + 1);
      const W2 = w * 2;
      out[y * 2 * W2 + x * 2] = C === A && C !== D && A !== B ? A : P;
      out[y * 2 * W2 + x * 2 + 1] = A === B && A !== C && B !== D ? B : P;
      out[(y * 2 + 1) * W2 + x * 2] = D === C && D !== B && C !== A ? C : P;
      out[(y * 2 + 1) * W2 + x * 2 + 1] = B === D && B !== A && D !== C ? D : P;
    }
  }
  return out;
}

/**
 * Draw a stamp rotated by `deg` (clockwise) so that its pivot lands on (px,py).
 * Uses Scale2x×3 upsampling then nearest sampling (RotSprite approximation) to
 * keep clean single-pixel lines at arbitrary angles.
 */
export function drawStampRotated(
  target: (x: number, y: number, c: number) => void,
  st: Stamp,
  px: number,
  py: number,
  deg: number,
  flipX = false,
): void {
  const rad = (deg * Math.PI) / 180;
  if (Math.abs(rad) < 1e-6) {
    const ox = Math.round(px - st.pivot[0]);
    const oy = Math.round(py - st.pivot[1]);
    for (let y = 0; y < st.h; y++) {
      for (let x = 0; x < st.w; x++) {
        const c = st.px[y * st.w + (flipX ? st.w - 1 - x : x)];
        if (c >= 0) target(ox + x, oy + y, c);
      }
    }
    return;
  }
  let big = st.px;
  let bw = st.w;
  let bh = st.h;
  if (flipX) {
    big = new Int32Array(st.px.length);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) big[y * bw + x] = st.px[y * bw + (bw - 1 - x)];
  }
  for (let i = 0; i < 3; i++) {
    big = scale2x(big, bw, bh);
    bw *= 2;
    bh *= 2;
  }
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pvx = flipX ? st.w - st.pivot[0] : st.pivot[0];
  const pvy = st.pivot[1];
  const r = Math.hypot(st.w, st.h) + 2;
  for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
    for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
      const dx = x + 0.5 - px;
      const dy = y + 0.5 - py;
      // inverse rotation
      const sx = dx * cos + dy * sin + pvx;
      const sy = -dx * sin + dy * cos + pvy;
      if (sx < 0 || sy < 0 || sx >= st.w || sy >= st.h) continue;
      const c = big[Math.floor(sy * 8) * bw + Math.floor(sx * 8)];
      if (c >= 0) target(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

/** Simple shelf packer producing a Phaser JSON-hash atlas. */
export function packAtlas(items: { name: string; c: PixelCanvas }[], width = 512, pad = 1): { canvas: PixelCanvas; json: unknown } {
  const sorted = [...items].sort((a, b) => b.c.h - a.c.h);
  let x = pad;
  let y = pad;
  let shelf = 0;
  const pos = new Map<string, [number, number]>();
  for (const it of sorted) {
    if (x + it.c.w + pad > width) {
      x = pad;
      y += shelf + pad;
      shelf = 0;
    }
    pos.set(it.name, [x, y]);
    x += it.c.w + pad;
    shelf = Math.max(shelf, it.c.h);
  }
  const height = 1 << Math.ceil(Math.log2(y + shelf + pad));
  const canvas = new PixelCanvas(width, height);
  const frames: Record<string, AtlasFrame> = {};
  for (const it of items) {
    const [px, py] = pos.get(it.name)!;
    canvas.copyFrom(it.c, 0, 0, it.c.w, it.c.h, px, py);
    frames[it.name] = {
      frame: { x: px, y: py, w: it.c.w, h: it.c.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: it.c.w, h: it.c.h },
      sourceSize: { w: it.c.w, h: it.c.h },
    };
  }
  return { canvas, json: { frames, meta: { app: 'tetherfall-bake', version: '1', size: { w: width, h: height }, scale: '1' } } };
}

/** Upscale for previews. */
export function upscale(c: PixelCanvas, s: number, bg = -1): PixelCanvas {
  const out = new PixelCanvas(c.w * s, c.h * s);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const sx = Math.floor(x / s);
      const sy = Math.floor(y / s);
      const col = c.get(sx, sy);
      if (col >= 0) out.set(x, y, col, 255);
      else if (bg >= 0) out.set(x, y, bg, 255);
    }
  }
  return out;
}
