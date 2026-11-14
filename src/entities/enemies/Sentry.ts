import Phaser from 'phaser';
import { DEPTH } from '../../config.ts';
import { RAMPS } from '../../art/palette.ts';
import { Enemy, type EnemyCtx } from './Enemy.ts';

const TURN = 3.4; // rad/s while tracking

/**
 * Floor-mounted turret. Sweeps, acquires the player, tracks with a visible
 * laser sight, locks for a beat, then fires a 3-round burst. Bolts can be
 * slashed back.
 */
export class Sentry extends Enemy {
  readonly kind = 'sentry' as const;
  override readonly hookRadius = 11;
  private base: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private angle = -Math.PI / 2;
  private shots = 0;
  private shotT = 0;
  private readonly floorY: number;

  constructor(ctx: EnemyCtx, x: number, floorY: number) {
    super(ctx, x, floorY - 9, 18, 18, 3);
    this.floorY = floorY;
    this.base = ctx.scene.add.image(x, floorY, 'enemies', 'sentry_base').setOrigin(0.5, 1).setDepth(DEPTH.objects);
    this.head = ctx.scene.add.image(x, floorY - 12, 'enemies', 'sentry_idle_18').setDepth(DEPTH.objects + 1);
    this.glow = ctx.scene.add.image(x, floorY - 12, 'fx', 'glow16').setDepth(DEPTH.objects).setBlendMode(Phaser.BlendModes.ADD).setTint(RAMPS.crimson[5]).setAlpha(0);
  }

  private get pivotY(): number {
    return this.floorY - 12;
  }

  private muzzle(): [number, number] {
    return [this.body.x + Math.cos(this.angle) * 12, this.pivotY + Math.sin(this.angle) * 12];
  }

  fixedUpdate(dt: number): void {
    this.beginStep(dt);
    const p = this.foe;
    const target = Math.atan2(p.y - 6 - this.pivotY, p.x - this.body.x);
    const sees = this.canSee(230, this.body.x, this.pivotY);
    switch (this.state) {
      case 'patrol': {
        // slow sweep around "up-forward"
        const centre = -Math.PI / 2;
        this.angle = centre + Math.sin(this.t * 0.6) * 0.9;
        if (sees) {
          this.setState('aim');
          this.ctx.juice.sfx('lock', { vol: 0.5 });
        }
        break;
      }
      case 'aim': {
        const err = this.turnTo(target, TURN * dt);
        if (!sees && this.stateT > 0.3) this.setState('cool');
        else if ((this.stateT > 0.75 && err < 0.06) || this.stateT > 1.6) {
          this.setState('lock');
          this.ctx.juice.sfx('lock', { vol: 0.6, pitch: 1.5 });
        }
        break;
      }
      case 'lock':
        if (this.stateT > 0.22) {
          this.setState('fire');
          this.shots = 0;
          this.shotT = 0;
        }
        break;
      case 'fire':
        this.shotT -= dt;
        if (this.shotT <= 0 && this.shots < 3) {
          this.shotT = 0.12;
          this.shots++;
          const [mx, my] = this.muzzle();
          const sp = 245;
          this.ctx.projectiles.spawn(mx, my, Math.cos(this.angle) * sp, Math.sin(this.angle) * sp, 'enemy', this);
          this.ctx.juice.sfx('shoot', { vol: 0.55 });
          this.ctx.particles.sparks(mx, my, (this.angle * 180) / Math.PI, 40, 4, [RAMPS.magenta[5], RAMPS.magenta[6], 0xffffff]);
        }
        if (this.shots >= 3 && this.shotT <= 0) this.setState('cool');
        break;
      case 'cool':
        if (this.stateT > 1.3) this.setState(sees ? 'aim' : 'patrol');
        break;
      case 'stagger':
        if (this.stateT > 0.3) this.setState('cool');
        break;
      case 'dying':
        if (this.stateT > 0.25 && !this.gone) {
          this.gone = true;
          this.ctx.boom(this.body.x, this.pivotY, false);
          this.head.setVisible(false);
          this.glow.setVisible(false);
          this.base.setTint(0x463d70);
        }
        break;
      default:
        break;
    }
  }

  /** Rotate toward target; returns the remaining angular error. */
  private turnTo(target: number, maxStep: number): number {
    let d = target - this.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const step = Math.max(-maxStep, Math.min(maxStep, d));
    this.angle += step;
    return Math.abs(d - step);
  }

  protected override onHurt(): void {
    if (this.state === 'aim' || this.state === 'lock') this.setState('stagger');
  }

  override reset(): void {
    super.reset();
    this.head.setVisible(true);
    this.glow.setVisible(true);
    this.base.clearTint();
    this.angle = -Math.PI / 2;
  }

  render(_alpha: number, _dt: number): void {
    const lens = this.state === 'fire' && this.shotT > 0.06 ? 'fire' : this.state === 'aim' || this.state === 'lock' || this.state === 'fire' ? 'aim' : 'idle';
    let deg = (this.angle * 180) / Math.PI;
    deg = ((deg % 360) + 360) % 360;
    const idx = Math.round(deg / 15) % 24;
    this.head.setFrame(`sentry_${lens}_${idx}`);
    this.applyFlash(this.head);
    this.applyFlash(this.base);
    if (!this.alive) this.base.setTint(0x463d70);
    const shake = this.state === 'lock' ? (Math.floor(this.t * 50) % 2 ? 1 : 0) : 0;
    this.head.setPosition(this.body.x + shake, this.pivotY);
    this.glow.setPosition(this.body.x, this.pivotY).setAlpha(lens === 'idle' ? 0.15 : 0.6);

    // laser sight
    if (this.alive && (this.state === 'aim' || this.state === 'lock')) {
      const [mx, my] = this.muzzle();
      const ex = mx + Math.cos(this.angle) * 260;
      const ey = my + Math.sin(this.angle) * 260;
      const hit = this.ctx.world.raycast(mx, my, ex, ey);
      const tx = hit ? hit.x : ex;
      const ty = hit ? hit.y : ey;
      const g = this.ctx.laser;
      const lock = this.state === 'lock';
      const n = Math.ceil(Math.hypot(tx - mx, ty - my));
      const flick = Math.floor(this.t * 30) % 2;
      for (let i = 2; i < n; i++) {
        if (!lock && (i + flick * 2) % 4 > 1) continue;
        const x = Math.round(mx + ((tx - mx) * i) / n);
        const y = Math.round(my + ((ty - my) * i) / n);
        g.fillStyle(lock ? 0xffffff : RAMPS.crimson[5], lock ? 0.95 : 0.55);
        g.fillRect(x, y, 1, 1);
      }
      if (lock) {
        g.fillStyle(RAMPS.crimson[6], 1);
        g.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3);
      }
    }
  }

  destroy(): void {
    this.base.destroy();
    this.head.destroy();
    this.glow.destroy();
  }
}
