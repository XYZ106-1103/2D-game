import Phaser from 'phaser';
import { DEPTH } from '../../config.ts';
import { COLORS } from '../../art/palette.ts';
import { Enemy, type EnemyCtx, type HitKind } from './Enemy.ts';

/**
 * Seeker drone: hovers on patrol, spots the player, telegraphs (eye flare +
 * shake), then dashes in a straight line. Contact during the dash hurts.
 */
export class Drone extends Enemy {
  readonly kind = 'drone' as const;
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private dx = 1;
  private dy = 0;
  private cooldown = 0;

  constructor(ctx: EnemyCtx, x: number, y: number) {
    super(ctx, x, y, 14, 10, 2);
    this.sprite = ctx.scene.add.image(x, y, 'enemies', 'drone_hover_0').setDepth(DEPTH.objects + 1);
    this.glow = ctx.scene.add.image(x, y, 'fx', 'glow16').setDepth(DEPTH.objects).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.crimsonHot).setAlpha(0.5);
  }

  override get dangerous(): boolean {
    return this.alive && this.state === 'dash';
  }

  fixedUpdate(dt: number): void {
    this.beginStep(dt);
    const b = this.body;
    const p = this.foe;
    this.cooldown -= dt;
    switch (this.state) {
      case 'patrol': {
        const tx = this.spawnX + Math.sin(this.t * 0.7) * 26;
        const ty = this.spawnY + Math.sin(this.t * 1.6) * 5;
        b.vx += (tx - b.x) * 4 * dt - b.vx * 2 * dt;
        b.vy += (ty - b.y) * 4 * dt - b.vy * 2 * dt;
        if (Math.abs(b.vx) > 4) this.facing = b.vx > 0 ? 1 : -1;
        if (this.cooldown <= 0 && this.canSee(150)) {
          this.setState('windup');
          this.ctx.juice.sfx('charge', { vol: 0.6, pitch: 1.3 });
        }
        break;
      }
      case 'windup': {
        b.vx *= Math.exp(-6 * dt);
        b.vy *= Math.exp(-6 * dt);
        this.facing = p.x > b.x ? 1 : -1;
        if (this.stateT > 0.5) {
          const lx = p.x + p.body.vx * 0.12 - b.x;
          const ly = p.y - 4 + p.body.vy * 0.08 - b.y;
          const d = Math.hypot(lx, ly) || 1;
          this.dx = lx / d;
          this.dy = ly / d;
          this.setState('dash');
          this.ctx.juice.sfx('drone_dash');
        }
        break;
      }
      case 'dash': {
        b.vx = this.dx * 300;
        b.vy = this.dy * 300;
        if (this.stateT > 0.42) this.setState('recover');
        if (this.stateT % 0.04 < dt) this.ctx.particles.emit(b.x - this.dx * 8, b.y - this.dy * 8, { frame: 'px1', speed: [10, 30], life: [0.15, 0.25], tint: [COLORS.crimsonHot, COLORS.magenta], add: true });
        break;
      }
      case 'recover':
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        if (this.stateT > 0.75) {
          this.cooldown = 0.4;
          this.setState('patrol');
        }
        break;
      case 'stagger':
        b.vx *= Math.exp(-4 * dt);
        b.vy *= Math.exp(-4 * dt);
        if (this.stateT > 0.35) this.setState('recover');
        break;
      case 'dying':
        b.vy += 500 * dt;
        b.vx *= Math.exp(-1 * dt);
        if (this.stateT > 0.35 || b.hitCeil || b.onGround) this.explode();
        break;
      default:
        break;
    }
    if (this.state === 'dying' && this.gone) return;
    this.ctx.world.moveX(b, b.vx * dt);
    b.onGround = false;
    this.ctx.world.moveY(b, b.vy * dt);
    if (this.state === 'dash' && (b.hitWallX !== 0 || b.hitCeil || b.onGround)) {
      this.ctx.particles.sparks(b.x + this.dx * 7, b.y + this.dy * 5, Math.atan2(-this.dy, -this.dx) * 57.3, 90, 6);
      this.ctx.juice.sfx('clink', { vol: 0.5 });
      this.setState('stagger');
    }
  }

  private explode(): void {
    if (this.gone) return;
    this.gone = true;
    this.ctx.boom(this.body.x, this.body.y, false);
    this.sprite.setVisible(false);
    this.glow.setVisible(false);
  }

  protected override onHurt(dirX: number, dirY: number, kind: HitKind): void {
    const k = kind === 'zip' ? 260 : 190;
    this.body.vx = (dirX || -this.facing) * k;
    this.body.vy = dirY * k * 0.6 - 40;
    this.setState('stagger');
  }

  override die(): void {
    super.die();
    this.body.vy = -120;
  }

  override reset(): void {
    super.reset();
    this.sprite.setVisible(true);
    this.glow.setVisible(true);
    this.cooldown = 0;
  }

  render(alpha: number, _dt: number): void {
    if (this.gone) return;
    let frame = `drone_hover_${Math.floor(this.t * 16) % 4}`;
    let ox = 0;
    if (this.state === 'windup') {
      frame = `drone_windup_${Math.floor(this.t * 16) % 2}`;
      ox = Math.floor(this.t * 40) % 2 ? 1 : -1;
    } else if (this.state === 'dash') frame = `drone_dash_${Math.floor(this.t * 20) % 2}`;
    else if (this.state === 'stagger' || this.state === 'dying') frame = 'drone_hurt_0';
    const bob = this.state === 'patrol' ? Math.round(Math.sin(this.t * 5) * 1) : 0;
    this.sprite.setFrame(frame).setFlipX(this.facing < 0);
    this.sprite.setPosition(this.ix(alpha) + ox, this.iy(alpha) + bob);
    if (this.state === 'dash') this.sprite.setRotation(Math.atan2(this.dy, Math.abs(this.dx)) * (this.facing < 0 ? -1 : 1) * 0.6);
    else this.sprite.setRotation(0);
    this.applyFlash(this.sprite);
    this.glow.setPosition(this.sprite.x + this.facing * 5, this.sprite.y);
    this.glow.setAlpha(this.state === 'windup' ? 0.9 : this.alive ? 0.4 : 0);
  }

  destroy(): void {
    this.sprite.destroy();
    this.glow.destroy();
  }
}
