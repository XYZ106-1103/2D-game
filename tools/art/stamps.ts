// Hand-authored pixel stamps for the protagonist (ION). Facing right.
// Shading is authored for a key light from the upper-front.
import { RAMPS } from '../../src/art/palette.ts';
import { stampFromRows, type Stamp } from './pixel.ts';

const R = RAMPS;

/** Character palette: one char per color. */
export const CHAR_PAL: Record<string, number> = {
  // jacket
  J: R.jacket[6],
  j: R.jacket[5],
  n: R.jacket[4],
  m: R.jacket[3],
  M: R.jacket[2],
  // amber trim
  A: R.amber[4],
  a: R.amber[3],
  b: R.amber[2],
  // scarf crimson
  R: R.crimson[5],
  r: R.crimson[4],
  q: R.crimson[3],
  Q: R.crimson[2],
  // hair
  W: R.hair[5],
  H: R.hair[4],
  h: R.hair[3],
  g: R.hair[2],
  G: R.hair[1],
  // skin
  S: R.skin[4],
  s: R.skin[3],
  k: R.skin[2],
  K: R.skin[1],
  // visor
  V: R.cyan[6],
  v: R.cyan[5],
  c: R.cyan[4],
  C: R.cyan[3],
  // steel
  T: R.steel[6],
  t: R.steel[5],
  e: R.steel[4],
  E: R.steel[3],
  d: R.steel[2],
  // dark
  x: R.steel[1],
  X: R.night[0],
  // pants
  P: R.pants[4],
  p: R.pants[3],
  o: R.pants[2],
};

function s(rows: string[], pivot: [number, number]): Stamp {
  return stampFromRows(rows, CHAR_PAL, pivot);
}

// Head ------------------------------------------------------------------------
// Pivot = base of skull (where the neck meets the head).
export const HEAD = {
  normal: s(
    [
      '.....Gg.....',
      '...GGghg.g..',
      '..GghhhhhWh.',
      '.GghhhHHhhHh',
      'GGgghHhhHHhh',
      '.GGgghhhhgSh',
      '..GggaCcvVVs',
      '...GgkksssSs',
      '....GKksssk.',
      '.....KKkk...',
    ],
    [6, 10],
  ),
  // Visor glowing hotter, jaw set — attacks / dash / grapple.
  fierce: s(
    [
      '.....Gg.....',
      '...GGghg.g..',
      '..GghhhhhWh.',
      '.GghhhHHhhHh',
      'GGgghHhhHHhh',
      '.GGgghhhhggh',
      '..GggaCvVVVV',
      '...GgkksssSs',
      '....GKkKKk..',
      '.....KKkk...',
    ],
    [6, 10],
  ),
  // Visor flickered off, eye shut — hit.
  hurt: s(
    [
      '.....Gg.....',
      '...GGghg.g..',
      '..GghhhhhWh.',
      '.GghhhHHhhHh',
      'GGgghHhhHHhh',
      '.GGgghhhhgSh',
      '..GggaECCkKs',
      '...GgkksssSs',
      '....GKkKKk..',
      '.....KKkk...',
    ],
    [6, 10],
  ),
  dead: s(
    [
      '.....Gg.....',
      '...GGghg.g..',
      '..GghhhhhWh.',
      '.GghhhHHhhHh',
      'GGgghHhhHHhh',
      '.GGgghhhhgSh',
      '..GggbdEEdks',
      '...GgkksssSs',
      '....GKkkkk..',
      '.....KKkk...',
    ],
    [6, 10],
  ),
};

// Torso -----------------------------------------------------------------------
// Pivot = waist (belt line centre). Includes scarf wrap around the neck.
export const TORSO = {
  normal: s(
    [
      '....qrRq...',
      '...qrRRRq..',
      '..mQqrrRrn.',
      '.mnnjQqrjJ.',
      '.mnnjjjJJJa',
      '.Mmnnjjjjja',
      '.Mmnnnjjjja',
      '.MMmnnnnjja',
      '..Mmnnnnnja',
      '..xxxxxxxbx',
      '..MmmnnnnnM',
      '..MMmmnnnm.',
      '...MMmmm...',
    ],
    [5.5, 9.5],
  ),
  // Chest expanded / shoulders up (breathing in)
  inhale: s(
    [
      '....qrRq...',
      '...qrRRRq..',
      '..mQqrrRrnj',
      '.mnnjQqrjJJ',
      '.mnnjjjJJJa',
      '.Mmnnjjjjja',
      '.Mmnnnjjjja',
      '.MMmnnnnjja',
      '..Mmnnnnnja',
      '..xxxxxxxbx',
      '..MmmnnnnnM',
      '..MMmmnnnm.',
      '...MMmmm...',
    ],
    [5.5, 9.5],
  ),
};

/** Joint offsets relative to the torso pivot (unrotated). */
export const TORSO_JOINTS = {
  shoulderF: [1.2, -5.5] as [number, number],
  shoulderB: [-1.8, -5.5] as [number, number],
  neck: [-0.3, -8.6] as [number, number],
  scarf: [-1.6, -8.0] as [number, number],
  hipF: [0.8, 1.6] as [number, number],
  hipB: [-1.4, 1.6] as [number, number],
  coat: [-3.2, 0.6] as [number, number],
};
