// Chapter 3 material kits — the city by daylight. Each kit redraws every slot
// of the tileset layout in its own material language.
import { RAMPS } from '../../src/art/palette.ts';
import { fbm, hash2 } from './pixel.ts';
import { roundCorners, type Plot, type TileKit } from './tiles.ts';

const T = 16;
const N = 1;
const E = 2;
const S = 4;
const W = 8;

const SU = RAMPS.stucco;
const SK = RAMPS.sky;
const AL = RAMPS.algae;
const BR = RAMPS.brick;
const ST = RAMPS.steel;
const GO = RAMPS.gold;
const MA = RAMPS.marble;
const CY = RAMPS.cyan;
const CR = RAMPS.crimson;
const AM = RAMPS.amber;
const YE = RAMPS.yellow;
const OX = RAMPS.oxide;
const MG = RAMPS.magenta;
const AC = RAMPS.acid;
const NI = RAMPS.night;
const TL = RAMPS.teal;
const VI = RAMPS.violet;

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
function edges(p: Plot, mask: number, left: number, right: number, bottom: number, topStart = 0): void {
  if (mask & W) for (let y = topStart; y < T; y++) p(0, y, left);
  if (mask & E) for (let y = topStart; y < T; y++) p(15, y, right);
  if (mask & S) for (let x = 0; x < T; x++) p(x, 15, bottom);
}
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
/** Generic "window" helper. */
function win(p: Plot, frame: number, glass: number[], sill: number): void {
  rect(p, 3, 3, 12, 11, frame);
  rect(p, 4, 4, 11, 10, glass[1]);
  rect(p, 4, 4, 11, 5, glass[2]);
  for (let y = 4; y < 11; y++) p(8, y, frame);
  p(10, 5, glass[3] ?? glass[2]);
  rect(p, 3, 12, 12, 12, sill);
}

// =============================================================================
// SUNROOF — sunlit stucco blocks, solar panels, planked walkways
// =============================================================================

function sunSolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    const n = fbm((x + v * 17) / 5, y / 5, 300, 3);
    let c = n > 0.6 ? SU[5] : n < 0.35 ? SU[3] : SU[4];
    if ((x + y * 3 + v) % 23 === 0) c = SU[3];
    p(x, y, c);
  });
  if (mask & N) {
    for (let x = 0; x < T; x++) {
      p(x, 0, SU[7]);
      p(x, 1, SU[6]);
      p(x, 2, SU[6]);
      p(x, 3, SU[3]);
      if (hash2(x, 4, v) > 0.7) p(x, 4, SU[3]);
    }
  }
  edges(p, mask, SU[6], SU[2], SU[1], mask & N ? 4 : 0);
  roundCorners(p, mask);
}

function sunInterior(p: Plot, k: number): void {
  sunSolid(p, 0, k % 2);
  switch (k) {
    case 2: // peeling paint
      for (let i = 0; i < 6; i++) p(4 + i, 6 + (i % 3), SU[2]);
      rect(p, 5, 9, 9, 10, BR[4]);
      break;
    case 3:
      win(p, SU[2], [SK[2], SK[3], SK[5], SK[6]], SU[6]);
      break;
    case 4: // open shutters + curtain
      win(p, SU[2], [SK[2], AM[2], AM[4], AM[5]], SU[6]);
      rect(p, 1, 3, 2, 11, AL[4]);
      rect(p, 13, 3, 14, 11, AL[4]);
      break;
    case 5: // flower box
      win(p, SU[2], [SK[2], SK[3], SK[4], SK[6]], SU[6]);
      rect(p, 3, 12, 12, 13, BR[3]);
      for (const x of [4, 7, 10]) {
        p(x, 11, MG[5]);
        p(x + 1, 11, AL[5]);
      }
      break;
    case 6: // AC unit
      rect(p, 3, 4, 12, 12, MA[4]);
      rect(p, 3, 4, 12, 4, MA[6]);
      circle(p, 8, 8.5, 3, MA[2]);
      for (let i = -2; i <= 2; i++) p(8 + i, 8, MA[3]);
      break;
    case 7: // drainpipe
      for (let y = 0; y < T; y++) {
        p(6, y, ST[2]);
        p(7, y, ST[5]);
        p(8, y, ST[4]);
        p(9, y, ST[2]);
      }
      for (const yy of [4, 12]) rect(p, 5, yy, 10, yy, ST[5]);
      break;
    case 8: // shaded window
      win(p, SU[2], [NI[2], NI[3], NI[4], NI[5]], SU[6]);
      break;
    default:
      break;
  }
}

function sunPlate(p: Plot, mask: number): void {
  // solar panel: blue cells, aluminium frame, a morning glint
  each((x, y) => {
    let c = (x % 4 === 0 || y % 4 === 0) ? SK[1] : y < 6 ? SK[2] : SK[1];
    if ((x - y + 32) % 13 === 0 && y < 10) c = SK[5];
    if (x === 0 || x === 15 || y === 15) c = MA[3];
    p(x, y, c);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, MA[6]);
    p(x, 1, MA[4]);
  }
  roundCorners(p, mask);
}

function sunGlass(p: Plot, mask: number): void {
  // skylight
  each((x, y) => p(x, y, (x + y) % 9 === 0 ? SK[6] : y < 8 ? SK[4] : SK[3], 200));
  for (let i = 0; i < T; i++) {
    p(i, 0, mask & N ? MA[6] : MA[4]);
    p(0, i, MA[4]);
    p(15, i, MA[3]);
    p(i, 15, MA[3]);
    p(i, 8, MA[4]);
  }
}

function sunCatwalk(p: Plot, part: number): void {
  // sun-bleached planks
  for (let x = 0; x < T; x++) {
    const plank = Math.floor(x / 5);
    p(x, 0, SU[7]);
    p(x, 1, x % 5 === 4 ? SU[2] : plank % 2 ? SU[5] : SU[6]);
    p(x, 2, x % 5 === 4 ? SU[2] : SU[4]);
    p(x, 3, SU[2]);
  }
  struts(p, part, SU[3], SU[2]);
}

function sunRail(p: Plot, part: number): void {
  // barbed-wire coil on a rail
  for (let x = 0; x < T; x++) {
    p(x, 14, ST[2]);
    p(x, 15, ST[1]);
  }
  for (let x = 0; x < T; x++) {
    const y = 9 + Math.round(Math.sin((x / 16) * Math.PI * 4) * 3);
    p(x, y, ST[5]);
    p(x, y + 1, ST[3]);
    if (x % 3 === 0) {
      p(x, y - 1, ST[6]);
      p(x, y + 2, ST[6]);
    }
  }
  void part;
}

function sunBackwall(p: Plot, kind: number): void {
  // warm brick in shade, with clothes lines
  each((x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    let c = (x + off) % 8 === 0 || y % 4 === 0 ? BR[1] : hash2((x + off) >> 3, row, kind) > 0.5 ? BR[2] : BR[3];
    p(x, y, c);
  });
  if (kind % 4 === 1) for (let x = 0; x < T; x++) {
    const y = 6 + Math.round(Math.sin(x / 5) * 1);
    p(x, y, MA[2]);
    if (x % 6 === 2) rect(p, x, y + 1, x + 2, y + 4, [MG[4], SK[4], YE[3]][kind % 3]);
  }
  if (kind % 4 === 3) rect(p, 4, 4, 11, 11, BR[0]);
}

function sunCrumble(p: Plot, frame: number): void {
  // old crate boards
  each((x, y) => {
    let c = y % 5 === 4 ? OX[2] : OX[4];
    if (x === 0 || x === 15) c = OX[3];
    p(x, y, c);
  });
  const n = frame ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const cx = 2 + Math.floor(hash2(i, frame, 310) * 12);
    for (let y = 1; y < 15; y += 2) p(cx + (y % 4 ? 0 : 1), y, OX[1]);
  }
}

export const SUNROOF_KIT: TileKit = { solid: sunSolid, interior: sunInterior, plate: sunPlate, glass: sunGlass, catwalk: sunCatwalk, rail: sunRail, backwall: sunBackwall, crumble: sunCrumble };

// =============================================================================
// DROWNED — algae-slick concrete, waterlines, submerged tiles
// =============================================================================

function drownSolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    const n = fbm((x + v * 13) / 4, y / 6, 320, 3);
    let c = n > 0.6 ? TL[4] : n < 0.35 ? TL[2] : TL[3];
    // algae streaks and barnacles
    if (fbm(x / 3, (y + v * 5) / 9, 321, 2) > 0.66) c = AL[3];
    if (hash2(x, y, v + 322) > 0.97) c = MA[3];
    p(x, y, c);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, AL[6]);
    p(x, 1, AL[5]);
    p(x, 2, AL[4]);
    if (hash2(x, 3, v) > 0.5) {
      const len = 2 + Math.floor(hash2(x, 4, v) * 6);
      for (let y = 3; y < 3 + len; y++) p(x, y, AL[3]);
    }
  }
  edges(p, mask, TL[5], TL[1], TL[0], mask & N ? 3 : 0);
  roundCorners(p, mask);
}

function drownInterior(p: Plot, k: number): void {
  drownSolid(p, 0, k % 2);
  switch (k) {
    case 2: // waterline stain
      for (let x = 0; x < T; x++) {
        p(x, 6, MA[2]);
        p(x, 7, TL[1]);
      }
      break;
    case 3:
      win(p, TL[1], [TL[0], TL[1], TL[3], CY[3]], TL[5]);
      break;
    case 4: // flooded shop window, fish shadow
      win(p, TL[1], [TL[0], 0x123a44, 0x1c5a6a, CY[4]], TL[5]);
      p(6, 8, CY[5]);
      p(7, 8, CY[5]);
      p(5, 7, CY[4]);
      break;
    case 5:
      win(p, TL[1], [TL[0], AM[1], AM[2], AM[3]], TL[5]);
      break;
    case 6: // drain grate
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) p(x, y, x % 2 ? TL[0] : TL[4]);
      break;
    case 7: // leaking pipe
      for (let y = 0; y < T; y++) {
        p(6, y, OX[2]);
        p(7, y, OX[4]);
        p(8, y, OX[3]);
      }
      p(9, 10, CY[5]);
      p(9, 12, CY[4]);
      break;
    case 8: // tilted sign
      rect(p, 3, 5, 12, 10, TL[0]);
      for (let x = 4; x < 12; x++) p(x, 7 + Math.floor((x - 4) / 4), CY[4]);
      break;
    default:
      break;
  }
}

function drownPlate(p: Plot, mask: number): void {
  // rusted grating with algae
  each((x, y) => {
    let c = x % 4 === 1 || y % 4 === 1 ? OX[1] : OX[3];
    if (fbm(x / 3, y / 3, 330, 2) > 0.62) c = AL[4];
    p(x, y, c);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, OX[5]);
    p(x, 1, AL[5]);
  }
  roundCorners(p, mask);
}

function drownGlass(p: Plot, mask: number): void {
  // aquarium-thick glass, cloudy
  each((x, y) => p(x, y, fbm(x / 4, y / 4, 331, 2) > 0.55 ? 0x2a6a74 : 0x1c5060, 210));
  for (let i = 0; i < T; i++) {
    if (mask & N) p(i, 0, TL[6]);
    p(0, i, TL[5]);
    p(15, i, TL[2]);
  }
}

function drownCatwalk(p: Plot, part: number): void {
  // floating pallet with buoys
  for (let x = 0; x < T; x++) {
    p(x, 0, OX[6]);
    p(x, 1, x % 4 === 3 ? OX[2] : OX[5]);
    p(x, 2, OX[3]);
    p(x, 3, x % 4 === 3 ? OX[1] : OX[4]);
  }
  if (part === 0 || part === 3) rect(p, 1, 4, 3, 6, CR[4]);
  if (part === 2 || part === 3) rect(p, 12, 4, 14, 6, CR[4]);
}

function drownRail(p: Plot, part: number): void {
  // spiny urchins
  for (const cx of [4, 11]) {
    circle(p, cx, 12, 3, VI[1]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (let r = 3; r < 6; r++) p(Math.round(cx + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r), r === 5 ? VI[4] : VI[2]);
    }
    p(cx, 11, MG[5]);
  }
  void part;
}

function drownBackwall(p: Plot, kind: number): void {
  // flooded tunnel tiles
  each((x, y) => {
    let c = x % 4 === 0 || y % 4 === 0 ? 0x0e2a30 : (x + y + kind) % 7 === 0 ? 0x1c4a50 : 0x163c44;
    if (y > 10 && fbm(x / 3, y / 3, 332 + kind, 2) > 0.6) c = AL[2];
    p(x, y, c);
  });
  if (kind % 4 === 2) for (let x = 0; x < T; x++) p(x, 7, CY[2]);
}

function drownCrumble(p: Plot, frame: number): void {
  each((x, y) => p(x, y, y % 4 === 3 ? OX[1] : fbm(x / 3, y / 3, 333, 2) > 0.6 ? AL[3] : OX[3]));
  const n = frame ? 6 : 2;
  for (let i = 0; i < n; i++) p(2 + Math.floor(hash2(i, frame, 334) * 12), 2 + Math.floor(hash2(i, 9, 334) * 12), -1);
}

export const DROWNED_KIT: TileKit = { solid: drownSolid, interior: drownInterior, plate: drownPlate, glass: drownGlass, catwalk: drownCatwalk, rail: drownRail, backwall: drownBackwall, crumble: drownCrumble };

// =============================================================================
// AVENUE — shopfronts, posters, striped awnings
// =============================================================================

const AWN = [
  [CR[4], MA[6]],
  [SK[3], MA[6]],
  [AL[4], MA[6]],
  [AM[3], MA[6]],
];

function aveSolid(p: Plot, mask: number, v: number): void {
  // painted plaster above, tiled base course
  each((x, y) => {
    const n = fbm((x + v * 11) / 6, y / 6, 340, 2);
    let c = n > 0.55 ? MA[4] : MA[3];
    if (y % 8 === 7) c = MA[2];
    p(x, y, c);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, MA[6]);
    p(x, 1, MA[5]);
    p(x, 2, MA[2]);
  }
  edges(p, mask, MA[5], MA[1], MA[0], mask & N ? 3 : 0);
  roundCorners(p, mask);
}

function aveInterior(p: Plot, k: number): void {
  aveSolid(p, 0, k % 2);
  switch (k) {
    case 2: // protest poster
      rect(p, 3, 2, 12, 13, MA[6]);
      rect(p, 4, 3, 11, 6, CR[4]);
      for (let x = 4; x < 11; x += 2) p(x, 8, NI[1]);
      for (let x = 4; x < 9; x += 2) p(x, 10, NI[1]);
      break;
    case 3:
      win(p, MA[1], [SK[2], SK[3], SK[5], SK[6]], MA[5]);
      break;
    case 4: // shop display (warm)
      win(p, NI[2], [AM[1], AM[2], AM[4], AM[5]], MA[5]);
      break;
    case 5: // shop display (screens)
      win(p, NI[2], [NI[1], CY[2], CY[4], CY[5]], MA[5]);
      break;
    case 6: // graffiti
      for (let x = 2; x < 14; x++) {
        const y = 8 + Math.round(Math.sin(x * 0.8) * 3);
        p(x, y, MG[5]);
        p(x, y + 1, MG[3]);
      }
      p(4, 5, AC[4]);
      p(5, 4, AC[4]);
      break;
    case 7: // downpipe
      for (let y = 0; y < T; y++) {
        p(7, y, ST[3]);
        p(8, y, ST[5]);
      }
      break;
    case 8: // shutter (closed shop)
      for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) p(x, y, y % 2 ? ST[3] : ST[4]);
      break;
    default:
      break;
  }
}

function avePlate(p: Plot, mask: number): void {
  // red brick pavers
  each((x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    p(x, y, (x + off) % 8 === 0 || y % 4 === 0 ? BR[2] : hash2((x + off) >> 3, row, 341) > 0.5 ? BR[4] : BR[3]);
  });
  if (mask & N) for (let x = 0; x < T; x++) p(x, 0, BR[6]);
  roundCorners(p, mask);
}

function aveGlass(p: Plot, mask: number): void {
  // striped shop canopy seen from the street: lit top, stripes, scalloped valance
  const [a, b] = AWN[0];
  each((x, y) => {
    const stripe = Math.floor(x / 4) % 2 ? a : b;
    if (y < 2) p(x, y, mask & N ? MA[6] : stripe);
    else if (y < 11) p(x, y, y > 8 ? (stripe === a ? CR[3] : MA[4]) : stripe);
    else if (y < 14) {
      const sc = Math.abs((x % 4) - 1.5) + (y - 11) * 0.9 < 2.2;
      if (sc) p(x, y, stripe === a ? CR[3] : MA[4]);
    }
  });
  if (mask & S) for (let x = 0; x < T; x++) if (x % 4 === 1 || x % 4 === 2) p(x, 14, NI[2], 160);
  if (mask & W) for (let y = 0; y < 13; y++) p(0, y, NI[2]);
  if (mask & E) for (let y = 0; y < 13; y++) p(15, y, NI[2]);
}

function aveCatwalk(p: Plot, part: number): void {
  // striped awning
  const [a, b] = AWN[0];
  void part;
  for (let x = 0; x < T; x++) {
    const c = Math.floor(x / 4) % 2 ? a : b;
    p(x, 0, c);
    p(x, 1, c);
    p(x, 2, c);
    p(x, 3, Math.floor(x / 4) % 2 ? MA[1] : MA[3]);
    if (x % 4 === 1) p(x, 4, c);
  }
}

function aveRail(p: Plot, part: number): void {
  // police caltrops strip
  for (let x = 0; x < T; x++) {
    p(x, 14, YE[3]);
    p(x, 15, x % 4 < 2 ? NI[1] : YE[2]);
  }
  for (const cx of [2, 7, 12]) {
    for (let i = 0; i < 5; i++) p(cx + Math.floor(i / 2), 13 - i, ST[6 - (i % 2)]);
  }
  void part;
}

function aveBackwall(p: Plot, kind: number): void {
  // warm brick facade in shade: offset courses, mortar, the odd darker or sun-bleached brick
  each((x, y) => {
    const row = y >> 2;
    const off = row % 2 ? 4 : 0;
    const bx = (x + off) >> 3;
    const mortar = y % 4 === 3 || (x + off) % 8 === 7;
    const h = hash2(bx + kind * 3, row, 343);
    let c = h > 0.86 ? BR[2] : h < 0.12 ? SU[3] : SU[2];
    if (y % 4 === 0 && !mortar && h > 0.55) c = h > 0.86 ? BR[3] : SU[3]; // a few bricks catch the light
    if (mortar) c = SU[0];
    p(x, y, c);
  });
  switch (kind) {
    case 101: // lit window, a room behind it
      rect(p, 3, 2, 12, 12, SU[0]);
      rect(p, 4, 3, 11, 11, AM[1]);
      rect(p, 4, 3, 11, 5, AM[2]);
      for (let y = 3; y < 12; y++) p(8, y, SU[0]);
      p(5, 4, AM[4]);
      rect(p, 3, 13, 12, 13, SU[4]);
      break;
    case 2: // dark window with a sky reflection
      rect(p, 3, 2, 12, 12, SU[0]);
      rect(p, 4, 3, 11, 11, NI[2]);
      for (let i = 0; i < 4; i++) p(5 + i, 7 - i, SK[2]);
      for (let y = 3; y < 12; y++) p(8, y, SU[0]);
      rect(p, 3, 13, 12, 13, SU[4]);
      break;
    case 3: // vote poster, sun-faded
      rect(p, 3, 3, 12, 13, SU[5]);
      rect(p, 4, 4, 11, 7, CR[3]);
      for (let x = 4; x < 11; x += 2) p(x, 9, SU[1]);
      for (let x = 4; x < 9; x += 2) p(x, 11, SU[1]);
      p(12, 3, SU[3]);
      break;
    case 104: // air-conditioner unit
      rect(p, 2, 6, 13, 13, ST[4]);
      rect(p, 2, 6, 13, 6, ST[5]);
      for (let y = 8; y < 13; y += 2) rect(p, 3, y, 9, y, ST[2]);
      circle(p, 11.5, 10.5, 1.8, ST[2]);
      rect(p, 2, 14, 13, 14, SU[0]);
      break;
    case 105: // little shop sign
      rect(p, 2, 4, 13, 10, NI[1]);
      for (let x = 4; x < 12; x++) if (hash2(x, 1, 344) > 0.35) p(x, 7, x < 8 ? MG[5] : CY[5]);
      rect(p, 7, 0, 8, 3, ST[2]);
      break;
    case 106: // vent grille
      rect(p, 4, 5, 11, 11, ST[2]);
      for (let y = 6; y < 11; y += 2) rect(p, 5, y, 10, y, ST[4]);
      break;
    default:
      break;
  }
}

function aveCrumble(p: Plot, frame: number): void {
  // cardboard boxes
  each((x, y) => p(x, y, x === 8 || y === 8 ? OX[3] : GO[2]));
  for (let i = 0; i < (frame ? 6 : 2); i++) p(2 + Math.floor(hash2(i, frame, 342) * 12), 2 + Math.floor(hash2(i, 3, 342) * 12), OX[1]);
}

export const AVENUE_KIT: TileKit = { solid: aveSolid, interior: aveInterior, plate: avePlate, glass: aveGlass, catwalk: aveCatwalk, rail: aveRail, backwall: aveBackwall, crumble: aveCrumble };

// =============================================================================
// TRANSIT — viaduct concrete, platform edges, subway tiles
// =============================================================================

function trSolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    const n = fbm((x + v * 9) / 6, y / 6, 350, 2);
    let c = n > 0.58 ? MA[3] : n < 0.36 ? MA[1] : MA[2];
    if (x === 7 && (y + v) % 16 < 14) c = MA[1]; // expansion joint
    p(x, y, c);
  });
  for (const [x, y] of [
    [3, 4],
    [12, 4],
    [3, 12],
    [12, 12],
  ])
    p(x, y, MA[5]);
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, MA[5]);
    p(x, 1, MA[4]);
    p(x, 2, MA[1]);
  }
  edges(p, mask, MA[4], MA[0], MA[0], mask & N ? 3 : 0);
  roundCorners(p, mask);
}

function trInterior(p: Plot, k: number): void {
  trSolid(p, 0, k % 2);
  switch (k) {
    case 2: // line map plaque
      rect(p, 2, 4, 13, 11, MA[5]);
      for (let x = 3; x < 13; x++) p(x, 7, x < 8 ? CR[4] : SK[3]);
      p(7, 7, MA[6]);
      break;
    case 3:
      win(p, MA[1], [SK[2], SK[3], SK[5], SK[6]], MA[4]);
      break;
    case 4: // station sign
      rect(p, 2, 5, 13, 10, SK[1]);
      for (let x = 4; x < 12; x += 2) p(x, 7, MA[6]);
      break;
    case 5: // timetable screen
      rect(p, 3, 4, 12, 11, NI[1]);
      for (let y = 5; y < 11; y += 2) for (let x = 4; x < 11; x++) if (hash2(x, y, 351) > 0.4) p(x, y, AM[4]);
      break;
    case 6: // vent
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) p(x, y, y % 2 ? MA[0] : MA[3]);
      break;
    case 7: // cable conduit
      for (let y = 0; y < T; y++) {
        p(6, y, NI[2]);
        p(7, y, YE[2]);
        p(8, y, NI[2]);
      }
      break;
    case 8: // warning stripes
      for (let y = 4; y < 12; y++) for (let x = 2; x < 14; x++) p(x, y, ((x + y) >> 1) % 2 ? YE[3] : NI[1]);
      break;
    default:
      break;
  }
}

function trPlate(p: Plot, mask: number): void {
  // platform edge with tactile strip
  each((x, y) => p(x, y, y < 4 ? (x % 3 === 1 && y % 2 === 1 ? YE[2] : YE[3]) : (x + y) % 5 === 0 ? MA[2] : MA[3]));
  if (mask & N) for (let x = 0; x < T; x++) p(x, 0, YE[4]);
  if (mask & S) for (let x = 0; x < T; x++) p(x, 15, MA[0]);
  roundCorners(p, mask);
}

function trGlass(p: Plot, mask: number): void {
  // platform screen door
  each((x, y) => p(x, y, x === 7 || x === 8 ? MA[2] : y < 3 ? MA[4] : (x + y) % 10 === 0 ? SK[5] : SK[3], 210));
  for (let i = 0; i < T; i++) {
    if (mask & N) p(i, 0, MA[5]);
    p(0, i, MA[3]);
    p(15, i, MA[1]);
  }
}

function trCatwalk(p: Plot, part: number): void {
  for (let x = 0; x < T; x++) {
    p(x, 0, YE[3]);
    p(x, 1, ST[4]);
    p(x, 2, x % 2 ? ST[1] : ST[3]);
    p(x, 3, ST[2]);
  }
  struts(p, part, ST[3], ST[1]);
}

function trRail(p: Plot, part: number): void {
  // hot exhaust grate
  for (let y = 8; y < T; y++) for (let x = 0; x < T; x++) p(x, y, x % 3 === 0 ? NI[1] : y < 11 ? AM[4] : y < 13 ? AM[3] : OX[4]);
  for (let x = 1; x < T; x += 3) {
    p(x, 6, AM[2]);
    p(x + 1, 4, AM[1]);
  }
  void part;
}

function trBackwall(p: Plot, kind: number): void {
  // glazed teal tiles in shade with a faint sheen; equipment fixed to the wall
  each((x, y) => {
    const grout = x % 4 === 0 || y % 4 === 0;
    const h = hash2((x >> 2) + kind * 5, y >> 2, 353);
    let c = grout ? TL[2] : h > 0.8 ? TL[5] : TL[4];
    if (!grout && x % 4 === 1 && y % 4 === 1) c = TL[6]; // glaze glint
    p(x, y, c);
  });
  switch (kind) {
    case 101: // route map
      rect(p, 2, 3, 13, 12, MA[5]);
      for (let x = 3; x < 13; x++) p(x, 6, CR[4]);
      for (let x = 3; x < 13; x++) p(x, 9, SK[3]);
      for (const x of [4, 8, 11]) {
        p(x, 6, MA[6]);
        p(x, 9, MA[6]);
      }
      break;
    case 2: // departure board
      rect(p, 2, 4, 13, 11, NI[1]);
      for (let y = 5; y < 11; y += 2) for (let x = 3; x < 13; x++) if (hash2(x, y, 354) > 0.4) p(x, y, AM[4]);
      break;
    case 3: // control panel with status lamps
      rect(p, 2, 5, 13, 13, ST[2]);
      rect(p, 2, 5, 13, 5, ST[4]);
      for (let x = 4; x < 13; x += 3) p(x, 8, hash2(x, 2, 355) > 0.5 ? AC[4] : CR[5]);
      for (let x = 4; x < 12; x++) p(x, 11, x % 2 ? ST[5] : ST[3]);
      break;
    case 104: // wall lamp
      rect(p, 6, 3, 9, 4, ST[3]);
      rect(p, 5, 5, 10, 8, AM[4]);
      rect(p, 6, 5, 9, 5, AM[5]);
      rect(p, 5, 9, 10, 9, ST[2]);
      break;
    case 105: // direction sign
      rect(p, 2, 5, 13, 10, SK[1]);
      for (let i = 0; i < 3; i++) {
        p(9 + i, 7 - i, MA[6]);
        p(9 + i, 8 + i, MA[6]);
      }
      rect(p, 4, 7, 11, 8, MA[6]);
      break;
    case 106: // vent
      rect(p, 3, 4, 12, 11, TL[1]);
      for (let y = 5; y < 11; y += 2) rect(p, 4, y, 11, y, TL[3]);
      break;
    default:
      break;
  }
}

function trCrumble(p: Plot, frame: number): void {
  trSolid(p, 15, 0);
  for (let i = 0; i < (frame ? 6 : 3); i++) {
    let x = 2 + Math.floor(hash2(i, frame, 352) * 12);
    for (let y = 2; y < 14; y++) {
      p(x, y, MA[0]);
      if (hash2(x, y, i) > 0.6) x += hash2(y, x, i) > 0.5 ? 1 : -1;
      x = Math.max(1, Math.min(14, x));
    }
  }
}

export const TRANSIT_KIT: TileKit = { solid: trSolid, interior: trInterior, plate: trPlate, glass: trGlass, catwalk: trCatwalk, rail: trRail, backwall: trBackwall, crumble: trCrumble };

// =============================================================================
// LAB — clean white panels, orange/blue municipal stripes
// =============================================================================

function labSolid(p: Plot, mask: number, v: number): void {
  // matte panels: bright enough to read as "clean", dim enough not to bloom
  each((x, y) => {
    let c = MA[2];
    if (x === 0 || y === 0) c = MA[3];
    if (x === 15 || y === 15) c = MA[1];
    if (y === 10 && v === 1) c = AM[2];
    if (y === 11 && v === 1) c = SK[2];
    p(x, y, c);
  });
  p(2, 2, MA[3]);
  p(13, 2, MA[3]);
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, MA[5]);
    p(x, 1, MA[3]);
    p(x, 2, SK[3]);
  }
  edges(p, mask, MA[3], MA[1], MA[0], mask & N ? 3 : 0);
  roundCorners(p, mask);
}

function labInterior(p: Plot, k: number): void {
  labSolid(p, 0, k % 2);
  switch (k) {
    case 2: // whiteboard formula
      rect(p, 2, 3, 13, 12, 0xffffff);
      for (let x = 3; x < 12; x++) if (hash2(x, 5, 360) > 0.4) p(x, 5, SK[2]);
      for (let x = 3; x < 10; x++) if (hash2(x, 8, 360) > 0.4) p(x, 8, CR[3]);
      break;
    case 3:
      win(p, MA[3], [SK[3], SK[4], SK[5], SK[6]], MA[6]);
      break;
    case 4: // indicator panel
      rect(p, 3, 4, 12, 11, NI[2]);
      for (let x = 4; x < 12; x += 2) p(x, 6, hash2(x, 0, 361) > 0.5 ? AC[4] : AM[4]);
      for (let x = 4; x < 12; x += 3) p(x, 9, SK[5]);
      break;
    case 5: // relay port
      circle(p, 8, 8, 4, MA[3]);
      circle(p, 8, 8, 2.5, SK[3]);
      p(8, 8, 0xffffff);
      break;
    case 6: // locker vents
      for (let y = 4; y < 12; y += 2) rect(p, 4, y, 11, y, MA[3]);
      break;
    case 7: // coolant line
      for (let y = 0; y < T; y++) {
        p(6, y, SK[2]);
        p(7, y, SK[4]);
        p(8, y, SK[3]);
      }
      break;
    case 8: // hazard label
      rect(p, 4, 4, 11, 11, AM[3]);
      rect(p, 7, 5, 8, 9, NI[1]);
      p(7, 10, NI[1]);
      break;
    default:
      break;
  }
}

function labPlate(p: Plot, mask: number): void {
  each((x, y) => p(x, y, (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? MA[3] : MA[2]));
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, MA[5]);
    p(x, 1, AM[3]);
  }
  roundCorners(p, mask);
}

function labGlass(p: Plot, mask: number): void {
  each((x, y) => p(x, y, (x - y + 32) % 12 === 0 ? SK[6] : SK[4], 170));
  for (let i = 0; i < T; i++) {
    if (mask & N) p(i, 0, MA[5]);
    if (mask & S) p(i, 15, MA[3]);
    if (mask & W) p(0, i, MA[5]);
    if (mask & E) p(15, i, MA[3]);
  }
}

function labCatwalk(p: Plot, part: number): void {
  for (let x = 0; x < T; x++) {
    p(x, 0, MA[5]);
    p(x, 1, x % 4 === 0 ? SK[4] : MA[3]);
    p(x, 2, MA[2]);
    p(x, 3, MA[1]);
  }
  struts(p, part, MA[2], MA[1]);
}

function labRail(p: Plot, part: number): void {
  // spilled coolant, bubbling
  for (let x = 0; x < T; x++) {
    const sy = 10 + Math.round(Math.sin(x * 0.7) * 0.6);
    for (let y = sy; y < T; y++) p(x, y, y === sy ? AC[5] : y < sy + 2 ? AC[4] : AC[3]);
  }
  p(4, 8, AC[4]);
  p(11, 7, AC[5]);
  p(8, 6, AC[3]);
  void part;
}

function labBackwall(p: Plot, kind: number): void {
  // blue-grey wall panels in the lab's shade, seams and rivets; fixtures on a few
  each((x, y) => {
    const seam = x % 8 === 0 || y % 8 === 0;
    const h = hash2((x >> 3) + kind * 7, y >> 3, 363);
    let c = seam ? ST[2] : h > 0.78 ? ST[4] : ST[3];
    if (!seam && (x % 8 === 1 || y % 8 === 1)) c = h > 0.78 ? ST[5] : ST[4]; // lit panel edge
    p(x, y, c);
  });
  for (const [x, y] of [
    [2, 2],
    [10, 2],
    [2, 10],
    [10, 10],
  ])
    p(x, y, ST[5]);
  switch (kind) {
    case 1: // monitor with a waveform
      rect(p, 2, 3, 13, 11, NI[1]);
      for (let x = 3; x < 13; x++) p(x, 7 + Math.round(Math.sin(x * 0.9) * 2), CY[5]);
      rect(p, 7, 12, 8, 13, ST[2]);
      break;
    case 102: // hazard sign
      rect(p, 4, 4, 11, 11, AM[3]);
      rect(p, 7, 5, 8, 8, NI[1]);
      p(7, 10, NI[1]);
      p(8, 10, NI[1]);
      break;
    case 103: // wall clock
      circle(p, 8, 8, 5, MA[4]);
      circle(p, 8, 8, 5, ST[1], true);
      for (let i = 0; i < 3; i++) p(8, 8 - i, NI[1]);
      for (let i = 0; i < 3; i++) p(8 + i, 8, NI[1]);
      break;
    case 4: // cable junction box
      rect(p, 4, 4, 11, 12, ST[2]);
      rect(p, 5, 5, 10, 6, AM[2]);
      p(6, 9, AC[4]);
      p(9, 9, CR[5]);
      break;
    case 105: // air vent
      rect(p, 3, 5, 12, 11, ST[1]);
      for (let y = 6; y < 11; y += 2) rect(p, 4, y, 11, y, ST[3]);
      break;
    default:
      break;
  }
}

function labCrumble(p: Plot, frame: number): void {
  each((x, y) => p(x, y, (x + y) % 6 === 0 ? SK[6] : SK[4], 200));
  for (let i = 0; i < (frame ? 6 : 2); i++) {
    const cx = 2 + Math.floor(hash2(i, frame, 362) * 12);
    for (let y = 1; y < 15; y++) p(cx + Math.round(Math.sin(y + i)), y, 0xffffff);
  }
}

export const LAB_KIT: TileKit = { solid: labSolid, interior: labInterior, plate: labPlate, glass: labGlass, catwalk: labCatwalk, rail: labRail, backwall: labBackwall, crumble: labCrumble };

// =============================================================================
// HARBOR — corrugated containers, pier planks, chain-link
// =============================================================================

const CONT = [
  [CR[2], CR[3], CR[4]],
  [SK[0], SK[1], SK[2]],
  [AL[2], AL[3], AL[4]],
  [OX[3], OX[4], OX[5]],
];

function harSolid(p: Plot, mask: number, v: number): void {
  const C = CONT[0];
  each((x, y) => p(x, y, x % 3 === 0 ? C[0] : x % 3 === 1 ? (v ? C[1] : C[2]) : C[1]));
  for (let x = 0; x < T; x++) if (hash2(x, 1, v + 370) > 0.85) for (let y = 3; y < 12; y++) if (hash2(x, y, 371) > 0.4) p(x, y, OX[3]);
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, C[2]);
    p(x, 1, MA[2]);
  }
  edges(p, mask, C[2], C[0], NI[1], mask & N ? 2 : 0);
}

function harInterior(p: Plot, k: number): void {
  harSolid(p, 0, k % 2);
  switch (k) {
    case 2: // stencil code
      for (let x = 3; x < 12; x++) if (hash2(x, 0, 372) > 0.3) p(x, 6, MA[6]);
      for (let x = 3; x < 9; x++) if (hash2(x, 1, 372) > 0.3) p(x, 8, MA[6]);
      break;
    case 3: // door handles
      for (const x of [5, 10]) for (let y = 3; y < 13; y++) p(x, y, ST[5]);
      break;
    case 4: // door seal + lock
      for (let y = 2; y < 14; y++) p(8, y, NI[1]);
      rect(p, 7, 7, 9, 9, AM[3]);
      break;
    case 5: // logo
      circle(p, 8, 8, 4, MA[6], true);
      break;
    case 6: // vent
      for (let y = 5; y < 11; y++) for (let x = 4; x < 12; x++) p(x, y, y % 2 ? NI[1] : ST[3]);
      break;
    case 7: // ladder
      for (let y = 0; y < T; y++) {
        p(5, y, ST[4]);
        p(10, y, ST[4]);
      }
      for (let y = 1; y < T; y += 3) rect(p, 5, y, 10, y, ST[5]);
      break;
    case 8: // rust patch
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) if (fbm(x / 2, y / 2, 373, 2) > 0.5) p(x, y, OX[4]);
      break;
    default:
      break;
  }
}

function harPlate(p: Plot, mask: number): void {
  // pier planks, nails
  each((x, y) => p(x, y, y % 4 === 3 ? OX[1] : hash2(0, Math.floor(y / 4), 374) > 0.5 ? OX[4] : OX[3]));
  for (let y = 1; y < T; y += 4) {
    p(2, y, ST[5]);
    p(13, y, ST[5]);
  }
  if (mask & N) for (let x = 0; x < T; x++) p(x, 0, OX[6]);
  roundCorners(p, mask);
}

function harGlass(p: Plot, mask: number): void {
  // chain-link fence
  each((x, y) => {
    if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) p(x, y, ST[4]);
  });
  for (let i = 0; i < T; i++) {
    if (mask & N) p(i, 0, ST[5]);
    if (mask & W) p(0, i, ST[3]);
  }
}

function harCatwalk(p: Plot, part: number): void {
  for (let x = 0; x < T; x++) {
    p(x, 0, OX[6]);
    p(x, 1, OX[5]);
    p(x, 2, x % 5 === 0 ? OX[1] : OX[4]);
    p(x, 3, OX[2]);
  }
  struts(p, part, OX[3], OX[1]);
}

function harRail(p: Plot, part: number): void {
  // scalding pipe
  for (let x = 0; x < T; x++) {
    p(x, 10, AM[5]);
    p(x, 11, AM[4]);
    p(x, 12, AM[3]);
    p(x, 13, OX[4]);
    p(x, 14, OX[2]);
  }
  for (let x = 2; x < T; x += 5) {
    p(x, 8, MA[5]);
    p(x + 1, 6, MA[4]);
  }
  void part;
}

function harBackwall(p: Plot, kind: number): void {
  const C = CONT[kind % 4];
  each((x, y) => p(x, y, x % 3 === 0 ? 0x0a0a12 : y % 16 === 0 ? 0x0a0a12 : C[0]));
}

function harCrumble(p: Plot, frame: number): void {
  each((x, y) => p(x, y, y % 4 === 3 ? OX[1] : OX[2]));
  for (let i = 0; i < (frame ? 7 : 3); i++) p(1 + Math.floor(hash2(i, frame, 375) * 14), 1 + Math.floor(hash2(i, 7, 375) * 14), -1);
}

export const HARBOR_KIT: TileKit = { solid: harSolid, interior: harInterior, plate: harPlate, glass: harGlass, catwalk: harCatwalk, rail: harRail, backwall: harBackwall, crumble: harCrumble };

// =============================================================================
// CLOCK — old red brick, brass gear plates, clock-face glass
// =============================================================================

function clkSolid(p: Plot, mask: number, v: number): void {
  each((x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    const h = hash2((x + off) >> 3, row, v + 380);
    p(x, y, (x + off) % 8 === 0 || y % 4 === 0 ? BR[1] : h > 0.66 ? BR[4] : h > 0.33 ? BR[3] : BR[2]);
  });
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, MA[5]);
    p(x, 1, MA[4]);
    p(x, 2, MA[2]);
  }
  edges(p, mask, BR[5], BR[0], BR[0], mask & N ? 3 : 0);
  roundCorners(p, mask);
}

function clkInterior(p: Plot, k: number): void {
  clkSolid(p, 0, k % 2);
  switch (k) {
    case 2: // stone medallion
      circle(p, 8, 8, 5, MA[3]);
      circle(p, 8, 8, 3, MA[4]);
      break;
    case 3: // arched window
      rect(p, 5, 5, 10, 12, NI[2]);
      circle(p, 7.5, 5.5, 2.6, NI[2]);
      rect(p, 6, 6, 9, 11, GO[3]);
      break;
    case 4:
      rect(p, 5, 5, 10, 12, NI[2]);
      circle(p, 7.5, 5.5, 2.6, NI[2]);
      rect(p, 6, 6, 9, 11, AM[4]);
      break;
    case 5:
      rect(p, 5, 5, 10, 12, NI[2]);
      circle(p, 7.5, 5.5, 2.6, NI[2]);
      break;
    case 6: // iron grille
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) if (x % 2 === 0 || y % 4 === 0) p(x, y, NI[1]);
      break;
    case 7: // brass rod
      for (let y = 0; y < T; y++) {
        p(7, y, GO[3]);
        p(8, y, GO[5]);
      }
      break;
    case 8: // small gear relief
      circle(p, 8, 8, 4, GO[2]);
      circle(p, 8, 8, 2, BR[2]);
      for (let k2 = 0; k2 < 8; k2++) p(Math.round(8 + Math.cos(k2 * 0.785) * 5), Math.round(8 + Math.sin(k2 * 0.785) * 5), GO[3]);
      break;
    default:
      break;
  }
}

function clkPlate(p: Plot, mask: number): void {
  // brass plate with rivets & engraving
  each((x, y) => p(x, y, (x + y) % 7 === 0 ? GO[4] : y < 8 ? GO[3] : GO[2]));
  for (const [x, y] of [
    [2, 3],
    [13, 3],
    [2, 12],
    [13, 12],
  ]) {
    p(x, y, GO[6]);
    p(x, y + 1, GO[1]);
  }
  if (mask & N) for (let x = 0; x < T; x++) {
    p(x, 0, GO[6]);
    p(x, 1, GO[5]);
  }
  roundCorners(p, mask);
}

function clkGlass(p: Plot, mask: number): void {
  // backlit clock-face glass with numerals around its edge
  each((x, y) => p(x, y, (x + y * 2) % 9 === 0 ? 0xfff6d0 : 0xf4e2b0, 235));
  if (mask & N) for (let x = 2; x < 14; x += 4) p(x, 1, NI[2]);
  if (mask & S) for (let x = 2; x < 14; x += 4) p(x, 14, NI[2]);
  if (mask & W) for (let y = 2; y < 14; y += 4) p(1, y, NI[2]);
  if (mask & E) for (let y = 2; y < 14; y += 4) p(14, y, NI[2]);
  for (let i = 0; i < T; i++) {
    if (mask & N) p(i, 0, GO[3]);
    if (mask & S) p(i, 15, GO[2]);
    if (mask & W) p(0, i, GO[3]);
    if (mask & E) p(15, i, GO[2]);
  }
}

function clkCatwalk(p: Plot, part: number): void {
  for (let x = 0; x < T; x++) {
    p(x, 0, OX[6]);
    p(x, 1, OX[5]);
    p(x, 2, OX[4]);
    p(x, 3, OX[2]);
  }
  struts(p, part, NI[2], NI[1]);
}

function clkRail(p: Plot, part: number): void {
  // spinning gear teeth
  circle(p, 8, 16, 7, GO[2]);
  for (let k = 0; k < 10; k++) {
    const a = Math.PI + (k / 10) * Math.PI;
    for (let r = 7; r < 10; r++) p(Math.round(8 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), r === 9 ? GO[5] : GO[3]);
  }
  void part;
}

function clkBackwall(p: Plot, kind: number): void {
  // timber interior with gear shadows
  each((x, y) => p(x, y, y % 8 === 0 ? 0x1a0e0a : (x + kind) % 5 === 0 ? 0x2a1810 : 0x22140e));
  if (kind % 4 === 1) circle(p, 8, 8, 6, 0x1a0e0a, true);
  if (kind % 4 === 3) for (let y = 0; y < T; y++) p(8, y, 0x3a2416);
}

function clkCrumble(p: Plot, frame: number): void {
  each((x, y) => p(x, y, x % 5 === 4 ? OX[1] : OX[3]));
  for (let i = 0; i < (frame ? 6 : 2); i++) {
    const cx = 1 + Math.floor(hash2(i, frame, 381) * 13);
    for (let y = 2; y < 14; y++) p(cx, y, OX[0]);
  }
}

export const CLOCK_KIT: TileKit = { solid: clkSolid, interior: clkInterior, plate: clkPlate, glass: clkGlass, catwalk: clkCatwalk, rail: clkRail, backwall: clkBackwall, crumble: clkCrumble };

export const KITS3: Record<string, TileKit> = {
  sunroof: SUNROOF_KIT,
  drowned: DROWNED_KIT,
  avenue: AVENUE_KIT,
  transit: TRANSIT_KIT,
  lab: LAB_KIT,
  harbor: HARBOR_KIT,
  clock: CLOCK_KIT,
};
void CY;
