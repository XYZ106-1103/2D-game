// LETHE security forces: shield trooper (rig), seeker drone, sentry turret,
// projectiles, explosions and debris. Same palette, light and outline rules
// as the player so everything reads as one art set.
import { RAMPS, INK } from '../../src/art/palette.ts';
import { PixelCanvas, bayer, drawStampRotated, hash2, stampFromRows, type Stamp } from './pixel.ts';
import { renderPose, TROOPER_SKIN, darken, type Pose } from './rig.ts';

const S = RAMPS.steel;
const MG = RAMPS.magenta;
const CR = RAMPS.crimson;
const N = RAMPS.night;

export interface Anim {
  name: string;
  fps: number;
  loop: boolean;
  frames: PixelCanvas[];
}

// ---------------------------------------------------------------------------
// Shield trooper (rig-based)
// ---------------------------------------------------------------------------

const TB: Pose = {
  root: [24, 29],
  lean: 2,
  aF: [40, 45],
  aB: [-15, 20],
  lF: [10, 12],
  lB: [-8, 10],
};
const TP = (o: Partial<Pose>): Pose => ({ ...TB, ...o });
const sin = (d: number) => Math.sin((d * Math.PI) / 180);
const cos = (d: number) => Math.cos((d * Math.PI) / 180);

export function trooperAnims(): Anim[] {
  const R = (p: Pose) => renderPose(p, 48, TROOPER_SKIN).canvas;
  const anims: Anim[] = [];
  const idle: PixelCanvas[] = [];
  for (let i = 0; i < 4; i++) {
    const b = (1 - cos(i * 90)) / 2;
    idle.push(R(TP({ root: [24, 29 + Math.round(b)], head: -2 + b * 2, aF: [40, 45 + b * 4], aB: [-15, 20 + b * 6], lF: [10, 12 + b * 6], lB: [-8, 10 + b * 6] })));
  }
  anims.push({ name: 'idle', fps: 5, loop: true, frames: idle });
  const walk: PixelCanvas[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i * 45;
    walk.push(
      R(
        TP({
          root: [24, 29 - Math.abs(sin(t)) + 0.5],
          lean: 5,
          aF: [44 + sin(t) * 4, 45],
          aB: [-12 + sin(t) * 18, 30],
          lF: [22 * sin(t) + 4, 14 + 40 * Math.max(0, cos(t))],
          lB: [22 * sin(t + 180) + 4, 14 + 40 * Math.max(0, cos(t + 180))],
        }),
      ),
    );
  }
  anims.push({ name: 'walk', fps: 9, loop: true, frames: walk });
  anims.push({ name: 'guard', fps: 1, loop: true, frames: [R(TP({ root: [24, 30], lean: 8, headStamp: 'alert', aF: [75, 25], aB: [-20, 40], lF: [26, 30], lB: [-16, 18] }))] });
  anims.push({
    name: 'windup',
    fps: 8,
    loop: false,
    frames: [
      R(TP({ root: [23, 30], lean: -8, headStamp: 'alert', aF: [40, 70], aB: [-40, 60], lF: [24, 30], lB: [-24, 24] })),
      R(TP({ root: [22, 31], lean: -14, headStamp: 'alert', aF: [30, 80], aB: [-60, 70], lF: [28, 40], lB: [-28, 30] })),
    ],
  });
  anims.push({
    name: 'bash',
    fps: 12,
    loop: false,
    frames: [
      R(TP({ root: [26, 30], lean: 22, headStamp: 'alert', aF: [85, 5], aB: [-50, 30], lF: [40, 30], lB: [-32, 10] })),
      R(TP({ root: [27, 30], lean: 26, headStamp: 'alert', aF: [92, 0], aB: [-60, 30], lF: [44, 36], lB: [-34, 8] })),
    ],
  });
  anims.push({
    name: 'stagger',
    fps: 8,
    loop: false,
    frames: [
      R(TP({ root: [22, 30], lean: -24, head: -18, headStamp: 'hurt', aF: [-10, 40], aB: [-80, 40], lF: [30, 30], lB: [-20, 20] })),
      R(TP({ root: [23, 30], lean: -14, head: -10, headStamp: 'hurt', aF: [10, 40], aB: [-50, 40], lF: [26, 30], lB: [-16, 20] })),
    ],
  });
  const k0 = TP({ root: [22, 30], lean: -24, head: -20, headStamp: 'hurt', aF: [-20, 40], aB: [-90, 30], lF: [30, 30], lB: [-24, 20] });
  const k1 = TP({ root: [23, 34], lean: 20, head: 20, headStamp: 'hurt', aF: [0, 20], aB: [-20, 20], lF: [70, 130], lB: [50, 130] });
  const k2 = TP({ root: [25, 40], lean: 80, head: 10, headStamp: 'hurt', aF: [-60, 10], aB: [-50, 10], lF: [90, 120], lB: [80, 130] });
  const k3 = TP({ root: [24, 41], lean: 92, head: 0, headStamp: 'hurt', aF: [-90, 0], aB: [-85, 0], lF: [100, 20], lB: [95, 15] });
  anims.push({ name: 'death', fps: 10, loop: false, frames: [k0, k1, k2, k3].map(R) });
  return anims;
}

// ---------------------------------------------------------------------------
// Seeker drone (procedural, 24×20)
// ---------------------------------------------------------------------------

function drone(f: number, mode: 'hover' | 'windup' | 'dash' | 'hurt'): PixelCanvas {
  const W = 24;
  const H = 20;
  const c = new PixelCanvas(W, H);
  const cx = 11.5;
  const cy = 10.5;
  const tilt = mode === 'dash' ? 0.3 : 0;
  const body = (x: number, y: number) => {
    // rotate sample point by tilt around centre
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const rx = dx * Math.cos(tilt) + dy * Math.sin(tilt);
    const ry = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
    return [rx, ry];
  };
  // rotor arms + blades
  const bladeOn = f % 2 === 0;
  for (const side of [-1, 1]) {
    const ax = Math.round(cx + side * 7);
    for (let i = 0; i < 3; i++) c.set(Math.round(cx + side * (4 + i)), 5, S[3]);
    c.set(ax, 4, S[4]);
    const span = mode === 'dash' ? 2 : 3;
    for (let k = -span; k <= span; k++) {
      if ((bladeOn && k < 0) || (!bladeOn && k > 0) || k === 0) c.set(ax + k, 3, k === 0 ? S[5] : S[2]);
    }
  }
  // hull
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [rx, ry] = body(x, y);
      const e = (rx / 7.5) ** 2 + (ry / 5.2) ** 2;
      if (e > 1) continue;
      const lit = -ry / 5.2 * 0.7 + rx / 7.5 * 0.3;
      let col = lit > 0.45 ? S[5] : lit > 0.05 ? S[4] : lit > -0.4 ? S[3] : S[2];
      if (Math.abs(ry - 1.2) < 0.6) col = MG[3]; // corporate stripe
      if (ry > 3.6) col = S[1];
      c.set(x, y, col);
    }
  }
  // eye (front = right side)
  const [ex, ey] = [cx + 4.6 + (mode === 'dash' ? 0.6 : 0), cy - 0.6 + (mode === 'dash' ? 1.5 : 0)];
  const eyeCols = mode === 'windup' ? [CR[6], 0xffffff, CR[5]] : mode === 'hurt' ? [N[3], N[4], N[2]] : [CR[5], CR[6], CR[4]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - ex, y + 0.5 - ey);
      if (d < 2.6) c.set(x, y, d < 1.1 ? eyeCols[1] : d < 1.9 ? eyeCols[0] : S[0]);
    }
  }
  // underside emitter
  c.set(Math.round(cx), H - 5, mode === 'windup' ? CR[6] : MG[4]);
  c.set(Math.round(cx) - 1, H - 6, S[1]);
  c.set(Math.round(cx) + 1, H - 6, S[1]);
  if (mode === 'windup' && f % 2) {
    c.set(Math.round(cx) - 5, Math.round(cy) + 2, CR[5]);
    c.set(Math.round(cx) + 5, Math.round(cy) + 2, CR[5]);
  }
  c.outline(INK);
  return c;
}

export function droneAnims(): Anim[] {
  return [
    { name: 'hover', fps: 16, loop: true, frames: [0, 1, 2, 3].map((f) => drone(f, 'hover')) },
    { name: 'windup', fps: 16, loop: true, frames: [0, 1].map((f) => drone(f, 'windup')) },
    { name: 'dash', fps: 20, loop: true, frames: [0, 1].map((f) => drone(f, 'dash')) },
    { name: 'hurt', fps: 1, loop: false, frames: [drone(0, 'hurt')] },
  ];
}

// ---------------------------------------------------------------------------
// Sentry turret: base (24×12) + head pre-rotated to 24 angles (RotSprite)
// ---------------------------------------------------------------------------

const SENTRY_PAL: Record<string, number> = {
  T: S[6],
  t: S[5],
  e: S[4],
  E: S[3],
  d: S[2],
  x: S[1],
  m: MG[4],
  M: MG[5],
  r: CR[5],
  R: CR[6],
  W: 0xffffff,
};

const HEAD_ROWS = [
  '..eeeeeee.......',
  '.eTTTTTTte......',
  'eTttttttteE.....',
  'eTtRrtttteEddddx',
  'eTtrrtttteEtttTx',
  'eEeeeeeeeEEddddx',
  '.EEEEEEEEE......',
  '..ddddddd.......',
];

export function sentrySprites(): { name: string; c: PixelCanvas }[] {
  const out: { name: string; c: PixelCanvas }[] = [];
  // base housing
  const base = new PixelCanvas(24, 12);
  for (let y = 0; y < 12; y++) {
    const half = 5 + y * 0.6;
    for (let x = 0; x < 24; x++) {
      if (Math.abs(x + 0.5 - 12) > half) continue;
      let col = y < 2 ? S[5] : y < 5 ? S[4] : y < 9 ? S[3] : S[2];
      if (y === 6) col = MG[3];
      if (x + 0.5 - 12 > half - 1.5) col = darken(col);
      base.set(x, y, col);
    }
  }
  base.set(12, 3, CR[5]);
  base.outline(INK);
  out.push({ name: 'sentry_base', c: base });
  // heads at 24 angles, for idle/aim/fire
  const stamp = (lens: 'idle' | 'aim' | 'fire'): Stamp => {
    const rows = HEAD_ROWS.map((r) => (lens === 'aim' ? r.replace(/r/g, 'R') : lens === 'idle' ? r.replace(/R/g, 'r').replace(/r/g, 'd') : r.replace(/r/g, 'W').replace(/R/g, 'W')));
    return stampFromRows(rows, SENTRY_PAL, [5, 4]);
  };
  for (const lens of ['idle', 'aim', 'fire'] as const) {
    const st = stamp(lens);
    for (let i = 0; i < 24; i++) {
      const c = new PixelCanvas(32, 32);
      drawStampRotated((x, y, col) => c.set(x, y, col), st, 16, 16, i * 15);
      if (lens === 'fire') {
        // muzzle flash at the barrel tip
        const a = (i * 15 * Math.PI) / 180;
        const mx = 16 + Math.cos(a) * 13;
        const my = 16 + Math.sin(a) * 13;
        for (let k = -2; k <= 2; k++) {
          c.set(mx + Math.cos(a) * k, my + Math.sin(a) * k, k === 0 ? 0xffffff : MG[6]);
          c.set(mx - Math.sin(a) * k * 0.6, my + Math.cos(a) * k * 0.6, MG[5]);
        }
      }
      c.outline(INK);
      out.push({ name: `sentry_${lens}_${i}`, c });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Projectiles, explosions, debris
// ---------------------------------------------------------------------------

export function combatFx(): { name: string; c: PixelCanvas }[] {
  const out: { name: string; c: PixelCanvas }[] = [];
  for (const [name, ramp] of [
    ['bolt', MG],
    ['bolt_r', RAMPS.cyan],
  ] as const) {
    for (let f = 0; f < 2; f++) {
      const c = new PixelCanvas(12, 7);
      for (let x = 0; x < 11; x++) {
        const k = x / 10;
        const w = k < 0.6 ? 0 : 1;
        c.set(x, 3, k > 0.75 ? 0xffffff : k > 0.4 ? ramp[6] : ramp[4]);
        if (w) {
          c.set(x, 2, ramp[5]);
          c.set(x, 4, ramp[5]);
        }
        if (k < 0.4 && (x + f) % 2 === 0) c.set(x, 3 + (f ? 1 : -1), ramp[3]);
      }
      c.set(10, 1, ramp[4]);
      c.set(10, 5, ramp[4]);
      out.push({ name: `${name}_${f}`, c });
    }
  }
  // explosion: 7 frames, 40×40, dithered fireball in magenta → amber → smoke
  for (let f = 0; f < 7; f++) {
    const c = new PixelCanvas(40, 40);
    const t = f / 6;
    const r = 5 + t * 15;
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        const d = Math.hypot(x + 0.5 - 20, y + 0.5 - 20);
        const n = hash2(x >> 1, y >> 1, f) * 4;
        if (d > r + n) continue;
        const k = d / (r + 0.01);
        let col: number;
        if (t < 0.3) col = k < 0.5 ? 0xffffff : k < 0.8 ? RAMPS.yellow[4] : MG[5];
        else if (t < 0.6) col = k < 0.35 ? RAMPS.yellow[4] : k < 0.7 ? RAMPS.amber[3] : MG[4];
        else col = k < 0.5 ? N[4] : N[3];
        if (t > 0.5 && k > 0.6 && bayer(x, y) < (t - 0.5) * 1.6) continue;
        if (t > 0.75 && bayer(x, y) < (t - 0.6) * 1.5) continue;
        // hollow ring late
        if (t > 0.45 && k < (t - 0.45) * 1.4) continue;
        c.set(x, y, col);
      }
    }
    out.push({ name: `boom_${f}`, c });
  }
  // debris shards
  const shards = ['xx.|.xx', 'x..|xx.|.x.', '.x.|xxx', 'xx|xx'];
  shards.forEach((s, i) => {
    const rows = s.split('|');
    const c = new PixelCanvas(4, 4);
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch === 'x' && c.set(x, y, y === 0 ? S[5] : S[3])));
    out.push({ name: `shard_${i}`, c });
  });
  // shield block spark (bigger, white/amber)
  for (let f = 0; f < 3; f++) {
    const c = new PixelCanvas(15, 15);
    const L = [4, 7, 6][f];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + f * 0.3;
      for (let r = f; r < L; r++) c.set(7 + Math.cos(a) * r, 7 + Math.sin(a) * r, r < L / 2 ? 0xffffff : RAMPS.amber[4]);
    }
    out.push({ name: `block_${f}`, c });
  }
  // laser sight (1×1 for scaling) and a tracer pixel
  const laser = new PixelCanvas(4, 1);
  laser.fillRect(0, 0, 4, 1, 0xffffff);
  out.push({ name: 'laser', c: laser });
  return out;
}
