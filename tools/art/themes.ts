// Stage-specific parallax themes.
//   market — 하층 시장: warm smog, dense signage, alley walls, steam
//   tower  — 레테 타워 외벽: above the smog sea, cold air, a huge moon
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, RNG, bayer, fbm, hash2, rampDither } from './pixel.ts';
import { loadGalmuri, rasterText } from '../lib/bdf.ts';
import { skyline } from './backgrounds.ts';

type Ramp = readonly number[];

function gradientSky(pal: Ramp, opts: { smog: number; stars: number; moon?: { x: number; y: number; r: number; pal: Ramp; halo: number[] } }): PixelCanvas {
  const W = 480;
  const H = 270;
  const c = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let t = Math.pow(y / H, 1.4);
      t += (fbm(x / 90, y / 22, 13, 4) - 0.5) * opts.smog;
      c.set(x, y, rampDither(pal, t, x, y));
    }
  }
  const r = new RNG(7);
  for (let i = 0; i < opts.stars; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(0, 140);
    c.set(x, y, r.chance(0.25) ? RAMPS.night[9] : RAMPS.night[6]);
  }
  const m = opts.moon;
  if (m) {
    for (let y = m.y - m.r - 40; y < m.y + m.r + 40; y++) {
      for (let x = m.x - m.r - 40; x < m.x + m.r + 40; x++) {
        const d = Math.hypot(x + 0.5 - m.x, y + 0.5 - m.y);
        if (d < m.r) {
          const n = fbm(x / 7, y / 7, 31, 3);
          const lit = (x - m.x) * -0.5 + (y - m.y) * -0.6;
          const t = 0.55 + lit / (m.r * 3) + (n - 0.5) * 0.45 - (d > m.r - 1.5 ? 0.15 : 0);
          c.set(x, y, rampDither(m.pal, t, x, y));
        } else if (d < m.r + 36) {
          const k = 1 - (d - m.r) / 36;
          if (k * k * 0.6 > bayer(x, y)) c.set(x, y, k > 0.55 ? m.halo[1] : m.halo[0]);
        }
      }
    }
  }
  return c;
}

/** Sea of smog seen from above, lit from beneath by the city. Tileable. */
function cloudSea(width: number, height: number, seed: number, top: Ramp, glow: Ramp): PixelCanvas {
  const c = new PixelCanvas(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const n1 = fbm(x / 70, y / 14, seed, 4);
      const n2 = fbm((x - width) / 70, y / 14, seed, 4);
      const n = n1 * (1 - u) + n2 * u;
      const surface = 40 + (n - 0.5) * 50;
      if (y < surface) continue;
      const depth = (y - surface) / (height - surface + 1);
      // top of the clouds catches moonlight, the underside glows with neon
      const t = depth < 0.12 ? 0.9 - depth * 3 : 0.55 - depth * 0.5;
      let col = rampDither(top, t, x, y);
      const g = fbm(x / 40, y / 30, seed + 5, 3);
      if (depth > 0.4 && g > 0.6 && bayer(x, y) < (g - 0.6) * 4) col = rampDither(glow, (g - 0.6) * 2.2, x, y);
      c.set(x, y, col);
    }
  }
  return c;
}

/** Tall tower tops piercing the cloud sea (cold, distant). Tileable. */
function piercingTowers(width: number, height: number, seed: number, body: Ramp, lights: number[]): PixelCanvas {
  const c = new PixelCanvas(width, height);
  const rng = new RNG(seed);
  let x = 0;
  while (x < width) {
    const w = rng.int(10, 28);
    const top = rng.int(20, 140);
    const cx = x + w / 2;
    for (let y = top; y < height; y++) {
      const taper = y < top + 30 ? ((y - top) / 30) * 0.5 + 0.5 : 1;
      const hw = (w / 2) * taper;
      for (let xx = Math.floor(cx - hw); xx <= Math.ceil(cx + hw); xx++) {
        const u = (xx - (cx - hw)) / (2 * hw + 0.01);
        c.set(((xx % width) + width) % width, y, u < 0.2 ? body[2] : u < 0.7 ? body[1] : body[0]);
      }
      if (y % 9 === 0 && hash2(x, y, seed) < 0.4) c.set(Math.round(cx) % width, y, rng.pick(lights));
    }
    for (let y = top - 14; y < top; y++) c.set(Math.round(cx) % width, y, body[2]);
    c.set(Math.round(cx) % width, top - 15, RAMPS.crimson[5]);
    x += w + rng.int(30, 90);
  }
  return c;
}

/** Dense alley walls with signage, pipes and laundry cables (market near layer). */
function alleyWalls(seed: number): PixelCanvas {
  const W = 1024;
  const H = 400;
  const c = new PixelCanvas(W, H);
  const rng = new RNG(seed);
  const body = [0x0c0610, 0x120816, 0x1a0c1e, 0x241226];
  const blds: { x: number; w: number; top: number }[] = [];
  let x = 0;
  while (x < W) {
    const w = rng.int(70, 150);
    blds.push({ x, w, top: rng.int(10, 90) });
    x += w + rng.int(8, 24);
  }
  for (const b of blds) {
    for (let lx = 0; lx < b.w; lx++) {
      const px = (b.x + lx) % W;
      for (let y = b.top; y < H; y++) {
        let col = body[1];
        if (lx === 0) col = RAMPS.amber[2];
        else if (lx === 1) col = RAMPS.amber[1];
        else if (lx === b.w - 1) col = RAMPS.magenta[3];
        else if (lx === b.w - 2) col = RAMPS.magenta[2];
        else if (lx < 5) col = body[2];
        if ((y - b.top) % 16 === 15 && lx > 1 && lx < b.w - 2) col = body[0];
        c.set(px, y, col);
      }
      // shop-house windows, warm
      for (let y = b.top + 5; y < H; y++) {
        const fy = (y - b.top - 5) % 16;
        const fx = (lx - 5) % 9;
        if (lx < 5 || lx > b.w - 7 || fy > 7 || fx > 4) continue;
        const cell = hash2(Math.floor((lx - 5) / 9) + b.x, Math.floor((y - b.top - 5) / 16), seed);
        if (cell < 0.2) c.set(px, y, fy < 2 ? 0xb06a2a : 0x7a4224);
        else if (cell < 0.28) c.set(px, y, fy < 2 ? 0x9a2a6a : 0x5a1a3a);
        else if (cell < 0.31) c.set(px, y, fy < 2 ? 0x2a7a8a : 0x1a4a5a);
        else c.set(px, y, body[0]);
      }
    }
    // vertical pipes with valves
    for (let k = 0; k < 2; k++) {
      if (!rng.chance(0.6)) continue;
      const pxp = b.x + rng.int(6, b.w - 6);
      for (let y = b.top; y < H; y++) {
        c.set(pxp % W, y, body[3]);
        c.set((pxp + 1) % W, y, body[2]);
        if (y % 40 === 0) for (let i = -1; i <= 2; i++) c.set((pxp + i) % W, y, RAMPS.rust[3]);
      }
    }
    // AC unit clusters
    for (let i = 0; i < 6; i++) {
      if (!rng.chance(0.55)) continue;
      const ax = b.x + rng.int(6, b.w - 12);
      const ay = b.top + rng.int(10, 200);
      for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 8; xx++) c.set((ax + xx) % W, ay + yy, yy === 0 ? body[3] : (xx + yy) % 2 ? body[0] : body[2]);
    }
  }
  // signage — many, vertical, Hangul
  const font = loadGalmuri('Galmuri11-Bold');
  const signs: { t: string[]; col: Ramp }[] = [
    { t: ['시', '장'], col: RAMPS.amber },
    { t: ['수', '리'], col: RAMPS.cyan },
    { t: ['전', '당', '포'], col: RAMPS.magenta },
    { t: ['노', '래', '방'], col: RAMPS.violet },
    { t: ['식', '당'], col: RAMPS.yellow },
    { t: ['환', '전'], col: RAMPS.acid },
    { t: ['기', '억', '삽', '니', '다'], col: RAMPS.magenta },
    { t: ['24'], col: RAMPS.amber },
  ];
  [...signs, ...signs].forEach((s, i) => {
    const b = blds[(i * 3 + 1) % blds.length];
    const sx = b.x + (i % 2 ? 6 : b.w - 24) + (i >= signs.length ? (i % 2 ? 20 : -20) : 0);
    const sy = b.top + 20 + ((i * 3) % 7) * 20;
    const h = s.t.length * 14 + 6;
    for (let y = 0; y < h; y++) for (let xx = 0; xx < 16; xx++) c.set((sx + xx) % W, sy + y, xx === 0 || xx === 15 || y === 0 || y === h - 1 ? s.col[2] : 0x0a0612);
    s.t.forEach((ch, k) => rasterText(font, ch, sx + (ch.length > 1 ? 1 : 2), sy + 2 + k * 14, (px, py) => c.set(px % W, py, s.col[s.col.length - 2])));
    // glow halo dots around the box
    for (let y = -2; y < h + 2; y += 2) {
      if (bayer(sx, y) < 0.5) c.set((sx - 2) % W, sy + y, s.col[1]);
      c.set((sx + 17) % W, sy + y, s.col[1]);
    }
  });
  // laundry / cable lines with hanging cloth
  for (let i = 0; i < blds.length - 1; i++) {
    const a = blds[i];
    const b = blds[i + 1];
    for (let k = 0; k < 3; k++) {
      const x0 = a.x + a.w - 1;
      const x1 = b.x;
      const y0 = a.top + 30 + k * 40 + rng.int(0, 12);
      const y1 = b.top + 30 + k * 40 + rng.int(0, 12);
      const sag = 4 + rng.int(0, 8);
      for (let xx = x0; xx <= x1; xx++) {
        const t = (xx - x0) / Math.max(1, x1 - x0);
        const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
        c.set(xx % W, y, body[3]);
        if (k === 1 && (xx - x0) % 7 === 3) for (let d = 1; d < 5; d++) c.set(xx % W, y + d, rng.pick([0x3a1a2a, 0x2a2a3a, 0x4a3a1a]));
      }
    }
  }
  // warm haze at the bottom
  const haze = [0x1a0a16, 0x24101c, 0x301422];
  for (let y = 250; y < H; y++) {
    const k = (y - 250) / (H - 250);
    for (let xx = 0; xx < W; xx++) if (c.get(xx, y) >= 0 && k > bayer(xx, y)) c.set(xx, y, rampDither(haze, k, xx, y));
  }
  return c;
}

export interface ThemeLayers {
  [file: string]: PixelCanvas;
}

export function marketTheme(): ThemeLayers {
  const sky = gradientSky([0x0a0610, 0x140a1a, 0x1e0c22, 0x2a0e2a, 0x3a1030, 0x4e1434, 0x641a36, 0x7e2438, 0x9a3438, 0xb44a38], { smog: 0.3, stars: 0 });
  const far = skyline({
    width: 960,
    height: 320,
    base: 140,
    seed: 501,
    count: 70,
    wRange: [14, 40],
    hRange: [60, 140],
    body: [0x2a0e26, 0x34122c, 0x3e1632, 0x4a1a3a],
    rimL: 0x5a2040,
    rimR: 0x2a0e26,
    windowP: 0.08,
    windowColors: [0x6a3a2a, 0x7a4a2a, 0x5a2a3a],
    windowSize: [1, 1],
    haze: [0x4a1834, 0x5a1c36, 0x6a2238],
    hazeStart: 100,
    neonStrips: 0.25,
  });
  const mid = skyline({
    width: 960,
    height: 360,
    base: 130,
    seed: 502,
    count: 45,
    wRange: [24, 60],
    hRange: [80, 170],
    body: [0x16081a, 0x1e0c20, 0x281028, 0x341432],
    rimL: RAMPS.amber[1],
    rimR: RAMPS.magenta[2],
    windowP: 0.18,
    windowColors: [0x9a6a3a, 0xaa7a3a, 0x8a3a5a, 0x7a5a2a],
    windowSize: [2, 1],
    haze: [0x2a0e22, 0x341228, 0x40162e],
    hazeStart: 150,
    neonStrips: 0.55,
  });
  return { 'market_sky.png': sky, 'market_far.png': far, 'market_mid.png': mid, 'market_near.png': alleyWalls(503) };
}

export function towerTheme(): ThemeLayers {
  const sky = gradientSky([0x05040e, 0x080816, 0x0c0c20, 0x12122c, 0x181a38, 0x1e2244, 0x262a50, 0x30305a, 0x3a3664, 0x48406e], {
    smog: 0.12,
    stars: 160,
    moon: { x: 340, y: 74, r: 30, pal: [0x6a7aa0, 0x8c9cc0, 0xb0bcd8, 0xd4dcf0, 0xf2f6ff], halo: [0x1c2448, 0x2a3260] },
  });
  const far = piercingTowers(960, 300, 601, [0x10142a, 0x161c36, 0x1e2644], [0x5a6aa0, 0x8c58e8, 0x3ff0ea]);
  const clouds = cloudSea(960, 220, 602, [0x141830, 0x1c2240, 0x262c52, 0x323a66, 0x48507e, 0x6a70a0], [0x3a1440, 0x5a1a4e, 0x8c1a72, 0xd02a90]);
  const mid = piercingTowers(960, 340, 603, [0x0a0c1c, 0x0e1226, 0x141a32], [0x3ff0ea, 0xff4fb0, 0xffc870]);
  return { 'tower_sky.png': sky, 'tower_far.png': far, 'tower_clouds.png': clouds, 'tower_mid.png': mid };
}
