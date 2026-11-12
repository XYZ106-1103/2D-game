// LETHE Executor Unit LT-0 "ARCHIVIST" — boss art.
// Built with the same Composer (analytic shading + contact shadows + ink
// outline) as the characters, so it matches the rest of the game.
import { RAMPS } from '../../src/art/palette.ts';
import { PixelCanvas, bayer } from './pixel.ts';
import { Composer, type V2 } from './rig.ts';

const S = RAMPS.steel;
const MG = RAMPS.magenta;
const N = RAMPS.night;
type Item = { name: string; c: PixelCanvas };

const rot = (v: V2, deg: number): V2 => {
  const r = (deg * Math.PI) / 180;
  return [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r)];
};

/** Octagonal armoured shell. `open` splits it to reveal the core cavity. */
function body(open: boolean): PixelCanvas {
  const W = 96;
  const H = 72;
  const comp = new Composer(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const oct = (rx: number, ry: number, ox = 0): V2[] => {
    const pts: V2[] = [];
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      pts.push([cx + ox + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  };
  const back = comp.part();
  comp.poly(back, oct(30, 25), S, 1, true); // dark inner frame
  if (open) {
    // core cavity glow ring
    const cav = comp.part(false);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.15);
        if (d < 17) comp.plot(cav, x, y, d < 12 ? N[0] : bayer(x, y) < 0.5 ? MG[2] : MG[1]);
      }
    }
  }
  const off = open ? 11 : 0;
  for (const side of [-1, 1]) {
    const id = comp.part();
    // half shell (left or right of centre), pushed outward when open
    // explicit half-octagon: top centre → outer vertices → bottom centre
    const ox = cx + side * off;
    const ang = [-67.5, -22.5, 22.5, 67.5];
    const pts: V2[] = [[ox, cy - 27]];
    for (const a of ang) pts.push([ox + side * Math.cos((a * Math.PI) / 180) * 34, cy + Math.sin((a * Math.PI) / 180) * 28]);
    pts.push([ox, cy + 27]);
    comp.poly(id, pts, S, 3, true);
    // armour plate seams + magenta channel
    for (let y = -20; y <= 20; y += 10) {
      for (let k = 6; k < 28; k++) comp.plot(id, cx + side * (off + k), cy + y, k % 7 === 0 ? MG[4] : S[1]);
    }
    for (let y = -24; y <= 24; y++) comp.plot(id, cx + side * (off + 3), cy + y, y % 6 === 0 ? MG[5] : MG[3]);
    // shoulder mount
    const sx = cx + side * (off + 31);
    for (let y = -7; y <= 7; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y < 40) comp.plot(id, sx + x, cy - 6 + y, x * side < -2 ? S[5] : x * side > 2 ? S[2] : S[4]);
  }
  if (!open) {
    // eye socket
    const sock = comp.part(false);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < 13) comp.plot(sock, x, y, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > 11 ? S[5] : N[0]);
  }
  // underside thrusters
  const th = comp.part();
  for (const sx of [-14, 14]) {
    comp.capsule(th, [cx + sx - 4, cy + 27], [cx + sx + 4, cy + 27], 4, S, 2);
    for (let x = -3; x <= 3; x++) comp.plot(th, cx + sx + x, cy + 31, RAMPS.cyan[5]);
  }
  return comp.finish();
}

function eye(state: number): PixelCanvas {
  const c = new PixelCanvas(24, 24);
  const iris = state === 2 ? [0xffffff, MG[7], MG[6]] : state === 1 ? [MG[6], MG[5], MG[4]] : state === 3 ? [N[5], N[4], N[3]] : [MG[5], MG[4], MG[3]];
  const pupil = state === 1 ? 2.5 : state === 2 ? 1.5 : 4;
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 12);
      if (d > 10.5) continue;
      let col = d > 9 ? iris[2] : d > 6.5 ? iris[1] : d > pupil ? iris[0] : N[0];
      // aperture blades
      const a = Math.atan2(y - 12, x - 12);
      if (d > 6 && Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2 === 0 && d < 9) col = iris[2];
      if (state === 3 && Math.abs(x - y) < 1 && d > 3) col = 0x0a0612;
      c.set(x, y, col);
    }
  }
  c.set(9, 8, 0xffffff);
  c.set(10, 8, 0xffffff);
  c.set(9, 9, MG[7]);
  return c;
}

function core(f: number): PixelCanvas {
  const c = new PixelCanvas(30, 30);
  const r = 9 + Math.sin((f / 4) * Math.PI * 2) * 1.5;
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      const d = Math.hypot(x + 0.5 - 15, y + 0.5 - 15);
      if (d < r) {
        const lit = (15 - x) * 0.04 + (15 - y) * 0.05;
        c.set(x, y, d < r * 0.4 + lit * 4 ? 0xffffff : d < r * 0.7 ? MG[6] : MG[5]);
      } else if (d < r + 4 && bayer(x, y) < 0.5 - (d - r) / 10) c.set(x, y, MG[4], 200);
    }
  }
  // energy arcs
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + f * 0.7;
    for (let k = 0; k < 6; k++) c.set(15 + Math.cos(a + k * 0.12) * (r + 2), 15 + Math.sin(a + k * 0.12) * (r + 2), RAMPS.cyan[6]);
  }
  return c;
}

/** Whole arm (shoulder at the canvas centre) pointing at `deg` (0 = right, clockwise). */
function arm(deg: number, open: boolean): PixelCanvas {
  const W = 132;
  const comp = new Composer(W, W);
  const c: V2 = [W / 2, W / 2];
  const P = (x: number, y: number): V2 => {
    const v = rot([x, y], deg);
    return [c[0] + v[0], c[1] + v[1]];
  };
  const upper = comp.part();
  comp.capsule(upper, P(0, 0), P(28, 0), 6, S, 3, 1);
  for (let k = 6; k < 26; k += 5) {
    const q = P(k, -5);
    comp.plot(upper, q[0], q[1], MG[4]);
  }
  const elbow = comp.part();
  comp.capsule(elbow, P(30, 0), P(30, 0), 7, S, 4, 1);
  const fore = comp.part();
  comp.capsule(fore, P(32, 0), P(58, 0), 7.5, S, 3, 1);
  // hook-node socket (ring) on the forearm
  const ring = comp.part(false);
  for (let a = 0; a < 360; a += 6) {
    const q = P(45 + Math.cos((a * Math.PI) / 180) * 4.5, Math.sin((a * Math.PI) / 180) * 4.5);
    comp.plot(ring, q[0], q[1], RAMPS.cyan[4]);
  }
  const q0 = P(45, 0);
  comp.plot(ring, q0[0], q0[1], RAMPS.cyan[6]);
  // claw: three fingers
  const claw = comp.part();
  const spread = open ? 34 : 12;
  for (const f of [-1, 0, 1]) {
    const base = P(60, f * 4);
    const ang = f * spread;
    const v = rot([16, 0], deg + ang);
    const tip: V2 = [base[0] + v[0], base[1] + v[1]];
    comp.capsule(claw, base, tip, f === 0 ? 2.4 : 2.8, S, 4, 1);
    comp.plot(claw, tip[0], tip[1], MG[5]);
  }
  return comp.finish();
}

function shock(f: number): PixelCanvas {
  const c = new PixelCanvas(34, 22);
  const h = [8, 14, 18, 14][f];
  for (let x = 0; x < 34; x++) {
    const k = Math.sin((x / 33) * Math.PI);
    const top = 21 - Math.round(h * k);
    for (let y = top; y < 22; y++) {
      const edge = y === top;
      if (!edge && bayer(x, y) < (y - top) / (h + 1)) continue;
      c.set(x, y, edge ? 0xffffff : y - top < 3 ? MG[6] : MG[4]);
    }
  }
  return c;
}

export function buildBoss(): Item[] {
  const out: Item[] = [];
  out.push({ name: 'boss_body', c: body(false) });
  out.push({ name: 'boss_body_open', c: body(true) });
  for (let i = 0; i < 4; i++) out.push({ name: `boss_eye_${i}`, c: eye(i) });
  for (let i = 0; i < 4; i++) out.push({ name: `boss_core_${i}`, c: core(i) });
  for (let i = 0; i < 24; i++) {
    out.push({ name: `boss_arm_c_${i}`, c: arm(i * 15, false) });
    out.push({ name: `boss_arm_o_${i}`, c: arm(i * 15, true) });
  }
  for (let i = 0; i < 4; i++) out.push({ name: `boss_shock_${i}`, c: shock(i) });
  return out;
}
