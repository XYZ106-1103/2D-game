// Parallax background layers for VESPER city.
// Aerial perspective: farther layers are lighter, hazier and lower contrast.
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, RNG, bayer, fbm, hash2, rampDither } from './pixel.ts';
import { loadGalmuri, rasterText } from '../lib/bdf.ts';

const SKY = [0x0a0612, 0x0f0a1c, 0x150e28, 0x1c1234, 0x24143f, 0x2e1648, 0x3a184e, 0x4a1a54, 0x5e1c58, 0x7a2060];

/** 480×270 sky with smog, moon and stars. Fixed to the camera. */
export function sky(): PixelCanvas {
  const W = 480;
  const H = 270;
  const c = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let t = Math.pow(y / H, 1.6);
      const smog = fbm(x / 90, y / 22, 3, 4);
      t += (smog - 0.5) * 0.18;
      c.set(x, y, rampDither(SKY, t, x, y));
    }
  }
  // stars (only in the clearer upper sky)
  const r = new RNG(42);
  for (let i = 0; i < 90; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(0, 120);
    if (fbm(x / 90, y / 22, 3, 4) > 0.55) continue;
    c.set(x, y, r.chance(0.2) ? RAMPS.night[8] : RAMPS.night[5]);
  }
  // moon with halo, half veiled in smog
  const mx = 372;
  const my = 58;
  const mr = 19;
  for (let y = my - 60; y < my + 60; y++) {
    for (let x = mx - 60; x < mx + 60; x++) {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (d < mr) {
        const n = fbm(x / 6, y / 6, 9, 3);
        const lit = (x - mx) * -0.5 + (y - my) * -0.6;
        let t = 0.55 + lit / (mr * 3) + (n - 0.5) * 0.4;
        if (d > mr - 1.5) t -= 0.15;
        const col = rampDither([0x6d5a8a, 0x8f7aa6, 0xb3a0c4, 0xd6c8e0, 0xf0e8f4], t, x, y);
        c.set(x, y, col);
      } else if (d < mr + 26) {
        const k = 1 - (d - mr) / 26;
        if (k * k * 0.55 > bayer(x, y)) c.set(x, y, k > 0.6 ? 0x5a2a68 : 0x40204e);
      }
    }
  }
  // smog bands over the moon
  for (let y = my - 2; y < my + 14; y++) {
    for (let x = mx - 40; x < mx + 40; x++) {
      const n = fbm(x / 30, y / 5, 21, 3);
      if (n > 0.55 && c.get(x, y) >= 0) c.set(x, y, rampDither(SKY, 0.45 + (y - my) / 60, x, y));
    }
  }
  return c;
}

/** The LETHE spire: a single colossal corporate tower on the horizon. */
export function spire(): PixelCanvas {
  const W = 90;
  const H = 260;
  const c = new PixelCanvas(W, H);
  const cx = 45;
  const body = [0x1a1030, 0x22143c, 0x2c1a4a, 0x3a2258];
  for (let y = 0; y < H; y++) {
    const t = y / H;
    let half = 3 + t * 28;
    if (y > 60) half = 10 + (y - 60) * 0.12;
    if (y > 150) half = 22 + (y - 150) * 0.18;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const u = (x - (cx - half)) / (2 * half);
      let col = u < 0.25 ? body[2] : u < 0.6 ? body[1] : body[0];
      if (u < 0.08) col = body[3];
      // horizontal ring decks
      if (y % 23 === 0 && y > 30) col = body[3];
      c.set(x, y, col);
    }
    // vertical light seams
    if (y > 20 && y % 3 !== 0) {
      c.set(cx, y, y % 6 < 3 ? RAMPS.magenta[4] : RAMPS.magenta[3]);
    }
    if (y > 160 && y % 4 === 1) {
      c.set(Math.round(cx - half * 0.5), y, RAMPS.magenta[3]);
      c.set(Math.round(cx + half * 0.5), y, RAMPS.magenta[2]);
    }
  }
  // crown + antenna
  for (let y = 0; y < 24; y++) c.set(cx, y, y < 4 ? RAMPS.crimson[5] : RAMPS.night[5]);
  c.set(cx, 0, RAMPS.crimson[6]);
  // halo ring
  for (let a = 0; a < 360; a += 2) {
    const r = (a * Math.PI) / 180;
    const x = cx + Math.cos(r) * 26;
    const y = 44 + Math.sin(r) * 5;
    c.set(x, y, Math.sin(r) < 0 ? RAMPS.magenta[3] : RAMPS.magenta[5]);
  }
  // corporate glyph: LETHE
  const font = loadGalmuri('Galmuri7');
  rasterText(font, 'LETHE', cx - 11, 78, (x, y) => c.set(x, y, RAMPS.magenta[6]), 0);
  return c;
}

interface Tower {
  x: number;
  w: number;
  h: number;
  top: 'flat' | 'step' | 'spire' | 'slant';
  seed: number;
}

function towers(rng: RNG, width: number, count: number, minW: number, maxW: number, minH: number, maxH: number): Tower[] {
  const list: Tower[] = [];
  let x = 0;
  for (let i = 0; i < count && x < width; i++) {
    const w = rng.int(minW, maxW);
    list.push({ x, w, h: rng.int(minH, maxH), top: rng.pick(['flat', 'step', 'spire', 'slant'] as const), seed: rng.int(0, 99999) });
    x += w + rng.int(-Math.floor(w / 3), 6);
  }
  return list;
}

function towerTopY(t: Tower, lx: number, base: number): number {
  const top = base - t.h;
  switch (t.top) {
    case 'step':
      return lx < t.w * 0.3 || lx > t.w * 0.7 ? top + 8 : top;
    case 'spire':
      return lx === Math.floor(t.w / 2) ? top - 18 : Math.abs(lx - t.w / 2) < t.w * 0.2 ? top - 4 : top + 4;
    case 'slant':
      return top + Math.floor((lx / t.w) * 10);
    default:
      return top;
  }
}

/** Generic skyline layer. */
function skyline(opts: {
  width: number;
  height: number;
  base: number;
  seed: number;
  count: number;
  wRange: [number, number];
  hRange: [number, number];
  body: number[];
  rimL: number;
  rimR: number;
  windowP: number;
  windowColors: number[];
  windowSize: [number, number];
  haze: number[];
  hazeStart: number;
  neonStrips: number;
}): PixelCanvas {
  const { width: W, height: H } = opts;
  const c = new PixelCanvas(W, H);
  const rng = new RNG(opts.seed);
  const list = towers(rng, W + 80, opts.count, opts.wRange[0], opts.wRange[1], opts.hRange[0], opts.hRange[1]);
  for (const t of list) {
    for (let lx = 0; lx < t.w; lx++) {
      const x = (t.x + lx) % W;
      const ty = towerTopY(t, lx, opts.base);
      for (let y = Math.max(0, ty); y < H; y++) {
        let col = opts.body[1];
        if (lx === 0) col = opts.rimL;
        else if (lx === t.w - 1) col = opts.rimR;
        else if (lx < 3) col = opts.body[2];
        else if (lx > t.w - 4) col = opts.body[0];
        if (y === ty) col = opts.body[3];
        c.set(x, y, col);
      }
      // windows grid
      const [ww, wh] = opts.windowSize;
      const gx = ww + 1;
      const gy = wh + 2;
      for (let y = ty + 4; y < H; y++) {
        const wx = lx - 2;
        const wy = y - ty - 4;
        if (lx < 2 || lx > t.w - 3) continue;
        if (wx % gx >= ww || wy % gy >= wh) continue;
        const cellX = Math.floor(wx / gx);
        const cellY = Math.floor(wy / gy);
        const hsh = hash2(cellX + t.seed, cellY, opts.seed);
        if (hsh < opts.windowP) {
          const ci = Math.floor(hash2(cellX, cellY + t.seed, 3) * opts.windowColors.length);
          c.set(x, y, opts.windowColors[ci]);
        } else if (hsh < opts.windowP + 0.25) {
          c.set(x, y, opts.body[0]);
        }
      }
    }
    // rooftop clutter
    const rx = t.x + rng.int(2, Math.max(3, t.w - 6));
    const ty = towerTopY(t, rx - t.x, opts.base);
    if (rng.chance(0.6)) {
      const ah = rng.int(4, 14);
      for (let y = 0; y < ah; y++) c.set(rx % W, ty - y, opts.body[2]);
      c.set(rx % W, ty - ah, RAMPS.crimson[4]);
    }
    if (rng.chance(0.4) && t.w > 14) {
      const tx = (t.x + 3) % W;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) c.set((tx + x) % W, ty - 5 + y, opts.body[y === 0 ? 3 : 1]);
    }
    // neon vertical strips
    if (rng.chance(opts.neonStrips)) {
      const sx = (t.x + (rng.chance(0.5) ? 1 : t.w - 2)) % W;
      const col = rng.pick([RAMPS.magenta[4], RAMPS.cyan[4], RAMPS.violet[4], RAMPS.amber[3]]);
      const len = rng.int(20, Math.min(90, t.h - 10));
      const sy = towerTopY(t, 1, opts.base) + rng.int(6, 20);
      for (let y = sy; y < sy + len; y++) c.set(sx, y, y % 2 === 0 ? col : col);
    }
  }
  // haze toward the bottom
  for (let y = opts.hazeStart; y < H; y++) {
    const k = (y - opts.hazeStart) / (H - opts.hazeStart);
    for (let x = 0; x < W; x++) {
      if (c.get(x, y) < 0) continue;
      if (k > bayer(x, y) * 0.9 + 0.1) c.set(x, y, rampDither(opts.haze, k, x, y));
    }
  }
  return c;
}

export function farLayer(): PixelCanvas {
  return skyline({
    width: 960,
    height: 320,
    base: 150,
    seed: 101,
    count: 60,
    wRange: [16, 44],
    hRange: [40, 130],
    body: [0x1e1236, 0x241640, 0x2c1a4c, 0x34205a],
    rimL: 0x3a2462,
    rimR: 0x1e1236,
    windowP: 0.05,
    windowColors: [0x3e2a62, 0x4a2a5a, 0x2e3460, 0x553a58],
    windowSize: [1, 1],
    haze: [0x2a1848, 0x341a50, 0x401c56],
    hazeStart: 110,
    neonStrips: 0.15,
  });
}

export function midLayer(): PixelCanvas {
  const c = skyline({
    width: 960,
    height: 360,
    base: 150,
    seed: 202,
    count: 40,
    wRange: [26, 64],
    hRange: [60, 150],
    body: [0x120c22, 0x180f2c, 0x221638, 0x2c1c48],
    rimL: 0x4a2a6a,
    rimR: 0x163448,
    windowP: 0.12,
    windowColors: [0x7a5a3a, 0x8a6a3a, 0x6a4a34, 0x3a6a7a, 0x7a5a3a],
    windowSize: [2, 1],
    haze: [0x1c1036, 0x24143e, 0x2c1846],
    hazeStart: 150,
    neonStrips: 0.35,
  });
  // distant holo-billboards
  const rng = new RNG(77);
  for (let i = 0; i < 6; i++) {
    const x = rng.int(0, 900);
    const y = rng.int(40, 100);
    const w = rng.int(18, 34);
    const h = rng.int(10, 16);
    const col = rng.pick([RAMPS.magenta, RAMPS.cyan, RAMPS.violet]);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const edge = xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1;
        const band = (yy + i) % 4 === 0;
        c.set((x + xx) % 960, y + yy, edge ? col[3] : band ? col[3] : col[2]);
      }
    }
    for (let xx = 3; xx < w - 3; xx += 2) c.set((x + xx) % 960, y + Math.floor(h / 2), col[5]);
  }
  return c;
}

/** Near layer: big dark structures with two-tone neon rim light, fire escapes, cables and signage. */
export function nearLayer(): PixelCanvas {
  const W = 1024;
  const H = 400;
  const c = new PixelCanvas(W, H);
  const rng = new RNG(303);
  const base = 120;
  const body = [0x0a0714, 0x0e0a1a, 0x140f24, 0x1c142e];
  const blds: { x: number; w: number; top: number }[] = [];
  let x = 0;
  while (x < W) {
    const w = rng.int(60, 130);
    const top = base + rng.int(-60, 40);
    blds.push({ x, w, top });
    x += w + rng.int(14, 40);
  }
  for (const b of blds) {
    for (let lx = 0; lx < b.w; lx++) {
      const px = (b.x + lx) % W;
      for (let y = b.top; y < H; y++) {
        let col = body[1];
        if (lx === 0) col = RAMPS.magenta[3];
        else if (lx === 1) col = RAMPS.magenta[2];
        else if (lx === b.w - 1) col = RAMPS.cyan[3];
        else if (lx === b.w - 2) col = RAMPS.cyan[2];
        else if (lx < 6) col = body[2];
        if (y === b.top) col = lx < 2 ? RAMPS.magenta[4] : lx > b.w - 3 ? RAMPS.cyan[4] : body[3];
        // floor slabs
        if ((y - b.top) % 18 === 17 && lx > 1 && lx < b.w - 2) col = body[0];
        c.set(px, y, col);
      }
      // windows
      for (let y = b.top + 6; y < H; y++) {
        const fy = (y - b.top - 6) % 18;
        const fx = (lx - 6) % 10;
        if (lx < 6 || lx > b.w - 8 || fy > 8 || fx > 5) continue;
        const cell = hash2(Math.floor((lx - 6) / 10) + b.x, Math.floor((y - b.top - 6) / 18), 9);
        if (cell < 0.1) c.set(px, y, fy < 2 ? 0x7a5a3a : 0x5a3a2a);
        else if (cell < 0.16) c.set(px, y, fy < 2 ? 0x2a5a6a : 0x1a3a4a);
        else c.set(px, y, body[0]);
      }
    }
    // fire escape zigzag
    if (rng.chance(0.7) && b.w > 70) {
      const fx = b.x + rng.int(10, b.w - 40);
      for (let level = 0; level < 8; level++) {
        const ly = b.top + 20 + level * 18;
        for (let i = 0; i < 26; i++) {
          c.set((fx + i) % W, ly, body[3]);
          if (i % 4 === 0) c.set((fx + i) % W, ly - 1, body[3]);
        }
        const dir = level % 2 ? 1 : -1;
        for (let i = 0; i < 16; i++) c.set((fx + 13 + dir * (i * 0.75)) % W, ly + i, body[2]);
      }
    }
    // AC units
    for (let i = 0; i < 4; i++) {
      if (!rng.chance(0.5)) continue;
      const ax = b.x + rng.int(8, b.w - 14);
      const ay = b.top + rng.int(10, 160);
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 7; xx++) c.set((ax + xx) % W, ay + yy, yy === 0 ? body[3] : xx % 2 ? body[0] : body[2]);
    }
  }
  // Neon signs with Hangul (Galmuri glyphs as neon tubes)
  const font = loadGalmuri('Galmuri11-Bold');
  const signs = [
    { t: ['기', '억'], col: RAMPS.cyan },
    { t: ['호', '텔'], col: RAMPS.magenta },
    { t: ['약'], col: RAMPS.acid },
    { t: ['라', '멘'], col: RAMPS.amber },
    { t: ['망', '각'], col: RAMPS.magenta },
    { t: ['24', 'H'], col: RAMPS.yellow },
  ];
  signs.forEach((s, i) => {
    const b = blds[(i * 3 + 1) % blds.length];
    const sx = b.x + (i % 2 ? 8 : b.w - 26);
    const sy = b.top + 14 + (i % 3) * 16;
    const h = s.t.length * 14 + 6;
    // sign box
    for (let y = 0; y < h; y++) for (let xx = 0; xx < 16; xx++) c.set((sx + xx) % W, sy + y, xx === 0 || xx === 15 || y === 0 || y === h - 1 ? s.col[2] : 0x0a0612);
    s.t.forEach((ch, k) => {
      const off = ch.length > 1 ? 1 : 2;
      rasterText(font, ch, sx + off, sy + 2 + k * 14, (px, py) => c.set(px % W, py, s.col[s.col.length - 2]));
    });
  });
  // hanging cables between buildings (catenaries)
  for (let i = 0; i < blds.length - 1; i++) {
    const a = blds[i];
    const b = blds[i + 1];
    for (let k = 0; k < 2; k++) {
      const x0 = a.x + a.w - 1;
      const x1 = b.x;
      const y0 = a.top + 10 + k * 22 + rng.int(0, 10);
      const y1 = b.top + 10 + k * 22 + rng.int(0, 10);
      const sag = 6 + rng.int(0, 10);
      for (let xx = x0; xx <= x1; xx++) {
        const t = (xx - x0) / Math.max(1, x1 - x0);
        const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
        c.set(xx % W, y, body[3]);
      }
    }
  }
  // bottom fog
  const haze = [0x120c22, 0x1a1030, 0x22143c];
  for (let y = 240; y < H; y++) {
    const k = (y - 240) / (H - 240);
    for (let xx = 0; xx < W; xx++) {
      if (c.get(xx, y) < 0) continue;
      if (k > bayer(xx, y)) c.set(xx, y, rampDither(haze, k, xx, y));
    }
  }
  return c;
}

/** Tileable horizontal fog strip (white, alpha-dithered — tinted at runtime). */
export function fogStrip(): PixelCanvas {
  const W = 512;
  const H = 64;
  const c = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = 1 - Math.abs(y - H / 2) / (H / 2);
      const n = fbm(x / 48, y / 10, 5, 3);
      // tileable: blend noise at wrap
      const n2 = fbm((x - W) / 48, y / 10, 5, 3);
      const nn = n * (1 - x / W) + n2 * (x / W);
      const a = v * v * (0.4 + nn * 0.9);
      if (a > bayer(x, y) * 1.1) c.set(x, y, 0xffffff, a > 0.7 ? 160 : a > 0.45 ? 110 : 70);
    }
  }
  return c;
}
