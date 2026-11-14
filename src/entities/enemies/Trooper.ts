import Phaser from 'phaser';
import { DEPTH, TILE } from '../../config.ts';
import { COLORS } from '../../art/palette.ts';
import { Enemy, type EnemyCtx, type HitKind, type HitResult } from './Enemy.ts';

interface Sheet {
  origin: [number, number];
  anims: Record<string, { frames: number[]; fps: number; loop: boolean }>;
}

/**
 * LETHE riot trooper. Blocks frontal attacks with its shield; vulnerable from
 * behind, from above, or after a zip strike breaks its guard. Attacks with a
 * telegraphed shield bash lunge.
 */
export class Trooper extends Enemy {
  readonly kind = 'trooper' as const;
  private sprite: Phaser.GameObjects.Sprite;
  private sheet: Sheet;
  private anim = 'idle';
  private animT = 0;
  private lostT = 0;
  private bashHit = false;
  private pauseT = 0;
  private guardBroken = false;

  constructor(ctx: EnemyCtx, x: number, feetY: number) {
    super(ctx, x, feetY - 13, 12, 26, 4);
    this.sheet = ctx.scene.cache.json.get('trooper-sheet') as Sheet;
    this.sprite = ctx.scene.add.sprite(x, feetY, 'trooper', 0).setDepth(DEPTH.objects + 2);
    this.sprite.setOrigin(this.sheet.origin[0] / 48, this.sheet.origin[1] / 48);
  }

  override get hookable(): boolean {
    return this.alive;
  }

  private groundAhead(dir: number): boolean {
    const w = this.ctx.world;
    const fx = this.body.x + dir * (this.body.w / 2 + 3);
    const fy = this.body.y + this.body.h / 2 + 2;
    return w.isSolid(Math.floor(fx / TILE), Math.floor(fy / TILE));
  }

  private wallAhead(dir: number): boolean {
    const w = this.ctx.world;
    const fx = this.body.x + dir * (this.body.w / 2 + 2);
    return w.isSolid(Math.floor(fx / TILE), Math.floor(this.body.y / TILE));
  }

  fixedUpdate(dt: number): void {
    this.beginStep(dt);
    const b = this.body;
    const p = this.foe;
    const dxp = p.x - b.x;
    const dyp = p.y - b.y;
    const sees = this.canSee(170, b.x, b.y - 8) && Math.abs(dyp) < 80;
    switch (this.state) {
      case 'patrol':
        this.pauseT -= dt;
        if (this.pauseT > 0) b.vx = 0;
        else {
          if (!this.groundAhead(this.facing) || this.wallAhead(this.facing)) {
            this.facing = -this.facing;
            this.pauseT = 0.8;
          }
          b.vx = this.facing * 34;
        }
        if (sees) {
          this.setState('approach');
          this.ctx.juice.sfx('alert', { vol: 0.5 });
        }
        break;
      case 'approach': {
        this.facing = dxp > 0 ? 1 : -1;
        const dist = Math.abs(dxp);
        const canStep = this.groundAhead(this.facing) && !this.wallAhead(this.facing);
        b.vx = dist > 40 && canStep ? this.facing * 66 : 0;
        if (dist < 46 && Math.abs(dyp) < 34) this.setState('windup');
        if (!sees) {
          this.lostT += dt;
          if (this.lostT > 1.6) this.setState('patrol');
        } else this.lostT = 0;
        break;
      }
      case 'windup':
        b.vx = 0;
        this.facing = dxp > 0 ? 1 : -1;
        if (this.stateT > 0.42) {
          this.setState('bash');
          this.bashHit = false;
          this.ctx.juice.sfx('bash');
        }
        break;
      case 'bash':
        b.vx = this.groundAhead(this.facing) ? this.facing * 270 : 0;
        if (!this.bashHit && this.alive) {
          const hx = b.x + this.facing * 12;
          const pb = p.body;
          if (Math.abs(pb.x - hx) < 14 + pb.w / 2 && Math.abs(pb.y - b.y) < 16 + pb.h / 2 && !p.dead) {
            this.bashHit = true;
            p.hurt(1, b.x);
          }
        }
        if (this.stateT > 0.17) this.setState('recover');
        break;
      case 'recover':
        b.vx *= Math.exp(-10 * dt);
        if (this.stateT > 0.55) this.setState(sees ? 'approach' : 'patrol');
        break;
      case 'stagger':
        b.vx *= Math.exp(-6 * dt);
        if (this.stateT > (this.guardBroken ? 1.1 : 0.32)) {
          this.guardBroken = false;
          this.setState('approach');
        }
        break;
      case 'dying':
        b.vx *= Math.exp(-6 * dt);
        if (this.stateT > 0.55 && !this.gone) {
          this.gone = true;
          this.ctx.boom(b.x, b.y, false);
          this.sprite.setVisible(false);
        }
        break;
      default:
        break;
    }
    // gravity + collisions
    b.vy = Math.min(b.vy + 1100 * dt, 460);
    this.ctx.world.moveX(b, b.vx * dt);
    b.onGround = false;
    this.ctx.world.moveY(b, b.vy * dt);
    if (b.y > this.ctx.world.pixelHeight + 40 && this.alive) {
      this.alive = false;
      this.gone = true;
      this.sprite.setVisible(false);
    }
  }

  override takeHit(dmg: number, dirX: number, dirY: number, kind: HitKind, fromX: number, fromY: number): HitResult {
    if (!this.alive) return 'none';
    const fromFront = (fromX - this.body.x) * this.facing > 0;
    const fromAbove = fromY < this.body.y - 16;
    const guarding = this.state !== 'stagger' && this.state !== 'recover' && this.state !== 'dying';
    if (guarding && fromFront && !fromAbove) {
      if (kind === 'zip') {
        // zip strike smashes the guard open
        this.guardBroken = true;
        this.setState('stagger');
        this.body.vx = (dirX || -this.facing) * 140;
        return super.takeHit(1, dirX, dirY, kind, fromX, fromY);
      }
      if (kind === 'bolt') return 'block';
      this.flashT = 0.05;
      return 'block';
    }
    return super.takeHit(dmg, dirX, dirY, kind, fromX, fromY);
  }

  protected override onHurt(dirX: number): void {
    this.body.vx = (dirX || -this.facing) * 110;
    if (!this.guardBroken) this.setState('stagger');
  }

  override reset(): void {
    super.reset();
    this.sprite.setVisible(true);
    this.guardBroken = false;
    this.pauseT = 0;
  }

  private play(name: string): void {
    if (this.anim !== name) {
      this.anim = name;
      this.animT = 0;
    }
  }

  render(alpha: number, dt: number): void {
    if (this.gone) return;
    switch (this.state) {
      case 'patrol':
        this.play(Math.abs(this.body.vx) > 1 ? 'walk' : 'idle');
        break;
      case 'approach':
        this.play(Math.abs(this.body.vx) > 1 ? 'walk' : 'guard');
        break;
      case 'windup':
        this.play('windup');
        break;
      case 'bash':
        this.play('bash');
        break;
      case 'recover':
        this.play('guard');
        break;
      case 'stagger':
        this.play('stagger');
        break;
      case 'dying':
        this.play('death');
        break;
      default:
        this.play('idle');
    }
    this.animT += dt;
    const a = this.sheet.anims[this.anim];
    let fi = Math.floor(this.animT * a.fps);
    fi = a.loop ? fi % a.frames.length : Math.min(fi, a.frames.length - 1);
    this.sprite.setFrame(a.frames[fi]);
    this.sprite.setFlipX(this.facing < 0);
    const shake = this.state === 'windup' ? (Math.floor(this.t * 40) % 2 ? 1 : 0) : 0;
    this.sprite.setPosition(this.ix(alpha) + shake, this.iy(alpha) + this.body.h / 2);
    this.applyFlash(this.sprite);
    if (this.state === 'windup' && Math.floor(this.t * 12) % 2 === 0 && this.flashT <= 0) this.sprite.setTint(COLORS.crimsonHot);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
