// UI atlas: panels, HUD pieces, key caps, logo.
import { RAMPS, INK } from '../../src/art/palette.ts';
import { PixelCanvas, bayer } from './pixel.ts';

type Item = { name: string; c: PixelCanvas };
const CY = RAMPS.cyan;
const MG = RAMPS.magenta;
const N = RAMPS.night;

/** 9-slice panel (24×24, slice 8). Translucent dark fill with cyan corner brackets. */
function panels(out: Item[]): void {
  const make = (name: string, accent: readonly number[]) => {
    const c = new PixelCanvas(24, 24);
    for (let y = 1; y < 23; y++) for (let x = 1; x < 23; x++) c.set(x, y, 0x0b0816, 225);
    for (let i = 1; i < 23; i++) {
      c.set(i, 0, N[4]);
      c.set(i, 23, N[3]);
      c.set(0, i, N[4]);
      c.set(23, i, N[3]);
    }
    // corner brackets
    for (let i = 0; i < 6; i++) {
      c.set(i, 0, accent[5]);
      c.set(0, i, accent[5]);
      c.set(23 - i, 23, accent[4]);
      c.set(23, 23 - i, accent[4]);
    }
    c.set(23, 0, accent[3]);
    c.set(0, 23, accent[3]);
    // inner bevel line
    for (let i = 2; i < 22; i++) c.set(i, 2, N[2]);
    out.push({ name, c });
  };
  make('panel', CY);
  make('panel_mg', MG);
  // selection bar (stretchable horizontally): 8×12
  const bar = new PixelCanvas(8, 12);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) bar.set(x, y, y === 0 || y === 11 ? CY[4] : CY[2], y === 0 || y === 11 ? 255 : 150);
  out.push({ name: 'selbar', c: bar });
}

function hud(out: Item[]): void {
  // HP cell: slanted parallelogram 7×9
  const cell = (name: string, ramp: readonly number[] | null) => {
    const c = new PixelCanvas(8, 9);
    for (let y = 0; y < 9; y++) {
      const off = Math.floor((8 - y) / 3);
      for (let x = 0; x < 5; x++) {
        const px = x + off;
        if (ramp) c.set(px, y, y === 0 ? ramp[6] : y < 3 ? ramp[5] : y < 7 ? ramp[4] : ramp[3]);
        else c.set(px, y, y === 0 ? N[4] : N[2]);
      }
    }
    c.outline(INK);
    out.push({ name, c });
  };
  cell('hp_full', RAMPS.crimson);
  cell('hp_empty', null);
  cell('hp_flash', [0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff]);
  // HUD emblem: tether gauntlet icon 16×16
  const em = new PixelCanvas(18, 18);
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const d = Math.hypot(x + 0.5 - 9, y + 0.5 - 9);
      if (d < 8.5 && d > 6.8) em.set(x, y, y < 9 ? CY[5] : CY[3]);
      else if (d <= 6.8) em.set(x, y, 0x0b0816);
    }
  }
  // hook glyph
  const g = ['..X...', '..X...', '..X...', '..X...', 'X.X.X.', 'X.X.X.', '.XXX..', '..X...'];
  g.forEach((r, y) => [...r].forEach((ch, x) => ch === 'X' && em.set(x + 6, y + 5, CY[6])));
  em.outline(INK);
  out.push({ name: 'emblem', c: em });
  // log icon
  const lg = new PixelCanvas(9, 9);
  ['....X....', '...XmX...', '..XmmmX..', '.XmmWmmX.', 'XmmmmmmmX', '.XmmmmmX.', '..XmmmX..', '...XmX...', '....X....'].forEach((r, y) =>
    [...r].forEach((ch, x) => ch !== '.' && lg.set(x, y, ch === 'X' ? MG[3] : ch === 'W' ? MG[7] : MG[5])),
  );
  out.push({ name: 'icon_log', c: lg });
  // menu cursor ▶ 6×7
  const cur = new PixelCanvas(6, 7);
  for (let y = 0; y < 7; y++) for (let x = 0; x <= 3 - Math.abs(y - 3); x++) cur.set(x + 1, y, x === 0 ? CY[4] : CY[6]);
  out.push({ name: 'cursor', c: cur });
  // boss bar frame 204×9
  const bb = new PixelCanvas(204, 9);
  for (let x = 0; x < 204; x++) {
    bb.set(x, 0, N[5]);
    bb.set(x, 8, N[3]);
  }
  for (let y = 0; y < 9; y++) {
    bb.set(0, y, N[5]);
    bb.set(203, y, N[3]);
  }
  for (let y = 1; y < 8; y++) for (let x = 1; x < 203; x++) bb.set(x, y, 0x0b0816, 220);
  out.push({ name: 'bossbar', c: bb });
}

/** Keycap (13×13) & mouse icons for the controls screen. */
function keys(out: Item[]): void {
  const cap = (name: string, w: number) => {
    const c = new PixelCanvas(w, 13);
    for (let y = 0; y < 13; y++) {
      for (let x = 0; x < w; x++) {
        let col = N[3];
        if (y === 0 || x === 0) col = N[6];
        if (y >= 10) col = N[2];
        if (x === w - 1) col = N[2];
        if (y === 12) col = N[1];
        c.set(x, y, col);
      }
    }
    c.outline(INK);
    out.push({ name, c });
  };
  cap('key', 13);
  cap('key_wide', 31);
  cap('key_space', 47);
  for (const side of ['l', 'r', 'w'] as const) {
    const c = new PixelCanvas(13, 18);
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 13; x++) {
        const dx = (x + 0.5 - 6.5) / 6.5;
        const dy = (y + 0.5 - 9) / 9;
        if (dx * dx + dy * dy > 1) continue;
        let col = N[4];
        if (y < 7) {
          const left = x < 6;
          const right = x > 6;
          if ((side === 'l' && left) || (side === 'r' && right)) col = CY[5];
          if (x === 6) col = N[2];
        }
        if (y === 7) col = N[2];
        if (side === 'w' && x === 6 && y > 1 && y < 5) col = CY[6];
        c.set(x, y, col);
      }
    }
    c.outline(INK);
    out.push({ name: `mouse_${side}`, c });
  }
}

// --- Logo -------------------------------------------------------------------
type Seg = [number, number, number, number];
const LETTERS: Record<string, Seg[]> = {
  T: [
    [0, 0, 11, 0],
    [5.5, 0, 5.5, 17],
  ],
  E: [
    [0, 0, 0, 17],
    [0, 0, 10, 0],
    [0, 8.5, 8, 8.5],
    [0, 17, 10, 17],
  ],
  H: [
    [0, 0, 0, 17],
    [10, 0, 10, 17],
    [0, 8.5, 10, 8.5],
  ],
  R: [
    [0, 0, 0, 17],
    [0, 0, 7, 0],
    [7, 0, 10, 3],
    [10, 3, 10, 5.5],
    [10, 5.5, 7, 8.5],
    [7, 8.5, 0, 8.5],
    [5, 8.5, 10, 17],
  ],
  F: [
    [0, 0, 0, 17],
    [0, 0, 10, 0],
    [0, 8.5, 8, 8.5],
  ],
  A: [
    [0, 17, 0, 5],
    [0, 5, 4.5, 0],
    [4.5, 0, 5.5, 0],
    [5.5, 0, 10, 5],
    [10, 5, 10, 17],
    [0, 10, 10, 10],
  ],
  L: [
    [0, 0, 0, 17],
    [0, 17, 10, 17],
  ],
};

function logo(out: Item[]): void {
  const text = 'TETHERFALL';
  const adv = 15;
  const W = text.length * adv + 16;
  const H = 34;
  const ox = 6;
  const oy = 6;
  const mask = new Uint8Array(W * H);
  [...text].forEach((ch, i) => {
    for (const [x0, y0, x1, y1] of LETTERS[ch]) {
      const ax = ox + i * adv + x0 + 1.5;
      const ay = oy + y0 + 1.5;
      const bx = ox + i * adv + x1 + 1.5;
      const by = oy + y1 + 1.5;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const dx = bx - ax;
          const dy = by - ay;
          const l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
          const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
          if (d <= 1.6) mask[y * W + x] = 1;
        }
      }
    }
  });
  const c = new PixelCanvas(W, H);
  // magenta offset shadow (chromatic split)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x] && x + 2 < W && y + 2 < H) c.set(x + 2, y + 2, MG[3]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      const t = (y - oy) / 20;
      const ramp = [0xf0fffe, CY[6], CY[5], CY[4], CY[3]];
      let col = ramp[Math.min(4, Math.floor(t * 4.2 + (bayer(x, y) - 0.5) * 0.6))] ?? CY[4];
      if (!mask[(y - 1) * W + x]) col = 0xffffff;
      c.set(x, y, col);
    }
  }
  // scan gaps (thin horizontal cuts through the letters)
  for (let x = 0; x < W; x++) {
    if (mask[(oy + 12) * W + x]) c.set(x, oy + 12, CY[2]);
  }
  c.outline(INK);
  out.push({ name: 'logo', c });
  // subtitle wire: a hook line under the logo
  const wire = new PixelCanvas(W, 7);
  for (let x = 0; x < W - 8; x++) wire.set(x, 3, x % 9 === 0 ? CY[6] : CY[3]);
  ['..X..', '.X.X.', 'X...X', '.X.X.', '..X..'].forEach((r, y) => [...r].forEach((ch, x) => ch === 'X' && wire.set(W - 7 + x, 1 + y, CY[6])));
  out.push({ name: 'logo_wire', c: wire });
}

export function buildUi(): Item[] {
  const out: Item[] = [];
  panels(out);
  hud(out);
  keys(out);
  logo(out);
  return out;
}
