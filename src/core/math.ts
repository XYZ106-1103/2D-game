export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const sign = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const approach = (v: number, target: number, delta: number): number =>
  v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
export const len = (x: number, y: number): number => Math.hypot(x, y);
export const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;
export const dot = (ax: number, ay: number, bx: number, by: number): number => ax * bx + ay * by;
export const RAD = Math.PI / 180;
export const DEG = 180 / Math.PI;

/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Distance from point P to segment AB, plus the projection parameter. */
export function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Smooth noise for camera shake (sum of sines, cheap & deterministic). */
export function shakeNoise(t: number, seed: number): number {
  return (Math.sin(t * 37.1 + seed * 11.3) * 0.5 + Math.sin(t * 61.7 + seed * 3.7) * 0.35 + Math.sin(t * 13.3 + seed * 7.1) * 0.15);
}
