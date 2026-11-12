import { HOOK, TILE } from '../config.ts';
import { cross } from '../core/math.ts';
import type { TileWorld } from './TileWorld.ts';

export interface Pivot {
  x: number;
  y: number;
  /** Winding side recorded when the rope wrapped around this corner. */
  side: number;
}

/**
 * Inextensible (but slack-capable) rope with corner wrapping.
 *
 * pivots[0] is the hook anchor, the last pivot is where the free segment
 * starts. `length` is the length of that free segment only; the wrapped part
 * is fixed geometry.
 */
export class Rope {
  pivots: Pivot[] = [];
  length = 0;
  private world: TileWorld;

  constructor(world: TileWorld) {
    this.world = world;
  }

  get active(): Pivot {
    return this.pivots[this.pivots.length - 1];
  }

  get attached(): boolean {
    return this.pivots.length > 0;
  }

  attach(ax: number, ay: number, px: number, py: number): void {
    this.pivots = [{ x: ax, y: ay, side: 0 }];
    this.length = Math.min(HOOK.maxLen, Math.max(HOOK.minLen, Math.hypot(px - ax, py - ay)));
  }

  detach(): void {
    this.pivots = [];
  }

  /** Total rope length currently in use (wrapped + free). */
  totalLength(): number {
    let l = this.length;
    for (let i = 1; i < this.pivots.length; i++) {
      l += Math.hypot(this.pivots[i].x - this.pivots[i - 1].x, this.pivots[i].y - this.pivots[i - 1].y);
    }
    return l;
  }

  /**
   * Wrap around tile corners the free segment crosses, and unwrap when the
   * player swings back past a corner. Call after the body moved.
   */
  updateWrapping(prevX: number, prevY: number, px: number, py: number): void {
    if (!this.attached) return;
    // --- unwrap -----------------------------------------------------------
    while (this.pivots.length > 1) {
      const cur = this.pivots[this.pivots.length - 1];
      const prev = this.pivots[this.pivots.length - 2];
      const s = Math.sign(cross(cur.x - prev.x, cur.y - prev.y, px - cur.x, py - cur.y));
      if (s !== 0 && s !== cur.side && this.world.clear(prev.x, prev.y, px, py)) {
        this.length += Math.hypot(cur.x - prev.x, cur.y - prev.y);
        this.pivots.pop();
      } else break;
    }
    // --- wrap ---------------------------------------------------------------
    for (let guard = 0; guard < 3 && this.pivots.length < HOOK.maxWraps; guard++) {
      const piv = this.active;
      const hit = this.world.raycast(piv.x, piv.y, px, py);
      if (!hit || hit.t <= 0) return;
      const corner = this.findCorner(piv, prevX, prevY, px, py);
      if (!corner) return;
      const seg = Math.hypot(corner.x - piv.x, corner.y - piv.y);
      if (seg < 1.5) return;
      const side = Math.sign(cross(corner.x - piv.x, corner.y - piv.y, px - corner.x, py - corner.y)) || 1;
      this.pivots.push({ x: corner.x, y: corner.y, side });
      this.length = Math.max(4, this.length - seg);
    }
  }

  private findCorner(
    piv: Pivot,
    prevX: number,
    prevY: number,
    px: number,
    py: number,
  ): { x: number; y: number } | null {
    return this.searchCorner(piv, prevX, prevY, px, py, true) ?? this.searchCorner(piv, prevX, prevY, px, py, false);
  }

  /**
   * Scan every solid cell inside the bounding box of the swept triangle
   * (pivot, previous player position, current position) for convex corners.
   * The corner the rope touches first is the one with the smallest angular
   * distance from the previous rope direction.
   */
  private searchCorner(
    piv: Pivot,
    prevX: number,
    prevY: number,
    px: number,
    py: number,
    strict: boolean,
  ): { x: number; y: number } | null {
    const w = this.world;
    const sweep = Math.sign(cross(prevX - piv.x, prevY - piv.y, px - piv.x, py - piv.y));
    const prevAng = Math.atan2(prevY - piv.y, prevX - piv.x);
    const x0 = Math.floor((Math.min(piv.x, prevX, px) - 1) / TILE);
    const x1 = Math.floor((Math.max(piv.x, prevX, px) + 1) / TILE);
    const y0 = Math.floor((Math.min(piv.y, prevY, py) - 1) / TILE);
    const y1 = Math.floor((Math.max(piv.y, prevY, py) + 1) / TILE);
    if ((x1 - x0) * (y1 - y0) > 900) return null;
    const maxD = Math.hypot(px - piv.x, py - piv.y) + 2;
    let best: { x: number; y: number } | null = null;
    let bestScore = Infinity;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!w.isSolid(cx, cy)) continue;
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            // convex corner: the three outside cells around it are free
            if (w.isSolid(cx + sx, cy) || w.isSolid(cx, cy + sy) || w.isSolid(cx + sx, cy + sy)) continue;
            const kx = (sx > 0 ? cx + 1 : cx) * TILE + sx * 0.6;
            const ky = (sy > 0 ? cy + 1 : cy) * TILE + sy * 0.6;
            const d = Math.hypot(kx - piv.x, ky - piv.y);
            if (d < 1.5 || d > maxD) continue;
            // must lie inside the swept wedge (between old and new rope direction)
            const c1 = Math.sign(cross(prevX - piv.x, prevY - piv.y, kx - piv.x, ky - piv.y));
            const c2 = Math.sign(cross(kx - piv.x, ky - piv.y, px - piv.x, py - piv.y));
            if (strict && sweep !== 0 && ((c1 !== 0 && c1 !== sweep) || (c2 !== 0 && c2 !== sweep))) continue;
            if (!w.clear(piv.x, piv.y, kx, ky)) continue;
            let da = Math.abs(Math.atan2(ky - piv.y, kx - piv.x) - prevAng);
            if (da > Math.PI) da = Math.PI * 2 - da;
            const score = da * 100 + d * 0.01;
            if (score < bestScore) {
              bestScore = score;
              best = { x: kx, y: ky };
            }
          }
        }
      }
    }
    return best;
  }
}
