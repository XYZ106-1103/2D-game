import Phaser from 'phaser';
import { DEPTH, TILE } from '../../config.ts';
import { COLORS, RAMPS } from '../../art/palette.ts';
import { rand } from '../../core/math.ts';
import { Cell } from '../../physics/TileWorld.ts';
import type { AnchorPoint } from '../Grapple.ts';
import type { HitKind, HitResult } from '../enemies/Enemy.ts';
import type { GameScene } from '../../scenes/GameScene.ts';
import type { Actor } from '../Actor.ts';

const FLOOR_ROW = 19;
const ARM_REACH = 78; // shoulder → claw tip
const NODE_DIST = 45; // shoulder → hook node

interface Arm {
  side: -1 | 1;
  hp: number;
  max: number;
  alive: boolean;
  angle: number; // degrees, 0 = right, clockwise
  target: number;
  open: boolean;
  sprite: Phaser.GameObjects.Image;
  node: Phaser.GameObjects.Image;
  lastHit: number;
  flash: number;
  part: AnchorPoint;
}

interface Shock {
  x: number;
  dir: number;
  t: number;
  img: Phaser.GameObjects.Image;
}

/**
 * LETHE Executor Unit LT-0 "ARCHIVIST". Three phases:
 *   1. both arms armoured — break the left arm's node (slams, laser)
 *   2. one arm left — faster slams, summons drones
 *   3. shell opens — hit the exposed core while the floor electrifies
 */
export class Archivist {
  active = false;
  defeated = false;
  phase = 1;
  x: number;
  y: number;
  private vx = 0;
  private vy = 0;
  private state = 'intro';
  private stateT = 0;
  private t = 0;
  private g: GameScene;
  private arms: Arm[] = [];
  private coreHp = 6;
  private coreMax = 6;
  private coreFlash = 0;
  private coreLastHit = -1;
  private bodySpr: Phaser.GameObjects.Image;
  private eyeSpr: Phaser.GameObjects.Image;
  private coreSpr: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private fx: Phaser.GameObjects.Graphics;
  private shocks: Shock[] = [];
  private slamArm = 0;
  private slamX = 0;
  private laserAng = 0;
  /** Who the current laser sweep has already burned (each player once). */
  private laserHit = new Set<Actor>();
  private attackIdx = 0;
  private elecT = 0;
  private elecState: 'off' | 'warn' | 'on' = 'off';
  private boltT = 0;
  private hurtCd = 0;
  private corePart: AnchorPoint;
  private readonly floorY = FLOOR_ROW * TILE;
  private readonly arenaW: number;
  onDefeated: (() => void) | null = null;
  onPhase: ((p: number) => void) | null = null;

  constructor(g: GameScene) {
    this.g = g;
    this.arenaW = g.level.world.pixelWidth;
    this.x = this.arenaW / 2;
    this.y = 420;
    const sc = g as unknown as Phaser.Scene;
    this.glow = sc.add.image(this.x, this.y, 'fx', 'glow128').setDepth(DEPTH.objects - 2).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.magenta).setAlpha(0.25).setScale(1.4);
    for (const side of [-1, 1] as const) {
      const arm: Arm = {
        side,
        hp: side < 0 ? 3 : 4,
        max: side < 0 ? 3 : 4,
        alive: true,
        angle: side < 0 ? 120 : 60,
        target: side < 0 ? 120 : 60,
        open: false,
        sprite: sc.add.image(0, 0, 'boss', 'boss_arm_c_4').setDepth(DEPTH.objects + 3),
        node: sc.add.image(0, 0, 'fx', 'glow16').setDepth(DEPTH.objects + 4).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.cyan),
        lastHit: -1,
        flash: 0,
        part: null as unknown as AnchorPoint,
      };
      const self = this;
      arm.part = {
        isEnemy: true,
        hookRadius: 13,
        get x() {
          return self.nodePos(arm)[0];
        },
        get y() {
          return self.nodePos(arm)[1];
        },
        get alive() {
          return arm.alive && self.active;
        },
      };
      this.arms.push(arm);
    }
    this.bodySpr = sc.add.image(this.x, this.y, 'boss', 'boss_body').setDepth(DEPTH.objects + 5);
    this.eyeSpr = sc.add.image(this.x, this.y, 'boss', 'boss_eye_0').setDepth(DEPTH.objects + 6);
    this.coreSpr = sc.add.image(this.x, this.y, 'boss', 'boss_core_0').setDepth(DEPTH.objects + 6).setVisible(false);
    this.fx = sc.add.graphics().setDepth(DEPTH.fx - 1);
    const self = this;
    this.corePart = {
      isEnemy: true,
      hookRadius: 14,
      get x() {
        return self.x;
      },
      get y() {
        return self.y;
      },
      get alive() {
        return self.phase === 3 && self.coreHp > 0 && self.active;
      },
    };
  }

  get totalHp(): number {
    return this.arms.reduce((s, a) => s + Math.max(0, a.hp), 0) + Math.max(0, this.coreHp);
  }
  get maxHp(): number {
    return this.arms.reduce((s, a) => s + a.max, 0) + this.coreMax;
  }

  /** Online co-op: tougher for two. */
  scaleHp(k: number): void {
    for (const a of this.arms) a.hp = a.max = Math.ceil(a.max * k);
    this.coreHp = this.coreMax = Math.ceil(this.coreMax * k);
  }

  private shoulder(a: Arm): [number, number] {
    return [this.x + a.side * 31, this.y - 6];
  }
  private nodePos(a: Arm): [number, number] {
    const [sx, sy] = this.shoulder(a);
    const r = (a.angle * Math.PI) / 180;
    return [sx + Math.cos(r) * NODE_DIST, sy + Math.sin(r) * NODE_DIST];
  }
  private clawPos(a: Arm): [number, number] {
    const [sx, sy] = this.shoulder(a);
    const r = (a.angle * Math.PI) / 180;
    return [sx + Math.cos(r) * ARM_REACH, sy + Math.sin(r) * ARM_REACH];
  }

  hookTargets(): AnchorPoint[] {
    if (!this.active) return [];
    const out: AnchorPoint[] = [];
    for (const a of this.arms) if (a.alive) out.push(a.part);
    if (this.phase === 3 && this.coreHp > 0) out.push(this.corePart);
    return out;
  }

  /** Start the fight (after the intro cinematic). */
  begin(): void {
    this.active = true;
    this.setState('idle');
  }

  private setState(s: string): void {
    this.state = s;
    this.stateT = 0;
  }

  // ---------------------------------------------------------------------------
  // Damage
  // ---------------------------------------------------------------------------

  hit(x: number, y: number, w: number, h: number, id: number, dmg: number, kind: HitKind, dirX: number): HitResult {
    if (!this.active || this.defeated) return 'none';
    const inRect = (px: number, py: number, r: number) => px + r > x && px - r < x + w && py + r > y && py - r < y + h;
    for (const a of this.arms) {
      if (!a.alive || a.lastHit === id) continue;
      const [nx, ny] = this.nodePos(a);
      if (!inRect(nx, ny, 12)) continue;
      a.lastHit = id;
      a.hp -= dmg;
      a.flash = 0.12;
      this.g.combat.feedback(a.hp <= 0 ? 'kill' : 'hit', nx, ny, dirX, kind);
      if (a.hp <= 0) this.breakArm(a);
      return a.hp <= 0 ? 'kill' : 'hit';
    }
    if (this.phase === 3 && this.coreHp > 0 && this.coreLastHit !== id && inRect(this.x, this.y, 13)) {
      this.coreLastHit = id;
      this.coreHp -= dmg;
      this.coreFlash = 0.12;
      this.g.combat.feedback(this.coreHp <= 0 ? 'kill' : 'hit', this.x, this.y, dirX, kind);
      if (this.coreHp <= 0) this.die();
      return this.coreHp <= 0 ? 'kill' : 'hit';
    }
    // armoured shell: clank
    if (inRect(this.x, this.y, 30)) {
      if (this.coreLastHit === id) return 'none';
      this.coreLastHit = id;
      this.g.combat.feedback('block', this.x - dirX * 20, this.y, dirX, kind);
      return 'block';
    }
    return 'none';
  }

  private breakArm(a: Arm): void {
    a.alive = false;
    const [nx, ny] = this.nodePos(a);
    const [sx, sy] = this.shoulder(a);
    this.g.combat.boom(nx, ny, true);
    this.g.combat.boom(sx, sy, false);
    this.g.slowmo(0.3, 0.6);
    this.g.flash(0.3);
    this.g.shake(6, 0.4);
    a.sprite.setVisible(false);
    a.node.setVisible(false);
    for (let i = 0; i < 10; i++) this.g.particles.emit(nx, ny, { frame: `shard_${i % 4}`, speed: [120, 260], angle: -90, spread: 220, gravity: 600, life: [0.8, 1.3], spin: rand(-14, 14) });
    this.setState('stagger');
    this.phase = this.arms.filter((x) => x.alive).length === 1 ? 2 : 3;
    if (this.phase === 3) {
      this.bodySpr.setFrame('boss_body_open');
      this.coreSpr.setVisible(true);
      this.eyeSpr.setVisible(false);
    }
    this.onPhase?.(this.phase);
  }

  private die(): void {
    this.defeated = true;
    this.setState('dying');
    this.g.slowmo(0.3, 1.4);
    this.setElectric('off');
  }

  // ---------------------------------------------------------------------------
  // Behaviour
  // ---------------------------------------------------------------------------

  private moveTo(tx: number, ty: number, k: number, dt: number): void {
    this.vx += ((tx - this.x) * k - this.vx * 2.4) * dt * 4;
    this.vy += ((ty - this.y) * k - this.vy * 2.4) * dt * 4;
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.stateT += dt;
    this.hurtCd -= dt;
    this.coreFlash -= dt;
    for (const a of this.arms) a.flash -= dt;
    // aim at the nearest player; hazards below check everyone
    const p = this.g.focus(this.x, this.y);
    const actors = this.g.actors();
    const speedK = this.phase === 3 ? 1.35 : this.phase === 2 ? 1.15 : 1;

    switch (this.state) {
      case 'intro':
        this.moveTo(this.arenaW / 2, 120, 1, dt);
        break;
      case 'idle': {
        const tx = Math.max(110, Math.min(this.arenaW - 110, p.x + Math.sin(this.t * 0.8) * 60));
        this.moveTo(tx, 112 + Math.sin(this.t * 1.7) * 10, 1, dt);
        for (const a of this.arms) a.target = (a.side < 0 ? 120 : 60) + Math.sin(this.t * 2 + a.side) * 8;
        if (this.stateT > 1.1 / speedK) this.nextAttack();
        break;
      }
      case 'slam_aim': {
        const a = this.arms[this.slamArm];
        this.slamX = Math.max(40, Math.min(this.arenaW - 40, p.x));
        this.moveTo(this.slamX - a.side * 31, this.floorY - ARM_REACH + 6, 1.6, dt);
        a.target = a.side < 0 ? 215 : -35;
        a.open = true;
        if (this.stateT > 0.75 / speedK) {
          this.setState('slam');
          this.g.sfx('bash', { pitch: 0.6 });
        }
        break;
      }
      case 'slam': {
        const a = this.arms[this.slamArm];
        this.vx *= 0.8;
        this.vy *= 0.8;
        a.target = 90;
        a.angle += (90 - a.angle) * Math.min(1, dt * 30);
        if (this.stateT > 0.1 && a.open) {
          a.open = false;
          const [cx] = this.clawPos(a);
          this.impact(cx);
        }
        if (this.stateT > 0.95 / speedK) this.setState('recover');
        break;
      }
      case 'recover':
        this.moveTo(this.x, 120, 1, dt);
        if (this.stateT > 0.6) this.setState('idle');
        break;
      case 'laser_charge':
        this.moveTo(this.arenaW / 2 + (p.x < this.arenaW / 2 ? 90 : -90), 82, 1.2, dt);
        // track while charging, then freeze for the last beat (dodge window)
        if (this.stateT < 0.6) this.laserAng = Math.atan2(p.y - 4 - this.y, p.x - this.x);
        this.laserHit.clear();
        if (Math.random() < 0.6) {
          const a = rand(0, Math.PI * 2);
          this.g.particles.emit(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40, { frame: 'px2', speed: [140, 180], angle: (a * 180) / Math.PI + 180, spread: 4, life: [0.22, 0.25], tint: [COLORS.magenta, COLORS.white], add: true });
        }
        if (this.stateT > 0.95) {
          this.setState('laser');
          this.g.sfx('laser');
          this.g.shake(2.5, 0.3);
        }
        break;
      case 'laser': {
        this.vx *= 0.9;
        this.vy *= 0.9;
        const want = Math.atan2(p.y - 4 - this.y, p.x - this.x);
        let d = want - this.laserAng;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const turn = 0.4 * dt * speedK;
        this.laserAng += Math.max(-turn, Math.min(turn, d));
        const [ex, ey] = this.laserEnd();
        for (const a of actors) {
          if (!this.laserHit.has(a) && this.pointSegDist(a.x, a.y - 4, this.x, this.y, ex, ey) < 6 && a.invulnT <= 0) {
            this.laserHit.add(a);
            this.hurtActor(a, this.x);
          }
        }
        if (Math.random() < 0.8) this.g.particles.sparks(ex, ey, -90, 160, 2, [COLORS.magenta, COLORS.white]);
        if (this.stateT > 1.7) this.setState('idle');
        break;
      }
      case 'summon':
        this.moveTo(this.x, 100, 1, dt);
        if (this.stateT > 0.5 && this.stateT - dt <= 0.5) {
          const alive = this.g.combat.enemies.filter((e) => e.alive && e.kind === 'drone').length;
          for (let i = alive; i < 2; i++) {
            const e = this.g.combat.spawn({ kind: 'drone', x: this.x + (i ? 40 : -40), y: this.y + 30 });
            this.g.particles.ring(e.x, e.y, COLORS.magenta);
          }
          this.g.sfx('alert', { pitch: 0.7 });
        }
        if (this.stateT > 1.1) this.setState('idle');
        break;
      case 'stagger':
        this.vy += 60 * dt;
        this.vx *= 0.95;
        if (this.stateT > 1.6) this.setState('idle');
        break;
      case 'dying':
        this.vy += 30 * dt;
        this.vx *= 0.95;
        if (Math.random() < dt * 9) this.g.combat.boom(this.x + rand(-34, 34), this.y + rand(-26, 26), false);
        this.g.shake(3, 0.1);
        if (this.stateT > 2.6 && this.state === 'dying') {
          this.setState('dead');
          this.g.combat.boom(this.x, this.y, true);
          this.g.combat.boom(this.x - 30, this.y + 10, true);
          this.g.combat.boom(this.x + 30, this.y - 10, true);
          this.g.flash(0.9);
          this.g.shake(8, 0.6);
          for (const s of [this.bodySpr, this.eyeSpr, this.coreSpr, this.glow]) s.setVisible(false);
          for (const a of this.arms) {
            a.sprite.setVisible(false);
            a.node.setVisible(false);
          }
          this.onDefeated?.();
        }
        break;
      default:
        break;
    }

    // phase 3: radial bolt bursts + electrified floor cycle
    if (this.phase === 3 && this.active && !this.defeated) {
      this.boltT -= dt;
      if (this.boltT <= 0 && this.state === 'idle') {
        this.boltT = 2.4;
        const n = 10;
        const off = rand(0, Math.PI);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          this.g.combat.projectiles.spawn(this.x + Math.cos(a) * 16, this.y + Math.sin(a) * 16, Math.cos(a) * 150, Math.sin(a) * 150, 'enemy', { x: this.x, y: this.y });
        }
        this.g.sfx('shoot', { pitch: 0.7 });
      }
      this.elecT += dt;
      const cyc = this.elecT % 6;
      this.setElectric(cyc < 2.6 ? 'off' : cyc < 3.5 ? 'warn' : 'on');
    }

    if (this.state !== 'slam') for (const a of this.arms) a.angle += (a.target - a.angle) * Math.min(1, dt * 6);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.max(60, Math.min(this.arenaW - 60, this.x));
    if (this.state !== 'dying' && this.state !== 'dead' && this.state !== 'slam' && this.state !== 'slam_aim') {
      if (this.y > this.floorY - 70) {
        this.y = this.floorY - 70;
        this.vy = Math.min(0, this.vy);
      }
    }
    if (this.y < 60) {
      this.y = 60;
      this.vy = Math.max(0, this.vy);
    }

    // shockwaves along the floor
    for (const s of this.shocks) {
      s.t += dt;
      s.x += s.dir * 230 * dt;
      for (const a of actors) if (Math.abs(a.x - s.x) < 11 && a.feetY > this.floorY - 14 && !a.dead) this.hurtActor(a, s.x - s.dir * 10);
    }
    this.shocks = this.shocks.filter((s) => {
      const keep = s.t < 1.5 && s.x > 8 && s.x < this.arenaW - 8;
      if (!keep) s.img.destroy();
      return keep;
    });

    // body contact
    if (this.active && !this.defeated) for (const a of actors) if (!a.dead && Math.abs(a.x - this.x) < 36 && Math.abs(a.y - this.y) < 30) this.hurtActor(a, this.x);
  }

  private nextAttack(): void {
    const aliveArms = this.arms.map((a, i) => (a.alive ? i : -1)).filter((i) => i >= 0);
    const seq = this.phase === 1 ? ['slam', 'slam', 'laser'] : this.phase === 2 ? ['slam', 'summon', 'slam', 'laser'] : ['laser', 'idle2'];
    const pick = seq[this.attackIdx++ % seq.length];
    if (pick === 'slam' && aliveArms.length) {
      this.slamArm = aliveArms[this.attackIdx % aliveArms.length];
      this.setState('slam_aim');
    } else if (pick === 'laser') this.setState('laser_charge');
    else if (pick === 'summon') this.setState('summon');
    else this.setState('idle');
  }

  private impact(x: number): void {
    this.g.shake(6, 0.35);
    this.g.sfx('slam');
    this.g.particles.landDust(x, this.floorY, 1);
    this.g.particles.sparks(x, this.floorY - 2, -90, 160, 18, [COLORS.white, COLORS.amberHot, COLORS.magenta]);
    for (const dir of [-1, 1]) {
      const img = (this.g as unknown as Phaser.Scene).add.image(x, this.floorY, 'boss', 'boss_shock_0').setOrigin(0.5, 1).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
      this.shocks.push({ x, dir, t: 0, img });
    }
    for (const a of this.g.actors()) if (Math.abs(a.x - x) < 20 && a.feetY > this.floorY - 40) this.hurtActor(a, x);
  }

  private hurtActor(a: Actor, fromX: number): void {
    if (a.invulnT > 0 || a.dead) return;
    if (a === this.g.player) {
      if (this.hurtCd > 0) return;
      this.hurtCd = 0.3;
    }
    a.hurt(1, fromX);
  }

  private laserEnd(): [number, number] {
    const ex = this.x + Math.cos(this.laserAng) * 600;
    const ey = this.y + Math.sin(this.laserAng) * 600;
    const hit = this.g.level.world.raycast(this.x, this.y, ex, ey);
    return hit ? [hit.x, hit.y] : [ex, ey];
  }

  private pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  private setElectric(s: 'off' | 'warn' | 'on'): void {
    if (s === this.elecState) return;
    this.elecState = s;
    const w = this.g.level.world;
    const row = FLOOR_ROW - 1;
    for (let x = 1; x < w.w - 1; x++) {
      const i = row * w.w + x;
      if (s === 'on' && w.cells[i] === Cell.Empty) w.cells[i] = Cell.Hazard;
      else if (s !== 'on' && w.cells[i] === Cell.Hazard) w.cells[i] = Cell.Empty;
    }
    if (s === 'on') this.g.sfx('zap', { vol: 0.8 });
    if (s === 'warn') this.g.sfx('lock', { pitch: 0.6 });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  render(_alpha: number, dt: number): void {
    const g = this.fx;
    g.clear();
    if (this.state === 'dead') {
      for (const s of this.shocks) s.img.setVisible(false);
      return;
    }
    const bx = Math.round(this.x);
    const by = Math.round(this.y + Math.sin(this.t * 3) * 1.5);
    const shake = this.state === 'dying' || this.state === 'stagger' ? (Math.floor(this.t * 40) % 2 ? 1 : -1) : 0;
    this.bodySpr.setPosition(bx + shake, by);
    this.glow.setPosition(bx, by).setAlpha(this.phase === 3 ? 0.4 + Math.sin(this.t * 6) * 0.08 : 0.22);
    // eye state
    const eyeF = this.state === 'laser' ? 2 : this.state === 'laser_charge' ? 1 : this.state === 'stagger' || this.state === 'dying' ? 3 : 0;
    this.eyeSpr.setFrame(`boss_eye_${eyeF}`).setPosition(bx + shake, by);
    this.coreSpr.setFrame(`boss_core_${Math.floor(this.t * 8) % 4}`).setPosition(bx + shake, by);
    if (this.coreFlash > 0) this.coreSpr.setTintFill(0xffffff);
    else this.coreSpr.clearTint();
    const flashBody = this.state === 'dying' && Math.floor(this.t * 16) % 2 === 0;
    if (flashBody) this.bodySpr.setTintFill(0xffffff);
    else this.bodySpr.clearTint();

    for (const a of this.arms) {
      if (!a.alive) continue;
      const [sx, sy] = this.shoulder(a);
      let deg = ((a.angle % 360) + 360) % 360;
      const idx = Math.round(deg / 15) % 24;
      deg = idx;
      a.sprite.setFrame(`boss_arm_${a.open ? 'o' : 'c'}_${deg}`).setPosition(Math.round(sx) + shake, Math.round(sy));
      if (a.flash > 0) a.sprite.setTintFill(0xffffff);
      else a.sprite.clearTint();
      const [nx, ny] = this.nodePos(a);
      a.node.setPosition(Math.round(nx), Math.round(ny)).setAlpha(0.6 + Math.sin(this.t * 8) * 0.25);
      a.node.setTint(this.state === 'slam' ? COLORS.white : COLORS.cyan);
    }

    // slam warning marker on the floor
    if (this.state === 'slam_aim') {
      const blink = Math.floor(this.t * 14) % 2 === 0;
      if (blink) {
        g.fillStyle(RAMPS.crimson[5], 0.9);
        for (let i = -12; i <= 12; i += 3) g.fillRect(Math.round(this.slamX + i), this.floorY - 2, 2, 1);
        g.fillRect(Math.round(this.slamX), this.floorY - 10, 1, 7);
      }
    }
    // laser charge sight + beam
    if (this.state === 'laser_charge' || this.state === 'laser') {
      const [ex, ey] = this.laserEnd();
      const n = Math.ceil(Math.hypot(ex - this.x, ey - this.y));
      const firing = this.state === 'laser';
      const width = firing ? 2 + (Math.floor(this.t * 30) % 2) : 0;
      for (let i = 14; i < n; i++) {
        const x = Math.round(this.x + ((ex - this.x) * i) / n);
        const y = Math.round(this.y + ((ey - this.y) * i) / n);
        if (!firing) {
          if (i % 4 < 2) {
            g.fillStyle(this.stateT > 0.6 ? 0xffffff : RAMPS.crimson[5], this.stateT > 0.6 ? 0.85 : 0.6);
            g.fillRect(x, y, 1, 1);
          }
          continue;
        }
        g.fillStyle(RAMPS.magenta[4], 0.55);
        g.fillRect(x - width, y - width, width * 2 + 1, width * 2 + 1);
        g.fillStyle(0xffffff, 1);
        g.fillRect(x, y, 1, 1);
      }
    }
    // electrified floor
    if (this.elecState !== 'off') {
      const on = this.elecState === 'on';
      const vis = on || Math.floor(this.t * 12) % 2 === 0;
      if (vis) {
        g.fillStyle(on ? RAMPS.cyan[6] : RAMPS.crimson[5], on ? 0.9 : 0.6);
        for (let x = 16; x < this.arenaW - 16; x += on ? 1 : 4) g.fillRect(x, this.floorY - 1 - (on && Math.random() < 0.2 ? 1 : 0), 1, 1);
      }
      if (on && Math.random() < dt * 30) this.g.particles.zap(rand(24, this.arenaW - 24), this.floorY - 5);
    }
    for (const s of this.shocks) {
      s.img.setPosition(Math.round(s.x), this.floorY).setFrame(`boss_shock_${Math.min(3, Math.floor(s.t * 8) % 4)}`).setFlipX(s.dir < 0).setAlpha(Math.max(0, 1 - s.t / 1.5));
    }
  }

  reset(): void {
    this.defeated = false;
    this.phase = 1;
    this.coreHp = this.coreMax;
    this.x = this.arenaW / 2;
    this.y = 120;
    this.vx = this.vy = 0;
    this.attackIdx = 0;
    this.elecT = 0;
    this.setElectric('off');
    for (const a of this.arms) {
      a.hp = a.max;
      a.alive = true;
      a.sprite.setVisible(true);
      a.node.setVisible(true);
      a.angle = a.target = a.side < 0 ? 120 : 60;
    }
    this.bodySpr.setFrame('boss_body').setVisible(true);
    this.eyeSpr.setVisible(true);
    this.coreSpr.setVisible(false);
    this.glow.setVisible(true);
    for (const s of this.shocks) s.img.destroy();
    this.shocks = [];
    for (const e of this.g.combat.enemies) if (e.kind === 'drone') {
      e.alive = false;
      e.gone = true;
    }
    this.setState(this.active ? 'idle' : 'intro');
  }

  destroy(): void {
    for (const s of [this.bodySpr, this.eyeSpr, this.coreSpr, this.glow, this.fx]) s.destroy();
    for (const a of this.arms) {
      a.sprite.destroy();
      a.node.destroy();
    }
    for (const s of this.shocks) s.img.destroy();
  }
}
