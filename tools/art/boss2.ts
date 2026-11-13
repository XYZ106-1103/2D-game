// NOCTURNE — the memory-eating moth. Front view: a furred mechanical body
// with faceted magenta eyes and feathered antennae, and four wings whose
// cells are tiny screens replaying stolen nights. Wing flaps are baked as
// frames (x-foreshortening around the body axis) so every pixel stays on grid.
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, bayer, fbm, forEachPolyPixel, hash2, rampDither } from './pixel.ts';

type Item = { name: string; c: PixelCanvas };
type Pt = [number, number];

const NI = RAMPS.night;
const VI = RAMPS.violet;
const MG = RAMPS.magenta;
const GO = RAMPS.gold;
const CY = RAMPS.cyan;
const DA = RAMPS.dawn;
const AM = RAMPS.amber;
const INK = 0x0a0612;

// Wing master space: root at (ROOT_X, ROOT_Y); x grows outward, y down.
const WW = 116;
const WH = 176;
const ROOT_X = 2;
const ROOT_Y = 84;

const FORE: Pt[] = [
  [0, -6],
  [24, -40],
  [58, -66],
  [92, -80],
  [108, -74],
  [112, -56],
  [100, -38],
  [74, -18],
  [40, -2],
  [8, 6],
];
const HIND: Pt[] = [
  [0, 6],
  [40, 12],
  [72, 26],
  [82, 48],
  [72, 70],
  [50, 82],
  [34, 90],
  [24, 74],
  [10, 40],
];

/** Lens (eyespot) centres in master space, relative to the root. */
export const LENS = { fore: [66, -42] as Pt, hind: [44, 46] as Pt };
/** Flap scales per frame (x foreshortening) and the matching tip lift. */
export const FLAP = [1, 0.88, 0.7, 0.52, 0.7, 0.88];
export const LIFT = 0.55;

const MEMORY_TINTS: (readonly number[])[] = [
  [DA[2], DA[4], DA[6], DA[8]],
  [CY[2], CY[3], CY[4], CY[5]],
  [MG[2], MG[3], MG[4], MG[5]],
  [AM[1], AM[2], AM[3], AM[4]],
  [VI[2], VI[3], VI[4], VI[5]],
];

function inPoly(pts: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Master wing (unscaled). torn: 0 none, 1 fore, 2 hind, 3 both. */
function masterWing(torn: number): PixelCanvas {
  const c = new PixelCanvas(WW, WH);
  const shift = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x + ROOT_X, y + ROOT_Y]);
  const parts: { pts: Pt[]; seed: number; broken: boolean; lens: Pt }[] = [
    { pts: shift(HIND), seed: 2, broken: (torn & 2) !== 0, lens: LENS.hind },
    { pts: shift(FORE), seed: 1, broken: (torn & 1) !== 0, lens: LENS.fore },
  ];
  for (const part of parts) {
    const veins = 7;
    forEachPolyPixel(part.pts, (x, y) => {
      const lx = x - ROOT_X;
      const ly = y - ROOT_Y;
      const a = Math.atan2(ly, lx);
      const r = Math.hypot(lx, ly);
      // radial veins from the root + concentric cross veins = cells
      const sector = Math.floor(((a + Math.PI) / (Math.PI * 2)) * veins * 4.4 + part.seed * 3);
      const band = Math.floor(r / 17 + (sector % 2) * 0.5);
      const va = ((a + Math.PI) / (Math.PI * 2)) * veins * 4.4 + part.seed * 3;
      const onVein = va - Math.floor(va) < 0.09 || (r / 17 + (sector % 2) * 0.5) % 1 < 0.08;
      let col: number;
      if (onVein) col = r < 20 ? GO[3] : NI[3];
      else {
        const ramp = MEMORY_TINTS[Math.floor(hash2(sector, band, part.seed) * MEMORY_TINTS.length)];
        // each cell is a little screen: scanlines + a remembered silhouette
        const n = fbm(x / 5, y / 4, sector * 7 + band, 2);
        let t = 0.25 + n * 0.55 - (y % 2) * 0.12;
        const sil = hash2(sector, band, 9) > 0.55 && n > 0.62;
        if (sil) t = 0.95;
        col = rampDither(ramp, Math.max(0, Math.min(1, t * 0.8)), x, y);
        // the membrane darkens toward the root
        if (r < 26 && bayer(x, y) > r / 26) col = NI[2];
      }
      if (part.broken) {
        // torn: holes and burnt edges
        const hole = fbm(x / 9, y / 9, 77 + part.seed, 3);
        if (hole > 0.55 && r > 22) return;
        if (hole > 0.5 && r > 22) col = AM[2];
        else col = rampDither([NI[1], NI[2], VI[1]], 0.4, x, y);
      }
      c.set(x, y, col);
    });
    // scalloped dark rim with gold trim
    for (let i = 0; i < part.pts.length; i++) {
      const [x0, y0] = part.pts[i];
      const [x1, y1] = part.pts[(i + 1) % part.pts.length];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / n);
        const y = Math.round(y0 + ((y1 - y0) * k) / n);
        if (c.get(x, y) < 0 && !inPoly(part.pts, x, y)) continue;
        c.set(x, y, k % 6 < 2 ? GO[4] : NI[1]);
      }
    }
    // the eyespot socket (the lens itself is a separate weak-point sprite)
    const [ex, ey] = [part.lens[0] + ROOT_X, part.lens[1] + ROOT_Y];
    for (let y = -9; y <= 9; y++)
      for (let x = -9; x <= 9; x++) {
        const d = Math.hypot(x, y);
        if (d < 9 && d > 7.4) c.set(ex + x, ey + y, part.broken ? NI[2] : GO[3]);
        else if (d <= 7.4 && part.broken) c.set(ex + x, ey + y, NI[0]);
      }
  }
  c.outline(INK);
  return c;
}

/** Foreshorten the master wing: x scales toward the root, the tip lifts. */
function flapFrame(m: PixelCanvas, s: number): PixelCanvas {
  const c = new PixelCanvas(WW, WH);
  for (let y = 0; y < WH; y++) {
    for (let x = 0; x < WW; x++) {
      const lx = (x - ROOT_X) / s;
      const sy = y + (1 - s) * lx * LIFT;
      const v = m.get(Math.round(lx + ROOT_X), Math.round(sy));
      if (v >= 0) c.set(x, y, v);
    }
  }
  return c;
}

function body(open: boolean): PixelCanvas {
  const W = 64;
  const H = 124;
  const c = new PixelCanvas(W, H);
  const cx = 32;
  // antennae (feathered)
  for (const side of [-1, 1]) {
    for (let t = 0; t < 1; t += 0.02) {
      const x = cx + side * (4 + t * 24 + Math.sin(t * 3) * 2);
      const y = 24 - t * 22 - Math.sin(t * 2.4) * 4;
      c.set(Math.round(x), Math.round(y), GO[3]);
      if (Math.round(t * 50) % 3 === 0) {
        for (let k = 1; k < 5 - t * 2; k++) {
          c.set(Math.round(x + side * k * 0.6), Math.round(y - k), VI[3]);
          c.set(Math.round(x - side * k * 0.4), Math.round(y - k), VI[2]);
        }
      }
    }
  }
  // abdomen (tapering segments)
  for (let y = 66; y < 118; y++) {
    const k = (y - 66) / 52;
    const w = Math.round(13 - k * 9);
    const seg = (y - 66) % 8;
    for (let x = -w; x <= w; x++) {
      let col = rampDither([NI[1], NI[2], VI[1], VI[2]], 0.5 - x / (w * 3) - (seg === 7 ? 0.3 : 0), cx + x, y);
      if (seg === 0) col = Math.abs(x) === w ? NI[1] : GO[3];
      if (Math.abs(x) === w) col = NI[1];
      c.set(cx + x, y, col);
    }
  }
  if (open) {
    // plates part: the memory core glows through
    for (let y = 72; y < 100; y++) {
      const half = Math.round(6 * Math.sin(((y - 72) / 28) * Math.PI));
      for (let x = -half; x <= half; x++) c.set(cx + x, y, Math.abs(x) >= half - 1 ? GO[4] : INK);
    }
  }
  // thorax (fur)
  for (let y = 38; y < 70; y++) {
    for (let x = -17; x <= 17; x++) {
      const d = Math.hypot(x / 17, (y - 54) / 16);
      if (d > 1) continue;
      const n = fbm((cx + x) / 2.2, y / 3, 41, 2);
      let col = rampDither([NI[1], NI[2], NI[3], VI[2], VI[3]], 0.65 - d * 0.5 + (n - 0.5) * 0.5 - x / 60, cx + x, y);
      if (y === 40 || y === 41) col = Math.abs(x) % 4 === 0 ? GO[5] : GO[3];
      c.set(cx + x, y, col);
    }
  }
  // folded legs
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const y0 = 50 + k * 7;
      for (let i = 0; i < 12; i++) {
        const x = cx + side * (15 + i);
        const y = y0 + Math.round(i * 0.6) + (i > 7 ? (i - 7) * 2 : 0);
        c.set(x, y, i > 9 ? GO[4] : NI[3]);
      }
    }
  }
  // head + faceted eyes
  for (let y = 20; y < 42; y++) {
    for (let x = -14; x <= 14; x++) {
      const d = Math.hypot(x / 14, (y - 31) / 11);
      if (d > 1) continue;
      c.set(cx + x, y, rampDither([NI[1], NI[2], NI[3]], 0.6 - d * 0.5, cx + x, y));
    }
  }
  for (const side of [-1, 1]) {
    const ex = cx + side * 9;
    const ey = 30;
    for (let y = -8; y <= 8; y++) {
      for (let x = -7; x <= 7; x++) {
        const d = Math.hypot(x / 7, y / 8);
        if (d > 1) continue;
        // hexagonal facets
        const hx = (x + 20 + (Math.floor((y + 20) / 2) % 2)) % 3;
        const facet = hx === 0 || (y + 20) % 2 === 0;
        const t = 0.85 - d * 0.6 + (x * side > 0 ? -0.1 : 0.12);
        c.set(ex + x, ey + y, facet ? rampDither([MG[2], MG[3], MG[4]], t, ex + x, ey + y) : rampDither([MG[3], MG[4], MG[5], MG[6]], t, ex + x, ey + y));
      }
    }
    c.set(ex - side * 2, ey - 4, 0xffffff);
    c.set(ex - side * 3, ey - 3, MG[7]);
  }
  c.outline(INK);
  return c;
}

function core(f: number): PixelCanvas {
  const c = new PixelCanvas(16, 28);
  for (let y = 0; y < 28; y++) {
    const half = 6 * Math.sin((y / 27) * Math.PI);
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - 7.5) / Math.max(1, half);
      if (d > 1) continue;
      const t = 1 - d * 0.7 - Math.abs(y - 14) / 30 + Math.sin(f * 1.57 + y * 0.6) * 0.1;
      c.set(x, y, rampDither([CY[3], CY[4], CY[5], CY[6], 0xffffff], t, x + f, y));
    }
  }
  return c;
}

function lens(state: 'idle' | 'hot' | 'broken'): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 7.2) continue;
      let col: number;
      if (state === 'broken') col = d > 5 ? NI[2] : (x + y) % 3 === 0 ? AM[2] : NI[0];
      else if (d > 5.6) col = state === 'hot' ? 0xffffff : MG[4];
      else if (d > 3.4) col = state === 'hot' ? MG[6] : MG[5];
      else col = d < 1.6 ? 0xffffff : state === 'hot' ? 0xffffff : MG[6];
      c.set(x, y, col);
    }
  if (state === 'broken') {
    for (let i = 0; i < 7; i++) c.set(3 + i, 4 + ((i * 3) % 7), AM[3]);
  }
  return c;
}

function mothling(f: number): PixelCanvas {
  const c = new PixelCanvas(14, 10);
  const up = f === 0;
  for (const side of [-1, 1]) {
    const pts: Pt[] = up
      ? [
          [7, 5],
          [7 + side * 6, 0],
          [7 + side * 6, 4],
        ]
      : [
          [7, 4],
          [7 + side * 6, 8],
          [7 + side * 5, 3],
        ];
    forEachPolyPixel(pts, (x, y) => c.set(x, y, y % 2 ? DA[5] : DA[7]));
  }
  c.fillRect(6, 2, 2, 7, NI[2]);
  c.set(6, 2, MG[6]);
  c.set(7, 2, MG[6]);
  c.outline(INK);
  return c;
}

function scale(f: number): PixelCanvas {
  const c = new PixelCanvas(7, 7);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      const d = Math.abs(x - 3) + Math.abs(y - 3);
      if (d > 3) continue;
      c.set(x, y, d === 0 ? 0xffffff : d === 1 ? (f ? DA[8] : GO[6]) : d === 2 ? DA[6] : DA[4]);
    }
  return c;
}

export function buildBoss2(): Item[] {
  const out: Item[] = [];
  out.push({ name: 'noc_body', c: body(false) });
  out.push({ name: 'noc_body_open', c: body(true) });
  for (let f = 0; f < 4; f++) out.push({ name: `noc_core_${f}`, c: core(f) });
  for (let torn = 0; torn < 4; torn++) {
    const m = masterWing(torn);
    FLAP.forEach((s, f) => out.push({ name: `noc_wing_${torn}_${f}`, c: flapFrame(m, s) }));
  }
  out.push({ name: 'noc_lens', c: lens('idle') });
  out.push({ name: 'noc_lens_hot', c: lens('hot') });
  out.push({ name: 'noc_lens_broken', c: lens('broken') });
  out.push({ name: 'noc_moth_0', c: mothling(0) });
  out.push({ name: 'noc_moth_1', c: mothling(1) });
  out.push({ name: 'noc_scale_0', c: scale(0) });
  out.push({ name: 'noc_scale_1', c: scale(1) });
  return out;
}

/** Wing image geometry shared with the runtime. */
export const WING_GEOM = { w: WW, h: WH, rootX: ROOT_X, rootY: ROOT_Y };
