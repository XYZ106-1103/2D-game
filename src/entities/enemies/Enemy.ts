import Phaser from 'phaser';
import { COLORS } from '../../art/palette.ts';
import type { Body, TileWorld } from '../../physics/TileWorld.ts';
import { makeBody } from '../../physics/TileWorld.ts';
import type { Particles } from '../../fx/Particles.ts';
import type { Juice } from '../../fx/Juice.ts';
import type { Player } from '../Player.ts';
import type { Actor } from '../Actor.ts';
import type { AnchorPoint } from '../Grapple.ts';
import type { Projectiles } from '../../combat/Projectiles.ts';

export type EnemyKind = 'drone' | 'sentry' | 'trooper' | 'mine' | 'echo' | 'watcher';
export type HitKind = 'slash' | 'air' | 'zip' | 'bolt' | 'boss';
export type HitResult = 'none' | 'hit' | 'block' | 'kill';

export interface EnemyCtx {
  scene: Phaser.Scene;
  world: TileWorld;
  player: Player;
  /** Everyone enemies can target or hurt (the player, plus the co-op partner). */
  actors: () => readonly Actor[];
  /** The actor an enemy at (x, y) should go after: the nearest living one. */
  target: (x: number, y: number) => Actor;
  particles: Particles;
  juice: Juice;
  projectiles: Projectiles;
  laser: Phaser.GameObjects.Graphics;
  boom(x: number, y: number, big?: boolean): void;
  /** District alarm (chapter 3 searchlight stages), if the stage has one. */
  alarm?: (x: number, y: number) => void;
}

/** Shared enemy behaviour: body, health, hit reactions, line of sight. */
export abstract class Enemy implements AnchorPoint {
  readonly isEnemy = true;
  readonly hookRadius: number = 10;
  abstract readonly kind: EnemyKind;
  readonly body: Body;
  readonly spawnX: number;
  readonly spawnY: number;
  hp: number;
  readonly maxHp: number;
  alive = true;
  /** Fully gone (death animation finished). */
  gone = false;
  facing = -1;
  state = 'patrol';
  stateT = 0;
  flashT = 0;
  lastHitId = -1;
  protected prevX: number;
  protected prevY: number;
  protected ctx: EnemyCtx;
  protected t = Math.random() * 10;

  constructor(ctx: EnemyCtx, x: number, y: number, w: number, h: number, hp: number) {
    this.ctx = ctx;
    this.body = makeBody(x, y, w, h);
    this.spawnX = x;
    this.spawnY = y;
    this.prevX = x;
    this.prevY = y;
    this.hp = hp;
    this.maxHp = hp;
  }

  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }

  /** True while touching the enemy hurts the player. */
  get dangerous(): boolean {
    return false;
  }

  /** Whether it can currently be targeted by the grapple. */
  get hookable(): boolean {
    return this.alive;
  }

  setState(s: string): void {
    this.state = s;
    this.stateT = 0;
  }

  beginStep(dt: number): void {
    this.prevX = this.body.x;
    this.prevY = this.body.y;
    this.stateT += dt;
    this.flashT -= dt;
    this.t += dt;
  }

  /** The actor this enemy is going after right now. */
  protected get foe(): Actor {
    return this.ctx.target(this.body.x, this.body.y);
  }

  /** Line of sight + range check to the target's chest. */
  canSee(range: number, fromX = this.body.x, fromY = this.body.y): boolean {
    const p = this.foe;
    if (p.dead) return false;
    const dx = p.x - fromX;
    const dy = p.y - 6 - fromY;
    if (dx * dx + dy * dy > range * range) return false;
    return this.ctx.world.clear(fromX, fromY, p.x, p.y - 6);
  }

  overlapsPlayer(pad = 0): boolean {
    return this.overlapsActor(this.ctx.player, pad);
  }

  overlapsActor(a: Actor, pad = 0): boolean {
    const p = a.body;
    const b = this.body;
    return Math.abs(p.x - b.x) < (p.w + b.w) / 2 - 2 + pad && Math.abs(p.y - b.y) < (p.h + b.h) / 2 - 2 + pad;
  }

  overlapsRect(x: number, y: number, w: number, h: number): boolean {
    const b = this.body;
    return Math.abs(x + w / 2 - b.x) < (w + b.w) / 2 && Math.abs(y + h / 2 - b.y) < (h + b.h) / 2;
  }

  /** Apply a hit. Subclasses may block or alter the reaction. */
  takeHit(dmg: number, dirX: number, _dirY: number, _kind: HitKind, _fromX: number, _fromY: number): HitResult {
    if (!this.alive) return 'none';
    this.hp -= dmg;
    this.flashT = 0.09;
    if (dirX !== 0) this.facing = dirX > 0 ? -1 : 1;
    if (this.hp <= 0) {
      this.die();
      return 'kill';
    }
    this.onHurt(dirX, _dirY, _kind);
    return 'hit';
  }

  protected onHurt(_dirX: number, _dirY: number, _kind: HitKind): void {
    /* subclasses */
  }

  die(): void {
    this.alive = false;
    this.setState('dying');
  }

  reset(): void {
    this.body.x = this.prevX = this.spawnX;
    this.body.y = this.prevY = this.spawnY;
    this.body.vx = this.body.vy = 0;
    this.hp = this.maxHp;
    this.alive = true;
    this.gone = false;
    this.flashT = 0;
    this.lastHitId = -1;
    this.setState('patrol');
  }

  protected ix(alpha: number): number {
    return Math.round(this.prevX + (this.body.x - this.prevX) * alpha);
  }
  protected iy(alpha: number): number {
    return Math.round(this.prevY + (this.body.y - this.prevY) * alpha);
  }

  protected applyFlash(obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): void {
    if (this.flashT > 0) obj.setTintFill(COLORS.white);
    else obj.clearTint();
  }

  abstract fixedUpdate(dt: number): void;
  abstract render(alpha: number, dt: number): void;
  abstract destroy(): void;
}
