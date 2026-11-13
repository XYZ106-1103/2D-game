// Chapter 2 parallax sets. Each stage gets its own place, not a tint:
//   archive  — 콜드 아카이브: endless frozen server halls under strip lights
//   refinery — 기억 정제소: giant lethe vats, chains, gantries, furnace glow
//   core     — 중력 코어: a spherical chamber around NOCTURNE's cocoon
//   memory   — 침묵의 시간: the remembered city, monochrome and glitching
//   garden   — 공중 정원: pre-dawn glass dome, bioluminescent trees
//   mast     — 방송탑: storm clouds and lattice masts
//   dawn     — 녹턴 결전: sunrise over the cloud sea
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, RNG, bayer, fbm, hash2, rampDither } from './pixel.ts';
import { cloudSea, gradientSky, piercingTowers, type ThemeLayers } from './themes.ts';
import { midLayer, nearLayer, skyline } from './backgrounds.ts';

type Ramp = readonly number[];
const I = RAMPS.ice;
const OX = RAMPS.oxide;
const MG = RAMPS.magenta;
const CY = RAMPS.cyan;
const VI = RAMPS.violet;
const NI = RAMPS.night;
const GO = RAMPS.gold;
const MO = RAMPS.mono;
const MA = RAMPS.marble;
const JA = RAMPS.jade;
const CR = RAMPS.crimson;
const AM = RAMPS.amber;
const AC = RAMPS.acid;
const DA = RAMPS.dawn;

const wrap = (x: number, w: number) => ((x % w) + w) % w;

/** Dithered haze fading opaque pixels toward a ramp near the bottom. */
function haze(c: PixelCanvas, start: number, ramp: Ramp, strength = 0.9): void {
  for (let y = start; y < c.h; y++) {
    const k = (y - start) / (c.h - start);
    for (let x = 0; x < c.w; x++) {
      if (c.get(x, y) < 0) continue;
      if (k > bayer(x, y) * strength + (1 - strength) * 0.5) c.set(x, y, rampDither(ramp, k, x, y));
    }
  }
}

function vGradient(w: number, h: number, ramp: Ramp, curve = 1): PixelCanvas {
  const c = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.set(x, y, rampDither(ramp, Math.pow(y / h, curve), x, y));
  return c;
}

// =============================================================================
// ARCHIVE
// =============================================================================

function serverRows(W: number, H: number, seed: number, o: { top: [number, number]; w: [number, number]; gap: [number, number]; body: number[]; frost: number; leds: number; mist: number }): PixelCanvas {
  const c = new PixelCanvas(W, H);
  const rng = new RNG(seed);
  let x = 0;
  while (x < W) {
    const w = rng.int(o.w[0], o.w[1]);
    const top = rng.int(o.top[0], o.top[1]);
    for (let lx = 0; lx < w; lx++) {
      const px = wrap(x + lx, W);
      for (let y = top; y < H; y++) {
        let col = o.body[1];
        if (lx === 0) col = o.body[3];
        else if (lx === w - 1) col = o.body[0];
        else if ((y - top) % 5 === 0) col = o.body[0];
        if (y === top) col = o.frost;
        else if (y === top + 1 && hash2(px, 1, seed) > 0.4) col = o.frost;
        c.set(px, y, col);
        // status LEDs in columns
        if (lx > 1 && lx < w - 2 && (y - top) % 5 === 2 && hash2(px, y, seed + 1) < o.leds) {
          const h = hash2(px, y, seed + 2);
          c.set(px, y, h > 0.85 ? AM[3] : h > 0.55 ? AC[3] : CY[4]);
        }
      }
    }
    x += w + rng.int(o.gap[0], o.gap[1]);
  }
  haze(c, Math.floor(H * o.mist), [I[2], I[3], I[4]]);
  return c;
}

export function archiveTheme(): ThemeLayers {
  const sky = vGradient(480, 270, [0x02040a, 0x040812, 0x060c1a, 0x081222, 0x0c182c, 0x101e36], 0.9);
  // receding ceiling strip lights + cold light shafts
  for (let row = 0; row < 6; row++) {
    const y = 6 + row * row * 3;
    const len = 30 - row * 4;
    const gap = 70 - row * 8;
    for (let x = (row * 23) % gap; x < 480; x += gap) {
      for (let i = 0; i < len; i++) sky.set(x + i, y, row < 2 ? I[8] : row < 4 ? I[6] : I[5]);
      for (let yy = y + 1; yy < y + 70 - row * 8; yy++) {
        const k = 1 - (yy - y) / (70 - row * 8);
        for (let i = 2; i < len - 2; i++) if (k * 0.35 > bayer(x + i, yy)) sky.set(x + i, yy, I[2]);
      }
    }
  }
  const far = serverRows(960, 300, 701, { top: [70, 96], w: [8, 14], gap: [1, 4], body: [0x060a14, 0x0a1220, 0x0e1828, 0x142034], frost: I[4], leds: 0.12, mist: 0.45 });
  // overhead cable trays across the far hall
  for (let x = 0; x < 960; x++) {
    far.set(x, 52, I[2]);
    far.set(x, 53, I[1]);
    if (x % 40 < 2) for (let y = 0; y < 52; y++) far.set(x, y, I[1]);
  }
  const mid = serverRows(960, 340, 702, { top: [40, 70], w: [22, 34], gap: [6, 22], body: [0x050912, 0x08101e, 0x0c1828, 0x162638], frost: I[7], leds: 0.22, mist: 0.55 });
  // hanging fluorescent tubes with light cones
  for (let x = 30; x < 960; x += 120) {
    for (let i = 0; i < 26; i++) {
      mid.set(x + i, 10, I[9]);
      mid.set(x + i, 11, I[7]);
    }
    for (let y = 0; y < 10; y++) mid.set(x + 13, y, I[2]);
    for (let y = 12; y < 60; y++) {
      const k = 1 - (y - 12) / 48;
      for (let i = -6; i < 32; i++) if (mid.get(wrap(x + i, 960), y) < 0 && k * 0.25 > bayer(x + i, y)) mid.set(wrap(x + i, 960), y, I[3]);
    }
  }
  // near: structural pillars with coolant pipes
  const near = new PixelCanvas(960, 400);
  for (let x0 = 80; x0 < 960; x0 += 320) {
    for (let x = 0; x < 54; x++) {
      for (let y = 0; y < 400; y++) {
        let col = x < 3 ? I[2] : x > 50 ? 0x02040a : 0x050a14;
        if (x === 14 || x === 15 || x === 38) col = I[1];
        if (x === 16) col = I[3];
        if (y % 90 < 3 && x > 10 && x < 20) col = I[6];
        near.set(x0 + x, y, col);
      }
    }
  }
  return { 'archive_sky.png': sky, 'archive_far.png': far, 'archive_mid.png': mid, 'archive_near.png': near };
}

// =============================================================================
// REFINERY
// =============================================================================

function vats(W: number, H: number, seed: number, scale: number, body: Ramp, glow: Ramp): PixelCanvas {
  const c = new PixelCanvas(W, H);
  const rng = new RNG(seed);
  let x = rng.int(0, 40);
  while (x < W) {
    const w = Math.round(rng.int(56, 90) * scale);
    const top = rng.int(Math.round(60 * scale), Math.round(130 * scale));
    const dome = Math.round(w * 0.22);
    const level = top + dome + rng.int(16, 60);
    for (let lx = 0; lx < w; lx++) {
      const px = wrap(x + lx, W);
      const u = lx / (w - 1);
      const shade = u < 0.15 ? 3 : u < 0.4 ? 2 : u < 0.8 ? 1 : 0;
      const dy = Math.round(dome * (1 - Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1, 2)))));
      for (let y = top + dy; y < H; y++) {
        let col = body[shade];
        // hoops
        if ((y - top) % 34 < 2) col = body[Math.min(3, shade + 1)];
        // sight window with glowing fluid
        if (u > 0.3 && u < 0.62 && y > top + dome + 6 && y < H - 30) {
          col = y < level ? 0x0c0408 : y === level ? glow[5] : rampDither(glow, 0.75 - ((y - level) / (H - level)) * 0.6, px, y);
          if (u < 0.33 || u > 0.59) col = body[3];
        }
        c.set(px, y, col);
      }
    }
    // connecting pipe to the next vat
    const py = top + dome + rng.int(20, 50);
    for (let i = 0; i < rng.int(30, 60); i++) {
      c.set(wrap(x + w + i, W), py, body[2]);
      c.set(wrap(x + w + i, W), py + 1, body[3]);
      c.set(wrap(x + w + i, W), py + 2, body[1]);
    }
    x += w + rng.int(20, 70);
  }
  return c;
}

export function refineryTheme(): ThemeLayers {
  const sky = vGradient(480, 270, [0x060202, 0x0c0404, 0x140806, 0x1c0c08, 0x28100a, 0x38160c, 0x4c1e0e, 0x642810], 1.3);
  const far = vats(960, 320, 801, 0.8, [0x140808, 0x1c0c0a, 0x26120c, 0x341a10], MG);
  haze(far, 190, [0x2a100c, 0x3a160e, 0x4c1e10]);
  const mid = vats(960, 360, 802, 1.2, [0x0c0505, 0x140807, 0x1e0e0a, 0x2c140c], MG);
  // gantry beam + hanging chains + crane hooks
  for (let x = 0; x < 960; x++) {
    for (let y = 18; y < 26; y++) mid.set(x, y, y === 18 ? OX[3] : y > 23 ? 0x0a0404 : OX[1]);
    if (x % 16 < 2) for (let y = 26; y < 34; y++) mid.set(x + (y - 26), y, OX[1]);
  }
  const rng = new RNG(803);
  for (let k = 0; k < 9; k++) {
    const cx = rng.int(0, 959);
    const len = rng.int(40, 180);
    for (let y = 26; y < 26 + len; y++) {
      const off = (y >> 1) % 2;
      mid.set(wrap(cx + off, 960), y, y % 4 === 0 ? 0x0a0404 : OX[2]);
    }
    for (let i = 0; i < 6; i++) mid.set(wrap(cx - 2 + i, 960), 26 + len, OX[3]);
    for (let y = 0; y < 6; y++) mid.set(wrap(cx + 3, 960), 26 + len + y, OX[3]);
  }
  haze(mid, 230, [0x1e0a08, 0x2a100a, 0x38140c]);
  // near: cog silhouettes with furnace rim light
  const near = new PixelCanvas(960, 400);
  for (const [gx, gy, r] of [
    [140, 260, 70],
    [520, 300, 90],
    [800, 240, 54],
  ] as const) {
    for (let y = gy - r - 10; y < gy + r + 10; y++) {
      for (let x = gx - r - 10; x < gx + r + 10; x++) {
        const dx = x - gx;
        const dy = y - gy;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const tooth = Math.cos(a * 14) > 0.3 ? 8 : 0;
        if (d < r + tooth && d > r * 0.32) near.set(wrap(x, 960), y, d > r + tooth - 2 && dx > 0 ? OX[3] : 0x0a0404);
        if (d < r * 0.18) near.set(wrap(x, 960), y, 0x140806);
      }
    }
  }
  for (let x = 300; x < 340; x++) for (let y = 120; y < 400; y++) near.set(x, y, x < 302 ? OX[3] : 0x0c0505);
  return { 'refinery_sky.png': sky, 'refinery_far.png': far, 'refinery_mid.png': mid, 'refinery_near.png': near };
}

// =============================================================================
// CORE
// =============================================================================

export function coreTheme(): ThemeLayers {
  const sky = new PixelCanvas(480, 270);
  for (let y = 0; y < 270; y++) {
    for (let x = 0; x < 480; x++) {
      const d = Math.hypot((x - 240) / 1.6, y - 130) / 200;
      sky.set(x, y, rampDither([0x1a1030, 0x140c26, 0x0e081c, 0x0a0614, 0x06040c], Math.min(1, d), x, y));
    }
  }
  // concentric containment rings
  for (const r of [70, 120, 175, 240]) {
    for (let a = 0; a < Math.PI * 2; a += 0.6 / r) {
      const x = Math.round(240 + Math.cos(a) * r * 1.6);
      const y = Math.round(130 + Math.sin(a) * r);
      if (Math.floor(a * r / 6) % 3 !== 0) sky.set(x, y, r < 130 ? GO[1] : NI[3]);
    }
  }
  const rs = new RNG(901);
  for (let i = 0; i < 120; i++) sky.set(rs.int(0, 479), rs.int(0, 269), rs.chance(0.2) ? GO[4] : VI[2]);

  // the cocoon: NOCTURNE asleep in its suspension field
  const sphere = new PixelCanvas(220, 260);
  const cx = 110;
  const cy = 130;
  for (let y = 0; y < 260; y++) {
    for (let x = 0; x < 220; x++) {
      const nx = (x - cx) / 56;
      const ny = (y - cy) / 86;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const lit = -nx * 0.6 - ny * 0.4 + (fbm(x / 9, y / 9, 902, 3) - 0.5) * 0.5;
      let col = rampDither([NI[1], NI[2], NI[3], NI[4], NI[5]], 0.35 + lit * 0.35, x, y);
      // gold ribs following the shell
      const rib = Math.abs(Math.sin(Math.atan2(ny, nx) * 5 + ny * 2));
      if (rib < 0.07) col = GO[3];
      // violet seams glowing from within
      if (Math.abs(Math.sin(y * 0.12 + Math.sin(x * 0.05) * 2)) < 0.05 && d < 0.8) col = VI[4];
      if (d > 0.93) col = NI[1];
      sphere.set(x, y, col);
    }
  }
  // tethers and orbit rings
  for (const [ax, ay] of [
    [0, 0],
    [219, 0],
    [0, 259],
    [219, 259],
  ]) sphere.line(ax, ay, cx + (ax ? 30 : -30), cy + (ay ? 50 : -50), GO[2]);
  for (const [rx, ry, tilt, col] of [
    [104, 22, 0.25, GO[4]],
    [92, 30, -0.4, VI[4]],
  ] as const) {
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry;
      const x = Math.round(cx + ex * Math.cos(tilt) - ey * Math.sin(tilt));
      const y = Math.round(cy + ex * Math.sin(tilt) + ey * Math.cos(tilt));
      const behind = Math.sin(a) < 0 && Math.pow((x - cx) / 56, 2) + Math.pow((y - cy) / 86, 2) < 1;
      if (!behind) sphere.set(x, y, col);
    }
  }
  // the eye-slit of the sleeper
  for (let x = cx - 14; x <= cx + 14; x++) {
    const h = Math.round(3 * Math.sqrt(1 - Math.pow((x - cx) / 15, 2)));
    for (let y = cy - h; y <= cy + h; y++) sphere.set(x, y, Math.abs(y - cy) < 1 ? MG[6] : MG[3]);
  }

  // chamber ribs
  const far = new PixelCanvas(960, 300);
  for (let x0 = 0; x0 < 960; x0 += 160) {
    for (let y = 0; y < 300; y++) {
      const bow = Math.round(Math.pow((y - 150) / 150, 2) * 26);
      for (let i = 0; i < 9; i++) far.set(wrap(x0 + bow + i, 960), y, i === 0 ? NI[4] : i > 6 ? NI[0] : NI[2]);
      if (y % 30 === 0) far.set(wrap(x0 + bow + 4, 960), y, GO[4]);
    }
  }
  haze(far, 200, [0x0a0614, 0x0e081c, 0x120a22]);
  // drifting debris slabs
  const mid = new PixelCanvas(960, 340);
  const rng = new RNG(903);
  for (let i = 0; i < 26; i++) {
    const x = rng.int(0, 959);
    const y = rng.int(20, 300);
    const w = rng.int(10, 40);
    const h = rng.int(4, 14);
    const skew = rng.int(-4, 4);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const px = wrap(x + xx + Math.round((skew * yy) / h), 960);
        let col = yy === 0 ? GO[4] : yy === h - 1 ? VI[3] : NI[2];
        if (xx === 0) col = NI[3];
        mid.set(px, y + yy, col);
      }
    }
    if (rng.chance(0.5)) mid.set(wrap(x + w / 2, 960), y + 2, VI[5]);
  }
  return { 'core_sky.png': sky, 'core_sphere.png': sphere, 'core_far.png': far, 'core_mid.png': mid };
}

// =============================================================================
// MEMORY
// =============================================================================

/** Re-render a chapter 1 layer as a reconstructed memory: greyscale, scanlines, glitches. */
function toMemory(src: PixelCanvas, seed: number): PixelCanvas {
  const c = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    const glitch = hash2(0, y >> 2, seed) > 0.93 ? Math.round((hash2(1, y >> 2, seed) - 0.5) * 16) : 0;
    for (let x = 0; x < src.w; x++) {
      const sx = wrap(x + glitch, src.w);
      const v = src.get(sx, y);
      if (v < 0) continue;
      const r = (v >> 16) & 255;
      const g = (v >> 8) & 255;
      const b = v & 255;
      const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      let col = rampDither(MO, Math.min(1, lum * 2.2 + 0.08), x, y);
      if (y % 3 === 0) col = MO[Math.max(0, MO.indexOf(col) - 1)] ?? col;
      if (lum > 0.42 && hash2(x, y, seed) > 0.6) col = CY[5];
      if (glitch && hash2(x, y, seed + 1) > 0.85) col = hash2(x, y, seed + 2) > 0.5 ? MG[4] : CY[4];
      c.set(x, y, col);
    }
  }
  return c;
}

/** Outline-only skyline: edges bright, bodies hollow. */
function wireframe(src: PixelCanvas, edge: number, fill: number): PixelCanvas {
  const c = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (src.get(x, y) < 0) continue;
      const open = src.get(wrap(x - 1, src.w), y) < 0 || src.get(wrap(x + 1, src.w), y) < 0 || y === 0 || src.get(x, y - 1) < 0;
      c.set(x, y, open ? edge : (x + y) % 9 === 0 || y % 12 === 0 ? MO[2] : fill);
    }
  }
  return c;
}

export function memoryTheme(): ThemeLayers {
  const sky = vGradient(480, 270, [MO[0], MO[1], MO[1], MO[2], MO[2], MO[3]], 1.2);
  // the moon, half-rendered in blocks
  const mx = 330;
  const my = 70;
  for (let by = -28; by < 28; by += 4) {
    for (let bx = -28; bx < 28; bx += 4) {
      const d = Math.hypot(bx + 2, by + 2);
      if (d > 26) continue;
      const missing = hash2(bx, by, 950) > 0.78;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        if (missing) {
          if (x === 0 || y === 0) sky.set(mx + bx + x, my + by + y, CY[3]);
        } else sky.set(mx + bx + x, my + by + y, rampDither([MO[6], MO[7], MO[8], MO[9]], 0.7 - (bx + by) / 90, mx + bx + x, my + by + y));
      }
    }
  }
  const sk = skyline({
    width: 960,
    height: 320,
    base: 150,
    seed: 951,
    count: 60,
    wRange: [16, 44],
    hRange: [40, 130],
    body: [1, 2, 3, 4],
    rimL: 5,
    rimR: 1,
    windowP: 0,
    windowColors: [1],
    windowSize: [1, 1],
    haze: [1, 1, 1],
    hazeStart: 400,
    neonStrips: 0,
  });
  const far = wireframe(sk, MO[6], MO[1]);
  haze(far, 200, [MO[1], MO[2], MO[2]]);
  return { 'memory_sky.png': sky, 'memory_far.png': far, 'memory_mid.png': toMemory(midLayer(), 952), 'memory_near.png': toMemory(nearLayer(), 953) };
}

// =============================================================================
// GARDEN
// =============================================================================

function tree(c: PixelCanvas, x: number, base: number, h: number, seed: number, trunk: Ramp, leaves: Ramp, glow: number[]): void {
  const rng = new RNG(seed);
  // trunk with a couple of branches
  for (let y = base - h; y < base; y++) {
    const w = 2 + Math.round(((y - (base - h)) / h) * 3);
    for (let i = 0; i < w; i++) c.set(wrap(x + i - (w >> 1), c.w), y, i === 0 ? trunk[2] : trunk[1]);
  }
  const crowns: [number, number, number][] = [[x, base - h, Math.round(h * 0.2)]];
  for (let k = 0; k < 3; k++) {
    const by = base - h + rng.int(10, Math.round(h * 0.5));
    const dir = k % 2 ? 1 : -1;
    const len = rng.int(10, 24);
    for (let i = 0; i < len; i++) c.set(wrap(x + dir * i, c.w), by - Math.round(i * 0.5), trunk[1]);
    crowns.push([x + dir * len, by - Math.round(len * 0.5), rng.int(8, 13)]);
  }
  for (const [cx, cy, r] of crowns) {
    for (let y = cy - r; y < cy + r; y++) {
      for (let xx = cx - r - 4; xx < cx + r + 4; xx++) {
        const d = Math.hypot((xx - cx) / 1.25, y - cy) / r;
        const n = fbm(xx / 6, y / 6, seed, 2);
        if (d + (n - 0.5) * 0.5 > 1) continue;
        let col = rampDither(leaves, 0.75 - (y - cy + r) / (r * 2.4), xx, y);
        if (hash2(xx, y, seed) > 0.965) col = glow[Math.floor(hash2(y, xx, seed) * glow.length)];
        c.set(wrap(xx, c.w), y, col);
      }
    }
  }
}

export function gardenTheme(): ThemeLayers {
  const sky = gradientSky([0x05060f, 0x080a18, 0x0b1022, 0x0e182c, 0x112236, 0x162c3e, 0x203646, 0x343c50, 0x543e58, 0x7a4860], { smog: 0.08, stars: 140 });
  // glass dome ribs
  for (let k = -3; k <= 3; k++) {
    for (let x = 0; x < 480; x++) {
      const y = Math.round(260 - Math.sqrt(Math.max(0, 1 - Math.pow((x - 240 - k * 60) / 420, 2))) * (230 - Math.abs(k) * 18));
      if (y >= 0 && y < 270 && x % 2 === 0) sky.set(x, y, k === 0 ? MA[2] : 0x2a3448);
    }
  }
  for (let y = 0; y < 270; y += 2) sky.set(240, y, 0x2a3448);

  // far: floating terraces + the broadcast mast on the horizon
  const far = new PixelCanvas(960, 300);
  const rng = new RNG(1001);
  for (let k = 0; k < 7; k++) {
    const x = rng.int(0, 959);
    const y = rng.int(150, 220);
    const w = rng.int(50, 110);
    for (let t = 0; t < 3; t++) {
      const tw = w - t * 16;
      const ty = y + t * 6;
      for (let xx = 0; xx < tw; xx++) for (let yy = 0; yy < 6; yy++) far.set(wrap(x + t * 8 + xx, 960), ty + yy, yy === 0 ? 0x2a3a4a : 0x141e2a);
    }
    for (let j = 0; j < 4; j++) {
      const tx = x + rng.int(4, w - 10);
      for (let yy = -10; yy < 0; yy++) for (let xx = -5; xx < 6; xx++) if (Math.hypot(xx, yy + 5) < 5.5) far.set(wrap(tx + xx, 960), y + yy, hash2(xx, yy, j) > 0.9 ? CY[4] : 0x12262a);
    }
  }
  for (let y = 40; y < 300; y++) {
    const w = 2 + Math.floor((y - 40) / 40);
    for (let i = 0; i < w; i++) far.set(640 + i - (w >> 1), y, 0x1a2230);
    if (y % 26 === 0) far.set(640, y, CR[5]);
  }
  haze(far, 210, [0x16242e, 0x1c2e38, 0x243640]);

  const mid = new PixelCanvas(960, 340);
  const trng = new RNG(1002);
  for (let x = 40; x < 940; x += trng.int(130, 190)) tree(mid, x, 340, trng.int(150, 220), 1003 + x, [MA[0], MA[1], MA[2]], [0x0c1e22, 0x10282c, 0x143236, 0x1a4040, 0x22504c], [CY[5], CY[4], JA[6], MG[5]]);
  // hanging lanterns
  for (let x = 90; x < 960; x += 150) {
    for (let y = 0; y < 60; y++) mid.set(x, y, 0x1a2230);
    for (let y = 60; y < 66; y++) for (let i = -2; i <= 2; i++) mid.set(x + i, y, y === 60 || y === 65 ? GO[2] : GO[5]);
  }
  const near = new PixelCanvas(960, 400);
  for (let x = 0; x < 960; x++) {
    const top = 300 + Math.round(fbm(x / 30, 0, 1004, 3) * 50);
    for (let y = top; y < 400; y++) near.set(x, y, hash2(x, y, 1005) > 0.97 ? JA[4] : y === top ? JA[2] : 0x06120c);
  }
  for (const cx0 of [200, 620]) for (let x = 0; x < 30; x++) for (let y = 120; y < 400; y++) near.set(cx0 + x, y, x < 2 ? MA[1] : x > 27 ? 0x0a0a10 : (x - 5) % 7 === 0 ? 0x101018 : 0x16161e);
  return { 'garden_sky.png': sky, 'garden_far.png': far, 'garden_mid.png': mid, 'garden_near.png': near };
}

// =============================================================================
// MAST
// =============================================================================

function lattice(c: PixelCanvas, x: number, w: number, top: number, col: number, edge: number, beacon: number): void {
  for (let y = top; y < c.h; y++) {
    c.set(wrap(x, c.w), y, edge);
    c.set(wrap(x + w, c.w), y, col);
  }
  for (let y = top; y < c.h; y += w) {
    for (let i = 0; i <= w; i++) {
      c.set(wrap(x + i, c.w), y + i, col);
      c.set(wrap(x + w - i, c.w), y + i, col);
    }
    for (let i = 0; i <= w; i++) c.set(wrap(x + i, c.w), y, edge);
  }
  for (let y = top; y < c.h; y += 60) c.set(wrap(x + (w >> 1), c.w), y, beacon);
  c.set(wrap(x + (w >> 1), c.w), top - 1, beacon);
}

export function mastTheme(): ThemeLayers {
  const sky = new PixelCanvas(480, 270);
  for (let y = 0; y < 270; y++) {
    for (let x = 0; x < 480; x++) {
      const n = fbm(x / 60, y / 24, 1101, 4);
      const t = 0.15 + (y / 270) * 0.45 + (n - 0.5) * 0.7;
      sky.set(x, y, rampDither([0x04050a, 0x080a12, 0x0c0f1a, 0x121624, 0x1a1e2e, 0x24283a, 0x323448], Math.max(0, Math.min(1, t)), x, y));
    }
  }
  const clouds = new PixelCanvas(960, 220);
  for (let y = 0; y < 220; y++) {
    for (let x = 0; x < 960; x++) {
      const u = x / 960;
      const n = fbm(x / 50, y / 16, 1102, 4) * (1 - u) + fbm((x - 960) / 50, y / 16, 1102, 4) * u;
      const surf = 60 + (n - 0.5) * 80;
      if (y < surf) continue;
      const d = (y - surf) / 40;
      clouds.set(x, y, rampDither([0x0a0c14, 0x10131e, 0x181c2a, 0x222838, 0x30364a], d < 0.15 ? 0.85 - d * 3 : 0.4 - Math.min(0.4, d * 0.1), x, y));
    }
  }
  const far = new PixelCanvas(960, 320);
  const rng = new RNG(1103);
  for (let k = 0; k < 6; k++) lattice(far, rng.int(0, 959), rng.int(6, 10), rng.int(60, 160), 0x161a26, 0x20263a, CR[5]);
  // city glow through cloud gaps far below
  for (let x = 0; x < 960; x++) for (let y = 280; y < 320; y++) if (hash2(x, y, 1104) > 0.985) far.set(x, y, hash2(y, x, 1105) > 0.5 ? AM[3] : MG[4]);
  const mid = new PixelCanvas(960, 360);
  lattice(mid, 120, 22, 30, 0x10131c, 0x1c2232, CR[5]);
  lattice(mid, 610, 30, 0, 0x10131c, 0x1c2232, CR[5]);
  // guy wires
  for (const [x0, x1] of [
    [131, 360],
    [625, 900],
    [625, 420],
  ]) mid.line(x0, 40, x1, 359, 0x2a3044);
  return { 'mast_sky.png': sky, 'mast_clouds.png': clouds, 'mast_far.png': far, 'mast_mid.png': mid };
}

// =============================================================================
// DAWN (finale arena)
// =============================================================================

export function dawnTheme(): ThemeLayers {
  const sky = new PixelCanvas(480, 270);
  const sx = 300;
  const sy = 236;
  for (let y = 0; y < 270; y++) {
    for (let x = 0; x < 480; x++) {
      const d = Math.hypot(x - sx, (y - sy) * 1.4);
      let t = 0.15 + (y / 270) * 0.7 - d / 900;
      // god rays
      const a = Math.atan2(y - sy, x - sx);
      if (Math.cos(a * 18) > 0.85 && y < sy) t += 0.08;
      t = Math.max(0, Math.min(1, t));
      sky.set(x, y, rampDither(DA, t, x, y));
      if (d < 34) sky.set(x, y, d < 30 ? DA[9] : DA[8]);
    }
  }
  // high cirrus lit pink
  for (let y = 30; y < 110; y++) {
    for (let x = 0; x < 480; x++) {
      const n = fbm(x / 80, y / 6, 1201, 3);
      if (n > 0.64) sky.set(x, y, n > 0.7 ? DA[6] : DA[4]);
    }
  }
  const clouds = cloudSea(960, 220, 1202, [DA[1], DA[2], DA[3], DA[5], DA[7], DA[8]], [VI[1], VI[2], MG[2], MG[3]]);
  const far = piercingTowers(960, 300, 1203, [0x2a1030, 0x3a1638, 0x562040], [DA[8], GO[5], CY[5]]);
  return { 'dawn_sky.png': sky, 'dawn_clouds.png': clouds, 'dawn_far.png': far };
}

export const CHAPTER2_BG = () => ({ ...archiveTheme(), ...refineryTheme(), ...coreTheme(), ...memoryTheme(), ...gardenTheme(), ...mastTheme(), ...dawnTheme() });
