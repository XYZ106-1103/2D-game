// RU — the courier kid from the chapter 3 hubs, the third player in online
// co-op. Same rig and animation set as ION (so every move reads the same),
// with its own silhouette: a backwards red cap, auburn hair, an oversized
// yellow courier jacket, a delivery backpack and red sneakers. The neck sits
// a pixel lower than ION's, so RU reads a little smaller.
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, stampFromRows, type Stamp } from './pixel.ts';
import { renderPose, ION_SKIN, type FrameMeta, type Skin, type V2 } from './rig.ts';
import { TORSO_JOINTS } from './stamps.ts';
import { allAnims, FRAME, ORIGIN } from './player.ts';

const CR = RAMPS.crimson;
const OX = RAMPS.oxide;
const YE = RAMPS.yellow;
const GO = RAMPS.gold;
const AM = RAMPS.amber;
const SK = RAMPS.skin;

const RU_PAL: Record<string, number> = {
  // cap
  C: CR[5],
  c: CR[4],
  e: CR[3],
  E: CR[2],
  // hair (auburn)
  H: OX[5],
  h: OX[4],
  g: OX[3],
  // skin
  S: SK[4],
  s: SK[3],
  k: SK[2],
  K: SK[1],
  d: RAMPS.night[1],
  // jacket
  J: YE[3],
  j: YE[2],
  n: GO[3],
  m: GO[2],
  M: GO[1],
  a: CR[4],
  // scarf wrap (the trailing scarf is amber too)
  R: AM[4],
  r: AM[3],
  q: AM[2],
  Q: AM[1],
  // backpack
  P: OX[6],
  p: OX[4],
  o: OX[3],
  O: OX[2],
  Y: YE[3],
  // belt
  x: RAMPS.steel[1],
  b: AM[3],
};

function s(rows: string[], pivot: [number, number]): Stamp {
  return stampFromRows(rows, RU_PAL, pivot);
}

// Head: pivot = base of the skull, facing right. The cap's brim points back.
const head = (eye: string, mouth: string): Stamp =>
  s(
    [
      '............',
      '....EeeeE...',
      '...EeccccE..',
      '..EecccCCce.',
      '..EeccccCCcH',
      'EEEEeeeeeHhS',
      eye,
      mouth,
      '....gKksssk.',
      '.....KKkk...',
    ],
    [6, 10],
  );

export const RU_HEAD = {
  normal: head('...ghhSSSdSS', '...ghkSSSSSs'),
  fierce: head('...ghhSSddSS', '...ghkSSSKKs'),
  hurt: head('...ghhSSKKSS', '...ghkSSSkSs'),
  dead: head('...ghhSSkKkS', '...ghkSSSSSs'),
};

// Torso: pivot = waist. Two extra columns at the back hold the backpack.
const torsoRows = (r1: string, r2: string): string[] => [
  '......qrRq...',
  r1,
  r2,
  'PYpponjQqrjJ.',
  'OppponjjjJJJa',
  'Opppnnnjjjjja',
  'Opppnnnnjjjja',
  'Ooppmnnnnjjja',
  'OOooomnnnnnja',
  '.OOO.xxxxxxbx',
  '....MmmnnnnnM',
  '....MMmmnnnm.',
  '.....MMmmm...',
];

export const RU_TORSO = {
  normal: s(torsoRows('.PPPoqrRRRq..', 'PpppoQqrrRrn.'), [7.5, 9.5]),
  inhale: s(torsoRows('.PPPoqrRRRq..', 'PpppoQqrrRrnj'), [7.5, 9.5]),
};

/** ION's joints with the head a pixel lower. */
const RU_JOINTS = { ...TORSO_JOINTS, neck: [-0.3, -7.6] as [number, number] };

export const RU_SKIN: Skin = {
  ...ION_SKIN,
  head: RU_HEAD,
  torso: RU_TORSO,
  joints: RU_JOINTS,
  sleeve: [GO[0], GO[1], GO[2], GO[3], YE[2], YE[3], YE[4]],
  sleeveBase: 2,
  legs: RAMPS.teal,
  legBase: 3,
  boots: [CR[0], CR[1], CR[2], CR[3], CR[4], CR[5]],
  bootBase: 2,
  coat: false,
  kneePad: null,
};

export function buildRuSheet(cols = 16): { canvas: PixelCanvas; json: { frameWidth: number; frameHeight: number; origin: V2 } } {
  const frames: { canvas: PixelCanvas; meta: FrameMeta }[] = [];
  for (const a of allAnims()) for (const p of a.poses) frames.push(renderPose(p, FRAME, RU_SKIN));
  const rows = Math.ceil(frames.length / cols);
  const canvas = new PixelCanvas(cols * FRAME, rows * FRAME);
  frames.forEach((f, i) => canvas.blit(f.canvas, (i % cols) * FRAME, Math.floor(i / cols) * FRAME));
  return { canvas, json: { frameWidth: FRAME, frameHeight: FRAME, origin: ORIGIN } };
}
