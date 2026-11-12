// Effects atlas: hook, particles, slashes, impacts, glows, crosshairs.
import { RAMPS, INK } from '../../src/art/palette.ts';
import { PixelCanvas, bayer, hash2 } from './pixel.ts';

type Item = { name: string; c: PixelCanvas };
const CY = RAMPS.cyan;
const S = RAMPS.steel;

function hook(out: Item[]): void {
  // Claw head, pointing right. Origin = centre.
  const rows = ['..ee...', '.eTtt..', 'eTTVtTe', 'eTVVVtT', 'eTTVtTe', '.eTtt..', '..ee...'];
  const pal: Record<string, number> = { e: S[3], T: S[6], t: S[5], V: CY[6] };
  const c = new PixelCanvas(9, 9);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && c.set(x + 1, y + 1, pal[ch])));
  c.outline(INK);
  out.push({ name: 'hook', c });
}

function dots(out: Item[]): void {
  const px1 = new PixelCanvas(1, 1);
  px1.set(0, 0, 0xffffff);
  out.push({ name: 'px1', c: px1 });
  const px2 = new PixelCanvas(2, 2);
  px2.fillRect(0, 0, 2, 2, 0xffffff);
  out.push({ name: 'px2', c: px2 });
  const plus = new PixelCanvas(3, 3);
  plus.set(1, 0, 0xffffff);
  plus.set(0, 1, 0xffffff);
  plus.set(1, 1, 0xffffff);
  plus.set(2, 1, 0xffffff);
  plus.set(1, 2, 0xffffff);
  out.push({ name: 'spark', c: plus });
  for (const len of [6, 9, 12]) {
    const r = new PixelCanvas(1, len);
    for (let y = 0; y < len; y++) r.set(0, y, 0xffffff, y < 2 ? 120 : 255);
    out.push({ name: `streak${len}`, c: r });
  }
  const sl = new PixelCanvas(14, 1);
  for (let x = 0; x < 14; x++) sl.set(x, 0, 0xffffff, x < 4 ? 90 : x < 9 ? 170 : 255);
  out.push({ name: 'speedline', c: sl });
}

function dust(out: Item[]): void {
  const D = [0x2b2336, 0x3a2f46, 0x4d405a, 0x655572, 0x82708e];
  for (let f = 0; f < 6; f++) {
    const c = new PixelCanvas(14, 12);
    const t = f / 5;
    const r = 2.5 + t * 3.5;
    const blobs = [
      [7, 8],
      [4.5, 8.5],
      [9.5, 8.6],
      [6.5, 6],
    ];
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 14; x++) {
        let inside = 0;
        for (const [bx, by] of blobs) {
          const d = Math.hypot(x + 0.5 - bx, y + 0.5 - (by - t * 3));
          inside = Math.max(inside, 1 - d / (r * (0.7 + hash2(bx, by, 1) * 0.3)));
        }
        if (inside <= 0) continue;
        if (t > 0.5 && bayer(x, y) < (t - 0.5) * 1.6) continue;
        const shade = y < 6 - t * 2 ? 4 : y < 8 - t * 2 ? 3 : 2;
        c.set(x, y, D[Math.max(0, shade - Math.floor(t * 2))]);
      }
    }
    out.push({ name: `dust_${f}`, c });
  }
}

function splash(out: Item[]): void {
  const shapes = [
    ['...x...', '..x.x..'],
    ['.x...x.', '..x.x..', '.......'],
    ['x.....x', '.......', '.x...x.'],
    ['.......', 'x.....x', '.......'],
  ];
  shapes.forEach((rows, f) => {
    const c = new PixelCanvas(7, 4);
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch === 'x' && c.set(x, y + 1, 0xb8c4dc, f > 2 ? 140 : 220)));
    out.push({ name: `splash_${f}`, c });
  });
}

/** Crescent slash smear. Arc from -70° to +70° in front of the swing. */
function slashes(out: Item[]): void {
  for (let f = 0; f < 4; f++) {
    const W = 48;
    const H = 40;
    const c = new PixelCanvas(W, H);
    const cx = 14;
    const cy = 20;
    const R = 22;
    const thick = [5, 7, 5, 3][f];
    const sweepEnd = [60, 75, 80, 80][f];
    const sweepStart = [-80, -75, -40, 0][f];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        const a = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (a < sweepStart || a > sweepEnd) continue;
        const along = (a - sweepStart) / (sweepEnd - sweepStart); // 0 tail → 1 head
        const th = thick * (0.25 + 0.75 * Math.sin(along * Math.PI * 0.95));
        const inner = R - th;
        if (d < inner || d > R) continue;
        const k = (d - inner) / th; // 0 inner → 1 outer edge
        let col: number;
        if (k > 0.75) col = 0xf0fffe;
        else if (k > 0.45) col = CY[6];
        else if (k > 0.2) col = CY[5];
        else col = CY[4];
        if (f >= 2 && bayer(x, y) < (f - 1) * 0.3 * (1 - k)) continue;
        c.set(x, y, col);
      }
    }
    out.push({ name: `slash_${f}`, c });
  }
}

function impact(out: Item[]): void {
  for (let f = 0; f < 4; f++) {
    const c = new PixelCanvas(25, 25);
    const cx = 12;
    const cy = 12;
    const len = [6, 11, 12, 10][f];
    const inner = [0, 2, 6, 8][f];
    const rays = 8;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + (i % 2) * 0.2;
      const L = i % 2 ? len * 0.6 : len;
      for (let r = inner; r < L; r += 0.5) {
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        c.set(x, y, r < L * 0.5 ? 0xffffff : RAMPS.yellow[4]);
      }
    }
    if (f < 2) {
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.abs(x) + Math.abs(y) <= 2 - f) c.set(cx + x, cy + y, 0xffffff);
    }
    out.push({ name: `impact_${f}`, c });
  }
}

function rings(out: Item[]): void {
  for (let f = 0; f < 5; f++) {
    const c = new PixelCanvas(31, 31);
    const r = 3 + f * 3;
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      if (f >= 3 && Math.floor(a / 20) % 2 === 1) continue;
      c.set(15 + Math.cos(rad) * r, 15 + Math.sin(rad) * r, 0xffffff);
    }
    out.push({ name: `ring_${f}`, c });
  }
}

/** Dithered radial glows (white; tint + ADD at runtime). */
function glows(out: Item[]): void {
  for (const size of [16, 32, 64, 128]) {
    const c = new PixelCanvas(size, size);
    const r = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
        if (d >= 1) continue;
        const v = Math.pow(1 - d, 1.8);
        // quantise to 3 alpha bands with ordered dithering between them
        const bands = [40, 80, 130];
        const f = v * bands.length;
        const i = Math.floor(f);
        const frac = f - i;
        const idx = Math.min(bands.length - 1, frac > bayer(x, y) ? i : i - 1);
        if (idx < 0) continue;
        c.set(x, y, 0xffffff, bands[idx]);
      }
    }
    out.push({ name: `glow${size}`, c });
  }
  // horizontal light cone for searchlights / lamps (pointing down)
  const W = 48;
  const H = 64;
  const cone = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) {
    const half = 3 + (y / H) * 22;
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - W / 2) / half;
      if (dx >= 1) continue;
      const v = (1 - dx) * (1 - y / H) * 0.9;
      if (v > bayer(x, y) * 0.8 + 0.08) cone.set(x, y, 0xffffff, v > 0.5 ? 90 : 50);
    }
  }
  out.push({ name: 'cone', c: cone });
}

function zaps(out: Item[]): void {
  for (let f = 0; f < 4; f++) {
    const c = new PixelCanvas(18, 12);
    let y = 6;
    for (let x = 0; x < 18; x++) {
      y += Math.round((hash2(x, f, 3) - 0.5) * 3);
      y = Math.max(1, Math.min(10, y));
      c.set(x, y, x % 5 === f % 5 ? 0xffffff : CY[6]);
      if (hash2(x, f, 9) > 0.8) c.set(x, y - 1, CY[5]);
    }
    out.push({ name: `zap_${f}`, c });
  }
}

/** Crosshair states: idle, valid surface, anchor lock, out of range. */
function crosshairs(out: Item[]): void {
  const make = (name: string, col: number, dim: number, mode: number) => {
    const c = new PixelCanvas(15, 15);
    const cx = 7;
    // corner brackets
    const L = mode === 2 ? 2 : 3;
    const o = mode === 2 ? 4 : 6;
    for (let i = 0; i < L; i++) {
      c.set(cx - o + i, cx - o, col);
      c.set(cx - o, cx - o + i, col);
      c.set(cx + o - i, cx - o, col);
      c.set(cx + o, cx - o + i, col);
      c.set(cx - o + i, cx + o, col);
      c.set(cx - o, cx + o - i, col);
      c.set(cx + o - i, cx + o, col);
      c.set(cx + o, cx + o - i, col);
    }
    c.set(cx, cx, mode === 3 ? dim : 0xffffff);
    if (mode !== 3) {
      c.set(cx - 2, cx, dim);
      c.set(cx + 2, cx, dim);
      c.set(cx, cx - 2, dim);
      c.set(cx, cx + 2, dim);
    } else {
      c.set(cx - 1, cx - 1, dim);
      c.set(cx + 1, cx + 1, dim);
      c.set(cx + 1, cx - 1, dim);
      c.set(cx - 1, cx + 1, dim);
    }
    c.outline(INK);
    out.push({ name, c });
  };
  make('cross_idle', RAMPS.night[8], RAMPS.night[6], 0);
  make('cross_valid', CY[5], CY[3], 1);
  make('cross_lock', RAMPS.magenta[5], RAMPS.magenta[3], 2);
  make('cross_far', RAMPS.crimson[4], RAMPS.crimson[3], 3);
  // anchor lock-on ring (drawn around anchors in range)
  for (let f = 0; f < 2; f++) {
    const c = new PixelCanvas(23, 23);
    for (let a = 0; a < 360; a += 3) {
      if (Math.floor((a + f * 22) / 45) % 2) continue;
      const rad = (a * Math.PI) / 180;
      c.set(11 + Math.cos(rad) * 10, 11 + Math.sin(rad) * 10, 0xffffff);
    }
    out.push({ name: `lockring_${f}`, c });
  }
}

export function buildFx(): Item[] {
  const out: Item[] = [];
  hook(out);
  dots(out);
  dust(out);
  splash(out);
  slashes(out);
  impact(out);
  rings(out);
  glows(out);
  zaps(out);
  crosshairs(out);
  return out;
}
