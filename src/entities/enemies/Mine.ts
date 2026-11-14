import Phaser from 'phaser';
import { DEPTH } from '../../config.ts';
import { COLORS, RAMPS } from '../../art/palette.ts';
import { Enemy, type EnemyCtx, type HitKind } from './Enemy.ts';

/**
 * Floating proximity mine: idles on a slow bob, drifts toward the player once
 * it notices them, then blinks white and detonates. Cutting or zip-striking it
 * first pops it harmlessly — and a zip strike is a free grapple point.
 */
export class Mine extends Enemy {
  readonly kind = 'mine' as const;
  override readonly hookRadius = 11;
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private respawnT = 0;

  constructor(ctx: EnemyCtx, x: number, y: number) {
    super(ctx, x, y, 12, 12, 1);
    this.glow = ctx.scene.add.image(x, y, 'fx', 'glow32').setDepth(DEPTH.objects).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.magenta).setAlpha(0.4);
    this.sprite = ctx.scene.add.image(x, y, 'ch2', 'mine_0').setDepth(DEPTH.objects + 1);
  }

  fixedUpdate(dt: number): void {
    this.beginStep(dt);
    const b = this.body;
    const p = this.foe;
    switch (this.state) {
      case 'patrol': {
        b.x += (this.spawnX - b.x) * Math.min(1, dt * 2);
        b.y = this.spawnY + Math.sin(this.t * 1.8) * 4;
        if (this.canSee(96)) {
          this.setState('seek');
          this.ctx.juice.sfx('alert', { vol: 0.4, pitch: 1.4 });
        }
        break;
      }
      case 'seek': {
        const dx = p.x - b.x;
        const dy = p.y - 6 - b.y;
        const d = Math.hypot(dx, dy) || 1;
        b.x += (dx / d) * 46 * dt;
        b.y += (dy / d) * 46 * dt;
        if (d < 24) {
          this.setState('fuse');
          this.ctx.juice.sfx('lock', { vol: 0.6, pitch: 1.6 });
        } else if (d > 170 || this.stateT > 3) this.setState('patrol');
        break;
      }
      case 'fuse':
        if (this.stateT > 0.5) this.detonate(true);
        break;
      case 'gone':
        this.respawnT -= dt;
        if (this.respawnT <= 0) {
          b.x = this.spawnX;
          b.y = this.spawnY;
          this.hp = this.maxHp;
          this.alive = true;
          this.gone = false;
          this.sprite.setVisible(true);
          this.glow.setVisible(true);
          this.ctx.particles.ring(b.x, b.y, COLORS.magenta);
          this.setState('patrol');
        }
        break;
      default:
        break;
    }
  }

  override get hookable(): boolean {
    return this.alive && this.state !== 'gone';
  }

  private detonate(harmful: boolean): void {
    const b = this.body;
    this.ctx.boom(b.x, b.y, harmful);
    if (harmful) for (const p of this.ctx.actors()) if (!p.dead && Math.hypot(p.x - b.x, p.y - 6 - b.y) < 36) p.hurt(1, b.x);
    this.alive = false;
    this.sprite.setVisible(false);
    this.glow.setVisible(false);
    this.respawnT = 6;
    this.setState('gone');
  }

  override takeHit(dmg: number, dirX: number, dirY: number, kind: HitKind, fromX: number, fromY: number): ReturnType<Enemy['takeHit']> {
    if (!this.alive) return 'none';
    void dmg;
    void dirX;
    void dirY;
    void kind;
    void fromX;
    void fromY;
    this.detonate(false);
    return 'kill';
  }

  override reset(): void {
    super.reset();
    this.sprite.setVisible(true);
    this.glow.setVisible(true);
    this.respawnT = 0;
  }

  render(alpha: number): void {
    if (this.state === 'gone') return;
    const fuse = this.state === 'fuse';
    const blink = fuse ? Math.floor(this.stateT * 16) % 2 === 0 : this.state === 'seek' ? Math.floor(this.t * 6) % 2 === 0 : false;
    this.sprite.setFrame(blink ? 'mine_warn' : `mine_${Math.floor(this.t * 3) % 2}`).setPosition(this.ix(alpha), this.iy(alpha));
    this.applyFlash(this.sprite);
    this.glow.setPosition(this.sprite.x, this.sprite.y).setTint(fuse ? COLORS.white : RAMPS.magenta[5]).setAlpha(fuse ? 0.8 : 0.35);
  }

  destroy(): void {
    this.sprite.destroy();
    this.glow.destroy();
  }
}
