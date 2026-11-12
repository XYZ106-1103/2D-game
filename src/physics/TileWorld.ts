import { TILE } from '../config.ts';

/** Collision classes stored in the physics grid. */
export const Cell = {
  Empty: 0,
  Solid: 1, // concrete / steel — hookable
  Glass: 2, // solid, not hookable
  OneWay: 3, // catwalk: solid from above only
  Hazard: 4, // electrified rail: not solid, hurts
} as const;
export type CellType = (typeof Cell)[keyof typeof Cell];

export interface Body {
  x: number; // centre
  y: number; // centre
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  hitWallX: number; // -1/0/1 last horizontal collision
  hitCeil: boolean;
  dropThrough: number; // timer: ignore one-way platforms
}

export interface RayHit {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  t: number; // 0..1 along the segment
  cell: CellType;
}

const EPS = 0.001;

export class TileWorld {
  readonly w: number;
  readonly h: number;
  readonly cells: Uint8Array;

  constructor(w: number, h: number, cells: Uint8Array) {
    this.w = w;
    this.h = h;
    this.cells = cells;
  }

  get pixelWidth(): number {
    return this.w * TILE;
  }
  get pixelHeight(): number {
    return this.h * TILE;
  }

  cell(tx: number, ty: number): CellType {
    if (tx < 0 || tx >= this.w) return Cell.Solid; // world sides are walls
    if (ty < 0 || ty >= this.h) return Cell.Empty; // open sky / abyss
    return this.cells[ty * this.w + tx] as CellType;
  }

  isSolid(tx: number, ty: number): boolean {
    const c = this.cell(tx, ty);
    return c === Cell.Solid || c === Cell.Glass;
  }

  isHookable(tx: number, ty: number): boolean {
    return this.cell(tx, ty) === Cell.Solid;
  }

  solidAtPoint(x: number, y: number): boolean {
    return this.isSolid(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  // ---------------------------------------------------------------------------
  // Body movement (axis separated, sub-stepped)
  // ---------------------------------------------------------------------------

  moveX(b: Body, dx: number): void {
    b.hitWallX = 0;
    if (dx === 0) return;
    const steps = Math.ceil(Math.abs(dx) / 4);
    const sd = dx / steps;
    for (let i = 0; i < steps; i++) {
      const nx = b.x + sd;
      const top = Math.floor((b.y - b.h / 2 + EPS) / TILE);
      const bot = Math.floor((b.y + b.h / 2 - EPS) / TILE);
      if (sd > 0) {
        const tx = Math.floor((nx + b.w / 2 - EPS) / TILE);
        for (let ty = top; ty <= bot; ty++) {
          if (this.isSolid(tx, ty)) {
            b.x = tx * TILE - b.w / 2;
            b.vx = Math.min(0, b.vx);
            b.hitWallX = 1;
            return;
          }
        }
      } else {
        const tx = Math.floor((nx - b.w / 2 + EPS) / TILE);
        for (let ty = top; ty <= bot; ty++) {
          if (this.isSolid(tx, ty)) {
            b.x = (tx + 1) * TILE + b.w / 2;
            b.vx = Math.max(0, b.vx);
            b.hitWallX = -1;
            return;
          }
        }
      }
      b.x = nx;
    }
  }

  moveY(b: Body, dy: number): void {
    b.hitCeil = false;
    if (dy === 0) return;
    const steps = Math.ceil(Math.abs(dy) / 4);
    const sd = dy / steps;
    for (let i = 0; i < steps; i++) {
      const ny = b.y + sd;
      const left = Math.floor((b.x - b.w / 2 + EPS) / TILE);
      const right = Math.floor((b.x + b.w / 2 - EPS) / TILE);
      if (sd > 0) {
        const oldBottom = b.y + b.h / 2;
        const ty = Math.floor((ny + b.h / 2 - EPS) / TILE);
        for (let tx = left; tx <= right; tx++) {
          const c = this.cell(tx, ty);
          const solid = c === Cell.Solid || c === Cell.Glass;
          const oneway = c === Cell.OneWay && b.dropThrough <= 0 && oldBottom <= ty * TILE + 0.5;
          if (solid || oneway) {
            b.y = ty * TILE - b.h / 2;
            b.vy = Math.min(0, b.vy);
            b.onGround = true;
            return;
          }
        }
      } else {
        const ty = Math.floor((ny - b.h / 2 + EPS) / TILE);
        for (let tx = left; tx <= right; tx++) {
          if (this.isSolid(tx, ty)) {
            b.y = (ty + 1) * TILE + b.h / 2;
            b.vy = Math.max(0, b.vy);
            b.hitCeil = true;
            return;
          }
        }
      }
      b.y = ny;
    }
  }

  /** Is there ground directly under the body? */
  groundProbe(b: Body): boolean {
    const y = b.y + b.h / 2 + 0.5;
    const ty = Math.floor(y / TILE);
    const left = Math.floor((b.x - b.w / 2 + EPS) / TILE);
    const right = Math.floor((b.x + b.w / 2 - EPS) / TILE);
    for (let tx = left; tx <= right; tx++) {
      const c = this.cell(tx, ty);
      if (c === Cell.Solid || c === Cell.Glass) return true;
      if (c === Cell.OneWay && b.dropThrough <= 0 && Math.abs(b.y + b.h / 2 - ty * TILE) < 0.6) return true;
    }
    return false;
  }

  /** True if the AABB overlaps any solid cell. */
  overlapsSolid(x: number, y: number, w: number, h: number): boolean {
    const l = Math.floor((x - w / 2 + EPS) / TILE);
    const r = Math.floor((x + w / 2 - EPS) / TILE);
    const t = Math.floor((y - h / 2 + EPS) / TILE);
    const b = Math.floor((y + h / 2 - EPS) / TILE);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++) if (this.isSolid(tx, ty)) return true;
    return false;
  }

  /** Hazard overlap: electrified rails occupy the lower 7px of their cell. */
  hazardAt(x: number, y: number, w: number, h: number): boolean {
    const l = Math.floor((x - w / 2) / TILE);
    const r = Math.floor((x + w / 2) / TILE);
    const t = Math.floor((y - h / 2) / TILE);
    const b = Math.floor((y + h / 2) / TILE);
    for (let ty = t; ty <= b; ty++) {
      for (let tx = l; tx <= r; tx++) {
        if (this.cell(tx, ty) !== Cell.Hazard) continue;
        const zoneTop = ty * TILE + 8;
        if (y + h / 2 > zoneTop && x + w / 2 > tx * TILE + 1 && x - w / 2 < (tx + 1) * TILE - 1) return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Raycast (Amanatides & Woo grid traversal) against solid cells
  // ---------------------------------------------------------------------------

  raycast(x0: number, y0: number, x1: number, y1: number): RayHit | null {
    const dx = x1 - x0;
    const dy = y1 - y0;
    let tx = Math.floor(x0 / TILE);
    let ty = Math.floor(y0 / TILE);
    const endX = Math.floor(x1 / TILE);
    const endY = Math.floor(y1 / TILE);
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const tDeltaX = stepX !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = stepX > 0 ? ((tx + 1) * TILE - x0) / dx : stepX < 0 ? (tx * TILE - x0) / dx : Infinity;
    let tMaxY = stepY > 0 ? ((ty + 1) * TILE - y0) / dy : stepY < 0 ? (ty * TILE - y0) / dy : Infinity;
    if (this.isSolid(tx, ty)) {
      return { x: x0, y: y0, tx, ty, nx: 0, ny: 0, t: 0, cell: this.cell(tx, ty) };
    }
    let guard = 0;
    while (guard++ < 400) {
      if (tx === endX && ty === endY) return null;
      let t: number;
      let nx = 0;
      let ny = 0;
      if (tMaxX < tMaxY) {
        t = tMaxX;
        tMaxX += tDeltaX;
        tx += stepX;
        nx = -stepX;
      } else {
        t = tMaxY;
        tMaxY += tDeltaY;
        ty += stepY;
        ny = -stepY;
      }
      if (t > 1) return null;
      if (this.isSolid(tx, ty)) {
        return { x: x0 + dx * t, y: y0 + dy * t, tx, ty, nx, ny, t, cell: this.cell(tx, ty) };
      }
    }
    return null;
  }

  /** Line of sight between two points (no solid cells in between). */
  clear(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.raycast(x0, y0, x1, y1) === null;
  }
}

export function makeBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, hitWallX: 0, hitCeil: false, dropThrough: 0 };
}
