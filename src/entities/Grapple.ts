import Phaser from 'phaser';
import { DEPTH, HOOK } from '../config.ts';
import { RAMPS } from '../art/palette.ts';
import { pointSegDist, RAD } from '../core/math.ts';
import { settings } from '../core/Settings.ts';
import { Rope } from '../physics/Rope.ts';
import type { TileWorld } from '../physics/TileWorld.ts';

export interface AnchorPoint {
  readonly x: number;
  readonly y: number;
  /** Enemies are hook targets too: hooking one triggers a zip strike. */
  readonly isEnemy?: boolean;
  /** Hit radius for the hook (defaults to HOOK.anchorRadius). */
  readonly hookRadius?: number;
  /** Dynamic targets report when they stop being valid. */
  readonly alive?: boolean;
  /** Anchor that moves (rope pivot follows it). */
  readonly moving?: boolean;
}

export type GrappleState = 'idle' | 'flying' | 'attached' | 'zip' | 'retract';

export interface GrappleEvents {
  onAttach(x: number, y: number, anchor: boolean, nx: number, ny: number): void;
  onHookEnemy(target: AnchorPoint): void;
  onFail(x: number, y: number, glass: boolean): void;
}

/** Hook projectile + rope rendering. Rope physics live in physics/Rope.ts and the Player. */
export class Grapple {
  state: GrappleState = 'idle';
  readonly rope: Rope;
  hx = 0;
  hy = 0;
  private hvx = 0;
  private hvy = 0;
  private travelled = 0;
  private cooldown = 0;
  private targetAnchor: AnchorPoint | null = null;
  private attachT = 0;
  private time = 0;
  private hookAngle = 0;
  private world: TileWorld;
  private g: Phaser.GameObjects.Graphics;
  private hook: Phaser.GameObjects.Image;
  private events: GrappleEvents;
  tension = 0;

  constructor(scene: Phaser.Scene, world: TileWorld, events: GrappleEvents) {
    this.world = world;
    this.rope = new Rope(world);
    this.events = events;
    this.g = scene.add.graphics().setDepth(DEPTH.rope);
    this.hook = scene.add.image(0, 0, 'fx', 'hook').setDepth(DEPTH.rope + 1).setVisible(false);
  }

  get attached(): boolean {
    return this.state === 'attached';
  }

  get busy(): boolean {
    return this.state === 'flying' || this.state === 'attached' || this.state === 'zip';
  }

  get canFire(): boolean {
    return !this.busy && this.cooldown <= 0;
  }

  /** Enemy currently being zipped to. */
  zipTarget: AnchorPoint | null = null;
  /** Anchor the rope is tied to (null for tile surfaces). */
  attachedTo: AnchorPoint | null = null;

  /** Re-grapple: drop the current line so a new shot can leave this frame. */
  forceReady(): void {
    this.rope.detach();
    if (this.busy) this.state = 'retract';
    this.zipTarget = null;
    this.cooldown = 0;
  }

  /** Pick the anchor the aim ray is closest to (aim assist). */
  static pickAnchor(world: TileWorld, fx: number, fy: number, tx: number, ty: number, anchors: AnchorPoint[]): AnchorPoint | null {
    const dx = tx - fx;
    const dy = ty - fy;
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl;
    const uy = dy / dl;
    let best: AnchorPoint | null = null;
    let bestScore = Infinity;
    for (const a of anchors) {
      const ax = a.x - fx;
      const ay = a.y - fy;
      const d = Math.hypot(ax, ay);
      if (d > HOOK.maxLen + 6 || d < 4) continue;
      const cos = (ax * ux + ay * uy) / d;
      const ang = Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
      const assist = settings.assist ? 1 : 0.35;
      const nearCursor = Math.hypot(a.x - tx, a.y - ty) < (HOOK.assistRadius + (a.hookRadius ?? 0)) * assist;
      if (ang > HOOK.assistAngleDeg * assist && !nearCursor) continue;
      if (!world.clear(fx, fy, a.x, a.y)) continue;
      // enemies slightly preferred: the zip strike is the sharper tool
      const score = (nearCursor ? ang * 0.25 : ang) * (a.isEnemy ? 0.8 : 1);
      if (score < bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
  }

  fire(fx: number, fy: number, tx: number, ty: number, anchors: AnchorPoint[]): void {
    let dx = tx - fx;
    let dy = ty - fy;
    const target = Grapple.pickAnchor(this.world, fx, fy, tx, ty, anchors);
    if (target) {
      dx = target.x - fx;
      dy = target.y - fy;
    }
    const d = Math.hypot(dx, dy) || 1;
    this.targetAnchor = target;
    this.hx = fx;
    this.hy = fy;
    this.hvx = (dx / d) * HOOK.speed;
    this.hvy = (dy / d) * HOOK.speed;
    this.hookAngle = Math.atan2(dy, dx);
    this.travelled = 0;
    this.state = 'flying';
  }

  release(immediate = false): void {
    if (this.state === 'idle' || this.state === 'retract') {
      if (immediate) this.cooldown = 0;
      return;
    }
    this.rope.detach();
    this.zipTarget = null;
    this.state = 'retract';
    this.cooldown = immediate ? 0 : HOOK.cooldown;
  }

  /** Instantly clear (death / respawn). */
  reset(): void {
    this.rope.detach();
    this.zipTarget = null;
    this.state = 'idle';
    this.hook.setVisible(false);
    this.g.clear();
  }

  fixedUpdate(dt: number, handX: number, handY: number, anchors: AnchorPoint[], bodyX: number, bodyY: number): void {
    this.time += dt;
    this.cooldown -= dt;
    if (this.state === 'flying') {
      const nx = this.hx + this.hvx * dt;
      const ny = this.hy + this.hvy * dt;
      // anchors first (they float in open air)
      let hitAnchor: AnchorPoint | null = null;
      for (const a of anchors) {
        const base = a.hookRadius ?? HOOK.anchorRadius;
        const r = a === this.targetAnchor ? base + 3 : base;
        if (pointSegDist(a.x, a.y, this.hx, this.hy, nx, ny) < r) {
          hitAnchor = a;
          break;
        }
      }
      const hit = this.world.raycast(this.hx, this.hy, nx, ny);
      if (hitAnchor && hitAnchor.isEnemy) {
        this.hx = hitAnchor.x;
        this.hy = hitAnchor.y;
        this.zipTarget = hitAnchor;
        this.state = 'zip';
        this.attachT = 0;
        this.events.onHookEnemy(hitAnchor);
        return;
      }
      if (hitAnchor) {
        this.attach(hitAnchor.x, hitAnchor.y, true, 0, 0, bodyX, bodyY);
        this.attachedTo = hitAnchor;
        return;
      }
      if (hit) {
        if (this.world.isHookable(hit.tx, hit.ty)) {
          this.attach(hit.x + hit.nx * 0.5, hit.y + hit.ny * 0.5, false, hit.nx, hit.ny, bodyX, bodyY);
        } else {
          this.hx = hit.x;
          this.hy = hit.y;
          this.events.onFail(hit.x, hit.y, true);
          this.state = 'retract';
          this.cooldown = HOOK.cooldown;
        }
        return;
      }
      this.hx = nx;
      this.hy = ny;
      this.travelled += HOOK.speed * dt;
      if (this.travelled >= HOOK.maxLen) {
        this.events.onFail(this.hx, this.hy, false);
        this.state = 'retract';
        this.cooldown = HOOK.cooldown;
      }
    } else if (this.state === 'attached' && this.attachedTo?.moving && this.rope.pivots.length) {
      // tether drones drag the rope's root along with them
      this.rope.pivots[0].x = this.hx = this.attachedTo.x;
      this.rope.pivots[0].y = this.hy = this.attachedTo.y;
    } else if (this.state === 'zip' && this.zipTarget) {
      this.hx = this.zipTarget.x;
      this.hy = this.zipTarget.y;
      this.hookAngle = Math.atan2(this.hy - handY, this.hx - handX);
    } else if (this.state === 'retract') {
      const dx = handX - this.hx;
      const dy = handY - this.hy;
      const d = Math.hypot(dx, dy);
      const step = HOOK.retractSpeed * dt;
      if (d <= step + 2) {
        this.state = 'idle';
      } else {
        this.hx += (dx / d) * step;
        this.hy += (dy / d) * step;
        this.hookAngle = Math.atan2(-dy, -dx);
      }
    }
  }

  private attach(x: number, y: number, anchor: boolean, nx: number, ny: number, bodyX: number, bodyY: number): void {
    this.attachedTo = null;
    this.hx = x;
    this.hy = y;
    this.rope.attach(x, y, bodyX, bodyY);
    this.state = 'attached';
    this.attachT = 0;
    if (!anchor && (nx || ny)) this.hookAngle = Math.atan2(-ny, -nx);
    this.events.onAttach(x, y, anchor, nx, ny);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  render(dt: number, handX: number, handY: number, speed: number): void {
    const g = this.g;
    g.clear();
    this.attachT += dt;
    const hx = Math.round(handX);
    const hy = Math.round(handY);
    if (this.state === 'idle') {
      this.hook.setVisible(false);
      return;
    }
    this.hook.setVisible(true);
    this.hook.setPosition(Math.round(this.hx), Math.round(this.hy));
    this.hook.setRotation(this.hookAngle);

    const C = RAMPS.cyan;
    if (this.state === 'zip') {
      const flash = Math.floor(this.time * 30) % 2 === 0;
      this.line(this.hx, this.hy, hx, hy, flash ? 0xffffff : C[6], RAMPS.magenta[4]);
      this.flush();
      return;
    }
    if (this.state === 'flying' || this.state === 'retract') {
      // travelling wave that settles as the line straightens
      const x0 = hx;
      const y0 = hy;
      const x1 = this.hx;
      const y1 = this.hy;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.ceil(len / 2));
      const px = -(y1 - y0) / (len || 1);
      const py = (x1 - x0) / (len || 1);
      const amp = this.state === 'flying' ? Math.min(5, len * 0.05) : 1.5;
      let lx = x0;
      let ly = y0;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const w = Math.sin(t * Math.PI) * Math.sin(t * 14 - this.time * 40) * amp;
        const x = x0 + (x1 - x0) * t + px * w;
        const y = y0 + (y1 - y0) * t + py * w;
        this.line(lx, ly, x, y, C[5], i % 4 === 0 ? C[3] : -1);
        lx = x;
        ly = y;
      }
      this.flush();
      return;
    }

    // attached: anchor → wrap pivots → free segment → hand
    const pts = this.rope.pivots.map((p) => [p.x, p.y] as [number, number]);
    pts.push([hx, hy]);
    const flash = this.attachT < 0.09;
    const hot = speed > 330;
    const core = flash ? 0xffffff : hot ? C[7] : C[5];
    const shade = flash ? C[6] : C[3];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const last = i === pts.length - 2;
      if (last) {
        const d = Math.hypot(bx - ax, by - ay);
        const slack = this.rope.length - d;
        if (slack > 3) {
          // sagging quadratic curve
          const sag = Math.min(40, Math.sqrt(slack * d) * 0.45);
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2 + sag;
          let lx = ax;
          let ly = ay;
          const n = Math.max(4, Math.ceil(d / 3));
          for (let k = 1; k <= n; k++) {
            const t = k / n;
            const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx;
            const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by;
            this.line(lx, ly, x, y, C[4], C[2]);
            lx = x;
            ly = y;
          }
          continue;
        }
      }
      this.line(ax, ay, bx, by, core, shade);
    }
    this.flush();
    // wrap points glow
    for (let i = 1; i < this.rope.pivots.length; i++) {
      const p = this.rope.pivots[i];
      g.fillStyle(C[6], 1);
      g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    // signal pulses travelling down the rope
    let total = 0;
    const segs: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segs.push(l);
      total += l;
    }
    if (total > 8) {
      const spacing = 46;
      const offset = (this.time * 260) % spacing;
      for (let s = offset; s < total; s += spacing) {
        let rem = s;
        for (let i = 0; i < segs.length; i++) {
          if (rem <= segs[i]) {
            const t = rem / segs[i];
            const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
            const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
            g.fillStyle(0xffffff, 1);
            g.fillRect(Math.round(x), Math.round(y), 1, 1);
            g.fillStyle(C[6], 1);
            g.fillRect(Math.round(x) - 1, Math.round(y), 1, 1);
            break;
          }
          rem -= segs[i];
        }
      }
    }
  }

  private cores: number[] = [];
  private shades: number[] = [];

  /** Bresenham line; points are queued and drawn in two passes (shade, then core). */
  private line(x0: number, y0: number, x1: number, y1: number, c: number, shade: number): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 1024; guard++) {
      if (shade >= 0) this.shades.push(x, y + 1, shade);
      this.cores.push(x, y, c);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  private flush(): void {
    const g = this.g;
    for (const list of [this.shades, this.cores]) {
      let last = -1;
      for (let i = 0; i < list.length; i += 3) {
        if (list[i + 2] !== last) {
          last = list[i + 2];
          g.fillStyle(last, 1);
        }
        g.fillRect(list[i], list[i + 1], 1, 1);
      }
      list.length = 0;
    }
  }

  destroy(): void {
    this.g.destroy();
    this.hook.destroy();
  }
}
