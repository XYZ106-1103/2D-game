// Procedural pixel-art character rig.
//
// Pipeline per frame:
//   pose → joint solve → per-part rasterisation (analytic-normal shading)
//   → hand-authored stamps (head/torso, RotSprite-rotated)
//   → contact shadows between overlapping parts → 1px ink outline.
import { INK, RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, drawStampRotated, forEachPolyPixel, type Stamp } from './pixel.ts';
import { HEAD, TORSO, TORSO_JOINTS, TROOPER_HEAD, TROOPER_TORSO, TROOPER_JOINTS } from './stamps.ts';

export type V2 = [number, number];

export interface Pose {
  /** Waist position in frame coordinates (before global rotation). */
  root: V2;
  /** Whole-body rotation in degrees (clockwise), around `pivot` (default root). */
  rot?: number;
  pivot?: V2;
  /** Torso lean in degrees (positive = forward). */
  lean: number;
  /** Extra head tilt relative to torso. */
  head?: number;
  headStamp?: string;
  torsoStamp?: string;
  /** Front (gauntlet) arm: [shoulder angle rel. torso, elbow bend]. 0 = hanging, + = forward. */
  aF: V2;
  /** Back arm. */
  aB: V2;
  /** Legs: [hip angle (absolute, 0 = down, + = forward), knee bend (+ = shin back), foot tilt]. */
  lF: [number, number, number?];
  lB: [number, number, number?];
  /** Coat tail angle (0 = hanging, + = blown backwards). */
  coat?: number;
  /** Energy blade from the gauntlet: angle relative to forearm, or undefined. */
  blade?: number;
  bladeLen?: number;
  /** Hook claw docked on the gauntlet. */
  claw?: boolean;
}

export interface FrameMeta {
  hand: V2; // front hand (rope origin)
  neck: V2; // scarf anchor
  blade?: [number, number, number, number];
}

/** Visual identity rendered by the shared rig (player, enemies). */
export interface Skin {
  head: Record<string, Stamp>;
  torso: Record<string, Stamp>;
  joints: typeof TORSO_JOINTS;
  sleeve: readonly number[];
  sleeveBase: number;
  legs: readonly number[];
  legBase: number;
  boots: readonly number[];
  bootBase: number;
  coat: boolean;
  frontArm: 'gauntlet' | 'shield';
  backWeapon: 'none' | 'baton';
  kneePad: number | null;
  scale: number;
}

export const ION_SKIN: Skin = {
  head: HEAD,
  torso: TORSO,
  joints: TORSO_JOINTS,
  sleeve: RAMPS.jacket,
  sleeveBase: 2,
  legs: RAMPS.pants,
  legBase: 4,
  boots: RAMPS.boots,
  bootBase: 3,
  coat: true,
  frontArm: 'gauntlet',
  backWeapon: 'none',
  kneePad: RAMPS.steel[5],
  scale: 1,
};

const ARMOR = [RAMPS.night[4], RAMPS.night[5], RAMPS.night[6], RAMPS.night[7], RAMPS.night[8], RAMPS.night[9], RAMPS.night[10]];

export const TROOPER_SKIN: Skin = {
  head: TROOPER_HEAD,
  torso: TROOPER_TORSO,
  joints: TROOPER_JOINTS,
  sleeve: ARMOR,
  sleeveBase: 3,
  legs: RAMPS.pants,
  legBase: 3,
  boots: ARMOR,
  bootBase: 3,
  coat: false,
  frontArm: 'shield',
  backWeapon: 'baton',
  kneePad: RAMPS.magenta[4],
  scale: 1.06,
};

const LIGHT: V2 = norm([0.55, -0.83]);

function norm(v: V2): V2 {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}
function dirOf(deg: number): V2 {
  const r = (deg * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
}
function add(a: V2, b: V2): V2 {
  return [a[0] + b[0], a[1] + b[1]];
}
function mul(a: V2, k: number): V2 {
  return [a[0] * k, a[1] * k];
}
function rotV(v: V2, deg: number): V2 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

// Reverse lookup: color → [ramp, index] for darkening.
const COLOR_INDEX = new Map<number, [readonly number[], number]>();
for (const ramp of Object.values(RAMPS)) {
  ramp.forEach((c, i) => {
    if (!COLOR_INDEX.has(c)) COLOR_INDEX.set(c, [ramp, i]);
  });
}
export function darken(c: number, steps = 1): number {
  const e = COLOR_INDEX.get(c);
  if (!e) return c;
  return e[0][Math.max(0, e[1] - steps)];
}
export function lighten(c: number, steps = 1): number {
  const e = COLOR_INDEX.get(c);
  if (!e) return c;
  return e[0][Math.min(e[0].length - 1, e[1] + steps)];
}

interface PartInfo {
  order: number;
  casts: boolean;
}

export class Composer {
  readonly w: number;
  readonly h: number;
  readonly color: Int32Array;
  readonly owner: Int16Array;
  readonly parts: PartInfo[] = [];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.color = new Int32Array(w * h).fill(-1);
    this.owner = new Int16Array(w * h).fill(-1);
  }

  part(casts = true): number {
    this.parts.push({ order: this.parts.length, casts });
    return this.parts.length - 1;
  }

  plot(id: number, x: number, y: number, c: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.color[y * this.w + x] = c;
    this.owner[y * this.w + x] = id;
  }

  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.color[y * this.w + x];
  }

  ownerAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.owner[y * this.w + x];
  }

  /** Capsule with cylinder shading from an analytic normal. */
  capsule(id: number, a: V2, b: V2, r: number, ramp: readonly number[], base: number, rimBoost = 0): void {
    const minX = Math.floor(Math.min(a[0], b[0]) - r - 1);
    const maxX = Math.ceil(Math.max(a[0], b[0]) + r + 1);
    const minY = Math.floor(Math.min(a[1], b[1]) - r - 1);
    const maxY = Math.ceil(Math.max(a[1], b[1]) + r + 1);
    const ab: V2 = [b[0] - a[0], b[1] - a[1]];
    const len2 = ab[0] * ab[0] + ab[1] * ab[1] || 1e-6;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p: V2 = [x + 0.5, y + 0.5];
        let t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = a[0] + ab[0] * t;
        const cy = a[1] + ab[1] * t;
        const dx = p[0] - cx;
        const dy = p[1] - cy;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        let l = 0;
        if (d > 0.45) l = (dx * LIGHT[0] + dy * LIGHT[1]) / d;
        let idx = base;
        if (l > 0.42) idx = base + 1 + (l > 0.9 && rimBoost ? 1 : 0);
        else if (l < -0.45) idx = base - 1;
        this.plot(id, x, y, ramp[Math.max(0, Math.min(ramp.length - 1, idx))]);
      }
    }
  }

  poly(id: number, pts: V2[], ramp: readonly number[], base: number, topLight = true): void {
    const cells: V2[] = [];
    forEachPolyPixel(pts, (x, y) => cells.push([x, y]));
    const set = new Set(cells.map(([x, y]) => x + ',' + y));
    for (const [x, y] of cells) {
      let idx = base;
      if (topLight && !set.has(x + ',' + (y - 1))) idx = base + 1;
      else if (!set.has(x + ',' + (y + 1)) || !set.has(x - 1 + ',' + y)) idx = base - 1;
      this.plot(id, x, y, ramp[Math.max(0, Math.min(ramp.length - 1, idx))]);
    }
  }

  stamp(id: number, st: Stamp, at: V2, deg: number, transform?: (c: number) => number): void {
    drawStampRotated((x, y, c) => this.plot(id, x, y, transform ? transform(c) : c), st, at[0], at[1], deg);
  }

  /** Bake shading interactions + outline into a PixelCanvas. */
  finish(outline = INK): PixelCanvas {
    const { w, h } = this;
    const out = this.color.slice();
    // Contact shadows: a pixel whose up/front neighbour belongs to a later
    // (overlapping) part gets one ramp step darker.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const a = this.owner[i];
        if (a < 0) continue;
        const check = (nx: number, ny: number) => {
          const b = this.ownerAt(nx, ny);
          return b >= 0 && b !== a && this.parts[b].order > this.parts[a].order && this.parts[b].casts;
        };
        if (check(x, y - 1) || check(x + 1, y) || check(x + 1, y - 1)) out[i] = darken(this.color[i], 1);
      }
    }
    const c = new PixelCanvas(w, h);
    for (let i = 0; i < out.length; i++) if (out[i] >= 0) c.set(i % w, Math.floor(i / w), out[i]);
    c.outline(outline);
    return c;
  }
}

/** Render a pose into a frame. Returns canvas + anchors. */
export function renderPose(pose: Pose, size = 48, skin: Skin = ION_SKIN): { canvas: PixelCanvas; meta: FrameMeta } {
  const comp = new Composer(size, size);
  const rot = pose.rot ?? 0;
  const pivot = pose.pivot ?? pose.root;
  // Transform from pose space (unrotated) into frame space.
  const T = (p: V2): V2 => add(rotV([p[0] - pivot[0], p[1] - pivot[1]], rot), pivot);

  const root = pose.root;
  const lean = pose.lean;
  const tl = (off: V2): V2 => add(root, rotV(off, lean));

  const JT = skin.joints;
  const shoulderF = tl(JT.shoulderF);
  const shoulderB = tl(JT.shoulderB);
  const neck = tl(JT.neck);
  const scarf = tl(JT.scarf);
  const hipF = add(root, rotV(JT.hipF, lean * 0.4));
  const hipB = add(root, rotV(JT.hipB, lean * 0.4));
  const coatRoot = add(root, rotV(JT.coat, lean * 0.6));

  const UPPER = 4.6 * skin.scale;
  const FORE = 4.4 * skin.scale;
  const THIGH = 6.2 * skin.scale;
  const SHIN = 6.0 * skin.scale;

  const arm = (sh: V2, a: V2): [V2, V2, V2] => {
    const upAbs = a[0] + lean;
    const elbow = add(sh, mul(dirOf(upAbs), UPPER));
    const hand = add(elbow, mul(dirOf(upAbs + a[1]), FORE));
    return [elbow, hand, dirOf(upAbs + a[1])];
  };
  const leg = (hp: V2, l: [number, number, number?]): [V2, V2, number] => {
    const knee = add(hp, mul(dirOf(l[0]), THIGH));
    const shinAng = l[0] - l[1];
    const ankle = add(knee, mul(dirOf(shinAng), SHIN));
    return [knee, ankle, shinAng + (l[2] ?? 0)];
  };

  const [elbowB, handB] = arm(shoulderB, pose.aB);
  const [elbowF, handF, foreDirF] = arm(shoulderF, pose.aF);
  const [kneeB, ankleB, footAngB] = leg(hipB, pose.lB);
  const [kneeF, ankleF, footAngF] = leg(hipF, pose.lF);

  const J = skin.sleeve;
  const P = skin.legs;
  const B = skin.boots;
  const S = RAMPS.steel;
  const PANTS = RAMPS.pants;
  const sb = skin.sleeveBase;

  // --- back arm -----------------------------------------------------------
  const idArmB = comp.part();
  if (skin.backWeapon === 'baton') {
    // stun baton held in the back hand (drawn behind the arm)
    const bd = dirOf(pose.aB[0] + lean + pose.aB[1] + 70);
    const b0 = T(add(handB, mul(bd, -1.5)));
    const b1 = T(add(handB, mul(bd, 7.5)));
    const n = Math.ceil(Math.hypot(b1[0] - b0[0], b1[1] - b0[1]));
    for (let i = 0; i <= n; i++) {
      const x = b0[0] + ((b1[0] - b0[0]) * i) / n;
      const y = b0[1] + ((b1[1] - b0[1]) * i) / n;
      comp.plot(idArmB, x, y, i >= n - 1 ? RAMPS.magenta[6] : i >= n - 2 ? RAMPS.magenta[4] : S[2]);
    }
  }
  comp.capsule(idArmB, T(shoulderB), T(elbowB), 1.45, J, sb);
  comp.capsule(idArmB, T(elbowB), T(handB), 1.3, J, sb);
  comp.capsule(idArmB, T(handB), T(handB), 1.2, PANTS, 2);

  // --- coat tail ------------------------------------------------------------
  const coatAng = pose.coat ?? 0;
  const idCoat = comp.part();
  if (skin.coat) {
    // Tapered back flap of the jacket.
    const dTail = dirOf(-12 - coatAng);
    const side = rotV(dTail, 90);
    const p0 = add(coatRoot, [1.8, -0.8]);
    const p1 = add(coatRoot, [-0.6, -1.2]);
    const tip = add(coatRoot, mul(dTail, 6.2));
    const mid = add(add(coatRoot, mul(dTail, 3.4)), mul(side, 1.4));
    comp.poly(idCoat, [T(p1), T(p0), T(add(mid, mul(side, -2.2))), T(tip), T(mid)], J, 3, true);
  }

  // --- legs -----------------------------------------------------------------
  const drawLeg = (hp: V2, knee: V2, ankle: V2, footAng: number, dark: number) => {
    const id = comp.part();
    comp.capsule(id, T(hp), T(knee), 1.85, P, skin.legBase - dark);
    comp.capsule(id, T(knee), T(ankle), 1.6, P, skin.legBase - dark);
    // boot: oriented by foot direction (forward = +90 deg from shin)
    const fwd = dirOf(footAng + 90);
    const down = dirOf(footAng);
    const a = add(ankle, mul(down, -1.2));
    const pts: V2[] = [
      add(a, mul(fwd, -1.9)),
      add(a, mul(fwd, 1.6)),
      add(add(a, mul(fwd, 3.9)), mul(down, 2.0)),
      add(add(a, mul(fwd, 3.9)), mul(down, 3.0)),
      add(add(a, mul(fwd, -2.0)), mul(down, 3.0)),
    ];
    comp.poly(id, pts.map(T), B, skin.bootBase - dark, true);
    // sole
    const s0 = add(add(a, mul(fwd, -2.0)), mul(down, 2.6));
    const s1 = add(add(a, mul(fwd, 3.6)), mul(down, 2.6));
    const ts0 = T(s0);
    const ts1 = T(s1);
    const n = Math.max(1, Math.ceil(Math.hypot(ts1[0] - ts0[0], ts1[1] - ts0[1])));
    for (let i = 0; i <= n; i++) {
      const x = ts0[0] + ((ts1[0] - ts0[0]) * i) / n;
      const y = ts0[1] + ((ts1[1] - ts0[1]) * i) / n;
      comp.plot(id, x, y, B[Math.min(B.length - 1, skin.bootBase + 2 - dark)]);
    }
    // knee pad (front leg only)
    if (!dark && skin.kneePad !== null) {
      const kp = T(add(knee, mul(dirOf(pose.lF[0] + 90), 0.9)));
      comp.plot(id, kp[0], kp[1], skin.kneePad);
      comp.plot(id, kp[0], kp[1] + 1, darken(skin.kneePad));
    }
  };
  drawLeg(hipB, kneeB, ankleB, footAngB, 1);
  drawLeg(hipF, kneeF, ankleF, footAngF, 0);

  // --- torso ------------------------------------------------------------------
  const idTorso = comp.part();
  comp.stamp(idTorso, skin.torso[pose.torsoStamp ?? 'normal'] ?? skin.torso.normal, T(root), lean + rot);

  // --- head -------------------------------------------------------------------
  const idHead = comp.part();
  comp.stamp(idHead, skin.head[pose.headStamp ?? 'normal'] ?? skin.head.normal, T(neck), lean + (pose.head ?? 0) + rot);

  // --- front arm --------------------------------------------------------------------
  const idArmF = comp.part();
  comp.capsule(idArmF, T(shoulderF), T(elbowF), 1.5, J, sb + 1, 1);
  if (skin.frontArm === 'shield') {
    comp.capsule(idArmF, T(elbowF), T(handF), 1.4, J, sb + 1, 1);
    comp.capsule(idArmF, T(handF), T(handF), 1.25, PANTS, 3);
    // riot shield: tall slab held in front of the fist, aligned with the torso
    const idShield = comp.part();
    const up = dirOf(180 + lean * 0.6);
    const fwd = dirOf(90 + lean * 0.6);
    const c = add(handF, mul(fwd, 2.2));
    const hw = 2.4;
    const hh = 9.5;
    const quad = (u0: number, u1: number, v0: number, v1: number): V2[] => [
      add(add(c, mul(fwd, u0)), mul(up, v0)),
      add(add(c, mul(fwd, u1)), mul(up, v0)),
      add(add(c, mul(fwd, u1)), mul(up, v1)),
      add(add(c, mul(fwd, u0)), mul(up, v1)),
    ];
    comp.poly(idShield, quad(-hw, hw, -hh, hh).map(T), ARMOR, 4, true);
    // dark viewport + magenta stripe
    comp.poly(idShield, quad(-hw + 1.2, hw - 0.6, 3.5, 7.5).map(T), RAMPS.night, 2, false);
    comp.poly(idShield, quad(-hw + 0.9, hw - 0.3, -2.2, -0.8).map(T), RAMPS.magenta, 4, false);
    return { canvas: comp.finish(), meta: { hand: T(handF), neck: T(scarf) } };
  }
  // gauntlet: bulkier steel forearm (ION)
  comp.capsule(idArmF, T(elbowF), T(add(handF, mul(foreDirF, -0.6))), 1.85, S, 4, 1);
  // cyan core light on the gauntlet
  const core = T(add(add(elbowF, mul(foreDirF, 1.6)), rotV(mul(foreDirF, 1.1), -90)));
  comp.plot(idArmF, core[0], core[1], RAMPS.cyan[6]);
  const core2 = T(add(add(elbowF, mul(foreDirF, 2.6)), rotV(mul(foreDirF, 1.1), -90)));
  comp.plot(idArmF, core2[0], core2[1], RAMPS.cyan[5]);
  // fist
  comp.capsule(idArmF, T(handF), T(handF), 1.25, P, 3);
  if (pose.claw !== false) {
    const tip = T(add(handF, mul(foreDirF, 2.0)));
    const tipBase = T(add(handF, mul(foreDirF, 0.9)));
    comp.plot(idArmF, tipBase[0], tipBase[1], S[6]);
    comp.plot(idArmF, tip[0], tip[1], S[5]);
  }

  let bladeMeta: FrameMeta['blade'];
  if (pose.blade !== undefined) {
    const bd = dirOf(pose.aF[0] + lean + pose.aF[1] + pose.blade);
    const len = pose.bladeLen ?? 10;
    const start = add(handF, mul(bd, 1.5));
    const end = add(handF, mul(bd, len));
    const idBlade = comp.part(false);
    const ts = T(start);
    const te = T(end);
    const n = Math.ceil(Math.hypot(te[0] - ts[0], te[1] - ts[1]));
    for (let i = 0; i <= n; i++) {
      const x = ts[0] + ((te[0] - ts[0]) * i) / n;
      const y = ts[1] + ((te[1] - ts[1]) * i) / n;
      comp.plot(idBlade, x, y, i > n - 2 ? RAMPS.cyan[7] : RAMPS.cyan[6]);
    }
    bladeMeta = [ts[0], ts[1], te[0], te[1]];
  }

  const canvas = comp.finish();
  return {
    canvas,
    meta: { hand: T(add(handF, mul(foreDirF, 1.5))), neck: T(scarf), blade: bladeMeta },
  };
}
