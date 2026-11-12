// Level props, interactive objects, neon signs, vehicles.
import { RAMPS, INK } from '../../src/art/palette.ts';
import { PixelCanvas, hash2 } from './pixel.ts';
import { loadGalmuri, rasterText, measureText } from '../lib/bdf.ts';

const S = RAMPS.steel;
const CY = RAMPS.cyan;
const MG = RAMPS.magenta;

type Item = { name: string; c: PixelCanvas };

/** Tether node: hovering anchor drone. 4-frame light pulse. */
function anchors(out: Item[]): void {
  for (let f = 0; f < 4; f++) {
    const c = new PixelCanvas(15, 15);
    const cx = 7;
    const cy = 7;
    // rotor arms
    for (let x = 0; x < 15; x++) {
      if (x > 3 && x < 11) continue;
      c.set(x, cy - 2, S[3]);
    }
    const blade = f % 2 === 0 ? [0, 1, 2] : [12, 13, 14];
    for (const x of blade) c.set(x, cy - 3, S[5]);
    for (const x of f % 2 === 0 ? [12, 13, 14] : [0, 1, 2]) c.set(x, cy - 3, S[2]);
    // ring body
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const d = Math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5);
        if (d < 4.6) {
          const lit = (x - cx) * 0.4 - (y - cy) * 0.6;
          c.set(x, y, d > 3.4 ? (lit > 0.5 ? S[5] : lit < -0.8 ? S[1] : S[3]) : d > 2.2 ? S[0] : 0);
        }
      }
    }
    const pulse = [CY[5], CY[6], CY[7], CY[6]][f];
    c.set(cx, cy, pulse);
    c.set(cx + 1, cy, CY[5]);
    c.set(cx, cy + 1, CY[5]);
    c.set(cx + 1, cy + 1, CY[4]);
    // hanging hook ring underneath
    c.set(cx, cy + 5, S[4]);
    c.set(cx + 1, cy + 5, S[4]);
    c.set(cx - 1, cy + 6, S[3]);
    c.set(cx + 2, cy + 6, S[3]);
    c.set(cx, cy + 7, S[2]);
    c.set(cx + 1, cy + 7, S[2]);
    c.outline(INK);
    out.push({ name: `anchor_${f}`, c });
  }
}

/** Memory relay checkpoint beacon. */
function checkpoint(out: Item[]): void {
  for (let f = 0; f < 5; f++) {
    const on = f > 0;
    const c = new PixelCanvas(16, 38);
    // pole
    for (let y = 14; y < 36; y++) {
      c.set(7, y, S[4]);
      c.set(8, y, S[2]);
    }
    // base
    for (let y = 33; y < 38; y++) for (let x = 3; x < 13; x++) c.set(x, y, y === 33 ? S[4] : x < 5 ? S[3] : S[1]);
    // head unit
    for (let y = 4; y < 15; y++) for (let x = 2; x < 14; x++) c.set(x, y, y === 4 ? S[5] : x === 2 ? S[4] : x === 13 ? S[0] : S[2]);
    // screen
    const scr = on ? [CY[3], CY[4], CY[5], CY[6]] : [0x0b0a14, 0x14121e, 0x1c1828, 0x22202e];
    for (let y = 6; y < 13; y++) for (let x = 4; x < 12; x++) c.set(x, y, scr[(y + (on ? f : 0)) % 3 === 0 ? 1 : 0]);
    if (on) {
      // memory glyph — a stylised tether loop
      const pts = [
        [6, 8],
        [7, 7],
        [8, 7],
        [9, 8],
        [9, 9],
        [8, 10],
        [7, 10],
        [6, 9],
      ];
      pts.forEach(([x, y], i) => c.set(x, y, i === (f * 2) % 8 ? scr[3] : scr[2]));
    }
    // antenna
    for (let y = 0; y < 4; y++) c.set(11, y, S[3]);
    c.set(11, 0, on ? (f % 2 ? RAMPS.acid[4] : RAMPS.acid[3]) : RAMPS.crimson[3]);
    c.outline(INK);
    out.push({ name: on ? `checkpoint_on_${f - 1}` : 'checkpoint_off', c });
  }
}

/** Collectible memory shard. 6-frame shimmer. */
function logShard(out: Item[]): void {
  for (let f = 0; f < 6; f++) {
    const c = new PixelCanvas(11, 13);
    const shape = ['....M....', '...MmM...', '..MmmmM..', '.MmmWmmM.', 'MmmmmmmmM', '.MmmmmmM.', '..MmmmM..', '...MmM...', '....M....'];
    const sw = [0.4, 0.7, 1, 0.7, 0.4, 0.2][f];
    shape.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        let col = ch === 'M' ? MG[3] : MG[4];
        if (ch === 'W') col = MG[7];
        // moving glint band
        if (ch === 'm' && Math.abs(x - y - (f * 3 - 4)) < 1.2) col = MG[6];
        if (x > 4 && ch !== 'W') col = ch === 'M' ? MG[2] : MG[3];
        c.set(x + 1, y + 2, col);
      });
    });
    if (sw > 0.6) c.set(5, 0, MG[6]);
    c.outline(INK);
    out.push({ name: `log_${f}`, c });
  }
}

/** Neon sign rendered from Galmuri glyphs. Produces on + off frames. */
function neonSign(out: Item[], name: string, text: string, ramp: readonly number[], vertical = false, fontName = 'Galmuri11-Bold'): void {
  const font = loadGalmuri(fontName);
  const chars = vertical ? [...text] : [text];
  const lineH = font.ascent + font.descent;
  const inner = Math.max(...chars.map((t) => measureText(font, t, 1)));
  const w = inner + 8;
  const h = chars.length * (lineH - 1) + 6;
  for (const on of [true, false]) {
    const c = new PixelCanvas(w, h);
    // backing box
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        c.set(x, y, edge ? (on ? ramp[3] : ramp[1]) : y < 2 ? 0x150f22 : 0x0d0a16);
      }
    }
    chars.forEach((t, i) => {
      const tw = measureText(font, t, 1);
      const ox = Math.floor((w - tw) / 2);
      const oy = 2 + i * (lineH - 1) - 1;
      const pts: [number, number][] = [];
      rasterText(font, t, ox, oy, (x, y) => pts.push([x, y]), 1);
      // tube halo
      if (on) {
        for (const [x, y] of pts) {
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            if (c.get(x + dx, y + dy) === 0x0d0a16 || c.get(x + dx, y + dy) === 0x150f22) c.set(x + dx, y + dy, ramp[2]);
          }
        }
      }
      for (const [x, y] of pts) c.set(x, y, on ? (hash2(x, y, 1) > 0.85 ? ramp[ramp.length - 1] : ramp[ramp.length - 2]) : ramp[2]);
    });
    // mounting brackets
    c.outline(INK);
    out.push({ name: `sign_${name}_${on ? 'on' : 'off'}`, c });
  }
}

function box(c: PixelCanvas, x0: number, y0: number, w: number, h: number, ramp: readonly number[], base: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let col = ramp[base];
      if (y === 0) col = ramp[base + 2];
      else if (x === 0) col = ramp[base + 1];
      else if (x === w - 1 || y === h - 1) col = ramp[base - 1];
      c.set(x0 + x, y0 + y, col);
    }
  }
}

function clutter(out: Item[]): void {
  // AC unit
  {
    const c = new PixelCanvas(20, 15);
    box(c, 0, 2, 20, 13, S, 2);
    for (let y = 4; y < 13; y++) for (let x = 2; x < 11; x++) c.set(x, y, Math.hypot(x - 6.5, y - 8.5) < 4.2 ? ((x + y) % 2 ? S[0] : S[3]) : S[2]);
    for (let y = 5; y < 13; y += 2) for (let x = 13; x < 18; x++) c.set(x, y, S[1]);
    c.set(4, 1, S[3]);
    c.set(15, 1, S[3]);
    c.outline(INK);
    out.push({ name: 'ac', c });
  }
  // water tank on legs
  {
    const c = new PixelCanvas(26, 32);
    const R = RAMPS.rust;
    for (let y = 0; y < 20; y++) {
      for (let x = 2; x < 24; x++) {
        const u = (x - 2) / 21;
        let col = u < 0.2 ? R[3] : u < 0.55 ? R[2] : u < 0.85 ? R[1] : R[0];
        if (y % 5 === 0) col = R[0];
        if (y < 2) col = R[4];
        c.set(x, y + 2, col);
      }
    }
    for (let x = 6; x < 20; x++) c.set(x, 0, R[3]);
    for (let x = 4; x < 22; x++) c.set(x, 1, R[2]);
    for (let y = 22; y < 32; y++) {
      c.set(4, y, S[3]);
      c.set(21, y, S[2]);
      c.set(12, y, S[2]);
    }
    for (let i = 0; i < 9; i++) {
      c.set(5 + i * 0.8, 23 + i, S[1]);
      c.set(20 - i * 0.8, 23 + i, S[1]);
    }
    // painted kanji-like stencil
    const font = loadGalmuri('Galmuri7');
    rasterText(font, '9', 10, 8, (x, y) => c.set(x, y, R[4]));
    c.outline(INK);
    out.push({ name: 'tank', c });
  }
  // antenna mast
  {
    const c = new PixelCanvas(11, 36);
    for (let y = 2; y < 36; y++) c.set(5, y, y % 6 === 0 ? S[5] : S[3]);
    for (const y of [8, 16, 24]) for (let x = 2; x < 9; x++) c.set(x, y, S[2]);
    c.set(5, 1, RAMPS.crimson[5]);
    c.set(5, 0, RAMPS.crimson[6]);
    c.outline(INK);
    out.push({ name: 'antenna', c });
  }
  // satellite dish
  {
    const c = new PixelCanvas(18, 16);
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x - 8) / 8, (y - 6) / 6);
        if (d < 1 && x < 10 + y * 0.2) c.set(x, y, d > 0.8 ? S[5] : x < 6 ? S[4] : S[3]);
      }
    }
    for (let y = 10; y < 16; y++) c.set(9, y, S[2]);
    for (let x = 6; x < 13; x++) c.set(x, 15, S[3]);
    c.set(13, 4, S[5]);
    c.outline(INK);
    out.push({ name: 'dish', c });
  }
  // crates & barrels
  {
    const c = new PixelCanvas(16, 14);
    box(c, 0, 0, 16, 14, RAMPS.teal, 2);
    for (let i = 1; i < 13; i++) c.set(i + 1, i, RAMPS.teal[1]);
    for (let x = 1; x < 15; x++) c.set(x, 6, RAMPS.teal[1]);
    c.set(3, 3, RAMPS.yellow[2]);
    c.set(4, 3, RAMPS.yellow[2]);
    c.outline(INK);
    out.push({ name: 'crate', c });
  }
  {
    const c = new PixelCanvas(11, 15);
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 11; x++) {
        const u = x / 10;
        let col = u < 0.25 ? RAMPS.crimson[4] : u < 0.6 ? RAMPS.crimson[3] : RAMPS.crimson[2];
        if (y === 3 || y === 11) col = RAMPS.crimson[1];
        if (y === 0) col = RAMPS.crimson[5];
        c.set(x, y, col);
      }
    }
    c.set(4, 6, RAMPS.yellow[3]);
    c.set(5, 7, RAMPS.yellow[3]);
    c.set(4, 8, RAMPS.yellow[3]);
    c.outline(INK);
    out.push({ name: 'barrel', c });
  }
  // vending machine (glowing)
  {
    const c = new PixelCanvas(16, 28);
    box(c, 0, 0, 16, 28, RAMPS.violet, 1);
    for (let y = 3; y < 15; y++) for (let x = 2; x < 11; x++) c.set(x, y, (y - 3) % 4 === 3 ? MG[2] : [MG[4], CY[4], RAMPS.amber[3], RAMPS.acid[3]][((x - 2) >> 1) % 4]);
    for (let y = 3; y < 15; y++) c.set(2, y, MG[6]);
    for (let y = 4; y < 12; y++) c.set(13, y, y % 2 ? RAMPS.violet[4] : RAMPS.violet[2]);
    for (let x = 3; x < 12; x++) c.set(x, 20, 0x0a0612);
    for (let x = 3; x < 12; x++) c.set(x, 21, RAMPS.violet[3]);
    c.outline(INK);
    out.push({ name: 'vending', c });
  }
  // street lamp head (pole drawn at runtime)
  {
    const c = new PixelCanvas(14, 8);
    for (let x = 0; x < 14; x++) c.set(x, 0, S[2]);
    for (let x = 2; x < 13; x++) c.set(x, 1, S[4]);
    for (let x = 3; x < 12; x++) c.set(x, 2, S[2]);
    for (let x = 4; x < 11; x++) c.set(x, 3, RAMPS.amber[4]);
    for (let x = 5; x < 10; x++) c.set(x, 4, RAMPS.amber[5]);
    c.outline(INK);
    out.push({ name: 'lamp', c });
  }
  // rooftop railing segment (tileable 16)
  {
    const c = new PixelCanvas(16, 9);
    for (let x = 0; x < 16; x++) {
      c.set(x, 0, S[4]);
      c.set(x, 4, S[2]);
    }
    for (const x of [1, 9]) for (let y = 0; y < 9; y++) c.set(x, y, S[3]);
    out.push({ name: 'railing', c });
  }
  // steam vent grate (floor)
  {
    const c = new PixelCanvas(18, 7);
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 18; x++) {
        let col = y === 0 ? S[5] : y === 6 ? S[1] : x % 3 === 0 ? S[1] : S[3];
        if (y > 1 && y < 5 && x % 3 !== 0) col = 0x0a0612;
        c.set(x, y, col);
      }
    }
    c.set(1, 1, RAMPS.yellow[2]);
    c.set(16, 1, RAMPS.yellow[2]);
    c.outline(INK);
    out.push({ name: 'vent', c });
  }
  // exit elevator gate
  {
    const c = new PixelCanvas(34, 46);
    box(c, 0, 0, 34, 46, S, 2);
    for (let y = 8; y < 46; y++) for (let x = 4; x < 30; x++) c.set(x, y, x === 16 || x === 17 ? S[0] : x < 16 ? S[3] : S[2]);
    for (let x = 4; x < 30; x++) c.set(x, 7, S[5]);
    const font = loadGalmuri('Galmuri7');
    for (let y = 1; y < 6; y++) for (let x = 8; x < 26; x++) c.set(x, y, 0x0a1a10);
    rasterText(font, 'EXIT', 10, 0, (x, y) => c.set(x, y, RAMPS.acid[4]));
    for (let y = 12; y < 44; y += 6) {
      c.set(6, y, RAMPS.acid[3]);
      c.set(27, y, RAMPS.acid[3]);
    }
    c.outline(INK);
    out.push({ name: 'exit', c });
  }
}

function cars(out: Item[]): void {
  const designs = [
    { body: RAMPS.steel, glass: CY, len: 22 },
    { body: RAMPS.violet, glass: MG, len: 18 },
    { body: RAMPS.rust, glass: RAMPS.amber, len: 26 },
  ];
  designs.forEach((d, i) => {
    const c = new PixelCanvas(d.len + 2, 9);
    const L = d.len;
    for (let x = 0; x < L; x++) {
      const top = x < 5 ? 3 : x > L - 4 ? 3 : 1;
      for (let y = top; y < 7; y++) {
        let col = d.body[y === top ? 4 : y > 5 ? 1 : 2];
        if (y === 2 && x > 6 && x < L - 6) col = d.glass[x % 3 === 0 ? 5 : 3];
        c.set(x + 1, y, col);
      }
    }
    // headlight / tail light
    c.set(L, 4, 0xfff4e0);
    c.set(L - 1, 4, RAMPS.yellow[3]);
    c.set(1, 4, RAMPS.crimson[5]);
    c.set(2, 4, RAMPS.crimson[4]);
    // thruster glow underside
    for (let x = 5; x < L - 4; x += 5) c.set(x + 1, 7, CY[5]);
    c.outline(INK);
    out.push({ name: `car_${i}`, c });
  });
}

/** Animated billboard screen content (5 frames of looping corporate propaganda). */
function billboard(out: Item[]): void {
  const W = 72;
  const H = 40;
  const font = loadGalmuri('Galmuri9');
  const small = loadGalmuri('Galmuri7');
  const frames = [
    { bg: MG, title: 'LETHE', sub: '기억 보관' },
    { bg: MG, title: 'LETHE', sub: 'REST EASY' },
    { bg: CY, title: 'ARCHIVE', sub: '백업 99.98%' },
    { bg: CY, title: 'ARCHIVE', sub: 'FORGET' },
    { bg: RAMPS.violet, title: '9구역', sub: '출입 통제' },
  ];
  frames.forEach((fr, i) => {
    const c = new PixelCanvas(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const edge = x < 2 || y < 2 || x > W - 3 || y > H - 3;
        let col = edge ? S[x === 0 || y === 0 ? 3 : 1] : fr.bg[(y >> 1) % 2 === 0 ? 1 : 2];
        if (!edge && y % 3 === 0) col = fr.bg[1];
        c.set(x, y, col);
      }
    }
    // eye motif
    const ex = 14;
    const ey = 20;
    for (let y = -6; y <= 6; y++) {
      for (let x = -9; x <= 9; x++) {
        const lid = Math.abs(y) < 6 - (x * x) / 16;
        if (!lid) continue;
        const d = Math.hypot(x, y);
        c.set(ex + x, ey + y, d < 2.5 ? 0x0a0612 : d < 4.5 ? fr.bg[5] : fr.bg[3]);
      }
    }
    rasterText(font, fr.title, 28, 6, (x, y) => c.set(x, y, fr.bg[6]));
    rasterText(small, fr.sub, 28, 21, (x, y) => c.set(x, y, fr.bg[5]));
    out.push({ name: `bill_${i}`, c });
  });
  // frame/stand
  const c = new PixelCanvas(W + 8, H + 26);
  box(c, 0, 0, W + 8, H + 8, S, 2);
  for (let y = H + 8; y < H + 26; y++) {
    c.set(12, y, S[3]);
    c.set(13, y, S[1]);
    c.set(W - 6, y, S[3]);
    c.set(W - 5, y, S[1]);
  }
  for (let y = 4; y < H + 4; y++) for (let x = 4; x < W + 4; x++) c.clear(x, y);
  c.outline(INK);
  out.push({ name: 'bill_frame', c });
}

export function buildProps(): Item[] {
  const out: Item[] = [];
  anchors(out);
  checkpoint(out);
  logShard(out);
  clutter(out);
  cars(out);
  billboard(out);
  neonSign(out, 'lethe', 'LETHE', MG);
  neonSign(out, 'memory', '기억', CY, true);
  neonSign(out, 'hotel', '호텔', MG, true);
  neonSign(out, 'ramen', '라멘', RAMPS.amber, true);
  neonSign(out, 'bar', 'BAR', CY);
  neonSign(out, 'open', '24H', RAMPS.yellow, false, 'Galmuri9');
  neonSign(out, 'pharm', '약', RAMPS.acid, true);
  neonSign(out, 'danger', '위험', RAMPS.crimson, false);
  return out;
}
