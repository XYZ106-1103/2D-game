import Phaser from 'phaser';
import { DEPTH } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import type { TileWorld } from '../physics/TileWorld.ts';
import type { Particles } from '../fx/Particles.ts';

export type Owner = 'enemy' | 'player';

export interface Bolt {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  owner: Owner;
  source: { x: number; y: number } | null;
  t: number;
}

/** Pooled energy bolts. Enemy bolts hurt the player; slashed bolts fly back. */
export class Projectiles {
  readonly list: Bolt[] = [];
  private world: TileWorld;
  private particles: Particles;

  constructor(scene: Phaser.Scene, world: TileWorld, particles: Particles) {
    this.world = world;
    this.particles = particles;
    for (let i = 0; i < 48; i++) {
      const glow = scene.add.image(0, 0, 'fx', 'glow16').setDepth(DEPTH.fx - 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setAlpha(0.7);
      const img = scene.add.image(0, 0, 'enemies', 'bolt_0').setDepth(DEPTH.fx).setVisible(false);
      this.list.push({ img, glow, alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, owner: 'enemy', source: null, t: 0 });
    }
  }

  spawn(x: number, y: number, vx: number, vy: number, owner: Owner, source: { x: number; y: number } | null = null): void {
    const b = this.list.find((p) => !p.alive);
    if (!b) return;
    Object.assign(b, { alive: true, x, y, vx, vy, life: 2.2, owner, source, t: 0 });
    b.img.setVisible(true);
    b.glow.setVisible(true).setTint(owner === 'enemy' ? COLORS.magenta : COLORS.cyan);
  }

  kill(b: Bolt, spark = true): void {
    b.alive = false;
    b.img.setVisible(false);
    b.glow.setVisible(false);
    if (spark) this.particles.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx) * 57.3, 120, 5, b.owner === 'enemy' ? [COLORS.magenta, 0xffa0d8, COLORS.white] : [COLORS.cyan, COLORS.cyanHot, COLORS.white]);
  }

  /** Reflect enemy bolts overlapping the rect back toward their shooter. */
  deflect(x: number, y: number, w: number, h: number): Bolt[] {
    const out: Bolt[] = [];
    for (const b of this.list) {
      if (!b.alive || b.owner !== 'enemy') continue;
      if (b.x < x - 3 || b.x > x + w + 3 || b.y < y - 3 || b.y > y + h + 3) continue;
      const sp = Math.hypot(b.vx, b.vy) * 1.6;
      let dx = -b.vx;
      let dy = -b.vy;
      if (b.source) {
        dx = b.source.x - b.x;
        dy = b.source.y - b.y;
      }
      const d = Math.hypot(dx, dy) || 1;
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      b.owner = 'player';
      b.life = 2;
      b.glow.setTint(COLORS.cyan);
      out.push(b);
    }
    return out;
  }

  fixedUpdate(dt: number): void {
    for (const b of this.list) {
      if (!b.alive) continue;
      b.life -= dt;
      b.t += dt;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      const hit = this.world.raycast(b.x, b.y, nx, ny);
      if (hit || b.life <= 0) {
        if (hit) {
          b.x = hit.x;
          b.y = hit.y;
        }
        this.kill(b, !!hit);
        continue;
      }
      b.x = nx;
      b.y = ny;
    }
  }

  render(): void {
    for (const b of this.list) {
      if (!b.alive) continue;
      const f = Math.floor(b.t * 20) % 2;
      b.img.setFrame(`${b.owner === 'enemy' ? 'bolt' : 'bolt_r'}_${f}`);
      b.img.setPosition(Math.round(b.x), Math.round(b.y));
      b.img.setRotation(Math.atan2(b.vy, b.vx));
      b.glow.setPosition(Math.round(b.x), Math.round(b.y));
    }
  }

  clear(): void {
    for (const b of this.list) if (b.alive) this.kill(b, false);
  }
}
