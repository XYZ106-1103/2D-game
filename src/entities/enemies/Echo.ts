import Phaser from 'phaser';
import { DEPTH } from '../../config.ts';
import { COLORS, RAMPS } from '../../art/palette.ts';
import { Enemy, type EnemyCtx, type HitKind } from './Enemy.ts';

const DELAY = 1.4; // seconds behind the player
const REFORM = 3.2;

interface Sample {
  x: number;
  y: number;
  frame: number;
  flip: boolean;
}

/**
 * 잔상 (Echo): a shadow of who ION used to be, replaying the player's own
 * path a moment behind. Touching it hurts; one cut scatters it for a while.
 * It cannot be hooked — there is nothing there to hold on to.
 */
export class Echo extends Enemy {
  readonly kind = 'echo' as const;
  private shadow: Phaser.GameObjects.Sprite;
  private ghost: Phaser.GameObjects.Sprite;
  private trail: Sample[] = [];
  private reformT = 0;
  private fade = 0;

  constructor(ctx: EnemyCtx, x: number, y: number) {
    super(ctx, x, y, 10, 22, 1);
    const p = ctx.player;
    this.ghost = ctx.scene.add.sprite(x, y, 'player', 0).setDepth(DEPTH.player - 1.2).setOrigin(p.sprite.originX, p.sprite.originY).setBlendMode(Phaser.BlendModes.ADD).setTintFill(RAMPS.cyan[4]).setAlpha(0);
    this.shadow = ctx.scene.add.sprite(x, y, 'player', 0).setDepth(DEPTH.player - 1).setOrigin(p.sprite.originX, p.sprite.originY).setTintFill(RAMPS.mono[1]).setAlpha(0);
  }

  override get hookable(): boolean {
    return false;
  }

  override get dangerous(): boolean {
    return this.alive && this.state === 'chase' && this.fade > 0.8;
  }

  fixedUpdate(dt: number): void {
    this.beginStep(dt);
    const p = this.ctx.player;
    const b = this.body;
    // record the player's path while near
    if (!p.dead) this.trail.push({ x: p.sprite.x, y: p.sprite.y, frame: Number(p.sprite.frame.name) || 0, flip: p.sprite.flipX });
    const max = Math.round(DELAY * 120);
    if (this.trail.length > max) this.trail.shift();
    switch (this.state) {
      case 'patrol':
        this.fade = Math.max(0, this.fade - dt * 2);
        if (Math.abs(p.x - this.spawnX) < 190 && Math.abs(p.y - this.spawnY) < 140 && !p.dead) {
          this.setState('form');
          this.ctx.juice.sfx('echo', { vol: 0.6 });
        }
        break;
      case 'form':
        this.fade = Math.min(1, this.stateT / 0.7);
        if (this.stateT > 0.7) this.setState('chase');
        break;
      case 'chase': {
        this.fade = 1;
        const s = this.trail[0];
        if (!s || p.dead) break;
        // glide onto the delayed path, then ride it exactly
        const tx = s.x;
        const ty = s.y - 12;
        const dx = tx - b.x;
        const dy = ty - b.y;
        const d = Math.hypot(dx, dy);
        const sp = 260 * dt;
        if (d <= sp) {
          b.x = tx;
          b.y = ty;
        } else {
          b.x += (dx / d) * sp;
          b.y += (dy / d) * sp;
        }
        this.facing = s.flip ? -1 : 1;
        if (Math.abs(p.x - b.x) > 420 || Math.abs(p.y - b.y) > 300) this.setState('scatter');
        break;
      }
      case 'scatter':
        this.fade = Math.max(0, 1 - this.stateT / 0.4);
        if (this.stateT > 0.4) {
          this.alive = false;
          this.reformT = REFORM;
          this.setState('away');
        }
        break;
      case 'away':
        this.reformT -= dt;
        if (this.reformT <= 0) {
          b.x = this.spawnX;
          b.y = this.spawnY;
          this.hp = this.maxHp;
          this.alive = true;
          this.setState('patrol');
        }
        break;
      default:
        break;
    }
  }

  override takeHit(_dmg: number, _dirX: number, _dirY: number, _kind: HitKind, _fx: number, _fy: number): ReturnType<Enemy['takeHit']> {
    if (!this.alive || this.state !== 'chase') return 'none';
    this.flashT = 0.1;
    this.setState('scatter');
    this.ctx.particles.sparks(this.body.x, this.body.y, -90, 360, 16, [RAMPS.mono[8], COLORS.cyan, COLORS.white]);
    this.ctx.juice.sfx('echo', { vol: 0.6, pitch: 0.6 });
    return 'kill';
  }

  override reset(): void {
    super.reset();
    this.trail = [];
    this.fade = 0;
  }

  render(alpha: number): void {
    const s = this.trail[0];
    const vis = this.fade > 0 && this.state !== 'away';
    this.shadow.setVisible(vis);
    this.ghost.setVisible(vis);
    if (!vis) return;
    const frame = this.state === 'chase' && s ? s.frame : 0;
    const x = this.ix(alpha);
    const y = this.iy(alpha) + 12;
    const glitch = Math.random() < 0.08 ? Math.round((Math.random() - 0.5) * 6) : 0;
    this.shadow.setFrame(frame).setFlipX(this.facing < 0).setPosition(x + glitch, y).setAlpha(0.85 * this.fade);
    this.ghost.setFrame(frame).setFlipX(this.facing < 0).setPosition(x + 1 - glitch, y).setAlpha((0.45 + Math.random() * 0.15) * this.fade);
    if (this.flashT > 0) this.shadow.setTintFill(COLORS.white);
    else this.shadow.setTintFill(RAMPS.mono[1]);
  }

  destroy(): void {
    this.shadow.destroy();
    this.ghost.destroy();
  }
}
