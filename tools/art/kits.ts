// Chapter 2 material kits. Each kit redraws every slot of the tileset layout
// (solid / interior specials / plate / no-hook surface / one-way / hazard /
// back wall / crumble / phase blocks) in its own visual language, so every
// stage reads as a different place — not a palette swap.
import { RAMPS } from '../../src/art/palette.ts';
import { fbm, hash2 } from './pixel.ts';
import { roundCorners, type Plot, type TileKit } from './tiles.ts';

const T = 16;
const N = 1;
const E = 2;
const S = 4;
const W = 8;

const I = RAMPS.ice;
const ST = RAMPS.steel;
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
const YE = RAMPS.yellow;
const AC = RAMPS.acid;

function each(fn: (x: number, y: number) => void): void {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) fn(x, y);
}
function rect(p: Plot, x0: number, y0: number, x1: number, y1: number, c: number, a = 255): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p(x, y, c, a);
}
function circle(p: Plot, cx: number, cy: number, r: number, c: number, ring = false): void {
  each((x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (ring ? d <= r && d > r - 1.2 : d <= r) p(x, y, c);
  });
}
/** Generic bevel: light top/left, dark bottom/right. */
function bevel(p: Plot, mask: number, top: number[], left: number, right: number, bottom: number): void {
  if (mask & N) top.forEach((c, i) => {
    for (let x = 0; x < T; x++) p(x, i, c);
  });
  const y0 = mask & N ? top.length : 0;
  if (mask & W) for (let y = y0; y < T; y++) p(0, y, left);
  if (mask & E) for (let y = y0; y < T; y++) p(15, y, right);
  if (mask & S) for (let x = 0; x < T; x++) p(x, 15, bottom);
}
/** End strut for one-way platforms (part: 0 left, 1 mid, 2 right, 3 single). */
function struts(p: Plot, part: number, a: number, b: number): void {
  const strut = (sx: number, dir: number) => {
    for (let i = 0; i < 6; i++) {
      p(sx + i * dir, 5 + i, a);
      p(sx + i * dir + dir, 5 + i, b);
    }
  };
  if (part === 0 || part === 3) strut(2, 1);
  if (part === 2 || part === 3) strut(13, -1);
}

// =============================================================================
// ARCHIVE — frozen server halls (stage 5)
// =============================================================================

function archiveSolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    let c = I[1];
    if (x === 1 || x === 14) c = I[3];
    else if (x === 2 || x === 13) c = I[0];
    else if (y % 4 === 0) c = I[0];
    else if (y % 4 === 1) c = I[2];
    p(x, y, c);
  });
  // rack units: drive bays + status LEDs
  for (let u = 0; u < 4; u++) {
    const yy = u * 4 + 2;
    if (hash2(u, v, 3) > 0.35) for (let x = 4; x < 9; x++) p(x, yy, I[3]);
    for (let x = 10; x < 13; x += 2) {
      const h = hash2(x, u + v * 7, 5);
      if (h > 0.55) p(x, yy, h > 0.9 ? AM[3] : h > 0.75 ? AC[4] : CY[5]);
    }
  }
  if (mask & N) {
    for (let x = 0; x < T; x++) {
      p(x, 0, I[9]);
      p(x, 1, hash2(x, 1, v) > 0.4 ? I[8] : I[7]);
      p(x, 2, I[5]);
      if (hash2(x, 3, v) > 0.7) p(x, 3, I[6]);
    }
  }
  if (mask & W) for (let y = mask & N ? 2 : 0; y < T; y++) p(0, y, I[5]);
  if (mask & E) for (let y = mask & N ? 2 : 0; y < T; y++) p(15, y, I[0]);
  if (mask & S) {
    for (let x = 0; x < T; x++) p(x, 15, I[0]);
    // icicles hanging under the rack
    for (let x = 1; x < 15; x++) {
      const h = hash2(x, 9, v);
      if (h > 0.7) {
        p(x, 13, I[7]);
        p(x, 14, I[8]);
        p(x, 15, h > 0.86 ? I[9] : I[6]);
      }
    }
  }
  roundCorners(p, mask);
}

function archiveInterior(p: Plot, k: number): void {
  archiveSolid(p, 0, k % 2);
  switch (k) {
    case 2: // big LED status matrix
      rect(p, 3, 3, 12, 10, I[0]);
      for (let y = 4; y < 10; y += 2) for (let x = 4; x < 12; x += 2) {
        const h = hash2(x, y, 41);
        p(x, y, h > 0.8 ? AM[3] : h > 0.45 ? CY[5] : h > 0.3 ? AC[4] : I[2]);
      }
      break;
    case 3: // fan grille
      circle(p, 8, 8, 6, I[0]);
      circle(p, 8, 8, 6, I[4], true);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        for (let r = 1; r < 5; r++) p(Math.round(8 + Math.cos(a) * r), Math.round(8 + Math.sin(a) * r), I[3]);
      }
      p(8, 8, I[6]);
      break;
    case 4: // terminal screen
      rect(p, 2, 3, 13, 11, CY[1]);
      for (let y = 4; y < 11; y += 2) {
        const len = 3 + Math.floor(hash2(y, 2, 44) * 7);
        for (let x = 3; x < 3 + len; x++) p(x, y, CY[4]);
      }
      p(3 + Math.floor(hash2(1, 1, 44) * 6), 10, CY[6]);
      rect(p, 2, 12, 13, 12, I[4]);
      break;
    case 5: // open bay of drive sleds
      rect(p, 3, 3, 12, 12, I[0]);
      for (let x = 3; x < 13; x += 2) {
        rect(p, x, 4, x, 11, I[3]);
        p(x, 4, hash2(x, 5, 45) > 0.5 ? AC[4] : CY[5]);
      }
      break;
    case 6: // cold-air slats
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) p(x, y, y % 2 ? I[4] : I[0]);
      for (let x = 3; x < 13; x++) if (hash2(x, 7, 46) > 0.6) p(x, 12, I[8]);
      break;
    case 7: // coolant line with frost collars
      for (let y = 0; y < T; y++) {
        p(6, y, I[2]);
        p(7, y, I[5]);
        p(8, y, I[7]);
        p(9, y, I[4]);
        p(10, y, I[2]);
      }
      for (const yy of [4, 12]) for (let x = 5; x < 12; x++) p(x, yy, I[8]);
      break;
    case 8: // red fault lamp
      rect(p, 5, 5, 10, 10, I[0]);
      circle(p, 8, 8, 2.6, CR[4]);
      p(7, 7, CR[6]);
      break;
    default:
      break;
  }
}

function archivePlate(p: Plot, mask: number): void {
  // raised data-centre floor panel, perforated
  each((x, y) => {
    let c = ST[3];
    if (x % 3 === 1 && y % 3 === 1) c = ST[1];
    if (x === 0 || y === 0) c = ST[4];
    if (x === 15 || y === 15) c = ST[1];
    p(x, y, c);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, ST[6]);
    p(x, 1, (x >> 1) % 3 === 0 ? CY[4] : ST[4]);
  }
  bevel(p, mask & ~N, [], ST[5], ST[0], ST[0]);
  roundCorners(p, mask);
}

function archiveGlass(p: Plot, mask: number): void {
  // cryo glass, frosted over
  each((x, y) => {
    const n = fbm(x / 4, y / 4, 61, 2);
    p(x, y, n > 0.6 ? I[6] : n > 0.4 ? I[5] : I[4]);
  });
  for (let i = 0; i < 5; i++) {
    let x = Math.floor(hash2(i, 0, 62) * 14) + 1;
    let y = Math.floor(hash2(i, 1, 62) * 14) + 1;
    for (let s = 0; s < 4; s++) {
      p(x, y, s === 0 ? I[9] : I[8]);
      x += hash2(i, s, 63) > 0.5 ? 1 : -1;
      y += 1;
    }
  }
  for (let i = 0; i < T; i++) {
    p(i, 0, mask & N ? I[9] : ST[2]);
    p(0, i, ST[2]);
    p(15, i, ST[1]);
    p(i, 15, ST[1]);
  }
  roundCorners(p, mask);
}

function archiveCatwalk(p: Plot, part: number): void {
  // cable tray
  for (let x = 0; x < T; x++) {
    p(x, 0, ST[6]);
    p(x, 1, ST[4]);
    p(x, 2, x % 2 ? ST[2] : ST[0]);
    p(x, 3, CY[3]);
    p(x, 4, Math.sin(x * 0.7) > 0 ? AM[2] : MG[3]);
    p(x, 5, ST[2]);
  }
  struts(p, part, ST[2], ST[1]);
}

function archiveRail(p: Plot, part: number): void {
  // cryo spikes
  for (let x = 0; x < T; x++) for (let y = 12; y < T; y++) p(x, y, y === 12 ? I[5] : I[2]);
  for (let s = 0; s < 4; s++) {
    const bx = s * 4;
    for (let y = 4; y < 12; y++) {
      const w = Math.floor(((y - 4) / 8) * 2);
      for (let x = bx + 2 - w - 1; x <= bx + 1 + w; x++) {
        if (x < 0 || x > 15) continue;
        p(x, y, x <= bx ? I[8] : x === bx + 1 ? I[6] : I[4]);
      }
    }
    p(bx + 1, 4, I[9]);
  }
  if (part === 0 || part === 3) for (let y = 12; y < T; y++) p(0, y, I[1]);
  if (part === 2 || part === 3) for (let y = 12; y < T; y++) p(15, y, I[1]);
}

function archiveBackwall(p: Plot, kind: number): void {
  const B = [0x050912, 0x08101c, 0x0c1726, 0x122034];
  each((x, y) => p(x, y, y % 4 === 0 ? B[0] : x === 2 || x === 13 ? B[2] : B[1]));
  switch (kind % 8) {
    case 1:
    case 2:
      for (let y = 2; y < T; y += 4) if (hash2(kind, y, 70) > 0.4) p(4 + ((kind * 3 + y) % 8), y, kind % 2 ? CY[3] : AC[2]);
      break;
    case 3:
      for (let y = 0; y < T; y++) {
        p(6, y, B[3]);
        p(9, y, B[2]);
      }
      break;
    case 4: // cold aisle door strip
      for (let y = 0; y < T; y++) p(7, y, CY[2]);
      for (let y = 0; y < T; y++) p(8, y, CY[1]);
      break;
    case 5:
      rect(p, 4, 3, 11, 10, B[0]);
      for (let x = 5; x < 11; x++) p(x, 5, I[2]);
      break;
    case 6: // hanging cables
      for (let x = 3; x < 13; x += 3) for (let y = 0; y < T; y++) p(x + (y > 10 ? 1 : 0), y, B[3]);
      break;
    case 7:
      for (let x = 0; x < T; x++) p(x, 8, B[3]);
      break;
    default:
      break;
  }
}

function archiveCrumble(p: Plot, frame: number): void {
  each((x, y) => {
    const n = fbm(x / 5, y / 5, 80, 2);
    let c = n > 0.55 ? I[7] : I[6];
    if (x === 0 || y === 0) c = I[8];
    if (x === 15 || y === 15) c = I[4];
    if ((x + y) % 7 === 0) c = I[8];
    p(x, y, c);
  });
  const n = frame ? 7 : 3;
  for (let i = 0; i < n; i++) {
    let x = 2 + Math.floor(hash2(i, frame, 81) * 12);
    for (let y = 2; y < 14; y++) {
      p(x, y, I[2]);
      if (hash2(x, y, i) > 0.6) x += hash2(y, x, i) > 0.5 ? 1 : -1;
      x = Math.max(1, Math.min(14, x));
    }
  }
}

export const ARCHIVE_KIT: TileKit = {
  solid: archiveSolid,
  interior: archiveInterior,
  plate: archivePlate,
  glass: archiveGlass,
  catwalk: archiveCatwalk,
  rail: archiveRail,
  backwall: archiveBackwall,
  crumble: archiveCrumble,
};

// =============================================================================
// REFINERY — riveted iron, lethe vats (stage 6)
// =============================================================================

function refinerySolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    const n = fbm((x + v * 13) / 4, y / 6, 90, 3);
    let c = n > 0.62 ? OX[3] : n < 0.35 ? OX[1] : OX[2];
    if (x === 7 || y === 7) c = OX[0];
    if (x === 8 || y === 8) c = OX[3];
    p(x, y, c);
  });
  for (const [x, y] of [
    [5, 5],
    [10, 5],
    [5, 10],
    [10, 10],
  ]) {
    p(x, y, OX[5]);
    p(x, y + 1, OX[0]);
  }
  // rust streaks
  for (let x = 1; x < 15; x++) {
    if (hash2(x, 3, v + 91) > 0.82) {
      const len = 3 + Math.floor(hash2(x, 4, v) * 9);
      for (let y = 2; y < 2 + len && y < T; y++) p(x, y, OX[4]);
    }
  }
  if (mask & N) {
    for (let x = 0; x < T; x++) {
      const stripe = ((x + v * 2) >> 1) % 2 === 0;
      const chipped = hash2(x, 0, v + 92) > 0.85;
      p(x, 0, OX[6]);
      p(x, 1, chipped ? OX[2] : stripe ? YE[3] : 0x140806);
      p(x, 2, chipped ? OX[1] : stripe ? YE[2] : 0x140806);
      p(x, 3, OX[0]);
    }
  }
  bevel(p, mask & ~N, [], OX[4], OX[0], 0x0a0404);
  roundCorners(p, mask);
}

function refineryInterior(p: Plot, k: number): void {
  refinerySolid(p, 0, k % 2);
  switch (k) {
    case 2: // pressure gauge
      circle(p, 8, 8, 5, ST[1]);
      circle(p, 8, 8, 4.2, MA[4]);
      for (let r = 0; r < 4; r++) p(8 + r, 8 - r, CR[4]);
      p(8, 8, ST[0]);
      break;
    case 3: // valve wheel
      circle(p, 8, 8, 5, CR[3], true);
      for (let i = 0; i < 4; i++) for (let r = 0; r < 5; r++) p(Math.round(8 + Math.cos(i * 1.57 + 0.78) * r), Math.round(8 + Math.sin(i * 1.57 + 0.78) * r), CR[2]);
      p(8, 8, CR[5]);
      break;
    case 4: // lethe sight glass
      rect(p, 3, 3, 12, 12, ST[1]);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) p(x, y, y < 6 ? 0x1a0814 : y === 6 ? MG[6] : y < 9 ? MG[4] : MG[3]);
      p(6, 9, MG[6]);
      p(9, 8, MG[7]);
      break;
    case 5: // warning triangle
      for (let y = 4; y < 12; y++) {
        const w = Math.floor((y - 4) / 2);
        for (let x = 8 - w - 1; x <= 7 + w + 1; x++) p(x, y, YE[3]);
      }
      p(7, 6, 0x140806);
      p(8, 6, 0x140806);
      for (let y = 7; y < 9; y++) p(7, y, 0x140806);
      p(7, 10, 0x140806);
      break;
    case 6: // glowing furnace grate
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) p(x, y, x % 3 === 0 ? OX[0] : y > 8 ? AM[3] : y > 6 ? AM[2] : OX[4]);
      break;
    case 7: // copper pipe with flanges
      for (let y = 0; y < T; y++) {
        p(5, y, OX[2]);
        p(6, y, OX[5]);
        p(7, y, OX[7]);
        p(8, y, OX[6]);
        p(9, y, OX[4]);
        p(10, y, OX[2]);
      }
      for (const yy of [2, 11]) for (let x = 4; x < 12; x++) p(x, yy, x === 4 ? OX[2] : OX[6]);
      break;
    case 8: // stencilled block
      rect(p, 3, 4, 12, 11, OX[1]);
      rect(p, 4, 5, 5, 10, OX[5]);
      rect(p, 4, 10, 7, 10, OX[5]);
      rect(p, 8, 5, 11, 5, OX[5]);
      rect(p, 9, 5, 10, 10, OX[5]);
      break;
    default:
      break;
  }
}

function refineryPlate(p: Plot, mask: number): void {
  // diamond tread plate
  each((x, y) => {
    let c = ST[2];
    const ox = (Math.floor(y / 4) % 2) * 2;
    const cx = (x + ox) % 4;
    const cy = y % 4;
    if (cx === 1 && cy === 1) c = ST[4];
    if (cx === 2 && cy === 2) c = ST[0];
    p(x, y, c);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, ST[5]);
    p(x, 1, hash2(x, 1, 95) > 0.7 ? OX[3] : ST[3]);
  }
  bevel(p, mask & ~N, [], ST[3], ST[0], ST[0]);
  roundCorners(p, mask);
}

function refineryGlass(p: Plot, mask: number): void {
  // vat wall: thick glass, lethe fluid inside
  each((x, y) => {
    const t = y / 15;
    let c = t < 0.3 ? MG[4] : t < 0.7 ? MG[3] : MG[2];
    if ((x + y * 2) % 13 === 0) c = MG[5];
    p(x, y, c);
  });
  for (let i = 0; i < 4; i++) {
    const bx = 2 + Math.floor(hash2(i, 0, 97) * 12);
    const by = 3 + Math.floor(hash2(i, 1, 97) * 11);
    p(bx, by, MG[6]);
    if (i % 2) p(bx + 1, by, MG[7]);
  }
  for (let y = 1; y < 6; y++) p(3 + y, y + 2, MG[6]);
  for (let i = 0; i < T; i++) {
    p(0, i, ST[3]);
    p(15, i, ST[1]);
    if (mask & N) p(i, 0, ST[4]);
    if (mask & S) p(i, 15, ST[1]);
  }
  roundCorners(p, mask);
}

function refineryCatwalk(p: Plot, part: number): void {
  for (let x = 0; x < T; x++) {
    p(x, 0, OX[7]);
    p(x, 1, OX[5]);
    p(x, 2, x % 2 ? ST[2] : 0x0a0404);
    p(x, 3, x % 2 ? 0x0a0404 : ST[2]);
    p(x, 4, OX[3]);
  }
  struts(p, part, OX[3], OX[1]);
}

function refineryRail(p: Plot, part: number): void {
  // pool of raw lethe fluid
  for (let x = 0; x < T; x++) {
    const sy = 8 + Math.round(Math.sin(x * 0.9) * 0.8);
    for (let y = sy; y < T; y++) {
      const d = y - sy;
      p(x, y, d === 0 ? MG[7] : d === 1 ? MG[5] : d < 4 ? MG[4] : MG[3]);
    }
  }
  for (const [x, y] of [
    [3, 11],
    [10, 13],
    [7, 12],
  ])
    p(x, y, MG[6]);
  p(5, 6, MG[5]);
  p(12, 7, MG[6]);
  if (part === 0 || part === 3) for (let y = 8; y < T; y++) p(0, y, ST[2]);
  if (part === 2 || part === 3) for (let y = 8; y < T; y++) p(15, y, ST[2]);
}

function refineryBackwall(p: Plot, kind: number): void {
  const B = [0x0a0505, 0x120807, 0x1c0e0a, 0x2a160e];
  each((x, y) => p(x, y, fbm((x + kind * 9) / 6, y / 6, 99, 2) > 0.58 ? B[2] : B[1]));
  switch (kind % 8) {
    case 1: // duct
      for (let y = 0; y < T; y++) for (let x = 4; x < 12; x++) p(x, y, x < 6 ? B[3] : x > 9 ? B[0] : B[2]);
      for (let x = 4; x < 12; x++) p(x, 7, B[0]);
      break;
    case 2: // horizontal pipes
      for (let x = 0; x < T; x++) {
        p(x, 4, B[3]);
        p(x, 5, B[2]);
        p(x, 10, OX[2]);
        p(x, 11, OX[1]);
      }
      break;
    case 3: // chain
      for (let y = 0; y < T; y++) p(7 + (y % 4 < 2 ? 0 : 1), y, y % 4 === 0 ? B[0] : B[3]);
      break;
    case 4: // dim lethe glow
      rect(p, 5, 4, 10, 11, B[0]);
      rect(p, 6, 8, 9, 11, MG[2]);
      p(7, 9, MG[3]);
      break;
    case 5: // column segment
      for (let y = 0; y < T; y++) for (let x = 3; x < 13; x++) p(x, y, x < 5 ? B[3] : x > 10 ? B[0] : B[2]);
      break;
    case 6:
      for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) p(x, y, (x + y) % 2 ? B[0] : B[3]);
      break;
    case 7:
      for (let x = 0; x < T; x++) if (x % 4 === 0) for (let y = 0; y < T; y++) p(x, y, B[0]);
      break;
    default:
      break;
  }
}

function refineryCrumble(p: Plot, frame: number): void {
  each((x, y) => {
    let c = (x + y) % 3 === 0 ? OX[2] : OX[3];
    if (x === 0 || y === 0) c = OX[5];
    if (x === 15 || y === 15) c = OX[1];
    p(x, y, c);
  });
  // corrosion holes eaten through the panel
  const holes = frame ? 6 : 3;
  for (let i = 0; i < holes; i++) {
    const hx = 2 + Math.floor(hash2(i, frame, 101) * 11);
    const hy = 3 + Math.floor(hash2(i, 9, 101) * 10);
    const r = 1 + (hash2(i, 3, 101) > 0.5 ? 1 : 0);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) p(hx + x, hy + y, -1);
    p(hx - r - 1, hy, OX[5]);
  }
}

export const REFINERY_KIT: TileKit = {
  solid: refinerySolid,
  interior: refineryInterior,
  plate: refineryPlate,
  glass: refineryGlass,
  catwalk: refineryCatwalk,
  rail: refineryRail,
  backwall: refineryBackwall,
  crumble: refineryCrumble,
};

// =============================================================================
// CORE — obsidian monoliths with gold circuitry (stage 7)
// =============================================================================

function coreSolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    let c = NI[1];
    // faint hex lattice
    const hx = (x + (Math.floor(y / 4) % 2) * 2) % 4;
    if (y % 4 === 0 && hx < 2) c = NI[2];
    if (hx === 0 && y % 4 !== 0) c = (y + v) % 3 === 0 ? NI[2] : c;
    p(x, y, c);
  });
  // short gold circuit trace (only on some tiles, placed per edge mask)
  if (v === 1 || hash2(mask, v, 112) > 0.6) {
    let x = 3 + Math.floor(hash2(mask, v, 110) * 8);
    let y = 5 + Math.floor(hash2(mask, 2, 110) * 5);
    p(x, y, GO[5]);
    const horiz = hash2(mask, v, 113) > 0.5;
    for (let s = 0; s < 5; s++) {
      if (horiz ? s < 3 : s >= 3) x += 1;
      else y += 1;
      p(x, y, GO[3]);
    }
    p(x, y, GO[4]);
  }
  if (mask & N) for (let x2 = 0; x2 < T; x2++) {
    p(x2, 0, GO[6]);
    p(x2, 1, GO[4]);
    p(x2, 2, VI[3]);
    p(x2, 3, NI[3]);
  }
  bevel(p, mask & ~N, [], NI[3], NI[0], 0x05040a);
  roundCorners(p, mask);
}

function coreInterior(p: Plot, k: number): void {
  coreSolid(p, 0, k % 2);
  switch (k) {
    case 2: // glyph ring
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        p(Math.round(8 + Math.cos(a) * 5), Math.round(8 + Math.sin(a) * 5), i % 3 ? GO[3] : GO[5]);
      }
      p(8, 8, GO[6]);
      break;
    case 3: // circuit node cluster
      for (const [nx, ny] of [
        [4, 4],
        [11, 5],
        [6, 11],
      ]) {
        rect(p, nx - 1, ny - 1, nx + 1, ny + 1, GO[2]);
        p(nx, ny, GO[5]);
      }
      for (let i = 4; i < 12; i++) p(i, 5, GO[2]);
      break;
    case 4: // violet energy window
      rect(p, 4, 4, 11, 11, NI[0]);
      circle(p, 8, 8, 3.2, VI[3]);
      circle(p, 8, 8, 1.8, VI[5]);
      break;
    case 5: // hex cell with cyan light
      for (let y = 4; y < 12; y++) {
        const w = 4 - Math.floor(Math.abs(y - 7.5) / 2);
        for (let x = 8 - w; x < 8 + w; x++) p(x, y, CY[2]);
      }
      p(7, 7, CY[5]);
      p(8, 8, CY[4]);
      break;
    case 6: // port slots
      for (let y = 4; y < 12; y += 3) rect(p, 3, y, 12, y, NI[0]);
      break;
    case 7: // energy conduit
      for (let y = 0; y < T; y++) {
        p(6, y, VI[1]);
        p(7, y, VI[3]);
        p(8, y, VI[4]);
        p(9, y, VI[2]);
      }
      for (const yy of [3, 11]) for (let x2 = 5; x2 < 11; x2++) p(x2, yy, GO[4]);
      break;
    case 8: // gold emblem
      circle(p, 8, 8, 5, GO[3], true);
      circle(p, 8, 8, 2.5, GO[5], true);
      break;
    default:
      break;
  }
}

function corePlate(p: Plot, mask: number): void {
  // maglev plate with energy bars
  each((x, y) => {
    let c = NI[2];
    if (y === 5 || y === 10) c = VI[4];
    if (y === 6 || y === 11) c = VI[2];
    if ((y === 5 || y === 10) && x % 4 === 0) c = VI[5];
    if (x === 0) c = NI[3];
    if (x === 15) c = NI[1];
    p(x, y, c);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, 0xf5f3ff);
    p(x, 1, VI[3]);
  }
  if (mask & S) for (let x = 0; x < T; x++) p(x, 15, NI[0]);
  roundCorners(p, mask);
}

function coreGlass(p: Plot, mask: number): void {
  // translucent force field (hex lattice)
  each((x, y) => {
    const hx = (x + (Math.floor(y / 5) % 2) * 3) % 6;
    const line = y % 5 === 0 || hx === 0;
    p(x, y, line ? VI[4] : VI[2], line ? 210 : 110);
  });
  for (let i = 0; i < T; i++) {
    if (mask & N) p(i, 0, VI[5]);
    if (mask & S) p(i, 15, VI[5]);
    if (mask & W) p(0, i, VI[5]);
    if (mask & E) p(15, i, VI[5]);
  }
}

function coreCatwalk(p: Plot, part: number): void {
  // hard-light bar
  for (let x = 0; x < T; x++) {
    p(x, 0, 0xf5f3ff);
    p(x, 1, VI[5], 230);
    p(x, 2, VI[4], 170);
    p(x, 3, VI[3], 90);
  }
  if (part === 0 || part === 3) rect(p, 0, 0, 1, 4, GO[4]);
  if (part === 2 || part === 3) rect(p, 14, 0, 15, 4, GO[4]);
}

function coreRail(p: Plot, part: number): void {
  // plasma field emitters
  for (let x = 0; x < T; x++) for (let y = 12; y < T; y++) p(x, y, y === 12 ? GO[4] : NI[2]);
  for (const ex of [3, 12]) {
    p(ex, 11, VI[5]);
    p(ex, 10, 0xf5f3ff);
  }
  let y = 8;
  for (let x = 3; x <= 12; x++) {
    y = Math.max(5, Math.min(10, y + (hash2(x, 0, 120) > 0.5 ? 1 : -1)));
    p(x, y, VI[5]);
    if (x % 3 === 0) p(x, y - 1, 0xf5f3ff);
  }
  y = 7;
  for (let x = 3; x <= 12; x++) {
    y = Math.max(4, Math.min(10, y + (hash2(x, 3, 121) > 0.5 ? 1 : -1)));
    p(x, y, VI[4]);
  }
  if (part === 0 || part === 3) for (let yy = 12; yy < T; yy++) p(0, yy, NI[3]);
  if (part === 2 || part === 3) for (let yy = 12; yy < T; yy++) p(15, yy, NI[3]);
}

function coreBackwall(p: Plot, kind: number): void {
  const B = [0x05040a, 0x0a0816, 0x110d22, 0x1a1430];
  each((x, y) => p(x, y, x === 0 || y === 0 ? B[2] : B[1]));
  switch (kind % 8) {
    case 1:
      p(4 + (kind % 7), 6, GO[2]);
      break;
    case 2:
      for (let x = 0; x < T; x++) p(x, 8, B[3]);
      break;
    case 3:
      for (let y = 0; y < T; y++) p(8, y, B[3]);
      p(8, 8, VI[3]);
      break;
    case 4:
      circle(p, 8, 8, 4, B[3], true);
      break;
    case 5:
      rect(p, 4, 4, 11, 11, B[0]);
      p(7, 7, VI[2]);
      break;
    case 6:
      for (let i = 0; i < 3; i++) p(3 + i * 4, 3 + i * 4, B[3]);
      break;
    default:
      break;
  }
}

function coreCrumble(p: Plot, frame: number): void {
  each((x, y) => {
    let c = NI[2];
    if (x === 0 || y === 0) c = NI[4];
    if (x === 15 || y === 15) c = NI[0];
    p(x, y, c);
  });
  const n = frame ? 6 : 3;
  for (let i = 0; i < n; i++) {
    let x = 2 + Math.floor(hash2(i, frame, 130) * 12);
    for (let y = 1; y < 15; y++) {
      p(x, y, VI[4]);
      p(x + 1, y, VI[2]);
      if (hash2(x, y, i + 3) > 0.6) x += hash2(y, x, i) > 0.5 ? 1 : -1;
      x = Math.max(1, Math.min(13, x));
    }
  }
}

export const CORE_KIT: TileKit = {
  solid: coreSolid,
  interior: coreInterior,
  plate: corePlate,
  glass: coreGlass,
  catwalk: coreCatwalk,
  rail: coreRail,
  backwall: coreBackwall,
  crumble: coreCrumble,
};

// =============================================================================
// MEMORY — a reconstructed city: wireframe voxels and glitches (stage 8)
// =============================================================================

function memorySolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    let c = MO[1];
    if (y % 2 === 1 && (x + y) % 4 === 1) c = MO[0]; // scanline dither
    if (x % 8 === 0 || y % 8 === 0) c = MO[4];
    p(x, y, c);
  });
  // glitch: chromatic offset streaks
  for (let i = 0; i < 2; i++) {
    const h = hash2(i, v, 140);
    if (h > 0.55) {
      const gy = 2 + Math.floor(hash2(i, v, 141) * 12);
      const gx = Math.floor(hash2(i, v, 142) * 10);
      const col = h > 0.8 ? MG[5] : CY[5];
      for (let x = gx; x < gx + 4; x++) p(x, gy, col);
    }
  }
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, MO[9]);
    p(x, 1, MO[6]);
  }
  bevel(p, mask & ~N, [], MO[6], MO[2], MO[0]);
}

function memoryInterior(p: Plot, k: number): void {
  memorySolid(p, 0, k % 2);
  switch (k) {
    case 2: // unloaded hole
      for (let y = 4; y < 11; y++) for (let x = 4; x < 11; x++) p(x, y, -1);
      for (let i = 4; i < 11; i++) {
        p(i, 3, CY[4]);
        p(i, 11, CY[4]);
        p(3, i, CY[4]);
        p(11, i, CY[4]);
      }
      break;
    case 3: // shifted band
      for (let y = 6; y < 10; y++) for (let x = 0; x < T; x++) p(x, y, (x + 3) % 8 === 0 ? MG[4] : MO[2]);
      break;
    case 4: // frozen grey window
      rect(p, 4, 3, 11, 11, MO[0]);
      rect(p, 5, 4, 10, 10, MO[7]);
      rect(p, 5, 4, 10, 5, MO[8]);
      break;
    case 5: // cyan window
      rect(p, 4, 3, 11, 11, MO[0]);
      rect(p, 5, 4, 10, 10, CY[3]);
      rect(p, 5, 4, 10, 5, CY[5]);
      break;
    case 6: // static patch
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) p(x, y, MO[Math.floor(hash2(x, y, 143) * 9)]);
      break;
    case 7: // data column
      for (let y = 0; y < T; y++) {
        p(7, y, MO[0]);
        p(8, y, MO[0]);
        if (hash2(y, 0, 144) > 0.6) p(7 + (y % 2), y, CY[4]);
      }
      break;
    case 8: // dark window with a single lit pixel
      rect(p, 4, 3, 11, 11, MO[0]);
      p(9, 5, MO[9]);
      break;
    default:
      break;
  }
}

function memoryPlate(p: Plot, mask: number): void {
  each((x, y) => p(x, y, (x % 4 === 0 && y % 4 === 0) || (x % 4 === 2 && y % 4 === 2) ? MO[6] : MO[3]));
  if (mask & N) for (let x = 0; x < T; x++) p(x, 0, MO[8]);
  bevel(p, mask & ~N, [], MO[5], MO[1], MO[1]);
}

function memoryGlass(p: Plot, mask: number): void {
  // never-rendered block: dotted outline only
  for (let i = 0; i < T; i += 2) {
    if (mask & N) p(i, 0, MO[6]);
    if (mask & S) p(i, 15, MO[6]);
    if (mask & W) p(0, i, MO[6]);
    if (mask & E) p(15, i, MO[6]);
  }
  for (let i = 0; i < 4; i++) p(2 + Math.floor(hash2(i, mask, 150) * 12), 2 + Math.floor(hash2(i, 1, 150) * 12), MO[4]);
}

function memoryCatwalk(p: Plot, part: number): void {
  for (let x = 0; x < T; x++) {
    p(x, 0, MO[9]);
    p(x, 1, MO[5]);
  }
  for (let x = 1; x < T; x += 4) for (let y = 3; y < 9; y += 2) p(x, y, MO[3]);
  if (part === 0 || part === 3) p(0, 0, CY[5]);
  if (part === 2 || part === 3) p(15, 0, CY[5]);
}

function memoryRail(p: Plot, part: number): void {
  // corruption static
  for (let x = 0; x < T; x++) {
    const top = 6 + Math.floor(hash2(x, 0, 160) * 3);
    for (let y = top; y < T; y++) {
      const h = hash2(x, y, 161);
      p(x, y, h > 0.94 ? MG[5] : h > 0.88 ? CY[5] : MO[Math.floor(h * 10) % 10]);
    }
  }
  void part;
}

function memoryBackwall(p: Plot, kind: number): void {
  each((x, y) => p(x, y, x % 8 === 0 || y % 8 === 0 ? MO[2] : MO[1]));
  if (kind % 4 === 1) p(4 + (kind % 8), 5, CY[3]);
  if (kind % 4 === 2) rect(p, 4, 4, 11, 11, MO[0]);
  if (kind % 4 === 3) for (let x = 0; x < T; x++) p(x, 12, MO[3]);
}

function memoryCrumble(p: Plot, frame: number): void {
  memorySolid(p, 15, 0);
  // dissolving into pixels
  each((x, y) => {
    if (hash2(x, y, 170) < (frame ? 0.35 : 0.12)) p(x, y, -1);
  });
}

function memoryExtra(p: Plot, k: number): void {
  // phase blocks: 0 cyan solid, 1 cyan ghost, 2 magenta solid, 3 magenta ghost
  const R = k < 2 ? CY : MG;
  const solid = k % 2 === 0;
  if (k > 3) return;
  if (solid) {
    each((x, y) => {
      let c = R[2];
      if (x === 0 || y === 0) c = R[5];
      else if (x === 15 || y === 15) c = R[1];
      else if ((x + y) % 6 === 0) c = R[3];
      p(x, y, c);
    });
    rect(p, 6, 6, 9, 9, R[4]);
    rect(p, 7, 7, 8, 8, R[6]);
  } else {
    for (let i = 0; i < T; i += 3) {
      p(i, 0, R[3]);
      p(i, 15, R[3]);
      p(0, i, R[3]);
      p(15, i, R[3]);
    }
    p(7, 7, R[2]);
    p(8, 8, R[2]);
  }
}

export const MEMORY_KIT: TileKit = {
  solid: memorySolid,
  interior: memoryInterior,
  plate: memoryPlate,
  glass: memoryGlass,
  catwalk: memoryCatwalk,
  rail: memoryRail,
  backwall: memoryBackwall,
  crumble: memoryCrumble,
  extra: memoryExtra,
};

// =============================================================================
// GARDEN — marble, moss and gold (stage 9)
// =============================================================================

function gardenSolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    const n = fbm((x + v * 21) / 7, y / 7, 180, 3);
    let c = n > 0.62 ? MA[4] : MA[3];
    const vein = Math.abs(fbm((x + y * 0.6 + v * 9) / 5, y / 9, 181, 2) - 0.5);
    if (vein < 0.025) c = MA[1];
    else if (vein < 0.05) c = MA[2];
    p(x, y, c);
  });
  if (mask & N) {
    for (let x = 0; x < T; x++) {
      const depth = 2 + Math.floor(hash2(x, 0, v + 182) * 3);
      for (let y = 0; y < depth; y++) p(x, y, y === 0 ? JA[6] : y === 1 ? JA[5] : JA[3]);
      const f = hash2(x, 1, v + 183);
      if (f > 0.88) p(x, 0, f > 0.95 ? MG[6] : CY[6]);
      else if (f > 0.8) p(x, 0, 0xf5f3ff);
    }
  }
  if (mask & W) for (let y = mask & N ? 3 : 0; y < T; y++) p(0, y, MA[5]);
  if (mask & E) for (let y = mask & N ? 3 : 0; y < T; y++) p(15, y, MA[2]);
  if (mask & S) for (let x = 0; x < T; x++) {
    p(x, 15, MA[1]);
    p(x, 14, GO[4]);
  }
  roundCorners(p, mask);
}

function gardenInterior(p: Plot, k: number): void {
  gardenSolid(p, 0, k % 2);
  switch (k) {
    case 2: // carved rosette
      circle(p, 8, 8, 5, MA[2], true);
      circle(p, 8, 8, 2.5, MA[3], true);
      p(8, 8, GO[4]);
      break;
    case 3: // ivy
      for (let y = 0; y < T; y++) {
        const x = 7 + Math.round(Math.sin(y * 0.8) * 2);
        p(x, y, JA[3]);
        if (y % 3 === 0) {
          p(x + 1, y, JA[5]);
          p(x + 2, y, JA[4]);
        }
        if (y % 3 === 1) p(x - 1, y, JA[5]);
      }
      break;
    case 4: // inset lantern
      rect(p, 5, 3, 10, 12, MA[1]);
      rect(p, 6, 5, 9, 11, GO[4]);
      rect(p, 7, 6, 8, 9, GO[6]);
      break;
    case 5: // mosaic
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) p(x, y, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? JA[4] : GO[4]);
      break;
    case 6: // mossy crack
      for (let y = 3, x = 6; y < 13; y++) {
        p(x, y, MA[1]);
        if (y % 2) p(x + 1, y, JA[4]);
        x += y % 3 === 0 ? 1 : 0;
      }
      break;
    case 7: // fluted column inlay
      for (let y = 0; y < T; y++) {
        p(5, y, GO[3]);
        p(6, y, MA[6]);
        p(7, y, MA[3]);
        p(8, y, MA[6]);
        p(9, y, MA[3]);
        p(10, y, GO[3]);
      }
      break;
    case 8: // glowing bloom in a niche
      rect(p, 5, 4, 10, 11, MA[1]);
      p(7, 6, CY[5]);
      p(8, 6, CY[6]);
      p(6, 7, CY[4]);
      p(9, 7, CY[4]);
      for (let y = 8; y < 11; y++) p(7 + (y % 2), y, JA[4]);
      break;
    default:
      break;
  }
}

function gardenPlate(p: Plot, mask: number): void {
  // polished granite with gold inlay
  each((x, y) => {
    const h = hash2(x, y, 190);
    p(x, y, h > 0.9 ? NI[4] : h > 0.6 ? NI[2] : NI[3]);
  });
  for (let x = 1; x < 15; x++) {
    p(x, 2, GO[4]);
    p(x, 13, GO[3]);
  }
  if (mask & N) for (let x = 0; x < T; x++) p(x, 0, MA[5]);
  bevel(p, mask & ~N, [], NI[5], NI[1], NI[1]);
  roundCorners(p, mask);
}

function gardenGlass(p: Plot, mask: number): void {
  // greenhouse pane, white frame
  each((x, y) => {
    const frame = x % 8 === 0 || y % 8 === 0;
    p(x, y, frame ? MA[5] : (x + y) % 9 === 0 ? JA[5] : JA[3], frame ? 255 : 160);
  });
  if (mask & E) for (let y = 0; y < T; y++) p(15, y, MA[4]);
  if (mask & S) for (let x = 0; x < T; x++) p(x, 15, MA[4]);
}

function gardenCatwalk(p: Plot, part: number): void {
  // pergola beam with vines
  for (let x = 0; x < T; x++) {
    p(x, 0, MA[6]);
    p(x, 1, MA[5]);
    p(x, 2, MA[4]);
    p(x, 3, MA[2]);
    const vine = Math.round(Math.sin(x * 0.9) * 1.2) + 2;
    p(x, vine, JA[4]);
  }
  for (let x = 1; x < T; x += 3) {
    const len = 2 + Math.floor(hash2(x, 0, 195) * 5);
    for (let y = 4; y < 4 + len; y++) p(x, y, y === 3 + len ? JA[6] : JA[4]);
  }
  void part;
}

function gardenRail(p: Plot, part: number): void {
  // memory-eating brambles
  for (let s = 0; s < 3; s++) {
    let y = 15;
    let x = 2 + s * 5;
    while (y > 5) {
      p(x, y, VI[2]);
      p(x + 1, y, VI[1]);
      if (y % 3 === 0) {
        p(x - 1, y - 1, VI[3]);
        p(x - 2, y - 2, MG[5]);
      }
      if (y % 3 === 1) {
        p(x + 2, y - 1, VI[3]);
        p(x + 3, y - 2, MG[5]);
      }
      y--;
      x += Math.sin(y * 0.8 + s) > 0 ? 1 : -1;
      x = Math.max(1, Math.min(13, x));
    }
    p(x, 5, MG[6]);
  }
  void part;
}

function gardenBackwall(p: Plot, kind: number): void {
  // clipped hedge wall; only a few cells carry a lantern or white blossoms
  each((x, y) => {
    const n = fbm((x + kind * 11) / 3, y / 3, 200, 2);
    p(x, y, n > 0.64 ? JA[3] : n > 0.42 ? JA[2] : JA[1]);
  });
  if (kind === 1 || kind === 9) {
    for (let i = 0; i < 3; i++) p(2 + Math.floor(hash2(i, kind, 201) * 12), 2 + Math.floor(hash2(i, 3, 201) * 12), MA[5]);
  } else if (kind === 5) {
    rect(p, 7, 5, 8, 6, GO[2]);
    rect(p, 6, 7, 9, 10, GO[3]);
    rect(p, 7, 8, 8, 9, GO[6]);
  }
}

function gardenCrumble(p: Plot, frame: number): void {
  each((x, y) => {
    let c = (x * 3 + y) % 5 === 0 ? GO[2] : GO[3];
    if (x === 0 || y === 0) c = GO[4];
    if (x === 15 || y === 15) c = GO[1];
    p(x, y, c);
  });
  const n = frame ? 6 : 2;
  for (let i = 0; i < n; i++) {
    let x = 2 + Math.floor(hash2(i, frame, 205) * 12);
    for (let y = 2; y < 14; y++) {
      p(x, y, GO[0]);
      if (hash2(x, y, i) > 0.6) x += hash2(y, x, i) > 0.5 ? 1 : -1;
      x = Math.max(1, Math.min(14, x));
    }
  }
}

function gardenExtra(p: Plot, k: number): void {
  if (k === 4) {
    // light bridge (on)
    for (let x = 0; x < T; x++) {
      p(x, 0, 0xfff6d0);
      p(x, 1, GO[5], 230);
      p(x, 2, GO[4], 170);
      p(x, 3, GO[3], 90);
      if (x % 4 === 1) p(x, 1, 0xfff6d0);
    }
  } else if (k === 5) {
    for (let x = 0; x < T; x += 2) p(x, 0, GO[2]);
  } else memoryExtra(p, k);
}

export const GARDEN_KIT: TileKit = {
  solid: gardenSolid,
  interior: gardenInterior,
  plate: gardenPlate,
  glass: gardenGlass,
  catwalk: gardenCatwalk,
  rail: gardenRail,
  backwall: gardenBackwall,
  crumble: gardenCrumble,
  extra: gardenExtra,
};

// =============================================================================
// MAST — red/white aviation girders, galvanized grating (stage 10 + finale)
// =============================================================================

function mastSolid(p: Plot, mask: number, v: number): void {
  // I-beam column painted with obstruction bands
  each((x, y) => {
    const band = (y + v * 8) % 16 < 8;
    let c = band ? CR[3] : MA[4];
    if (x === 3 || x === 12) c = band ? CR[2] : MA[2];
    if (x === 4 || x === 11) c = band ? CR[4] : MA[5];
    if (x < 3 || x > 12) c = band ? CR[2] : MA[3]; // flange
    if (x === 0) c = band ? CR[4] : MA[5];
    if (x === 15) c = band ? CR[1] : MA[1];
    p(x, y, c);
  });
  for (const [x, y] of [
    [1, 2],
    [14, 2],
    [1, 10],
    [14, 10],
  ]) {
    p(x, y, ST[6]);
    p(x, y + 1, ST[1]);
  }
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, ST[7]);
    p(x, 1, ST[5]);
    p(x, 2, ST[3]);
  }
  if (mask & S) for (let x = 0; x < T; x++) p(x, 15, ST[1]);
  roundCorners(p, mask);
}

function mastInterior(p: Plot, k: number): void {
  mastSolid(p, 0, k % 2);
  switch (k) {
    case 2: // antenna panel
      rect(p, 3, 2, 12, 13, MA[5]);
      for (let y = 4; y < 12; y += 2) rect(p, 5, y, 10, y, MA[2]);
      rect(p, 3, 13, 12, 13, MA[1]);
      break;
    case 3: // junction box
      rect(p, 3, 4, 12, 12, ST[3]);
      rect(p, 3, 4, 12, 4, ST[5]);
      rect(p, 5, 7, 10, 8, YE[3]);
      break;
    case 4: // red beacon
      rect(p, 5, 6, 10, 11, ST[1]);
      circle(p, 8, 8, 2.6, CR[5]);
      p(7, 7, CR[6]);
      break;
    case 5: // cable ladder
      rect(p, 4, 0, 4, 15, ST[2]);
      rect(p, 11, 0, 11, 15, ST[2]);
      for (let y = 1; y < T; y += 3) rect(p, 5, y, 10, y, ST[4]);
      break;
    case 6: // transmitter grille
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) p(x, y, (x + y) % 2 ? ST[1] : ST[4]);
      break;
    case 7: // cable bundle
      for (let y = 0; y < T; y++) {
        p(6, y, ST[0]);
        p(7, y, ST[2]);
        p(8, y, ST[0]);
        p(9, y, AM[1]);
      }
      for (const yy of [4, 12]) rect(p, 5, yy, 10, yy, ST[4]);
      break;
    case 8: // high-voltage plate
      rect(p, 4, 4, 11, 11, YE[3]);
      for (let i = 0; i < 6; i++) p(9 - i, 5 + i, 0x140806);
      p(8, 5, 0x140806);
      break;
    default:
      break;
  }
}

function mastPlate(p: Plot, mask: number): void {
  // galvanized grating
  each((x, y) => {
    const h = hash2(x, y, 210);
    let c = h > 0.85 ? ST[5] : ST[4];
    if (x % 4 === 2 || y % 4 === 2) c = ST[1];
    p(x, y, c);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, ST[7]);
    p(x, 1, ST[5]);
  }
  bevel(p, mask & ~N, [], ST[5], ST[1], ST[0]);
  roundCorners(p, mask);
}

function mastGlass(p: Plot, mask: number): void {
  // fibreglass radome panel
  each((x, y) => {
    const t = Math.abs(x - 7.5) / 8;
    p(x, y, t < 0.3 ? MA[5] : t < 0.7 ? MA[4] : MA[3]);
  });
  for (let i = 0; i < T; i++) {
    if (mask & N) p(i, 0, MA[6]);
    if (mask & S) p(i, 15, MA[2]);
    p(0, i, MA[2]);
  }
  for (let x = 0; x < T; x++) if (x % 5 === 2) p(x, 8, MA[2]);
}

function mastCatwalk(p: Plot, part: number): void {
  for (let x = 0; x < T; x++) {
    p(x, 0, ST[7]);
    p(x, 1, ST[4]);
    p(x, 2, x % 2 ? ST[1] : ST[3]);
    p(x, 3, ST[2]);
  }
  struts(p, part, ST[3], ST[1]);
}

function mastRail(p: Plot, part: number): void {
  // high-voltage insulators with arcs
  for (let x = 0; x < T; x++) for (let y = 13; y < T; y++) p(x, y, ST[2]);
  for (const ix of [3, 12]) for (let y = 6; y < 13; y++) p(ix, y, y % 2 ? MA[4] : OX[4]);
  let y = 7;
  for (let x = 4; x < 12; x++) {
    y = Math.max(5, Math.min(10, y + (hash2(x, 0, 215) > 0.5 ? 1 : -1)));
    p(x, y, CY[6]);
    p(x, y + 1, CY[4]);
  }
  void part;
}

function mastBackwall(p: Plot, kind: number): void {
  const B = [0x080a10, 0x0c0f18, 0x141826, 0x1e2436];
  each((x, y) => {
    let c = B[1];
    if (x === y || x === 15 - y) c = B[3]; // X brace
    if (x === 0 || x === 15) c = B[2];
    p(x, y, c);
  });
  if (kind % 5 === 2) p(8, 8, CR[3]);
  if (kind % 5 === 4) for (let x = 0; x < T; x++) p(x, 0, B[3]);
}

function mastCrumble(p: Plot, frame: number): void {
  each((x, y) => {
    let c = x % 4 === 2 || y % 4 === 2 ? 0x1e0e0c : RAMPS.rust[3];
    if (y === 0) c = RAMPS.rust[4];
    p(x, y, c);
  });
  const n = frame ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const hx = 2 + Math.floor(hash2(i, frame, 220) * 11);
    const hy = 3 + Math.floor(hash2(i, 5, 220) * 10);
    p(hx, hy, -1);
    p(hx + 1, hy, -1);
    p(hx, hy + 1, -1);
  }
}

export const MAST_KIT: TileKit = {
  solid: mastSolid,
  interior: mastInterior,
  plate: mastPlate,
  glass: mastGlass,
  catwalk: mastCatwalk,
  rail: mastRail,
  backwall: mastBackwall,
  crumble: mastCrumble,
};

export const KITS: Record<string, TileKit> = {
  archive: ARCHIVE_KIT,
  refinery: REFINERY_KIT,
  core: CORE_KIT,
  memory: MEMORY_KIT,
  garden: GARDEN_KIT,
  mast: MAST_KIT,
};
