// 16×16 tileset generator with 4-bit edge autotiling.
//
// Layout (16 columns):
//   row 0-1 : concrete, masks 0-15, variant 0/1
//   row 2   : concrete interior specials (windows, vents, cracks…)
//   row 3   : steel plate, masks 0-15
//   row 4   : glass curtain wall (not grappleable), masks 0-15
//   row 5   : one-way catwalk (0-3), electric rail hazard (4-7), back walls (8-15)
//   row 6   : back wall variants 2
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, hash2, fbm } from './pixel.ts';

export const T = 16;
const C = RAMPS.concrete;
const S = RAMPS.steel;
const TL = RAMPS.teal;

const N = 1;
const E = 2;
const Sb = 4;
const W = 8;

type Plot = (x: number, y: number, c: number) => void;

function concrete(p: Plot, mask: number, v: number): void {
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const n = fbm((x + v * 31) / 5, (y + v * 17) / 5, 7, 3);
      let c = C[2];
      if (n > 0.66) c = C[3];
      else if (n < 0.3) c = C[1];
      // faint horizontal formwork lines
      if (y === 8 && v === 1 && hash2(x, 3, v) > 0.2) c = C[1];
      if (y === 9 && v === 1 && hash2(x, 4, v) > 0.5) c = C[3];
      p(x, y, c);
    }
  }
  // pits / speckles
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(hash2(i, v, 11) * 14) + 1;
    const y = Math.floor(hash2(i, v, 12) * 12) + 3;
    p(x, y, C[1]);
    if (hash2(i, v, 13) > 0.5) p(x + 1, y, C[3]);
  }
  if (mask & N) {
    for (let x = 0; x < T; x++) {
      const neon = hash2(x, 0, v + 40) > 0.86;
      p(x, 0, neon ? RAMPS.magenta[5] : C[7]);
      p(x, 1, C[5]);
      p(x, 2, hash2(x, 2, v) > 0.5 ? C[4] : C[3]);
      p(x, 3, C[3]);
      // rain stains running down from the lip
      if (hash2(x, 9, v) > 0.72) {
        const len = 2 + Math.floor(hash2(x, 10, v) * 8);
        for (let y = 4; y < 4 + len && y < T; y++) p(x, y, C[1]);
      }
    }
  }
  if (mask & W) {
    for (let y = mask & N ? 1 : 0; y < T; y++) {
      p(0, y, C[4]);
      if (hash2(1, y, v) > 0.4) p(1, y, C[3]);
    }
  }
  if (mask & E) {
    for (let y = mask & N ? 1 : 0; y < T; y++) {
      p(15, y, C[1]);
      p(14, y, hash2(14, y, v) > 0.5 ? C[2] : C[1]);
    }
  }
  if (mask & Sb) {
    for (let x = 0; x < T; x++) {
      p(x, 15, C[0]);
      p(x, 14, C[1]);
      if (hash2(x, 14, v) > 0.7) p(x, 13, C[1]);
    }
  }
  roundCorners(p, mask);
}

function roundCorners(p: Plot, mask: number): void {
  const clear = -1;
  if (mask & N && mask & W) p(0, 0, clear);
  if (mask & N && mask & E) p(15, 0, clear);
  if (mask & Sb && mask & W) p(0, 15, clear);
  if (mask & Sb && mask & E) p(15, 15, clear);
}

function interior(p: Plot, kind: number): void {
  concrete(p, 0, kind % 2);
  const win = (lit: number[] | null) => {
    // recessed window 8×9 with sill
    for (let y = 3; y < 12; y++) for (let x = 4; x < 12; x++) p(x, y, C[0]);
    for (let x = 3; x < 13; x++) {
      p(x, 2, C[1]);
      p(x, 12, C[4]);
      p(x, 13, C[1]);
    }
    for (let y = 3; y < 12; y++) {
      p(3, y, C[1]);
      p(12, y, C[3]);
    }
    if (lit) {
      for (let y = 4; y < 11; y++) {
        for (let x = 5; x < 11; x++) {
          const t = (y - 4) / 7;
          p(x, y, t < 0.3 ? lit[2] : t < 0.7 ? lit[1] : lit[0]);
        }
      }
      // blinds
      for (let x = 5; x < 11; x++) {
        p(x, 6, lit[0]);
        p(x, 8, lit[0]);
      }
      p(7, 4, lit[3]);
    } else {
      // faint reflection
      p(10, 4, C[2]);
      p(9, 5, C[2]);
      p(8, 6, C[2]);
    }
    p(7, 3, C[1]);
    for (let y = 3; y < 12; y++) p(8, y, C[1]); // mullion
  };
  switch (kind) {
    case 0:
    case 1:
      break;
    case 2: {
      // crack
      let x = 4;
      for (let y = 2; y < 15; y++) {
        p(x, y, C[0]);
        if (hash2(y, 1, 5) > 0.6) x += hash2(y, 2, 5) > 0.5 ? 1 : -1;
        if (hash2(y, 3, 5) > 0.8) p(x + 1, y, C[3]);
      }
      break;
    }
    case 3:
      win(null);
      break;
    case 4:
      win([RAMPS.amber[1], RAMPS.amber[2], RAMPS.amber[3], RAMPS.amber[4]]);
      break;
    case 5:
      win([RAMPS.cyan[2], RAMPS.cyan[3], RAMPS.cyan[4], RAMPS.cyan[6]]);
      break;
    case 6: {
      // vent grille
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) p(x, y, (y & 1) === 0 ? C[0] : C[3]);
      for (let x = 3; x < 13; x++) p(x, 12, C[4]);
      break;
    }
    case 7: {
      // vertical pipe
      for (let y = 0; y < T; y++) {
        p(6, y, S[1]);
        p(7, y, S[3]);
        p(8, y, S[4]);
        p(9, y, S[2]);
        p(10, y, S[1]);
      }
      for (const yy of [3, 12]) for (let x = 5; x < 12; x++) p(x, yy, x === 5 ? S[1] : S[5]);
      break;
    }
    case 8:
      win([RAMPS.magenta[1], RAMPS.magenta[2], RAMPS.magenta[3], RAMPS.magenta[5]]);
      break;
    default:
      break;
  }
}

function steel(p: Plot, mask: number): void {
  const D = [S[0], S[1], S[2], S[3], S[4], S[5]];
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let c = D[1];
      if (x === 0 || y === 0) c = D[2];
      if (x === 15 || y === 15) c = D[0];
      if (y === 7) c = D[0];
      if (y === 8) c = D[2];
      p(x, y, c);
    }
  }
  // rivets
  for (const [x, y] of [
    [2, 2],
    [13, 2],
    [2, 11],
    [13, 11],
  ]) {
    p(x, y, D[4]);
    p(x + 1, y + 1, D[0]);
  }
  if (mask & N) {
    for (let x = 0; x < T; x++) {
      p(x, 0, D[5]);
      p(x, 1, D[3]);
      const stripe = (x >> 1) % 2 === 0;
      p(x, 2, stripe ? RAMPS.yellow[2] : D[0]);
      p(x, 3, stripe ? RAMPS.yellow[1] : D[0]);
    }
  }
  if (mask & W) for (let y = 1; y < T; y++) p(0, y, D[3]);
  if (mask & E) for (let y = 1; y < T; y++) p(15, y, D[0]);
  if (mask & Sb) for (let x = 0; x < T; x++) p(x, 15, D[0]);
  roundCorners(p, mask);
}

function glass(p: Plot, mask: number): void {
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const t = y / 15;
      let c = t < 0.4 ? TL[3] : t < 0.75 ? TL[2] : TL[1];
      // reflection streaks
      const d = (x + y) % 16;
      if (d === 3 || d === 4) c = TL[4];
      if (d === 9) c = TL[3];
      if ((x - y + 32) % 16 === 12 && y > 8) c = TL[2];
      p(x, y, c);
    }
  }
  // mullions
  for (let i = 0; i < T; i++) {
    p(i, 0, mask & N ? S[5] : S[2]);
    p(0, i, S[2]);
    p(15, i, S[1]);
    p(i, 15, S[1]);
  }
  if (mask & N) for (let x = 0; x < T; x++) p(x, 1, S[3]);
  // tiny cyan sign reflections
  p(11, 6, RAMPS.cyan[4]);
  p(12, 6, RAMPS.cyan[3]);
  roundCorners(p, mask);
}

function catwalk(p: Plot, part: number): void {
  // part: 0 left end, 1 middle, 2 right end, 3 single
  for (let x = 0; x < T; x++) {
    p(x, 0, S[6]);
    p(x, 1, S[4]);
    p(x, 2, x % 2 === 0 ? S[1] : S[3]);
    p(x, 3, S[3]);
    p(x, 4, S[1]);
  }
  const strut = (sx: number, dir: number) => {
    for (let i = 0; i < 7; i++) {
      p(sx + i * dir, 5 + i, S[2]);
      p(sx + i * dir + dir, 5 + i, S[1]);
    }
  };
  if (part === 0 || part === 3) {
    p(0, 0, S[5]);
    strut(2, 1);
  }
  if (part === 2 || part === 3) strut(13, -1);
  if (part === 1) {
    p(7, 5, S[2]);
    p(8, 5, S[1]);
  }
}

function rail(p: Plot, part: number): void {
  // electrified floor rail: base housing at the bottom 6px, emitters on top
  for (let y = 10; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let c = y === 10 ? S[4] : y === 15 ? S[0] : S[2];
      if (y >= 12 && y <= 13) c = ((x >> 1) + (y === 13 ? 1 : 0)) % 2 === 0 ? RAMPS.yellow[2] : S[0];
      p(x, y, c);
    }
  }
  for (const ex of [3, 11]) {
    p(ex, 9, RAMPS.cyan[5]);
    p(ex, 8, RAMPS.cyan[6]);
    p(ex + 1, 9, RAMPS.cyan[3]);
    p(ex - 1, 9, RAMPS.cyan[3]);
  }
  if (part === 0 || part === 3) for (let y = 10; y < T; y++) p(0, y, S[1]);
  if (part === 2 || part === 3) for (let y = 10; y < T; y++) p(15, y, S[1]);
}

function backwall(p: Plot, kind: number): void {
  const B = [0x0b0810, 0x110d18, 0x181322, 0x211a2e, 0x2b2238];
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const n = fbm((x + kind * 23) / 6, y / 6, 3, 2);
      p(x, y, n > 0.62 ? B[2] : n < 0.32 ? B[0] : B[1]);
    }
  }
  switch (kind % 8) {
    case 1:
      for (let x = 0; x < T; x++) {
        p(x, 7, B[0]);
        p(x, 8, B[3]);
      }
      break;
    case 2:
      for (let x = 0; x < T; x++) {
        p(x, 4, B[0]);
        p(x, 5, B[3]);
        p(x, 6, B[4]);
        p(x, 7, B[2]);
        p(x, 8, B[0]);
      }
      break;
    case 3:
      for (let y = 0; y < T; y++) {
        p(5, y, B[0]);
        p(6, y, B[3]);
        p(7, y, B[4]);
        p(8, y, B[2]);
        p(9, y, B[0]);
      }
      break;
    case 4:
      for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) p(x, y, y % 2 ? B[0] : B[3]);
      break;
    case 5:
      // dim window
      for (let y = 2; y < 13; y++) for (let x = 4; x < 12; x++) p(x, y, y < 5 ? RAMPS.violet[1] : 0x0b0814);
      for (let x = 3; x < 13; x++) p(x, 13, B[3]);
      break;
    case 6:
      // faded poster
      for (let y = 2; y < 14; y++) for (let x = 3; x < 12; x++) p(x, y, (x + y) % 5 === 0 ? RAMPS.magenta[1] : RAMPS.violet[1]);
      for (let x = 4; x < 11; x++) p(x, 4, RAMPS.magenta[2]);
      for (let x = 4; x < 9; x++) p(x, 6, RAMPS.violet[2]);
      break;
    case 7:
      // cable bundle
      for (let x = 0; x < T; x++) {
        const y = 3 + Math.round(Math.sin(x / 3) * 1.2);
        p(x, y, B[4]);
        p(x, y + 1, B[0]);
        p(x, y + 5, B[3]);
      }
      break;
    default:
      break;
  }
}

export function buildTileset(): PixelCanvas {
  const cols = 16;
  const rows = 8;
  const c = new PixelCanvas(cols * T, rows * T);
  const at = (col: number, row: number): Plot => (x, y, color) => {
    if (color < 0) c.clear(col * T + x, row * T + y);
    else c.set(col * T + x, row * T + y, color);
  };
  for (let m = 0; m < 16; m++) {
    concrete(at(m, 0), m, 0);
    concrete(at(m, 1), m, 1);
    steel(at(m, 3), m);
    glass(at(m, 4), m);
  }
  for (let k = 0; k < 9; k++) interior(at(k, 2), k);
  for (let k = 0; k < 4; k++) {
    catwalk(at(k, 5), k);
    rail(at(4 + k, 5), k);
  }
  for (let k = 0; k < 8; k++) backwall(at(8 + k, 5), k);
  for (let k = 0; k < 8; k++) backwall(at(k, 6), k + 8);
  return c;
}

/** Tile index helpers shared with the runtime (keep in sync with src/world/tiles.ts). */
export const TILE_INDEX = {
  concrete: (mask: number, variant: number) => variant * 16 + mask,
  interior: (kind: number) => 32 + kind,
  steel: (mask: number) => 48 + mask,
  glass: (mask: number) => 64 + mask,
  catwalk: (part: number) => 80 + part,
  rail: (part: number) => 84 + part,
  backwall: (kind: number) => (kind < 8 ? 88 + kind : 96 + (kind - 8)),
};
