// MOTH — ION's AI companion given a temporary hologram body for online co-op.
// Same rig and animation set as ION (so every move reads the same), but its
// own silhouette — a hooded visor head with swept-back moth antennae and a
// folded-wing collar — rendered in projected light: a cyan luminance ramp,
// violet accents and scanlines.
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, stampFromRows, type Stamp } from './pixel.ts';
import { renderPose, ION_SKIN, type FrameMeta, type Skin, type V2 } from './rig.ts';
import { TORSO_JOINTS } from './stamps.ts';
import { allAnims, FRAME, ORIGIN } from './player.ts';

const CY = RAMPS.cyan;
const VI = RAMPS.violet;

const MOTH_PAL: Record<string, number> = {
  // hood / shell
  H: CY[5],
  h: CY[4],
  g: CY[3],
  G: CY[2],
  // visor
  V: CY[7],
  v: CY[6],
  d: CY[2],
  C: CY[5],
  // antennae + wing collar
  F: VI[5],
  f: VI[4],
  w: VI[3],
  W: VI[2],
  // body light
  J: CY[6],
  j: CY[5],
  n: CY[4],
  m: CY[3],
  M: CY[2],
  x: CY[1],
};

function s(rows: string[], pivot: [number, number]): Stamp {
  return stampFromRows(rows, MOTH_PAL, pivot);
}

// Head: pivot = base of the skull, facing right. Antennae sweep back (left).
const head = (visor: string): Stamp =>
  s(
    [
      'Ff..Ff......',
      '.f...f......',
      '..fghhhh....',
      '..ghhHHhhh..',
      '.gghhhHHhhh.',
      '.gghhhhhhhh.',
      visor,
      '..gghhhhhhh.',
      '...gghhhhh..',
      '.....ggg....',
    ],
    [6, 10],
  );

export const MOTH_HEAD = {
  normal: head('.gghhhhVVVVv'),
  fierce: head('.gghhhVVVVVV'),
  hurt: head('.gghhhhdCdCd'),
  dead: head('.gghhhhdddd.'),
};

// Torso: pivot = waist. Same joint layout as ION; a folded-wing collar
// replaces the scarf wrap and a glowing seam runs down the chest.
const torsoRows = (top: string): string[] => [
  '....wfFw...',
  top,
  '..mWwffFwn.',
  '.mnnjWwfjJ.',
  '.mnnjjvjJJF',
  '.Mmnnjvjjjf',
  '.Mmnnnvjjjf',
  '.MMmnnvnjjf',
  '..Mmnnvnnjf',
  '..xxxxxxxwx',
  '..MmmnnnnnM',
  '..MMmmnnnm.',
  '...MMmmm...',
];

export const MOTH_TORSO = {
  normal: s(torsoRows('...wfFFFw..'), [5.5, 9.5]),
  inhale: s(torsoRows('...wfFFFwj.'), [5.5, 9.5]),
};

export const MOTH_SKIN: Skin = {
  ...ION_SKIN,
  head: MOTH_HEAD,
  torso: MOTH_TORSO,
  joints: TORSO_JOINTS,
  sleeve: [CY[1], CY[2], CY[3], CY[4], CY[5], CY[6], CY[7]],
  sleeveBase: 2,
  legs: [CY[1], CY[1], CY[2], CY[3], CY[4], CY[5]],
  legBase: 3,
  boots: [CY[0], CY[1], CY[2], CY[3], CY[4], CY[5]],
  bootBase: 2,
  kneePad: VI[4],
};

const lum = (c: number) => (((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114) / 255;
const isViolet = (c: number) => VI.includes(c);
const holoRamp = [CY[1], CY[2], CY[3], CY[4], CY[5], CY[6], CY[7]];

/** Projected-light pass: every non-accent pixel onto the cyan ramp, scanlines. */
function holo(src: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (!src.alpha(x, y)) continue;
      const c = src.get(x, y);
      let col = c;
      if (!isViolet(c)) {
        const l = lum(c);
        col = l < 0.07 ? CY[1] : holoRamp[Math.min(holoRamp.length - 1, Math.floor(l * holoRamp.length * 1.25))];
      }
      // scanlines: every third row a little dimmer and thinner
      const scan = y % 3 === 2;
      out.set(x, y, scan && col !== CY[1] ? holoRamp[Math.max(0, holoRamp.indexOf(col) - 1)] ?? col : col, scan ? 205 : 235);
    }
  }
  return out;
}

export function buildMothSheet(cols = 16): { canvas: PixelCanvas; json: { frameWidth: number; frameHeight: number; origin: V2 } } {
  const frames: { canvas: PixelCanvas; meta: FrameMeta }[] = [];
  for (const a of allAnims()) for (const p of a.poses) {
    const f = renderPose(p, FRAME, MOTH_SKIN);
    frames.push({ canvas: holo(f.canvas), meta: f.meta });
  }
  const rows = Math.ceil(frames.length / cols);
  const canvas = new PixelCanvas(cols * FRAME, rows * FRAME);
  frames.forEach((f, i) => canvas.blit(f.canvas, (i % cols) * FRAME, Math.floor(i / cols) * FRAME));
  return { canvas, json: { frameWidth: FRAME, frameHeight: FRAME, origin: ORIGIN } };
}
