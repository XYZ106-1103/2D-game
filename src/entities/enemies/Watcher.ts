import Phaser from 'phaser';
import { DEPTH } from '../../config.ts';
import { COLORS, RAMPS } from '../../art/palette.ts';
import { Enemy, type EnemyCtx, type HitKind } from './Enemy.ts';
import type { Actor } from '../Actor.ts';

/**
 * Watcher drone: patrols a lane with a searchlight pointed down. Holding the
 * player in its light raises the district alarm (or, with no alarm system,
 * it fires a bolt). Fragile and hookable — a zip strike takes it out.
 */
export class Watcher extends Enemy {
  readonly kind = 'watcher' as const;
  private sprite: Phaser.GameObjects.Image;
  private seen = 0;
  private aim = 90;
  private shotCd = 0;

  constructor(ctx: EnemyCtx, x: number, y: number) {
    super(ctx, x, y, 14, 10, 2);
    this.sprite = ctx.scene.add.image(x, y, 'ch3', 'watcher_0').setDepth(DEPTH.objects + 1);
  }

  fixedUpdate(dt: number): void {
    this.beginStep(dt);
    const b = this.body;
    this.shotCd -= dt;
    if (this.state === 'dying') {
      b.vy += 500 * dt;
      b.y += b.vy * dt;
      if (this.stateT > 0.4) {
        this.gone = true;
        this.ctx.boom(b.x, b.y, false);
        this.sprite.setVisible(false);
      }
      return;
    }
    // patrol: slow lane sweep with a bob
    const tx = this.spawnX + Math.sin(this.t * 0.5) * 70;
    b.vx += (tx - b.x) * 3 * dt - b.vx * 2 * dt;
    b.x += b.vx * dt;
    b.y = this.spawnY + Math.sin(this.t * 2) * 3;
    this.facing = b.vx >= 0 ? 1 : -1;
    // the light leans toward the travel direction
    this.aim = 90 - this.facing * 18;
    const p = this.inLight();
    if (p) {
      this.seen += dt;
      if (this.seen > 0.35) {
        if (this.ctx.alarm) this.ctx.alarm(b.x, b.y);
        else if (this.shotCd <= 0) {
          this.shotCd = 1.2;
          const dx = p.x - b.x;
          const dy = p.y - 6 - b.y;
          const d = Math.hypot(dx, dy) || 1;
          this.ctx.projectiles.spawn(b.x, b.y + 4, (dx / d) * 200, (dy / d) * 200, 'enemy', { x: b.x, y: b.y });
          this.ctx.juice.sfx('shoot', { vol: 0.6 });
        }
      }
    } else this.seen = Math.max(0, this.seen - dt * 2);
  }

  /** Whoever stands in the drone's light (either player online), or null. */
  private inLight(): Actor | null {
    const b = this.body;
    for (const p of this.ctx.actors()) {
      if (p.dead) continue;
      const dx = p.x - b.x;
      const dy = p.y - 6 - b.y;
      const d = Math.hypot(dx, dy);
      if (d > 130 || dy < 0) continue;
      let da = (Math.atan2(dy, dx) * 180) / Math.PI - this.aim;
      while (da > 180) da -= 360;
      while (da < -180) da += 360;
      if (Math.abs(da) < 16 && this.ctx.world.clear(b.x, b.y + 4, p.x, p.y - 6)) return p;
    }
    return null;
  }

  protected override onHurt(dirX: number, _dirY: number, _kind: HitKind): void {
    this.body.vx = dirX * 160;
  }

  override die(): void {
    super.die();
    this.body.vy = -80;
  }

  override reset(): void {
    super.reset();
    this.sprite.setVisible(true);
    this.seen = 0;
  }

  render(alpha: number): void {
    if (this.gone) return;
    const x = this.ix(alpha);
    const y = this.iy(alpha);
    this.sprite.setFrame(`watcher_${Math.floor(this.t * 12) % 2}`).setPosition(x, y).setFlipX(this.facing < 0);
    this.applyFlash(this.sprite);
    if (!this.alive) return;
    // searchlight cone (shared combat graphics, cleared each frame)
    const g = this.ctx.laser;
    const a0 = ((this.aim - 16) * Math.PI) / 180;
    const a1 = ((this.aim + 16) * Math.PI) / 180;
    const col = this.seen > 0 ? RAMPS.amber[4] : 0xfff4c8;
    g.fillStyle(col, this.seen > 0 ? 0.2 : 0.12);
    g.fillTriangle(x, y + 4, x + Math.cos(a0) * 130, y + 4 + Math.sin(a0) * 130, x + Math.cos(a1) * 130, y + 4 + Math.sin(a1) * 130);
    void COLORS;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
