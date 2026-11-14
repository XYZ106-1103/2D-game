import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { rand } from '../core/math.ts';
import type { TileWorld } from '../physics/TileWorld.ts';
import type { Player } from '../entities/Player.ts';
import type { Particles } from '../fx/Particles.ts';
import type { Juice } from '../fx/Juice.ts';
import type { AnchorPoint } from '../entities/Grapple.ts';
import { nearestActor, type Actor, type Attacker } from '../entities/Actor.ts';
import { Projectiles } from './Projectiles.ts';
import { Enemy, type EnemyCtx, type HitKind, type HitResult } from '../entities/enemies/Enemy.ts';
import { Drone } from '../entities/enemies/Drone.ts';
import { Sentry } from '../entities/enemies/Sentry.ts';
import { Trooper } from '../entities/enemies/Trooper.ts';
import { Mine } from '../entities/enemies/Mine.ts';
import { Echo } from '../entities/enemies/Echo.ts';
import { Watcher } from '../entities/enemies/Watcher.ts';

export interface EnemyDef {
  kind: 'drone' | 'sentry' | 'trooper' | 'mine' | 'echo' | 'watcher';
  x: number;
  y: number;
}

/**
 * Owns enemies + projectiles and resolves every hit in both directions,
 * producing the feedback (hit stop, shake, sparks, flashes, combo).
 */
export class Combat {
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectiles;
  private scene: Phaser.Scene;
  private player: Player;
  private particles: Particles;
  private juice: Juice;
  private laser: Phaser.GameObjects.Graphics;
  readonly ctx: EnemyCtx;
  combo = 0;
  comboT = 0;
  bestCombo = 0;
  kills = 0;
  onCombo: ((n: number) => void) | null = null;
  /**
   * Hit feedback scope. 'fx' (host resolving the partner's hits): sparks only;
   * 'juice' (guest feeling its own hits): hitstop, shake and sound only.
   */
  feedbackMode: 'full' | 'fx' | 'juice' = 'full';
  /** Extra hook targets (e.g. boss weak points) provided by the scene. */
  extraTargets: () => AnchorPoint[] = () => [];
  /** Everyone enemies can target (set by the scene for co-op; defaults to the player). */
  actors: () => readonly Actor[];
  /** Extra hittables (boss parts). */
  extraHit: ((x: number, y: number, w: number, h: number, id: number, dmg: number, kind: HitKind, dirX: number) => HitResult) | null = null;

  constructor(scene: Phaser.Scene, world: TileWorld, player: Player, particles: Particles, juice: Juice, defs: EnemyDef[]) {
    this.scene = scene;
    this.player = player;
    this.particles = particles;
    this.juice = juice;
    this.projectiles = new Projectiles(scene, world, particles);
    this.laser = scene.add.graphics().setDepth(DEPTH.fx - 2);
    this.actors = () => [player];
    this.ctx = {
      scene,
      world,
      player,
      actors: () => this.actors(),
      target: (x, y) => nearestActor(this.actors(), x, y),
      particles,
      juice,
      projectiles: this.projectiles,
      laser: this.laser,
      boom: (x, y, big) => this.boom(x, y, big),
    };
    for (const d of defs) this.spawn(d);
    player.onZipStrike = (t) => this.zipStrike(t);
  }

  spawn(d: EnemyDef): Enemy {
    let e: Enemy;
    if (d.kind === 'drone') e = new Drone(this.ctx, d.x, d.y);
    else if (d.kind === 'sentry') e = new Sentry(this.ctx, d.x, d.y);
    else if (d.kind === 'mine') e = new Mine(this.ctx, d.x, d.y);
    else if (d.kind === 'echo') e = new Echo(this.ctx, d.x, d.y);
    else if (d.kind === 'watcher') e = new Watcher(this.ctx, d.x, d.y);
    else e = new Trooper(this.ctx, d.x, d.y);
    this.enemies.push(e);
    return e;
  }

  /** Live hook targets: enemies + extras. */
  targets(): AnchorPoint[] {
    const out: AnchorPoint[] = [];
    for (const e of this.enemies) if (e.hookable && this.near(e, 260)) out.push(e);
    return out.concat(this.extraTargets());
  }

  private near(e: Enemy, margin: number): boolean {
    const cam = this.scene.cameras.main;
    return e.x > cam.scrollX - margin && e.x < cam.scrollX + GAME_W + margin && e.y > cam.scrollY - margin && e.y < cam.scrollY + GAME_H + margin;
  }

  fixedUpdate(dt: number): void {
    const p = this.player;
    const actors = this.actors();
    this.comboT -= dt;
    if (this.comboT <= 0 && this.combo > 0) this.combo = 0;
    for (const e of this.enemies) {
      if (e.gone) continue;
      if (!this.nearAny(e, 200, actors)) continue;
      e.fixedUpdate(dt);
      if (e.dangerous) for (const a of actors) if (!a.dead && e.overlapsActor(a)) a.hurt(1, e.x);
    }
    this.projectiles.fixedUpdate(dt);
    // bolts vs players / enemies
    for (const b of this.projectiles.list) {
      if (!b.alive) continue;
      if (b.owner === 'enemy') {
        for (const a of actors) {
          const pb = a.body;
          if (!a.dead && Math.abs(b.x - pb.x) < pb.w / 2 + 1 && Math.abs(b.y - pb.y) < pb.h / 2 - 1 && a.invulnT <= 0 && !a.isDashing) {
            a.hurt(1, b.x - b.vx);
            this.projectiles.kill(b);
            break;
          }
        }
      } else {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (e.overlapsRect(b.x - 3, b.y - 2, 6, 4)) {
            const r = e.takeHit(2, Math.sign(b.vx), Math.sign(b.vy), 'bolt', b.x - b.vx * 0.05, b.y - b.vy * 0.05);
            this.feedback(r, e.x, e.y, Math.sign(b.vx), 'bolt');
            this.projectiles.kill(b);
            break;
          }
        }
      }
    }
    // player attack hitbox
    const hb = p.attackHitbox();
    if (hb) this.resolveHitbox(hb, p);
  }

  /**
   * Resolve an attack hitbox against bolts, enemies and boss parts. Used for
   * the local player and, online, for the partner's swings sent by the guest.
   */
  resolveHitbox(hb: { x: number; y: number; w: number; h: number; id: number; kind: HitKind }, by: Attacker): void {
    const deflected = this.projectiles.deflect(hb.x, hb.y, hb.w, hb.h);
    if (deflected.length) {
      this.juice.hitstop(0.05);
      this.juice.sfx('deflect');
      this.particles.impact(deflected[0].x, deflected[0].y, COLORS.cyanHot);
    }
    for (const e of this.enemies) {
      if (!e.alive || e.lastHitId === hb.id) continue;
      if (!e.overlapsRect(hb.x, hb.y, hb.w, hb.h)) continue;
      e.lastHitId = hb.id;
      const dirX = Math.sign(e.x - by.x) || by.facing;
      const r = e.takeHit(1, dirX, hb.kind === 'air' ? -0.5 : 0, hb.kind, by.x, by.y);
      this.feedback(r, e.x, e.y, dirX, hb.kind);
      if (r !== 'none') by.onAttackLanded(r, dirX, hb.kind);
    }
    if (this.extraHit) {
      const r = this.extraHit(hb.x, hb.y, hb.w, hb.h, hb.id, 1, hb.kind, by.facing);
      if (r !== 'none') by.onAttackLanded(r, by.facing, hb.kind);
    }
  }

  private nearAny(e: Enemy, margin: number, actors: readonly Actor[]): boolean {
    if (this.near(e, margin)) return true;
    // online the partner keeps enemies around them awake too
    for (const a of actors) if (a !== this.player && Math.abs(e.x - a.x) < GAME_W / 2 + margin && Math.abs(e.y - a.y) < GAME_H / 2 + margin) return true;
    return false;
  }

  private zipStrike(target: AnchorPoint): void {
    this.zipStrikeBy(this.player, target);
  }

  /** A zip strike landing on a target (the local player's, or the partner's online). */
  zipStrikeBy(p: Attacker & { attackId: number }, target: AnchorPoint): void {
    const dirX = Math.sign(target.x - p.x) || p.facing;
    if (target instanceof Enemy) {
      target.lastHitId = p.attackId;
      const r = target.takeHit(2, dirX, Math.sign(target.y - p.y) * 0.5, 'zip', p.x, p.y);
      this.feedback(r, target.x, target.y, dirX, 'zip');
      p.onAttackLanded(r, dirX, 'zip');
    } else if (this.extraHit) {
      const r = this.extraHit(target.x - 6, target.y - 6, 12, 12, p.attackId, 2, 'zip', dirX);
      this.feedback(r, target.x, target.y, dirX, 'zip');
      p.onAttackLanded(r, dirX, 'zip');
    }
  }

  /** Visual + audio + time feedback for a resolved hit. */
  feedback(r: HitResult, x: number, y: number, dirX: number, kind: HitKind): void {
    if (r === 'none') return;
    const heavy = kind === 'zip';
    const juice = this.feedbackMode !== 'fx';
    const fx = this.feedbackMode !== 'juice';
    if (r === 'block') {
      if (juice) {
        this.juice.hitstop(0.045);
        this.juice.shake(1.5, 0.08);
        this.juice.sfx('block');
      }
      if (fx) {
        this.particles.emit(x - dirX * 6, y - 4, { frames: ['block_0', 'block_1', 'block_2'], life: [0.14, 0.14], add: true, fade: false });
        this.particles.sparks(x - dirX * 6, y - 4, dirX > 0 ? 180 : 0, 70, 8, [COLORS.white, COLORS.amberHot, COLORS.amber]);
      }
      return;
    }
    if (!juice) {
      if (r === 'kill') this.kills++;
      this.particles.impact(x, y, heavy ? COLORS.white : COLORS.cyanHot);
      this.particles.sparks(x, y, dirX > 0 ? 0 : 180, 80, heavy ? 14 : 9, [COLORS.cyan, COLORS.cyanHot, COLORS.white]);
      return;
    }
    this.combo++;
    this.comboT = 1.6;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.onCombo?.(this.combo);
    if (r === 'kill') {
      this.kills++;
      this.juice.hitstop(heavy ? 0.12 : 0.09);
      this.juice.shake(heavy ? 4.5 : 3.2, 0.2);
      this.juice.aberration(0.9);
      this.juice.flash(0.12);
      this.juice.sfx('kill');
    } else {
      this.juice.hitstop(heavy ? 0.09 : 0.055);
      this.juice.shake(heavy ? 3.2 : 2, 0.12);
      this.juice.sfx(heavy ? 'zipstrike' : 'hit', { pitch: 0.95 + Math.min(0.4, this.combo * 0.05) });
    }
    if (!fx) return;
    this.particles.impact(x, y, heavy ? COLORS.white : COLORS.cyanHot);
    this.particles.sparks(x, y, dirX > 0 ? 0 : 180, 80, heavy ? 14 : 9, [COLORS.cyan, COLORS.cyanHot, COLORS.white]);
    // hit streak line
    this.particles.emit(x, y, { frame: 'speedline', speed: [0, 0], life: [0.08, 0.1], rot: rand(-30, 30), tint: COLORS.white, add: true, alpha: 0.9 });
  }

  /** Death explosion: fireball, debris, ring, light. */
  boom(x: number, y: number, big = false): void {
    const frames = ['boom_0', 'boom_1', 'boom_2', 'boom_3', 'boom_4', 'boom_5', 'boom_6'];
    this.particles.emit(x, y, { frames, life: [0.42, 0.42], fade: false, add: true, depth: DEPTH.fx + 1 });
    if (big) for (let i = 0; i < 3; i++) this.particles.emit(x + rand(-14, 14), y + rand(-10, 10), { frames, life: [0.5, 0.6], fade: false, add: true });
    for (let i = 0; i < (big ? 14 : 7); i++) {
      this.particles.emit(x, y, { frame: `shard_${i % 4}`, speed: [80, 220], angle: -90, spread: 200, gravity: 600, life: [0.5, 0.9], spin: rand(-12, 12), drag: 1 });
    }
    this.particles.sparks(x, y, -90, 360, big ? 26 : 14, [COLORS.magenta, COLORS.amberHot, COLORS.white]);
    this.particles.ring(x, y, COLORS.magenta);
    this.juice.sfx('explode', { vol: big ? 1 : 0.8 });
  }

  render(alpha: number, dt: number): void {
    this.laser.clear();
    for (const e of this.enemies) {
      if (e.gone) continue;
      e.render(alpha, dt);
    }
    this.projectiles.render();
  }

  reset(): void {
    for (const e of this.enemies) e.reset();
    this.projectiles.clear();
    this.combo = 0;
  }

  destroy(): void {
    for (const e of this.enemies) e.destroy();
    this.laser.destroy();
  }
}
