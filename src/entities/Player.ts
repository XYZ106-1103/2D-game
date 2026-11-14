import Phaser from 'phaser';
import { DEPTH, HOOK, PLAYER } from '../config.ts';
import { approach, clamp, sign, DEG } from '../core/math.ts';
import type { Input } from '../core/Input.ts';
import { makeBody, type Body, type TileWorld } from '../physics/TileWorld.ts';
import { Grapple, type AnchorPoint } from './Grapple.ts';
import { Scarf } from './Scarf.ts';
import type { Particles } from '../fx/Particles.ts';
import type { Juice } from '../fx/Juice.ts';
import { COLORS } from '../art/palette.ts';
import type { HitKind, HitResult } from './enemies/Enemy.ts';

export interface PlayerSheet {
  frameWidth: number;
  frameHeight: number;
  origin: [number, number];
  anims: Record<string, { frames: number[]; fps: number; loop: boolean }>;
  meta: { hand: [number, number]; neck: [number, number]; blade?: [number, number, number, number] }[];
}

/** External controller that drives the body (e.g. riding a zip line). Return false to let go. */
export interface Carrier {
  step(dt: number, p: Player, jump: boolean, grappleHeld: boolean): boolean;
}

/** Moving platform / dynamic box provided by stage devices each step. */
export interface Plat {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Displacement during this step (already applied to x/y). */
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  /** Solid sides & bottom (crates); otherwise a one-way top. */
  solid: boolean;
}

export interface WaterState {
  /** Fraction of the body below the surface (0..1). */
  depth: number;
  cx: number;
  cy: number;
}

const SWING_ANGLES = [-135, -112.5, -90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90, 112.5, 135];
const SHOOT_ANGLES = [-90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90];

type AttackKind = 'attack1' | 'attack2' | 'airattack';

function grappleHeldNow(locked: boolean, input: Input): boolean {
  return !locked && input.grappleHeld;
}

export class Player {
  readonly body: Body;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly grapple: Grapple;
  readonly scarf: Scarf;
  private sheet: PlayerSheet;
  private world: TileWorld;
  private fx: Particles;
  private juice: Juice;

  facing = 1;
  hp: number = PLAYER.hp;
  dead = false;
  deadT = 0;
  fellOut = false;
  controlLocked = false;
  /** Set each step by stage devices (zero-g pockets). */
  gravityScale = 1;
  /** Zip line ride etc. */
  carrier: Carrier | null = null;
  /** Moving platforms and crates near the player (set by devices every step). */
  platforms: Plat[] = [];
  /** Water the player is in (set by devices every step). */
  water: WaterState | null = null;
  private ridePlat: Plat | null = null;
  private swimCd = 0;

  // timers & state
  private coyote = 0;
  private jumpBuf = 0;
  private jumpT = 0;
  private grappleBuf = 0;
  private jumping = false;
  private airDashes = 1;
  private dashT = 0;
  private dashCd = 0;
  private dashDx = 1;
  private dashDy = 0;
  private dashIdx = 2;
  private attackT = 0;
  private attackKind: AttackKind | null = null;
  private comboT = 0;
  private landT = 0;
  private hurtT = 0;
  invulnT = 0;
  private shootT = 0;
  private shootIdx = 4;
  private releaseT = 0;
  private flipT = 0;
  private stepDist = 0;
  private trailT = 0;
  private prevX = 0;
  private prevY = 0;

  // animation
  private anim = 'idle';
  private animT = 0;
  private frame = 0;

  // afterimages
  private ghosts: { img: Phaser.GameObjects.Image; t: number }[] = [];
  private slash: Phaser.GameObjects.Image;
  private slashT = 1;
  private slashKind: AttackKind = 'attack1';

  aimX = 0;
  aimY = 0;
  /** Increments per attack swing so each swing hits a target once. */
  attackId = 0;
  /** Set by the combat system: resolve a zip strike on arrival. */
  onZipStrike: ((target: AnchorPoint) => void) | null = null;
  private zipT = 0;
  private zipBlocked = 0;
  /**
   * Hooking something behind you while still holding the run key: that held
   * direction is ignored for pumping (it would fight the swing back) until the
   * key is released or ~1 s passes.
   */
  private pumpLock = 0;
  private pumpLockT = 0;
  private lastMx = 0;
  /** Horizontal input of the last step (-1, 0, 1). */
  get lastInput(): number {
    return this.lastMx;
  }

  constructor(scene: Phaser.Scene, world: TileWorld, x: number, y: number, fx: Particles, juice: Juice) {
    this.world = world;
    this.fx = fx;
    this.juice = juice;
    this.sheet = scene.cache.json.get('player-sheet') as PlayerSheet;
    this.body = makeBody(x, y - PLAYER.h / 2, PLAYER.w, PLAYER.h);
    this.prevX = this.body.x;
    this.prevY = this.body.y;
    this.sprite = scene.add.sprite(x, y, 'player', 0).setDepth(DEPTH.player);
    this.sprite.setOrigin(this.sheet.origin[0] / this.sheet.frameWidth, this.sheet.origin[1] / this.sheet.frameHeight);
    this.scarf = new Scarf(scene, x, y - 20);
    for (let i = 0; i < 14; i++) {
      const img = scene.add.image(0, 0, 'player', 0).setVisible(false).setDepth(DEPTH.afterimage).setBlendMode(Phaser.BlendModes.ADD);
      img.setOrigin(this.sprite.originX, this.sprite.originY);
      this.ghosts.push({ img, t: 0 });
    }
    this.slash = scene.add.image(0, 0, 'fx', 'slash_0').setVisible(false).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
    this.slash.setOrigin(14 / 48, 0.5);

    this.grapple = new Grapple(scene, world, {
      onAttach: (ax, ay, anchor, nx, ny) => {
        this.airDashes = 1;
        const away = Math.sign(this.body.x - ax);
        this.pumpLock = !this.body.onGround && away !== 0 && this.lastMx === away && Math.abs(this.body.x - ax) > 6 ? away : 0;
        this.pumpLockT = 0;
        this.juice.shake(1.6, 0.09);
        this.juice.sfx('attach', { pitch: anchor ? 1.15 : 1 });
        this.fx.ring(ax, ay, anchor ? COLORS.cyanHot : COLORS.cyan);
        const ang = anchor ? -90 : Math.atan2(ny, nx) * DEG;
        this.fx.sparks(ax, ay, ang, anchor ? 360 : 120, anchor ? 10 : 12);
      },
      onHookEnemy: () => {
        this.zipT = 0;
        this.zipBlocked = 0;
        this.airDashes = 1;
        this.dashT = 0;
        this.juice.sfx('zip');
        this.juice.shake(1.2, 0.06);
        this.juice.aberration(0.5);
      },
      onFail: (fx, fy, glass) => {
        this.juice.sfx(glass ? 'clink' : 'miss');
        if (glass) this.fx.sparks(fx, fy, -90, 160, 8, [COLORS.white, 0xb8c4dc, 0x8090b0]);
      },
    });
  }

  // ---------------------------------------------------------------------------

  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }
  get feetY(): number {
    return this.body.y + this.body.h / 2;
  }
  get speed(): number {
    return Math.hypot(this.body.vx, this.body.vy);
  }
  get isDashing(): boolean {
    return this.dashT > 0;
  }
  get onGround(): boolean {
    return this.body.onGround;
  }

  private frameMeta() {
    return this.sheet.meta[this.frame] ?? this.sheet.meta[0];
  }

  /** World position of a frame-space point for the current frame. */
  private framePoint(px: number, py: number): [number, number] {
    const ox = this.sheet.origin[0];
    const oy = this.sheet.origin[1];
    return [this.sprite.x + (px - ox) * this.facing, this.sprite.y + (py - oy)];
  }

  handPos(): [number, number] {
    const m = this.frameMeta();
    return this.framePoint(m.hand[0], m.hand[1]);
  }

  /** Hand position in simulation space (not interpolated). */
  private simHand(): [number, number] {
    const m = this.frameMeta();
    const ox = this.sheet.origin[0];
    const oy = this.sheet.origin[1];
    return [this.body.x + (m.hand[0] - ox) * this.facing, this.feetY + (m.hand[1] - oy)];
  }

  respawn(x: number, y: number): void {
    this.body.x = x;
    this.body.y = y - PLAYER.h / 2;
    this.body.vx = this.body.vy = 0;
    this.prevX = this.body.x;
    this.prevY = this.body.y;
    this.hp = PLAYER.hp;
    this.dead = false;
    this.fellOut = false;
    this.deadT = 0;
    this.hurtT = 0;
    this.invulnT = 1;
    this.dashT = 0;
    this.attackT = 0;
    this.grapple.reset();
    this.carrier = null;
    this.ridePlat = null;
    this.water = null;
    this.sprite.setVisible(true);
    this.scarf.reset(x, y - 20);
    this.setAnim('land', true);
    this.landT = 0.2;
  }

  // ---------------------------------------------------------------------------
  // Simulation (fixed step)
  // ---------------------------------------------------------------------------

  fixedUpdate(dt: number, input: Input, anchors: AnchorPoint[]): void {
    const b = this.body;
    this.prevX = b.x;
    this.prevY = b.y;

    if (this.dead) {
      this.deadT += dt;
      b.vy = Math.min(b.vy + PLAYER.gravity * dt, PLAYER.maxFall);
      b.vx = approach(b.vx, 0, 600 * dt);
      this.world.moveX(b, b.vx * dt);
      b.onGround = false;
      this.world.moveY(b, b.vy * dt);
      this.grapple.fixedUpdate(dt, b.x, b.y, anchors, b.x, b.y);
      return;
    }

    // timers
    this.jumpBuf -= dt;
    this.grappleBuf -= dt;
    this.dashCd -= dt;
    this.attackT -= dt;
    this.comboT -= dt;
    this.landT -= dt;
    this.hurtT -= dt;
    this.invulnT -= dt;
    this.shootT -= dt;
    this.releaseT -= dt;
    this.flipT -= dt;
    b.dropThrough -= dt;

    const locked = this.controlLocked || this.hurtT > 0.15;
    const take = (a: string) => !locked && input.take(a);
    if (take('jump')) this.jumpBuf = PLAYER.jumpBuffer;
    const wantDash = take('dash');
    const wantAttack = take('attack');
    if (take('grapple')) {
      this.grappleBuf = 0.18;
      // pressing again mid-swing chains straight to a new target
      if (this.grapple.busy) {
        this.releaseRope(false);
        this.grapple.forceReady();
      }
    }
    const grappleHeld = !locked && input.grappleHeld;
    // buffered fire: a press during cooldown/retract still fires while held
    const wantGrapple = this.grappleBuf > 0 && (grappleHeld || this.grappleBuf > 0.1);
    const mx = locked ? 0 : input.moveX;
    this.lastMx = mx;

    // --- external carrier (zip line) ----------------------------------------------
    if (this.carrier) {
      const jump = this.jumpBuf > 0;
      if (jump) this.jumpBuf = 0;
      this.grappleBuf = 0;
      if (!this.carrier.step(dt, this, jump, grappleHeldNow(locked, input))) {
        this.carrier = null;
        this.releaseT = 0.25;
        this.airDashes = 1;
      }
      const [hx0, hy0] = this.simHand();
      this.grapple.fixedUpdate(dt, hx0, hy0, anchors, b.x, b.y);
      if (this.world.hazardAt(b.x, b.y, b.w - 2, b.h)) this.hurt(1, b.x, true);
      if (b.y > this.world.pixelHeight + 60) this.die(true);
      return;
    }
    this.carryPlatform();

    // --- grapple fire / release -------------------------------------------------
    if (wantGrapple && this.grapple.canFire && this.dashT <= 0) {
      this.grappleBuf = 0;
      if (Math.abs(this.aimX - b.x) > 2) this.facing = this.aimX < b.x ? -1 : 1;
      let [hx, hy] = this.simHand();
      // never launch from inside geometry (hand pressed into a wall)
      if (this.world.solidAtPoint(hx, hy) || !this.world.clear(b.x, b.y - 4, hx, hy)) {
        hx = b.x;
        hy = b.y - 4;
      }
      const ang = Math.atan2(this.aimY - hy, (this.aimX - hx) * this.facing) * DEG;
      this.shootIdx = nearestIndex(SHOOT_ANGLES, clamp(ang, -90, 90));
      this.shootT = 0.2;
      this.grapple.fire(hx, hy, this.aimX, this.aimY, anchors);
      this.juice.sfx('fire');
      this.fx.sparks(hx, hy, Math.atan2(this.aimY - hy, this.aimX - hx) * DEG, 40, 5);
    }
    if ((this.grapple.attached || this.grapple.state === 'flying') && !grappleHeld) this.releaseRope(false);

    // --- dash ------------------------------------------------------------------------
    if (wantDash && this.dashCd <= 0 && (b.onGround || this.airDashes > 0)) this.startDash(input);

    // --- attack -----------------------------------------------------------------------
    if (wantAttack && this.attackT <= 0.08 && this.dashT <= 0 && this.grapple.state !== 'zip') this.startAttack();

    // --- movement -------------------------------------------------------------------
    if (this.grapple.state === 'zip') this.zipStep(dt);
    else if (this.dashT > 0) this.dashStep(dt);
    else if (this.grapple.attached) this.swingStep(dt, input, mx);
    else this.normalStep(dt, input, mx);

    // hand position for the hook projectile (simulation space)
    const [hx, hy] = this.simHand();
    this.grapple.fixedUpdate(dt, hx, hy, anchors, b.x, b.y);

    // --- hazards & bounds ------------------------------------------------------------
    if (this.world.hazardAt(b.x, b.y, b.w - 2, b.h)) {
      this.hurt(1, b.x, true);
      this.fx.zap(b.x, this.feetY - 4);
    }
    if (b.y > this.world.pixelHeight + 60) this.die(true);

    // footsteps
    if (b.onGround && Math.abs(b.vx) > 40 && this.dashT <= 0) {
      this.stepDist += Math.abs(b.vx) * dt;
      if (this.stepDist > 26) {
        this.stepDist = 0;
        this.juice.sfx('step', { vol: 0.5 });
        if (Math.abs(b.vx) > 120 && Math.random() < 0.35) this.fx.dust(b.x - sign(b.vx) * 3, this.feetY, -sign(b.vx), 1);
      }
    }
  }

  private normalStep(dt: number, input: Input, mx: number): void {
    const b = this.body;
    const P = PLAYER;
    if (this.water && this.water.depth > 0.2) {
      this.waterStep(dt, input, mx);
      return;
    }
    if (b.onGround) {
      this.coyote = P.coyote;
      this.airDashes = 1;
    }

    const max = P.runSpeed;
    if (b.onGround) {
      if (mx !== 0) {
        const turning = sign(b.vx) !== mx && Math.abs(b.vx) > 10;
        if (Math.abs(b.vx) > max && sign(b.vx) === mx) b.vx = approach(b.vx, mx * max, P.overspeedDrag * 3 * dt);
        else b.vx = approach(b.vx, mx * max, (turning ? P.turnAccel : P.groundAccel) * dt);
        if (turning && Math.abs(b.vx) > 90 && Math.random() < 0.3) this.fx.dust(b.x, this.feetY, -mx, 1);
      } else b.vx = approach(b.vx, 0, P.groundDecel * dt);
    } else {
      if (mx !== 0) {
        if (Math.abs(b.vx) <= max || sign(b.vx) !== mx) b.vx = approach(b.vx, mx * max, P.airAccel * dt);
        else b.vx = approach(b.vx, mx * max, P.overspeedDrag * dt);
      } else b.vx = approach(b.vx, 0, (Math.abs(b.vx) > max ? P.overspeedDrag * 0.5 : P.airDecel) * dt);
    }
    if (mx !== 0 && this.attackT <= 0) this.facing = mx;

    // jump (with drop-through on one-way platforms)
    if (this.jumpBuf > 0 && (b.onGround || this.coyote > 0)) {
      if (input.downHeld && b.onGround && this.onOneWay()) {
        b.dropThrough = 0.25;
        b.onGround = false;
        this.jumpBuf = 0;
      } else {
        b.vy = -P.jumpVel;
        this.jumping = true;
        this.jumpT = 0;
        this.jumpBuf = 0;
        this.coyote = 0;
        b.onGround = false;
        this.juice.sfx('jump');
        this.fx.dust(b.x, this.feetY, 1, 1);
        this.fx.dust(b.x, this.feetY, -1, 1);
        this.setAnim('jump', true);
      }
    }
    // coyote time counts down only after this step's jump check, so the
    // configured window is exact
    if (!b.onGround) this.coyote -= dt;

    // variable height: releasing early cuts the jump, but never below a
    // minimum hop (so a buffered tap that was already released still jumps)
    this.jumpT += dt;
    if (this.jumping && !input.jumpHeld && b.vy < 0 && this.jumpT >= P.minJumpTime) {
      b.vy *= P.jumpCut;
      this.jumping = false;
    }
    if (b.vy >= 0) this.jumping = false;

    let g = P.gravity;
    if (b.vy > 0) g *= P.fallGravityMul;
    if (!b.onGround && Math.abs(b.vy) < P.apexThreshold && input.jumpHeld) g *= P.apexGravityMul;
    if (this.attackKind === 'airattack' && this.attackT > 0) g *= 0.45;
    g *= this.gravityScale;
    const maxFall = this.gravityScale < 1 ? P.maxFall * (0.4 + 0.6 * this.gravityScale) : P.maxFall;
    if (this.gravityScale < 1 && b.vy > maxFall) b.vy -= Math.min(b.vy - maxFall, 900 * dt);
    else b.vy = Math.min(b.vy + g * dt, maxFall);

    this.integrate(dt);
  }

  private integrate(dt: number): void {
    const b = this.body;
    const vyBefore = b.vy;
    const prevX = b.x;
    const prevBottom = b.y + b.h / 2;
    const prevTop = b.y - b.h / 2;
    this.world.moveX(b, b.vx * dt);
    const wasGround = b.onGround;
    b.onGround = false;
    this.world.moveY(b, b.vy * dt);
    if (!b.onGround && b.vy >= 0) b.onGround = this.world.groundProbe(b);
    if (this.platforms.length) this.collidePlatforms(prevX, prevBottom, prevTop);
    if (b.onGround && !wasGround) this.onLand(vyBefore);
  }

  /** Ride the platform stood on last step (it has already moved). */
  private carryPlatform(): void {
    const b = this.body;
    const p = this.ridePlat;
    if (!p) return;
    const feet = b.y + b.h / 2;
    const ox = p.x - p.dx;
    const oy = p.y - p.dy;
    const onIt = this.platforms.includes(p) && Math.abs(feet - oy) < 3 && b.x + b.w / 2 > ox && b.x - b.w / 2 < ox + p.w && b.vy >= -1;
    if (!onIt) {
      // stepping or jumping off keeps the platform's momentum
      b.vx += p.vx;
      if (p.vy < 0) b.vy += p.vy;
      this.ridePlat = null;
      return;
    }
    this.world.moveX(b, p.dx);
    this.world.moveY(b, p.dy);
    b.y = Math.min(b.y, p.y - b.h / 2);
    b.onGround = true;
  }

  private collidePlatforms(prevX: number, prevBottom: number, prevTop: number): void {
    const b = this.body;
    let landed: Plat | null = null;
    for (const p of this.platforms) {
      if (b.x + b.w / 2 <= p.x || b.x - b.w / 2 >= p.x + p.w) continue;
      const bottom = b.y + b.h / 2;
      const top = b.y - b.h / 2;
      if (b.vy >= 0 && b.dropThrough <= 0 && prevBottom <= p.y + 2 + Math.max(0, p.dy) && bottom >= p.y) {
        b.y = p.y - b.h / 2;
        b.vy = 0;
        b.onGround = true;
        landed = p;
        continue;
      }
      if (!p.solid || bottom <= p.y + 1 || top >= p.y + p.h) continue;
      if (prevTop >= p.y + p.h - 2) {
        // bonk the underside
        b.y = p.y + p.h + b.h / 2;
        b.vy = Math.max(0, b.vy);
        b.hitCeil = true;
      } else {
        const fromLeft = prevX < p.x + p.w / 2;
        b.x = fromLeft ? p.x - b.w / 2 - 0.01 : p.x + p.w + b.w / 2 + 0.01;
        b.vx = fromLeft ? Math.min(0, b.vx - p.vx) + p.vx : Math.max(0, b.vx - p.vx) + p.vx;
        b.hitWallX = fromLeft ? 1 : -1;
      }
    }
    if (landed) this.ridePlat = landed;
  }

  /** Swimming: buoyancy, drag, currents, strokes and jumping out at the surface. */
  private waterStep(dt: number, input: Input, mx: number): void {
    const b = this.body;
    const w = this.water!;
    this.airDashes = 1;
    this.coyote = 0;
    this.jumping = false;
    b.vx = approach(b.vx, mx * 100, 520 * dt);
    if (mx !== 0 && this.attackT <= 0) this.facing = mx;
    const dive = input.downHeld ? 950 : 0;
    b.vy += (PLAYER.gravity * (1 - 1.5 * w.depth) + dive) * dt;
    b.vx *= Math.exp(-1.2 * dt);
    b.vy *= Math.exp(-2.6 * dt);
    b.vx += w.cx * dt;
    b.vy += w.cy * dt;
    b.vy = clamp(b.vy, -320, 240);
    this.swimCd -= dt;
    if (this.jumpBuf > 0) {
      if (w.depth < 0.9) {
        b.vy = -PLAYER.jumpVel * 0.95;
        this.jumping = true;
        this.jumpT = 0;
        this.juice.sfx('splash', { vol: 0.7 });
        this.jumpBuf = 0;
      } else if (this.swimCd <= 0) {
        b.vy = Math.min(b.vy, 0) - 200;
        this.swimCd = 0.28;
        this.jumpBuf = 0;
        this.juice.sfx('swim', { vol: 0.5 });
      }
    }
    this.integrate(dt);
  }

  private onOneWay(): boolean {
    const b = this.body;
    const ty = Math.floor((b.y + b.h / 2 + 1) / 16);
    const tx = Math.floor(b.x / 16);
    return this.world.cell(tx, ty) === 3;
  }

  private onLand(vy: number): void {
    if (vy < 60) return;
    const power = clamp(vy / 500, 0, 1);
    if (vy > PLAYER.hardLandVy) {
      this.landT = 0.18;
      this.setAnim('land', true);
      this.fx.landDust(this.body.x, this.feetY, power);
      if (vy > 420) this.juice.shake(2 + power * 2, 0.12);
    } else this.fx.dust(this.body.x, this.feetY, 1, 1);
    this.juice.sfx('land', { vol: 0.4 + power * 0.6 });
  }

  private swingStep(dt: number, input: Input, mx: number): void {
    const b = this.body;
    const rope = this.grapple.rope;
    const piv = rope.active;

    // jump-release
    if (this.jumpBuf > 0 && !b.onGround) {
      this.jumpBuf = 0;
      this.releaseRope(true);
      this.normalStep(dt, input, mx);
      return;
    }

    // a backward hook's held run key unlocks once released (or after a while)
    if (this.pumpLock !== 0) {
      this.pumpLockT += dt;
      if (mx !== this.pumpLock || this.pumpLockT > 1.1 || b.onGround) this.pumpLock = 0;
    }

    let dx = b.x - piv.x;
    let dy = b.y - piv.y;
    let dist = Math.hypot(dx, dy) || 0.001;
    let nx = dx / dist;
    let ny = dy / dist;
    const taut = dist >= rope.length - 0.75;

    if (b.onGround) {
      // walking while tethered
      this.airDashes = 1;
      if (mx !== 0) b.vx = approach(b.vx, mx * PLAYER.runSpeed, PLAYER.groundAccel * dt);
      else b.vx = approach(b.vx, 0, PLAYER.groundDecel * dt);
      if (this.jumpBuf > 0) {
        b.vy = -PLAYER.jumpVel;
        this.jumpBuf = 0;
        b.onGround = false;
        this.juice.sfx('jump');
      }
    } else if (mx !== 0 && mx !== this.pumpLock) {
      // pumping: accelerate along the tangent in the input direction
      let tx = -ny;
      let ty = nx;
      if (tx * mx < 0) {
        tx = -tx;
        ty = -ty;
      }
      const below = ny > 0 ? 1 : 0.35;
      const a = HOOK.pumpAccel * (taut ? 1 : HOOK.slackPumpMul) * below;
      b.vx += tx * a * dt;
      b.vy += ty * a * dt;
    }
    if (mx !== 0 && mx !== this.pumpLock) this.facing = mx;
    else if (Math.abs(b.vx) > 30) this.facing = sign(b.vx);

    // reel in / out (keys + wheel)
    const reel = (input.up ? -1 : 0) + (input.downHeld ? 1 : 0);
    const wheel = input.takeWheel();
    if (reel !== 0 || wheel !== 0) {
      const old = rope.length;
      const next = clamp(old + reel * HOOK.reelSpeed * dt + wheel * HOOK.wheelStep, HOOK.minLen, HOOK.maxLen);
      rope.length = next;
      if (next < old && taut && !b.onGround) {
        // conservation of angular momentum: v_t' = v_t * L / L'
        const vr = b.vx * nx + b.vy * ny;
        const tvx = b.vx - nx * vr;
        const tvy = b.vy - ny * vr;
        const k = Math.min(1.06, old / next);
        b.vx = nx * vr + tvx * k;
        b.vy = ny * vr + tvy * k;
      }
    }

    b.vy += PLAYER.gravity * this.gravityScale * dt;
    if (this.water && this.water.depth > 0) {
      b.vy -= PLAYER.gravity * 1.5 * this.water.depth * dt;
      b.vx *= Math.exp(-1.5 * dt);
      b.vy *= Math.exp(-1.5 * dt);
    }
    // light air drag keeps swings from building forever
    const drag = Math.exp(-0.08 * dt);
    b.vx *= drag;
    b.vy *= drag;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > HOOK.swingMaxSpeed) {
      b.vx *= HOOK.swingMaxSpeed / sp;
      b.vy *= HOOK.swingMaxSpeed / sp;
    }

    const prevX = b.x;
    const prevY = b.y;
    this.integrate(dt);

    // inextensible constraint (rope can go slack)
    dx = b.x - piv.x;
    dy = b.y - piv.y;
    dist = Math.hypot(dx, dy) || 0.001;
    if (dist > rope.length) {
      nx = dx / dist;
      ny = dy / dist;
      const tx = piv.x + nx * rope.length;
      const ty = piv.y + ny * rope.length;
      this.world.moveX(b, tx - b.x);
      this.world.moveY(b, ty - b.y);
      const vr = b.vx * nx + b.vy * ny;
      if (vr > 0) {
        b.vx -= nx * vr;
        b.vy -= ny * vr;
      }
      this.grapple.tension = vr;
    }
    rope.updateWrapping(prevX, prevY, b.x, b.y);
  }

  /** Grapple zip: reel the body into a hooked enemy and strike on arrival. */
  private zipStep(dt: number): void {
    const b = this.body;
    const t = this.grapple.zipTarget;
    this.zipT += dt;
    const cancel = () => {
      this.grapple.release();
      b.vx *= 0.4;
      b.vy *= 0.4;
    };
    if (!t || t.alive === false) return cancel();
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (d < 16) {
      this.grapple.release(true);
      this.attackId++;
      this.facing = dx >= 0 ? 1 : -1;
      this.onZipStrike?.(t);
      this.attackKind = 'attack1';
      this.attackT = 0.2;
      this.setAnim('attack1', true);
      this.slashKind = 'attack1';
      this.slashT = 0;
      this.juice.sfx('slash', { pitch: 0.85 });
      b.vx = -(dx / d) * 150;
      b.vy = -270;
      this.airDashes = 1;
      this.flipT = 0.32;
      return;
    }
    const sp = 580;
    b.vx = (dx / d) * sp;
    b.vy = (dy / d) * sp;
    this.facing = dx >= 0 ? 1 : -1;
    this.dashIdx = nearestIndex([-90, -45, 0, 45, 90], Math.atan2(dy, Math.abs(dx)) * DEG);
    // a zip aimed downward cuts through one-way platforms instead of stalling on them
    if (dy > 0) b.dropThrough = Math.max(b.dropThrough, 0.06);
    this.integrate(dt);
    if (b.hitWallX !== 0 || b.hitCeil) this.zipBlocked += dt;
    if (this.zipBlocked > 0.08 || this.zipT > 0.7) cancel();
  }

  /** Active attack hitbox in world space (only during the swing's live frames). */
  attackHitbox(): { x: number; y: number; w: number; h: number; id: number; kind: HitKind } | null {
    if (this.attackT <= 0 || !this.attackKind || this.dead) return null;
    const el = PLAYER.attackTime - this.attackT;
    if (el < 0.035 || el > 0.2) return null;
    const b = this.body;
    const f = this.facing;
    switch (this.attackKind) {
      case 'attack1':
        return { x: f > 0 ? b.x - 2 : b.x - 30, y: b.y - 20, w: 32, h: 28, id: this.attackId, kind: 'slash' };
      case 'attack2':
        return { x: f > 0 ? b.x - 4 : b.x - 26, y: b.y - 36, w: 30, h: 38, id: this.attackId, kind: 'slash' };
      default:
        return { x: b.x - 25, y: b.y - 25, w: 50, h: 46, id: this.attackId, kind: 'air' };
    }
  }

  refreshAirDash(): void {
    this.airDashes = 1;
  }

  /** Reaction to our own hit landing (pogo, recoil, dash refresh). */
  onAttackLanded(r: HitResult, dirX: number, kind: HitKind): void {
    const b = this.body;
    if (r === 'block') {
      b.vx = -dirX * 180;
      if (!b.onGround) b.vy = Math.min(b.vy, -90);
      return;
    }
    if (r === 'none') return;
    if (kind === 'air' || (!b.onGround && kind === 'slash')) {
      b.vy = Math.min(b.vy, -175);
      this.airDashes = 1;
    }
    if (r === 'kill') this.airDashes = 1;
  }

  releaseRope(jump: boolean): void {
    if (!this.grapple.busy) return;
    this.pumpLock = 0;
    const wasAttached = this.grapple.attached;
    this.grapple.release();
    if (!wasAttached) return;
    const b = this.body;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 110) {
      b.vx += (b.vx / sp) * HOOK.releaseBoost;
      b.vy += (b.vy / sp) * HOOK.releaseBoost;
    }
    if (jump) {
      b.vy = Math.min(b.vy, 0) - HOOK.jumpReleaseVy;
      this.juice.sfx('jump');
    }
    this.releaseT = 0.2;
    if (sp > 290 || jump) {
      this.flipT = 0.42;
      this.juice.sfx('whoosh', { pitch: 0.9 + Math.min(0.5, sp / 1200) });
      this.fx.speedLines(b.x, b.y, b.vx, b.vy, 5);
      this.juice.aberration(0.6);
    } else this.juice.sfx('release');
    this.jumping = false;
  }

  private startDash(input: Input): void {
    const b = this.body;
    if (this.grapple.busy) this.releaseRope(false);
    let dx = input.moveX;
    let dy = input.moveY;
    if (dx === 0 && dy === 0) dx = this.facing;
    if (dy > 0 && b.onGround) dy = 0;
    const l = Math.hypot(dx, dy);
    this.dashDx = dx / l;
    this.dashDy = dy / l;
    if (dx !== 0) this.facing = sign(dx);
    // map to baked dash directions (up, up-fwd, fwd, down-fwd, down)
    const a = Math.atan2(this.dashDy, Math.abs(this.dashDx)) * DEG;
    this.dashIdx = nearestIndex([-90, -45, 0, 45, 90], a);
    this.dashT = PLAYER.dashTime;
    this.dashCd = PLAYER.dashCooldown;
    if (!b.onGround) this.airDashes--;
    this.attackT = 0;
    this.juice.sfx('dash');
    this.juice.shake(1.2, 0.06);
    this.juice.aberration(0.5);
    this.fx.speedLines(b.x, b.y, this.dashDx, this.dashDy, 4);
    if (b.onGround) this.fx.dust(b.x, this.feetY, -this.facing, 2);
    this.setAnim(`dash_${this.dashIdx}`, true);
  }

  private dashStep(dt: number): void {
    const b = this.body;
    this.dashT -= dt;
    b.vx = this.dashDx * PLAYER.dashSpeed;
    b.vy = this.dashDy * PLAYER.dashSpeed;
    this.trailT -= dt;
    if (this.trailT <= 0) this.trailT = 0.02;
    this.integrate(dt);
    if (this.dashT <= 0 || b.hitWallX !== 0 || b.hitCeil) {
      this.dashT = 0;
      b.vx *= PLAYER.dashKeep;
      b.vy *= this.dashDy < 0 ? 0.45 : PLAYER.dashKeep;
    }
  }

  private startAttack(): void {
    const b = this.body;
    if (Math.abs(this.aimX - b.x) > 3) this.facing = this.aimX < b.x ? -1 : 1;
    let kind: AttackKind;
    if (!b.onGround && !this.grapple.attached) {
      kind = 'airattack';
      b.vy = Math.min(b.vy, 30);
    } else {
      kind = this.comboT > 0 && this.attackKind === 'attack1' ? 'attack2' : 'attack1';
      b.vx += this.facing * 70;
    }
    this.attackKind = kind;
    this.attackId++;
    this.attackT = PLAYER.attackTime;
    this.comboT = PLAYER.attackTime + PLAYER.comboWindow;
    this.setAnim(kind, true);
    this.slashKind = kind;
    this.slashT = 0;
    this.juice.sfx('slash', { pitch: kind === 'attack2' ? 1.15 : kind === 'airattack' ? 0.9 : 1 });
  }

  hurt(dmg: number, fromX: number, hazard = false): void {
    if (this.invulnT > 0 || this.dead) return;
    // dash i-frames against enemies (not against the environment)
    if (!hazard && (this.dashT > 0 || this.grapple.state === 'zip')) return;
    const b = this.body;
    this.hp -= dmg;
    this.invulnT = PLAYER.invuln;
    this.hurtT = 0.32;
    this.grapple.release();
    b.vx = (b.x >= fromX ? 1 : -1) * 150;
    b.vy = hazard ? -360 : -240;
    this.dashT = 0;
    this.attackT = 0;
    this.setAnim('hit', true);
    this.juice.hitstop(0.07);
    this.juice.shake(4, 0.2);
    this.juice.flash(0.35);
    this.juice.aberration(1.2);
    this.juice.sfx(hazard ? 'zap' : 'hurt');
    this.fx.sparks(b.x, b.y, -90, 360, 14, [COLORS.cyanHot, COLORS.white, COLORS.crimsonHot]);
    if (this.hp <= 0) this.die(false);
  }

  die(fell: boolean): void {
    if (this.dead) return;
    this.dead = true;
    this.fellOut = fell;
    this.deadT = 0;
    this.hp = 0;
    this.grapple.release();
    this.dashT = 0;
    this.juice.sfx('death');
    if (!fell) {
      this.juice.slowmo(0.35, 0.7);
      this.juice.shake(5, 0.3);
      this.setAnim('death', true);
    } else {
      this.sprite.setVisible(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Presentation (per render frame)
  // ---------------------------------------------------------------------------

  private setAnim(name: string, restart = false): void {
    if (this.anim === name && !restart) return;
    this.anim = name;
    this.animT = 0;
  }

  private pickAnim(): void {
    const b = this.body;
    if (this.dead) return this.setAnim('death');
    if (this.hurtT > 0) return this.setAnim('hit');
    if (this.dashT > 0 || this.grapple.state === 'zip') return this.setAnim(`dash_${this.dashIdx}`);
    if (this.attackT > 0 && this.attackKind) return this.setAnim(this.attackKind);
    if (this.carrier) return this.setAnim('swingB_6');
    if (this.grapple.attached && !b.onGround) {
      const piv = this.grapple.rope.active;
      let ang = Math.atan2(piv.x - b.x, -(piv.y - b.y)) * DEG; // clockwise from up
      if (this.facing < 0) ang = -ang;
      const idx = nearestIndex(SWING_ANGLES, clamp(ang, -135, 135));
      const variant = this.speed > 170 ? 'swingA' : 'swingB';
      return this.setAnim(`${variant}_${idx}`);
    }
    if (this.shootT > 0 || this.grapple.state === 'flying') return this.setAnim(`shoot_${this.shootIdx}`);
    if (this.flipT > 0 && !b.onGround) return this.setAnim('flip');
    if (this.releaseT > 0 && !b.onGround) return this.setAnim('release');
    if (b.onGround) {
      if (this.landT > 0 && Math.abs(b.vx) < 60) return this.setAnim('land');
      if (Math.abs(b.vx) > 12) {
        const mx = sign(b.vx);
        if (mx !== this.facing && Math.abs(b.vx) > 80) return this.setAnim('skid');
        return this.setAnim('run');
      }
      return this.setAnim('idle');
    }
    if (b.vy < -70) return this.setAnim('jump');
    if (b.vy < 70) return this.setAnim('peak');
    return this.setAnim('fall');
  }

  render(dt: number, alpha: number, time: number): void {
    const b = this.body;
    this.pickAnim();
    const def = this.sheet.anims[this.anim] ?? this.sheet.anims.idle;
    let speedMul = 1;
    if (this.anim === 'run') speedMul = clamp(Math.abs(b.vx) / PLAYER.runSpeed, 0.6, 1.35);
    this.animT += dt * speedMul;
    let fi = Math.floor(this.animT * def.fps);
    fi = def.loop ? fi % def.frames.length : Math.min(fi, def.frames.length - 1);
    if (this.anim === 'jump') fi = this.animT < 0.08 ? 0 : 1;
    this.frame = def.frames[fi];

    const ix = this.prevX + (b.x - this.prevX) * alpha;
    const iy = this.prevY + (b.y - this.prevY) * alpha;
    this.sprite.setFrame(this.frame);
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setPosition(Math.round(ix), Math.round(iy + b.h / 2));
    // invulnerability blink
    const blink = this.invulnT > 0 && !this.dead && Math.floor(time * 20) % 2 === 0;
    this.sprite.setAlpha(blink ? 0.35 : 1);
    if (this.hurtT > 0.2) this.sprite.setTintFill(0xffffff);
    else this.sprite.clearTint();

    // scarf follows the neck anchor of the current frame
    const m = this.frameMeta();
    const [nx, ny] = this.framePoint(m.neck[0], m.neck[1]);
    this.scarf.step(Math.min(dt, 1 / 30), nx, ny, this.facing, -12 - b.vx * 0.08);
    this.scarf.draw(this.sprite.visible, this.sprite.alpha);

    // afterimages at speed
    const fast = this.dashT > 0 || this.grapple.state === 'zip' || (this.speed > 300 && !b.onGround) || this.flipT > 0;
    this.trailT -= dt;
    if (fast && this.trailT <= 0 && this.sprite.visible) {
      this.trailT = this.dashT > 0 ? 0.022 : 0.04;
      const gh = this.ghosts.find((g) => g.t <= 0) ?? this.ghosts[0];
      gh.t = 0.24;
      gh.img.setFrame(this.frame).setFlipX(this.facing < 0).setPosition(this.sprite.x, this.sprite.y).setVisible(true);
      gh.img.setTint(Math.floor(time * 30) % 2 ? COLORS.cyan : COLORS.magenta);
    }
    for (const g of this.ghosts) {
      if (g.t <= 0) continue;
      g.t -= dt;
      g.img.setAlpha(Math.max(0, g.t / 0.24) * 0.55);
      if (g.t <= 0) g.img.setVisible(false);
    }

    // slash smear
    if (this.slashT < 0.16) {
      this.slashT += dt;
      const f = Math.min(3, Math.floor((this.slashT / 0.16) * 4));
      const rot = this.slashKind === 'attack1' ? 0.15 : this.slashKind === 'attack2' ? -0.9 : (this.slashT / 0.16) * Math.PI * 2;
      this.slash.setVisible(this.slashT < 0.16);
      this.slash.setFrame(`slash_${f}`);
      this.slash.setFlipX(this.facing < 0);
      this.slash.setOrigin(this.facing > 0 ? 14 / 48 : 34 / 48, 0.5);
      this.slash.setRotation(this.facing > 0 ? rot : -rot);
      this.slash.setPosition(this.sprite.x + this.facing * 2, this.sprite.y - 16);
    } else this.slash.setVisible(false);

    // grapple rope from the rendered hand
    const [hx, hy] = this.handPos();
    this.grapple.render(dt, hx, hy, this.speed);
  }

  destroy(): void {
    this.sprite.destroy();
    this.scarf.destroy();
    this.grapple.destroy();
    this.slash.destroy();
    for (const g of this.ghosts) g.img.destroy();
  }
}

function nearestIndex(arr: number[], v: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - v);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
