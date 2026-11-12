// ION — animation definitions. Every frame is a Pose rendered by the rig.
import { PixelCanvas } from './pixel.ts';
import { renderPose, type Pose, type FrameMeta, type V2 } from './rig.ts';

export const FRAME = 48;
/** Feet position inside a frame (sprite origin). */
export const ORIGIN: V2 = [24, 44];

export interface AnimDef {
  name: string;
  fps: number;
  loop: boolean;
  poses: Pose[];
}

const RAD = Math.PI / 180;
const sin = (d: number) => Math.sin(d * RAD);
const cos = (d: number) => Math.cos(d * RAD);

const BASE: Pose = {
  root: [24, 29],
  lean: 3,
  aF: [8, 25],
  aB: [-10, 15],
  lF: [8, 10],
  lB: [-6, 8],
  coat: 4,
};

function P(over: Partial<Pose>): Pose {
  return { ...BASE, ...over };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const l2 = (p: V2, q: V2): V2 => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  const l3 = (p: [number, number, number?], q: [number, number, number?]): [number, number, number] => [
    lerp(p[0], q[0], t),
    lerp(p[1], q[1], t),
    lerp(p[2] ?? 0, q[2] ?? 0, t),
  ];
  return {
    ...(t < 0.5 ? a : b),
    root: l2(a.root, b.root),
    rot: lerp(a.rot ?? 0, b.rot ?? 0, t),
    lean: lerp(a.lean, b.lean, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    aF: l2(a.aF, b.aF),
    aB: l2(a.aB, b.aB),
    lF: l3(a.lF, b.lF),
    lB: l3(a.lB, b.lB),
    coat: lerp(a.coat ?? 0, b.coat ?? 0, t),
    blade: a.blade !== undefined && b.blade !== undefined ? lerp(a.blade, b.blade, t) : t < 0.5 ? a.blade : b.blade,
  };
}

// ---------------------------------------------------------------------------

function idle(): AnimDef {
  const poses: Pose[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 360;
    const breath = (1 - cos(t)) / 2; // 0..1
    poses.push(
      P({
        root: [24, 29 + Math.round(breath * 1)],
        torsoStamp: breath > 0.6 ? 'inhale' : 'normal',
        lean: 3 + breath * 1.5,
        head: -2 + breath * 3,
        aF: [8 + breath * 3, 25 + breath * 6],
        aB: [-10 - breath * 2, 15 + breath * 4],
        lF: [8, 10 + breath * 6],
        lB: [-6, 8 + breath * 6],
        coat: 4 + sin(t) * 3,
      }),
    );
  }
  return { name: 'idle', fps: 7, loop: true, poses };
}

function run(): AnimDef {
  const poses: Pose[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 360;
    const legF = 38 * sin(t) + 6;
    const legB = 38 * sin(t + 180) + 6;
    const bendF = 18 + 78 * Math.max(0, cos(t));
    const bendB = 18 + 78 * Math.max(0, cos(t + 180));
    const bob = -Math.abs(sin(t)) * 1.6 + 0.6;
    poses.push(
      P({
        root: [24, 29.6 + bob],
        lean: 14 + 2 * sin(t * 2),
        head: -6,
        headStamp: 'normal',
        aF: [-32 * sin(t) + 10, 80 + 10 * sin(t)],
        aB: [32 * sin(t) - 6, 75 - 10 * sin(t)],
        lF: [legF, bendF, Math.max(0, -sin(t)) * -15],
        lB: [legB, bendB, Math.max(0, -sin(t + 180)) * -15],
        coat: 30 + 8 * sin(t * 2),
      }),
    );
  }
  return { name: 'run', fps: 14, loop: true, poses };
}

function skid(): AnimDef {
  return {
    name: 'skid',
    fps: 10,
    loop: true,
    poses: [
      P({ root: [23, 31], lean: -14, head: 4, aF: [40, 30], aB: [-50, 40], lF: [38, 10, -10], lB: [-10, 40], coat: 25 }),
    ],
  };
}

function jump(): AnimDef {
  return {
    name: 'jump',
    fps: 14,
    loop: false,
    poses: [
      P({ root: [24, 28], lean: 6, head: -6, aF: [40, 40], aB: [-30, 30], lF: [4, 4, -20], lB: [-12, 10, -25], coat: 10 }),
      P({ root: [24, 27], lean: 4, head: -8, aF: [70, 50], aB: [-40, 40], lF: [45, 75], lB: [-5, 40, -15], coat: 0 }),
    ],
  };
}

function peak(): AnimDef {
  return {
    name: 'peak',
    fps: 10,
    loop: false,
    poses: [P({ root: [24, 27], lean: 8, head: -2, aF: [80, 40], aB: [-60, 50], lF: [50, 90], lB: [10, 70], coat: -10 })],
  };
}

function fall(): AnimDef {
  const poses: Pose[] = [];
  for (let i = 0; i < 4; i++) {
    const w = sin(i * 90);
    poses.push(
      P({
        root: [24, 27],
        lean: 6,
        head: 4,
        aF: [110 + w * 8, 30],
        aB: [-120 - w * 8, 40],
        lF: [25, 45 + w * 6, 10],
        lB: [-10, 25 - w * 6, -10],
        coat: -40 - w * 10,
      }),
    );
  }
  return { name: 'fall', fps: 12, loop: true, poses };
}

function land(): AnimDef {
  return {
    name: 'land',
    fps: 16,
    loop: false,
    poses: [
      P({ root: [24, 33], lean: 24, head: 6, aF: [40, 50], aB: [-30, 40], lF: [62, 115], lB: [-6, 90], coat: -15 }),
      P({ root: [24, 32], lean: 16, head: 2, aF: [25, 40], aB: [-20, 30], lF: [50, 95], lB: [-6, 70], coat: 10 }),
      P({ root: [24, 30], lean: 8, head: -1, aF: [12, 30], aB: [-12, 20], lF: [20, 30], lB: [-6, 20], coat: 8 }),
    ],
  };
}

/** Grapple shoot: gauntlet arm aimed at `aim` degrees (0 = forward, -90 = up, +90 = down). */
function shoot(aim: number): Pose {
  const armAbs = 90 - aim; // dirOf: 90 = forward, 180 = up
  const lean = 6 + aim * -0.05;
  return P({
    root: [24, 29],
    lean,
    head: Math.max(-25, Math.min(20, aim * 0.3)),
    headStamp: 'fierce',
    aF: [armAbs - lean, 0],
    aB: [-40, 40],
    lF: [18, 22],
    lB: [-14, 14],
    coat: 12,
    claw: false,
  });
}

/** Swing: body aligned with rope; `ang` = rope angle (deg, clockwise from up). */
function swing(ang: number, variant: 0 | 1): Pose {
  const base: Pose =
    variant === 0
      ? P({
          root: [24, 29],
          lean: 0,
          head: -4,
          headStamp: 'fierce',
          aF: [178, 0],
          aB: [-35, 45],
          lF: [-18, 18],
          lB: [-28, 30],
          coat: 50,
          claw: false,
        })
      : P({
          root: [24, 29],
          lean: 4,
          head: 0,
          headStamp: 'normal',
          aF: [178, 0],
          aB: [40, 60],
          lF: [60, 100],
          lB: [40, 80],
          coat: 20,
          claw: false,
        });
  // Rotate around the gripping hand so the arm stays pointing to the anchor.
  return { ...base, rot: ang, pivot: base.root };
}

function release(): AnimDef {
  return {
    name: 'release',
    fps: 16,
    loop: false,
    poses: [
      P({ root: [24, 28], lean: 10, head: -10, headStamp: 'fierce', aF: [150, 10], aB: [-60, 30], lF: [-10, 20], lB: [-25, 30], coat: 60, claw: false }),
      P({ root: [24, 28], lean: 18, head: -4, aF: [110, 50], aB: [-90, 40], lF: [30, 70], lB: [0, 60], coat: 40, claw: true }),
      P({ root: [24, 28], lean: 10, head: 0, aF: [80, 60], aB: [-70, 50], lF: [45, 85], lB: [15, 70], coat: 10 }),
    ],
  };
}

function flip(): AnimDef {
  const tuck = P({ root: [24, 27], lean: 30, head: 10, aF: [60, 110], aB: [40, 110], lF: [95, 140], lB: [80, 135], coat: 30 });
  const poses: Pose[] = [];
  for (let i = 0; i < 8; i++) poses.push({ ...tuck, rot: i * 45, pivot: tuck.root });
  return { name: 'flip', fps: 24, loop: true, poses };
}

function dash(dirRot: number): Pose[] {
  const a = P({
    root: [24, 29],
    lean: 62,
    head: -50,
    headStamp: 'fierce',
    aF: [-70, 20],
    aB: [-90, 30],
    lF: [-50, 40],
    lB: [-80, 25],
    coat: 85,
  });
  const b = { ...a, lF: [-40, 55] as [number, number], lB: [-85, 15] as [number, number], coat: 95 };
  // Rotate the authored horizontal dash so the body axis follows the dash direction.
  const rot = dirRot === 0 ? 0 : 90 + dirRot - a.lean;
  return [a, b].map((p) => ({ ...p, rot, pivot: p.root }));
}

function attack1(): AnimDef {
  const k0 = P({ root: [24, 30], lean: -4, head: -4, headStamp: 'fierce', aF: [150, 60], aB: [-20, 40], lF: [22, 26], lB: [-18, 16], coat: 10, blade: 10, bladeLen: 6 });
  const k1 = P({ root: [25, 30], lean: 18, head: 2, headStamp: 'fierce', aF: [95, 5], aB: [-50, 40], lF: [35, 40], lB: [-24, 14], coat: 30, blade: 0, bladeLen: 11 });
  const k2 = P({ root: [25, 31], lean: 22, head: 4, headStamp: 'fierce', aF: [40, 10], aB: [-60, 40], lF: [38, 44], lB: [-26, 14], coat: 35, blade: 10, bladeLen: 11 });
  const k3 = P({ root: [24, 30], lean: 10, head: 0, aF: [25, 30], aB: [-25, 30], lF: [26, 30], lB: [-18, 14], coat: 15 });
  return { name: 'attack1', fps: 20, loop: false, poses: [k0, lerpPose(k0, k1, 0.6), k1, k2, lerpPose(k2, k3, 0.5), k3] };
}

function attack2(): AnimDef {
  const k0 = P({ root: [24, 31], lean: 14, head: 4, headStamp: 'fierce', aF: [20, 20], aB: [-40, 40], lF: [30, 40], lB: [-20, 20], coat: 20, blade: 5, bladeLen: 6 });
  const k1 = P({ root: [25, 30], lean: 4, head: -6, headStamp: 'fierce', aF: [95, 30], aB: [-60, 30], lF: [34, 30], lB: [-24, 14], coat: 30, blade: 0, bladeLen: 11 });
  const k2 = P({ root: [25, 29], lean: -6, head: -12, headStamp: 'fierce', aF: [165, 0], aB: [-70, 40], lF: [28, 20], lB: [-26, 10], coat: 40, blade: 0, bladeLen: 11 });
  const k3 = P({ root: [24, 30], lean: 4, head: -2, aF: [40, 40], aB: [-25, 30], lF: [20, 24], lB: [-14, 12], coat: 15 });
  return { name: 'attack2', fps: 20, loop: false, poses: [k0, lerpPose(k0, k1, 0.6), k1, k2, lerpPose(k2, k3, 0.5), k3] };
}

function airAttack(): AnimDef {
  const base = P({ root: [24, 28], lean: 20, head: 0, headStamp: 'fierce', aF: [90, 0], aB: [-60, 40], lF: [50, 90], lB: [20, 70], coat: 20, blade: 0, bladeLen: 11 });
  const poses: Pose[] = [];
  const rots = [-60, 0, 70, 150, 230, 300];
  for (const r of rots) poses.push({ ...base, rot: r, pivot: base.root });
  return { name: 'airattack', fps: 24, loop: false, poses };
}

function hit(): AnimDef {
  return {
    name: 'hit',
    fps: 12,
    loop: false,
    poses: [
      P({ root: [22, 30], lean: -22, head: -18, headStamp: 'hurt', aF: [-40, 60], aB: [-70, 50], lF: [30, 30], lB: [-20, 20], coat: -10 }),
      P({ root: [23, 30], lean: -12, head: -8, headStamp: 'hurt', aF: [-10, 50], aB: [-40, 40], lF: [24, 30], lB: [-16, 20], coat: 0 }),
    ],
  };
}

function death(): AnimDef {
  const k0 = P({ root: [22, 30], lean: -28, head: -24, headStamp: 'hurt', aF: [-50, 60], aB: [-80, 40], lF: [30, 30], lB: [-24, 20], coat: -20 });
  const k1 = P({ root: [23, 32], lean: 10, head: 18, headStamp: 'hurt', aF: [10, 20], aB: [-10, 20], lF: [40, 70], lB: [-10, 60], coat: 10 });
  const k2 = P({ root: [24, 36], lean: 30, head: 30, headStamp: 'dead', aF: [5, 10], aB: [-5, 10], lF: [80, 150], lB: [70, 150], coat: 10 });
  const k3 = P({ root: [25, 40], lean: 75, head: 20, headStamp: 'dead', aF: [-30, 10], aB: [-10, 10], lF: [70, 140], lB: [60, 150], coat: 40 });
  const k4 = P({ root: [24, 41], lean: 90, head: 8, headStamp: 'dead', aF: [-90, 0], aB: [-80, 0], lF: [100, 30], lB: [95, 20], coat: 85, rot: 0 });
  return {
    name: 'death',
    fps: 10,
    loop: false,
    poses: [k0, lerpPose(k0, k1, 0.5), k1, lerpPose(k1, k2, 0.5), k2, lerpPose(k2, k3, 0.5), k3, k4],
  };
}

// ---------------------------------------------------------------------------

export const SWING_ANGLES = [-135, -112.5, -90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90, 112.5, 135];
export const SHOOT_ANGLES = [-90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90];
export const DASH_DIRS = [-90, -45, 0, 45, 90]; // up, up-forward, forward, down-forward, down

export function allAnims(): AnimDef[] {
  const list: AnimDef[] = [idle(), run(), skid(), jump(), peak(), fall(), land()];
  SHOOT_ANGLES.forEach((a, i) => list.push({ name: `shoot_${i}`, fps: 1, loop: false, poses: [shoot(a)] }));
  SWING_ANGLES.forEach((a, i) => {
    list.push({ name: `swingA_${i}`, fps: 1, loop: false, poses: [swing(a, 0)] });
    list.push({ name: `swingB_${i}`, fps: 1, loop: false, poses: [swing(a, 1)] });
  });
  list.push(release(), flip());
  DASH_DIRS.forEach((d, i) => list.push({ name: `dash_${i}`, fps: 20, loop: true, poses: dash(d) }));
  list.push(attack1(), attack2(), airAttack(), hit(), death());
  return list;
}

export interface SheetResult {
  canvas: PixelCanvas;
  json: {
    frameWidth: number;
    frameHeight: number;
    origin: V2;
    anims: Record<string, { frames: number[]; fps: number; loop: boolean }>;
    meta: FrameMeta[];
  };
}

export function buildPlayerSheet(cols = 16): SheetResult {
  const anims = allAnims();
  const frames: { canvas: PixelCanvas; meta: FrameMeta }[] = [];
  const animJson: SheetResult['json']['anims'] = {};
  for (const a of anims) {
    const idx: number[] = [];
    for (const p of a.poses) {
      idx.push(frames.length);
      frames.push(renderPose(p, FRAME));
    }
    animJson[a.name] = { frames: idx, fps: a.fps, loop: a.loop };
  }
  const rows = Math.ceil(frames.length / cols);
  const canvas = new PixelCanvas(cols * FRAME, rows * FRAME);
  frames.forEach((f, i) => canvas.blit(f.canvas, (i % cols) * FRAME, Math.floor(i / cols) * FRAME));
  const round = (v: V2): V2 => [Math.round(v[0] * 10) / 10, Math.round(v[1] * 10) / 10];
  // Feet line: one row below the lowest opaque pixel of the first idle frame.
  const idle0 = frames[animJson.idle.frames[0]].canvas;
  let lowest = 0;
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) if (idle0.alpha(x, y)) lowest = Math.max(lowest, y);
  const origin: V2 = [ORIGIN[0], lowest + 1];
  return {
    canvas,
    json: {
      frameWidth: FRAME,
      frameHeight: FRAME,
      origin,
      anims: animJson,
      meta: frames.map((f) => ({
        hand: round(f.meta.hand),
        neck: round(f.meta.neck),
        ...(f.meta.blade ? { blade: f.meta.blade.map((v) => Math.round(v * 10) / 10) as [number, number, number, number] } : {}),
      })),
    },
  };
}
