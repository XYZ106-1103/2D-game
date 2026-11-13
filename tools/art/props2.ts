// Chapter 2 device & enemy sprites (atlas "ch2").
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas } from './pixel.ts';

type Item = { name: string; c: PixelCanvas };

const ST = RAMPS.steel;
const CY = RAMPS.cyan;
const CR = RAMPS.crimson;
const MG = RAMPS.magenta;
const YE = RAMPS.yellow;
const GO = RAMPS.gold;
const VI = RAMPS.violet;
const JA = RAMPS.jade;
const MA = RAMPS.marble;
const OX = RAMPS.oxide;
const INK = 0x0a0612;

function disc(c: PixelCanvas, cx: number, cy: number, r: number, col: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) c.set(x, y, col);
}

/** Wall-mounted beam emitter (faces right; flip for the receiver). */
function laserEmitter(): Item[] {
  const out: Item[] = [];
  for (const [name, lens] of [
    ['laser_emit', CR[5]],
    ['laser_emit_off', CR[2]],
  ] as const) {
    const c = new PixelCanvas(10, 12);
    c.fillRect(0, 0, 7, 12, ST[2]);
    c.fillRect(0, 0, 7, 1, ST[5]);
    c.fillRect(6, 0, 1, 12, ST[1]);
    c.fillRect(1, 2, 1, 1, YE[3]);
    c.fillRect(1, 9, 1, 1, YE[3]);
    c.fillRect(7, 3, 3, 6, ST[1]);
    c.fillRect(8, 4, 2, 4, lens);
    c.set(9, 4, 0xffffff);
    c.outline(INK);
    out.push({ name, c });
  }
  return out;
}

/** Industrial fan housing (4 rotation frames). */
function fanFrames(): Item[] {
  const out: Item[] = [];
  for (let f = 0; f < 4; f++) {
    const c = new PixelCanvas(24, 24);
    disc(c, 12, 12, 11, ST[1]);
    disc(c, 12, 12, 9.5, INK);
    for (let b = 0; b < 3; b++) {
      const a0 = (b / 3) * Math.PI * 2 + (f / 4) * ((Math.PI * 2) / 3);
      for (let r = 2; r < 9; r++) {
        for (let w = -1.2; w <= 1.2; w += 0.6) {
          const a = a0 + (w * 0.9) / Math.max(2, r * 0.4);
          c.set(Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r), w > 0.5 ? ST[5] : ST[3]);
        }
      }
    }
    disc(c, 12, 12, 2, ST[6]);
    for (let a = 0; a < Math.PI * 2; a += 0.05) c.set(Math.round(12 + Math.cos(a) * 10.5), Math.round(12 + Math.sin(a) * 10.5), a < Math.PI ? ST[2] : ST[4]);
    c.outline(INK);
    out.push({ name: `fan_${f}`, c });
  }
  return out;
}

function crusherHead(w: number): Item {
  const h = 22;
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, h, OX[2]);
  c.fillRect(0, 0, w, 2, OX[4]);
  c.fillRect(0, h - 6, w, 6, ST[2]);
  for (let x = 0; x < w; x++) {
    const stripe = ((x + 64) >> 2) % 2 === 0;
    c.set(x, h - 5, stripe ? YE[3] : INK);
    c.set(x, h - 4, stripe ? YE[2] : INK);
  }
  c.fillRect(0, h - 2, w, 2, ST[4]);
  for (const rx of [3, w - 4]) {
    c.set(rx, 5, OX[6]);
    c.set(rx, 10, OX[6]);
  }
  c.fillRect(Math.floor(w / 2) - 4, 4, 8, 6, OX[1]);
  c.fillRect(Math.floor(w / 2) - 3, 5, 6, 1, OX[5]);
  c.outline(INK);
  return { name: `crusher_${w}`, c };
}

function crusherShaft(): Item {
  const c = new PixelCanvas(10, 16);
  c.fillRect(0, 0, 10, 16, ST[3]);
  c.fillRect(0, 0, 2, 16, ST[5]);
  c.fillRect(8, 0, 2, 16, ST[1]);
  c.fillRect(4, 0, 1, 16, ST[6]);
  return { name: 'crusher_shaft', c };
}

/** Giant bioluminescent bloom (rest / squashed / open). */
function bloomFrames(): Item[] {
  const out: Item[] = [];
  for (const [name, squash] of [
    ['bloom_0', 0],
    ['bloom_1', 1],
  ] as const) {
    const c = new PixelCanvas(30, 22);
    const top = squash ? 12 : 6;
    // stem + leaves
    for (let y = top + 4; y < 22; y++) {
      c.set(14, y, JA[3]);
      c.set(15, y, JA[4]);
    }
    for (let i = 0; i < 6; i++) {
      c.set(13 - i, 19 - Math.floor(i / 2), JA[4]);
      c.set(16 + i, 18 - Math.floor(i / 2), JA[5]);
    }
    // petals cup
    const pw = squash ? 14 : 12;
    for (let y = 0; y < (squash ? 5 : 8); y++) {
      const half = pw - Math.floor((y * y) / (squash ? 3 : 6));
      for (let x = 15 - half; x < 15 + half; x++) {
        const edge = x === 15 - half || x === 15 + half - 1;
        c.set(x, top + y, y === 0 ? CY[6] : edge ? CY[3] : y < 3 ? CY[5] : CY[4]);
      }
    }
    // glowing pistil
    c.set(14, top - 1, MG[6]);
    c.set(15, top - 1, 0xffffff);
    c.set(16, top - 1, MG[6]);
    c.outline(INK);
    out.push({ name, c });
  }
  return out;
}

function switchFrames(): Item[] {
  const out: Item[] = [];
  for (const [name, on] of [
    ['switch_off', false],
    ['switch_on', true],
  ] as const) {
    const c = new PixelCanvas(16, 16);
    disc(c, 8, 8, 7, GO[2]);
    disc(c, 8, 8, 5.5, MA[4]);
    disc(c, 8, 8, 3.5, on ? GO[6] : GO[1]);
    if (on) disc(c, 8, 8, 1.6, 0xffffff);
    for (const [x, y] of [
      [8, 1],
      [8, 14],
      [1, 8],
      [14, 8],
    ])
      c.set(x, y, GO[5]);
    c.outline(INK);
    out.push({ name, c });
  }
  return out;
}

function wellFrames(): Item[] {
  const out: Item[] = [];
  for (let f = 0; f < 4; f++) {
    const c = new PixelCanvas(20, 20);
    disc(c, 10, 10, 4, INK);
    disc(c, 10, 10, 2.2, VI[5]);
    c.set(10, 10, 0xffffff);
    for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * Math.PI * 2 + (f / 4) * ((Math.PI * 2) / 3);
      for (let t = 0; t < 1; t += 0.06) {
        const a = a0 + t * 2.4;
        const r = 5 + t * 4.5;
        c.set(Math.round(10 + Math.cos(a) * r), Math.round(10 + Math.sin(a) * r), t < 0.5 ? GO[5] : GO[3]);
      }
    }
    out.push({ name: `well_${f}`, c });
  }
  return out;
}

function rodSprite(): Item[] {
  const out: Item[] = [];
  for (const [name, hot] of [
    ['rod', false],
    ['rod_hot', true],
  ] as const) {
    const c = new PixelCanvas(9, 40);
    c.fillRect(4, 0, 1, 26, hot ? CY[6] : ST[6]);
    c.fillRect(3, 2, 1, 22, hot ? CY[4] : ST[4]);
    c.set(4, 0, 0xffffff);
    for (let i = 0; i < 4; i++) c.fillRect(1, 26 + i * 3, 7, 2, i % 2 ? MA[4] : OX[4]);
    c.fillRect(0, 38, 9, 2, ST[2]);
    c.outline(INK);
    out.push({ name, c });
  }
  return out;
}

function emitterSprite(): Item {
  const c = new PixelCanvas(22, 14);
  for (let x = 0; x < 22; x++) {
    const y = Math.round(Math.pow((x - 10.5) / 10.5, 2) * 6);
    for (let yy = y; yy < 8; yy++) c.set(x, yy, yy === y ? MA[6] : MA[4]);
  }
  c.fillRect(10, 2, 2, 6, ST[2]);
  c.set(10, 1, CY[6]);
  c.set(11, 1, CY[5]);
  c.fillRect(8, 8, 6, 4, ST[3]);
  c.fillRect(6, 12, 10, 2, ST[2]);
  c.outline(INK);
  return { name: 'emitter', c };
}

function mineFrames(): Item[] {
  const out: Item[] = [];
  for (const [name, warn] of [
    ['mine_0', 0],
    ['mine_1', 1],
    ['mine_warn', 2],
  ] as const) {
    const c = new PixelCanvas(16, 16);
    // spikes
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + (warn === 1 ? 0.39 : 0);
      for (let r = 5; r < 8; r++) c.set(Math.round(8 + Math.cos(a) * r - 0.5), Math.round(8 + Math.sin(a) * r - 0.5), r === 7 ? ST[6] : ST[3]);
    }
    disc(c, 8, 8, 5, ST[2]);
    disc(c, 7, 7, 3.5, ST[3]);
    c.set(6, 5, ST[5]);
    const eye = warn === 2 ? 0xffffff : MG[5];
    disc(c, 8, 8, 1.8, eye);
    c.outline(INK);
    out.push({ name, c });
  }
  return out;
}

function petals(): Item[] {
  const a = new PixelCanvas(4, 3);
  a.set(1, 0, MG[6]);
  a.set(2, 0, MG[7]);
  a.fillRect(0, 1, 4, 1, MG[6]);
  a.set(1, 2, MG[5]);
  const b = new PixelCanvas(3, 3);
  b.set(1, 0, 0xffffff);
  b.fillRect(0, 1, 3, 1, MA[6]);
  b.set(1, 2, MA[5]);
  const s = new PixelCanvas(3, 3);
  s.set(1, 0, CY[6]);
  s.set(0, 1, CY[4]);
  s.set(1, 1, 0xffffff);
  s.set(2, 1, CY[4]);
  s.set(1, 2, CY[6]);
  return [
    { name: 'petal_0', c: a },
    { name: 'petal_1', c: b },
    { name: 'spark_star', c: s },
  ];
}

export function buildProps2(): Item[] {
  return [
    ...laserEmitter(),
    ...fanFrames(),
    crusherHead(32),
    crusherHead(48),
    crusherShaft(),
    ...bloomFrames(),
    ...switchFrames(),
    ...wellFrames(),
    ...rodSprite(),
    emitterSprite(),
    ...mineFrames(),
    ...petals(),
  ];
}
