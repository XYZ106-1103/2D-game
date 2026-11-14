// Hub characters (atlas "npcs"): hand-built pixel figures with distinct
// silhouettes, two breathing frames each, facing right.
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas } from './pixel.ts';

type Item = { name: string; c: PixelCanvas };
const INK = 0x0a0612;
const SKN = RAMPS.skin;
const MA = RAMPS.marble;
const OX = RAMPS.oxide;
const NI = RAMPS.night;
const CY = RAMPS.cyan;
const CR = RAMPS.crimson;
const YE = RAMPS.yellow;
const JA = RAMPS.jade;
const VI = RAMPS.violet;
const MG = RAMPS.magenta;
const SK = RAMPS.sky;
const GO = RAMPS.gold;
const PA = RAMPS.pants;
const BO = RAMPS.boots;

interface Look {
  kid?: boolean;
  hunch?: number;
  skin: number;
  hair: [number, number];
  style: 'bob' | 'short' | 'grey' | 'hood' | 'cap' | 'tied' | 'messy';
  top: [number, number, number];
  coatTo: number; // bottom of the coat (row)
  legs: [number, number];
  shoes: number;
  extra?: (c: PixelCanvas, f: number, y0: number) => void;
}

function rect(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, col: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.set(x, y, col);
}
function disc(c: PixelCanvas, cx: number, cy: number, r: number, col: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) c.set(x, y, col);
}

function person(L: Look, f: number): PixelCanvas {
  const c = new PixelCanvas(24, 44);
  const k = L.kid ? 0.78 : 1;
  const feet = 42;
  const legTop = Math.round(feet - 13 * k);
  const b = f; // breathing: upper body dips 1px
  const torsoTop = Math.round(legTop - 13 * k) + b;
  const headCy = torsoTop - Math.round(5 * k) + (L.hunch ?? 0);
  const cx = 11 + (L.hunch ? 1 : 0);
  // legs
  for (const [lx, col] of [
    [cx - 2, L.legs[1]],
    [cx + 1, L.legs[0]],
  ] as const) {
    rect(c, lx, legTop, lx + 1, feet - 2, col);
    rect(c, lx - (lx < cx ? 1 : 0), feet - 1, lx + 2, feet, L.shoes);
  }
  // torso / coat
  const sw = Math.round(5 * k);
  for (let y = torsoTop; y <= Math.max(L.coatTo + b, legTop); y++) {
    const t = (y - torsoTop) / Math.max(1, legTop - torsoTop);
    const w = y <= legTop ? sw - (t < 0.15 ? 1 : 0) : sw + Math.floor((y - legTop) / 3);
    if (y > L.coatTo + b && y > legTop) break;
    for (let x = cx - w; x <= cx + w; x++) c.set(x, y, x < cx - w + 2 ? L.top[2] : x > cx + w - 2 ? L.top[0] : L.top[1]);
  }
  // arms
  for (let y = torsoTop + 1; y < torsoTop + Math.round(10 * k); y++) {
    c.set(cx - sw - 1, y, L.top[0]);
    c.set(cx + sw + 1, y, L.top[2]);
  }
  c.set(cx - sw - 1, torsoTop + Math.round(10 * k), L.skin);
  c.set(cx + sw + 1, torsoTop + Math.round(10 * k), L.skin);
  // head
  const hr = 4 * (L.kid ? 0.95 : 1);
  disc(c, cx, headCy, hr, L.skin);
  c.set(cx + 2, headCy, NI[0]); // eye
  c.set(cx + 3, headCy + 2, SKN[1]);
  // hair styles
  const [h0, h1] = L.hair;
  switch (L.style) {
    case 'bob':
      for (let y = headCy - 5; y <= headCy + 3; y++) for (let x = cx - 5; x <= cx + 2; x++) if (Math.hypot(x - cx + 0.5, y - headCy + 0.5) <= 5.2 && (x < cx + 1 || y < headCy - 2)) c.set(x, y, y < headCy - 3 ? h1 : h0);
      c.set(cx - 4, headCy, CR[4]);
      c.set(cx - 4, headCy + 1, CR[4]);
      break;
    case 'short':
      for (let y = headCy - 5; y <= headCy - 2; y++) for (let x = cx - 4; x <= cx + 3; x++) if (Math.hypot(x - cx + 0.5, y - headCy + 0.5) <= 4.8) c.set(x, y, y < headCy - 4 ? h1 : h0);
      c.set(cx - 4, headCy - 1, h0);
      break;
    case 'grey':
      for (let y = headCy - 5; y <= headCy - 2; y++) for (let x = cx - 4; x <= cx + 2; x++) if (Math.hypot(x - cx + 0.5, y - headCy + 0.5) <= 4.8) c.set(x, y, h1);
      c.set(cx - 4, headCy, h0);
      c.set(cx - 4, headCy - 1, h0);
      // glasses
      c.set(cx + 2, headCy - 1, NI[2]);
      c.set(cx + 3, headCy - 1, NI[2]);
      break;
    case 'hood':
      for (let y = headCy - 6; y <= headCy + 4; y++) for (let x = cx - 6; x <= cx + 3; x++) {
        const d = Math.hypot(x - cx + 0.5, y - headCy + 0.5);
        if (d <= 6 && !(d < 3.4 && x > cx - 1)) c.set(x, y, y < headCy - 3 ? h1 : h0);
      }
      break;
    case 'cap':
      for (let y = headCy - 5; y <= headCy - 2; y++) for (let x = cx - 4; x <= cx + 3; x++) if (Math.hypot(x - cx + 0.5, y - headCy + 0.5) <= 5) c.set(x, y, y < headCy - 4 ? h1 : h0);
      rect(c, cx - 7, headCy - 3, cx - 4, headCy - 2, h0); // brim turned back
      break;
    case 'tied':
      for (let y = headCy - 5; y <= headCy - 1; y++) for (let x = cx - 4; x <= cx + 3; x++) if (Math.hypot(x - cx + 0.5, y - headCy + 0.5) <= 4.9) c.set(x, y, y < headCy - 3 ? h1 : h0);
      rect(c, cx - 7, headCy - 3, cx - 5, headCy + 4, h0); // long ponytail
      c.set(cx - 5, headCy - 2, MG[5]);
      break;
    case 'messy':
      for (let y = headCy - 6; y <= headCy - 2; y++) for (let x = cx - 5; x <= cx + 3; x++) if (Math.hypot(x - cx + 0.5, y - headCy + 0.5) <= 5.2 && (x + y) % 3 !== 0) c.set(x, y, y < headCy - 4 ? h1 : h0);
      c.set(cx + 2, headCy - 1, CY[5]);
      c.set(cx + 3, headCy - 1, CY[5]);
      break;
  }
  L.extra?.(c, f, torsoTop);
  c.outline(INK);
  return c;
}

const LOOKS: Record<string, Look> = {
  // 하나 — memory broker: long coat, red streak, goggles, satchel
  hana: {
    skin: SKN[3],
    hair: [NI[2], NI[4]],
    style: 'bob',
    top: [OX[2], OX[4], OX[5]],
    coatTo: 37,
    legs: [PA[3], PA[2]],
    shoes: BO[2],
    extra: (c, f, y0) => {
      rect(c, 8, y0 - 9 + f, 13, y0 - 9 + f, CY[4]);
      rect(c, 14, y0 + 6, 17, y0 + 10, OX[1]);
      c.set(13, y0 + 1, OX[1]);
      c.set(14, y0 + 3, OX[1]);
      c.set(15, y0 + 5, OX[1]);
    },
  },
  // 서 노인 — the old man from the deletion request: cardigan, cane, glasses
  seo: {
    hunch: 1,
    skin: SKN[2],
    hair: [MA[3], MA[5]],
    style: 'grey',
    top: [JA[2], JA[3], JA[4]],
    coatTo: 31,
    legs: [OX[2], OX[1]],
    shoes: BO[1],
    extra: (c) => {
      for (let y = 30; y < 43; y++) c.set(19, y, OX[3]);
      c.set(18, 29, OX[3]);
      c.set(17, 29, OX[3]);
    },
  },
  // 루 — courier kid: backwards cap, big jacket, delivery backpack
  ru: {
    kid: true,
    skin: SKN[3],
    hair: [CR[3], CR[4]],
    style: 'cap',
    top: [YE[2], YE[3], YE[4]],
    coatTo: 32,
    legs: [PA[4], PA[3]],
    shoes: CR[4],
    extra: (c, _f, y0) => {
      rect(c, 2, y0, 6, y0 + 8, OX[3]);
      rect(c, 2, y0, 6, y0, OX[5]);
      c.set(4, y0 + 4, YE[3]);
    },
  },
  // 애도하는 시민 — wants to forget: grey hood, white flowers
  mourner: {
    skin: SKN[2],
    hair: [NI[3], NI[5]],
    style: 'hood',
    top: [NI[3], NI[4], NI[5]],
    coatTo: 40,
    legs: [NI[2], NI[1]],
    shoes: NI[1],
    extra: (c, f, y0) => {
      for (let i = 0; i < 4; i++) c.set(17, y0 + 4 + i, JA[4]);
      c.set(17, y0 + 3 + f, MA[6]);
      c.set(18, y0 + 2 + f, MA[6]);
      c.set(16, y0 + 2 + f, MA[6]);
      c.set(17, y0 + 1 + f, 0xffffff);
    },
  },
  // 도윤 — former LETHE engineer: lab coat, glasses, glowing tablet
  doyun: {
    skin: SKN[3],
    hair: [OX[1], OX[2]],
    style: 'messy',
    top: [MA[4], MA[5], MA[6]],
    coatTo: 36,
    legs: [NI[3], NI[2]],
    shoes: NI[1],
    extra: (c, f, y0) => {
      rect(c, 16, y0 + 5 + f, 19, y0 + 9 + f, CY[3]);
      rect(c, 17, y0 + 6 + f, 18, y0 + 7 + f, CY[5]);
      rect(c, 10, y0 + 1, 12, y0 + 8, SK[1]);
    },
  },
  // 세린 — LETHE director: high collar, silver hair, holo badge
  serin: {
    skin: SKN[3],
    hair: [MA[4], MA[6]],
    style: 'tied',
    top: [VI[1], VI[2], VI[3]],
    coatTo: 39,
    legs: [NI[2], NI[1]],
    shoes: NI[0],
    extra: (c, f, y0) => {
      rect(c, 9, y0 - 1 + f, 14, y0 - 1 + f, VI[4]);
      c.set(14, y0 + 3, MG[5]);
      c.set(13, y0 + 3, MG[6]);
    },
  },
  // townsfolk for the plaza
  cit1: {
    skin: SKN[2],
    hair: [NI[1], NI[3]],
    style: 'short',
    top: [SK[1], SK[2], SK[3]],
    coatTo: 28,
    legs: [SK[1], SK[0]],
    shoes: BO[2],
  },
  cit2: {
    kid: true,
    skin: SKN[3],
    hair: [GO[2], GO[3]],
    style: 'tied',
    top: [MG[2], MG[3], MG[4]],
    coatTo: 31,
    legs: [PA[3], PA[2]],
    shoes: MA[5],
  },
};

export const NPC_IDS = Object.keys(LOOKS);

export function buildNpcs(): Item[] {
  const out: Item[] = [];
  for (const [id, look] of Object.entries(LOOKS)) for (let f = 0; f < 2; f++) out.push({ name: `${id}_${f}`, c: person(look, f) });
  return out;
}
