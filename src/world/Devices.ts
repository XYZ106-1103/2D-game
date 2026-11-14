// Chapter 2 stage devices. Each one is a self-contained rule the stage teaches:
//   Laser    — timed security beam (archive)
//   Fan      — cold-air / exhaust stream pushing the player (archive, refinery)
//   Crusher  — hydraulic press with a telegraphed slam (refinery)
//   Flood    — rising lethe fluid chase (refinery)
//   Zone     — low-gravity pocket (core)
//   Well     — gravity well pulling toward a hookable core (core)
//   Phase    — memory blocks that swap on a beat (memory)
//   Bouncer  — springy bloom (garden)
//   Switch   — hook it to light a hard-light bridge for a while (garden)
//   Rod      — lightning rod: charge, then a strike around it (mast)
//   Pulse    — broadcast ring that shoves the player outward (mast)
import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, TILE } from '../config.ts';
import { COLORS, RAMPS } from '../art/palette.ts';
import { rand } from '../core/math.ts';
import { Cell, type Body, type TileWorld } from '../physics/TileWorld.ts';
import type { Player } from '../entities/Player.ts';
import type { AnchorPoint } from '../entities/Grapple.ts';
import type { Particles } from '../fx/Particles.ts';
import type { Juice } from '../fx/Juice.ts';
import { EXTRA_TILE, type Level } from './Level.ts';
import { Mat, type BridgeDef, type CrusherDef, type FanDef, type FloodDef, type LaserDef, type PulseDef, type RodDef, type SwitchDef, type WellDef } from './LevelData.ts';

function overlap(b: Body, x: number, y: number, w: number, h: number): boolean {
  return b.x + b.w / 2 > x && b.x - b.w / 2 < x + w && b.y + b.h / 2 > y && b.y - b.h / 2 < y + h;
}

interface Ctx {
  scene: Phaser.Scene;
  level: Level;
  world: TileWorld;
  fx: Particles;
  juice: Juice;
  g: Phaser.GameObjects.Graphics;
  gFront: Phaser.GameObjects.Graphics;
  /** Between the back walls and the tiles (fluids). */
  gBack: Phaser.GameObjects.Graphics;
  cam: () => Phaser.Cameras.Scene2D.Camera;
}

const onScreen = (ctx: Ctx, x: number, y: number, m = 60) => {
  const c = ctx.cam();
  return x > c.scrollX - m && x < c.scrollX + GAME_W + m && y > c.scrollY - m && y < c.scrollY + GAME_H + m;
};

// -----------------------------------------------------------------------------

class Laser {
  private t = 0;
  on = false;
  private warn = false;
  private emit: Phaser.GameObjects.Image;
  private recv: Phaser.GameObjects.Image;
  private ctx: Ctx;
  private d: LaserDef;
  constructor(ctx: Ctx, d: LaserDef) {
    this.ctx = ctx;
    this.d = d;
    const h = d.dir === 'h';
    const ex = h ? d.x - 4 : d.x;
    const ey = h ? d.y : d.y - 4;
    const rx = h ? d.x + d.len - 12 : d.x;
    const ry = h ? d.y : d.y + d.len - 12;
    this.emit = ctx.scene.add.image(ex, ey, 'ch2', 'laser_emit').setDepth(DEPTH.objects).setRotation(h ? 0 : Math.PI / 2);
    this.recv = ctx.scene.add.image(rx, ry, 'ch2', 'laser_emit').setDepth(DEPTH.objects).setRotation(h ? Math.PI : -Math.PI / 2);
  }
  private rect(): [number, number, number, number] {
    const d = this.d;
    return d.dir === 'h' ? [d.x, d.y - 2, d.len - 12, 4] : [d.x - 2, d.y, 4, d.len - 12];
  }
  fixedUpdate(dt: number, p: Player): void {
    this.t += dt;
    const cyc = this.d.on + this.d.off;
    const u = (this.t + this.d.phase * cyc) % cyc;
    const was = this.on;
    this.on = u < this.d.on;
    this.warn = !this.on && u > cyc - 0.45;
    if (this.on && !was && onScreen(this.ctx, this.d.x, this.d.y)) this.ctx.juice.sfx('beam', { vol: 0.4 });
    if (this.on && !p.dead) {
      const [x, y, w, h] = this.rect();
      if (overlap(p.body, x, y, w, h)) {
        p.hurt(1, this.d.dir === 'h' ? p.x - 1 : this.d.x, true);
        this.ctx.fx.zap(p.x, p.y);
      }
    }
  }
  render(time: number): void {
    const g = this.ctx.g;
    this.emit.setFrame(this.on || this.warn ? 'laser_emit' : 'laser_emit_off');
    this.recv.setFrame(this.on ? 'laser_emit' : 'laser_emit_off');
    if (!onScreen(this.ctx, this.d.x, this.d.y, this.d.len)) return;
    const [x, y, w, h] = this.rect();
    if (this.on) {
      const flick = Math.floor(time * 30) % 2;
      g.fillStyle(RAMPS.crimson[4], 0.45).fillRect(x, y - (this.d.dir === 'h' ? flick : 0), w, h + (this.d.dir === 'h' ? flick : 0));
      g.fillStyle(RAMPS.crimson[6], 0.9);
      if (this.d.dir === 'h') g.fillRect(x, y + 1, w, 2);
      else g.fillRect(x + 1, y, 2, h);
      g.fillStyle(0xffffff, 1);
      if (this.d.dir === 'h') g.fillRect(x, y + 2, w, 1);
      else g.fillRect(x + 2, y, 1, h);
      if (Math.random() < 0.3) this.ctx.fx.sparks(x + (this.d.dir === 'h' ? w : 2), y + (this.d.dir === 'h' ? 2 : h), this.d.dir === 'h' ? 180 : -90, 90, 1, [COLORS.crimsonHot, COLORS.white]);
    } else if (this.warn && Math.floor(time * 16) % 2 === 0) {
      g.fillStyle(RAMPS.crimson[5], 0.7);
      const n = this.d.dir === 'h' ? w : h;
      for (let i = 0; i < n; i += 4) {
        if (this.d.dir === 'h') g.fillRect(x + i, y + 2, 2, 1);
        else g.fillRect(x + 2, y + i, 1, 2);
      }
    }
  }
  reset(): void {
    this.t = 0;
  }
  destroy(): void {
    this.emit.destroy();
    this.recv.destroy();
  }
}

// -----------------------------------------------------------------------------

class Fan {
  private img: Phaser.GameObjects.Image;
  private acc = 0;
  private ctx: Ctx;
  private d: FanDef;
  constructor(ctx: Ctx, d: FanDef) {
    this.ctx = ctx;
    this.d = d;
    let x = d.x + d.w / 2;
    let y = d.y + d.h / 2;
    if (d.ax > 0) x = d.x + 4;
    else if (d.ax < 0) x = d.x + d.w - 4;
    else if (d.ay < 0) y = d.y + d.h - 4;
    else y = d.y + 4;
    this.img = ctx.scene.add.image(x, y, 'ch2', 'fan_0').setDepth(DEPTH.decorBack + 0.6);
  }
  fixedUpdate(dt: number, p: Player): void {
    const b = p.body;
    if (p.dead || !overlap(b, this.d.x, this.d.y, this.d.w, this.d.h)) return;
    const k = b.onGround ? 0.45 : 1;
    b.vx += this.d.ax * dt * k;
    b.vy += this.d.ay * dt;
    if (this.d.ay < 0 && b.vy < -10) b.onGround = false;
    b.vx = Math.max(-420, Math.min(420, b.vx));
    b.vy = Math.max(-380, b.vy);
  }
  render(dt: number, time: number): void {
    this.img.setFrame(`fan_${Math.floor(time * 24) % 4}`);
    const d = this.d;
    if (!onScreen(this.ctx, d.x + d.w / 2, d.y + d.h / 2, Math.max(d.w, d.h))) return;
    this.acc += dt * (d.w * d.h) / 900;
    while (this.acc > 1) {
      this.acc -= 1;
      const along = Math.hypot(d.ax, d.ay) || 1;
      const ux = d.ax / along;
      const uy = d.ay / along;
      const x = ux > 0 ? d.x + 6 : ux < 0 ? d.x + d.w - 6 : d.x + rand(4, d.w - 4);
      const y = uy > 0 ? d.y + 6 : uy < 0 ? d.y + d.h - 6 : d.y + rand(4, d.h - 4);
      const span = ux !== 0 ? d.w : d.h;
      this.ctx.fx.emit(x, y, { frame: 'speedline', speed: [220, 260], angle: (Math.atan2(uy, ux) * 180) / Math.PI, spread: 2, life: [span / 260, span / 240], tint: 0xb8c4dc, alpha: 0.35, align: true });
    }
  }
  destroy(): void {
    this.img.destroy();
  }
}

// -----------------------------------------------------------------------------

class Crusher {
  private t = 0;
  headY: number;
  private head: Phaser.GameObjects.Image;
  private shaft: Phaser.GameObjects.TileSprite;
  private slammed = false;
  private stage: 'rest' | 'warn' | 'slam' | 'hold' | 'rise' = 'rest';
  private ctx: Ctx;
  private d: CrusherDef;
  constructor(ctx: Ctx, d: CrusherDef) {
    this.ctx = ctx;
    this.d = d;
    this.headY = d.top;
    const key = d.w >= 48 ? 'crusher_48' : 'crusher_32';
    this.head = ctx.scene.add.image(d.x, d.top, 'ch2', key).setOrigin(0.5, 1).setDepth(DEPTH.objects + 0.5);
    this.shaft = ctx.scene.add.tileSprite(d.x, d.top - 2 * TILE, 10, 16, 'ch2', 'crusher_shaft').setOrigin(0.5, 0).setDepth(DEPTH.objects + 0.4);
  }
  fixedUpdate(dt: number, p: Player): void {
    this.t += dt;
    const u = (this.t / this.d.period + this.d.phase) % 1;
    const { top, bottom } = this.d;
    if (u < 0.5) {
      this.stage = 'rest';
      this.headY = top;
      this.slammed = false;
    } else if (u < 0.62) {
      this.stage = 'warn';
      this.headY = top - 3;
    } else if (u < 0.67) {
      this.stage = 'slam';
      const k = (u - 0.62) / 0.05;
      this.headY = top + (bottom - top) * k * k;
    } else if (u < 0.82) {
      this.stage = 'hold';
      this.headY = bottom;
      if (!this.slammed) {
        this.slammed = true;
        if (onScreen(this.ctx, this.d.x, bottom)) {
          this.ctx.juice.shake(3.5, 0.2);
          this.ctx.juice.sfx('slam', { vol: 0.55 });
          this.ctx.fx.landDust(this.d.x, bottom, 0.9);
          this.ctx.fx.sparks(this.d.x, bottom - 2, -90, 160, 10, [COLORS.white, COLORS.amberHot]);
        }
      }
    } else {
      this.stage = 'rise';
      const k = (u - 0.82) / 0.18;
      this.headY = bottom + (top - bottom) * k;
    }
    if ((this.stage === 'slam' || this.stage === 'hold') && !p.dead && overlap(p.body, this.d.x - this.d.w / 2 + 3, this.headY - 22, this.d.w - 6, 22)) {
      p.hurt(1, this.d.x, true);
    }
  }
  render(time: number): void {
    const shake = this.stage === 'warn' ? (Math.floor(time * 40) % 2 ? 1 : -1) : 0;
    this.head.setPosition(this.d.x + shake, Math.round(this.headY));
    const shaftTop = this.d.top - 2 * TILE;
    this.shaft.setPosition(this.d.x + shake, shaftTop).setSize(10, Math.max(1, Math.round(this.headY - 22 - shaftTop)));
    if (this.stage === 'warn' && Math.floor(time * 12) % 2 === 0) {
      const g = this.ctx.g;
      g.fillStyle(RAMPS.crimson[5], 0.8);
      for (let i = -this.d.w / 2; i < this.d.w / 2; i += 4) g.fillRect(this.d.x + i, this.d.bottom - 1, 2, 1);
    }
  }
  reset(): void {
    this.t = 0;
  }
  destroy(): void {
    this.head.destroy();
    this.shaft.destroy();
  }
}

// -----------------------------------------------------------------------------

class Flood {
  y: number;
  rising = false;
  private glow: Phaser.GameObjects.TileSprite;
  private ctx: Ctx;
  private d: FloodDef;
  constructor(ctx: Ctx, d: FloodDef) {
    this.ctx = ctx;
    this.d = d;
    this.y = d.y0;
    this.glow = ctx.scene.add.tileSprite(0, 0, GAME_W, 64, 'bg-fog').setOrigin(0, 1).setDepth(DEPTH.tiles - 0.4).setTint(RAMPS.magenta[4]).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
  }
  fixedUpdate(dt: number, p: Player): void {
    const t = this.d.trigger;
    if (!this.rising && !p.dead && overlap(p.body, t.x, t.y, t.w, t.h)) {
      this.rising = true;
      this.ctx.juice.sfx('roar', { vol: 0.5, pitch: 1.6 });
      this.ctx.juice.shake(3, 0.6);
    }
    if (this.rising) this.y = Math.max(this.d.y1, this.y - this.d.speed * dt);
    if (!p.dead && p.feetY - 8 > this.y) {
      this.ctx.fx.sparks(p.x, this.y, -90, 120, 18, [RAMPS.magenta[5], RAMPS.magenta[6], COLORS.white]);
      this.ctx.juice.sfx('steam', { vol: 0.8 });
      p.die(true);
    }
  }
  render(time: number): void {
    const cam = this.ctx.cam();
    const g = this.ctx.gBack;
    const top = Math.round(this.y);
    if (top > cam.scrollY + GAME_H + 4) {
      this.glow.setVisible(false);
      return;
    }
    const x0 = Math.floor(cam.scrollX) - 4;
    const w = GAME_W + 8;
    const bottom = cam.scrollY + GAME_H + 4;
    g.fillStyle(RAMPS.magenta[2], 0.92).fillRect(x0, top + 3, w, Math.max(0, bottom - top - 3));
    g.fillStyle(RAMPS.magenta[3], 0.9).fillRect(x0, top + 2, w, 3);
    for (let x = x0; x < x0 + w; x += 2) {
      const wy = top + Math.round(Math.sin(x * 0.12 + time * 4) * 1.2);
      g.fillStyle(RAMPS.magenta[6], 1).fillRect(x, wy, 2, 1);
      g.fillStyle(RAMPS.magenta[5], 1).fillRect(x, wy + 1, 2, 1);
    }
    // bubbles
    for (let i = 0; i < 18; i++) {
      const bx = x0 + ((i * 53 + Math.floor(time * 20) * 7) % w);
      const by = top + 6 + ((i * 37 + Math.floor(time * 30)) % Math.max(8, bottom - top));
      g.fillStyle(RAMPS.magenta[5], 0.7).fillRect(bx, by, 1, 1);
    }
    this.glow.setVisible(true).setPosition(cam.scrollX, top + 8);
    this.glow.tilePositionX = Math.round(cam.scrollX * 1.1 + time * 14);
  }
  reset(): void {
    this.y = this.d.y0;
    this.rising = false;
  }
  destroy(): void {
    this.glow.destroy();
  }
}

// -----------------------------------------------------------------------------

class Well implements AnchorPoint {
  readonly hookRadius = 11;
  readonly x: number;
  readonly y: number;
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private ctx: Ctx;
  private d: WellDef;
  constructor(ctx: Ctx, d: WellDef) {
    this.ctx = ctx;
    this.d = d;
    this.x = d.x;
    this.y = d.y;
    this.glow = ctx.scene.add.image(d.x, d.y, 'fx', 'glow64').setDepth(DEPTH.objects - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(RAMPS.violet[4]).setAlpha(0.4);
    this.img = ctx.scene.add.image(d.x, d.y, 'ch2', 'well_0').setDepth(DEPTH.objects);
  }
  fixedUpdate(dt: number, p: Player): void {
    const b = p.body;
    if (p.dead || b.onGround || p.grapple.attachedTo === this) return;
    const dx = this.x - b.x;
    const dy = this.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.d.r || dist < 4) return;
    const k = this.d.strength * (1 - dist / this.d.r) * (p.grapple.attached ? 0.4 : 1);
    b.vx += (dx / dist) * k * dt;
    b.vy += (dy / dist) * k * dt;
    p.refreshAirDash();
  }
  render(dt: number, time: number): void {
    this.img.setFrame(`well_${Math.floor(time * 12) % 4}`);
    this.glow.setAlpha(0.32 + Math.sin(time * 3) * 0.08);
    if (!onScreen(this.ctx, this.x, this.y, this.d.r)) return;
    const g = this.ctx.g;
    // contracting rings show the pull radius
    for (let k = 0; k < 3; k++) {
      const r = this.d.r * (1 - ((time * 0.35 + k / 3) % 1));
      const n = Math.max(12, Math.floor(r / 3));
      g.fillStyle(RAMPS.violet[4], 0.5 * (1 - r / this.d.r) + 0.1);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + time * 0.6;
        if (i % 2) g.fillRect(Math.round(this.x + Math.cos(a) * r), Math.round(this.y + Math.sin(a) * r), 1, 1);
      }
    }
    if (Math.random() < dt * 20) {
      const a = rand(0, Math.PI * 2);
      const r = this.d.r * rand(0.6, 1);
      this.ctx.fx.emit(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, { frame: 'px1', speed: [r * 0.9, r * 1.1], angle: (a * 180) / Math.PI + 180, spread: 10, life: [0.9, 1], tint: [RAMPS.violet[5], RAMPS.gold[5]], add: true });
    }
  }
  destroy(): void {
    this.img.destroy();
    this.glow.destroy();
  }
}

// -----------------------------------------------------------------------------

interface PhaseCell {
  tx: number;
  ty: number;
  which: 'A' | 'B';
  pending: boolean;
}

class PhaseBlocks {
  private cells: PhaseCell[] = [];
  private active: 'A' | 'B' = 'A';
  private t = 0;
  private ctx: Ctx;
  private period: number;
  constructor(ctx: Ctx, period: number) {
    this.ctx = ctx;
    this.period = period;
    const d = ctx.level.data;
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const m = d.mat[y * d.w + x];
        if (m === Mat.PhaseA || m === Mat.PhaseB) this.cells.push({ tx: x, ty: y, which: m === Mat.PhaseA ? 'A' : 'B', pending: false });
      }
  }
  get count(): number {
    return this.cells.length;
  }
  private apply(c: PhaseCell, solid: boolean): void {
    const w = this.ctx.world;
    w.cells[c.ty * w.w + c.tx] = solid ? Cell.Solid : Cell.Empty;
    const tile = c.which === 'A' ? (solid ? EXTRA_TILE.phaseA : EXTRA_TILE.phaseAGhost) : solid ? EXTRA_TILE.phaseB : EXTRA_TILE.phaseBGhost;
    this.ctx.level.mainLayer?.putTileAt(tile, c.tx, c.ty);
  }
  fixedUpdate(dt: number, p: Player): void {
    if (!this.cells.length) return;
    this.t += dt;
    if (this.t >= this.period) {
      this.t -= this.period;
      this.active = this.active === 'A' ? 'B' : 'A';
      this.ctx.juice.sfx('phase', { vol: 0.5 });
      for (const c of this.cells) {
        const solid = c.which === this.active;
        if (solid && overlap(p.body, c.tx * TILE, c.ty * TILE, TILE, TILE)) {
          c.pending = true;
          this.apply(c, false);
        } else {
          c.pending = false;
          this.apply(c, solid);
        }
      }
    }
    for (const c of this.cells) {
      if (c.pending && !overlap(p.body, c.tx * TILE, c.ty * TILE, TILE, TILE)) {
        c.pending = false;
        if (c.which === this.active) this.apply(c, true);
      }
    }
  }
  render(time: number): void {
    // warning: the set about to appear flickers in during the last beat
    const warn = this.period - this.t < 0.45;
    const g = this.ctx.g;
    if (!warn || Math.floor(time * 14) % 2) return;
    for (const c of this.cells) {
      if (c.which === this.active) continue;
      const x = c.tx * TILE;
      const y = c.ty * TILE;
      if (!onScreen(this.ctx, x, y)) continue;
      g.lineStyle(1, c.which === 'A' ? RAMPS.cyan[5] : RAMPS.magenta[5], 0.9).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
  reset(): void {
    this.t = 0;
    this.active = 'A';
    for (const c of this.cells) {
      c.pending = false;
      this.apply(c, c.which === 'A');
    }
  }
}

// -----------------------------------------------------------------------------

class Bouncer {
  private squash = 0;
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private ctx: Ctx;
  private x: number;
  private y: number;
  private power: number;
  constructor(ctx: Ctx, x: number, y: number, power: number) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.power = power;
    this.glow = ctx.scene.add.image(x, y - 12, 'fx', 'glow32').setDepth(DEPTH.objects - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(RAMPS.cyan[5]).setAlpha(0.35);
    this.img = ctx.scene.add.image(x, y, 'ch2', 'bloom_0').setOrigin(0.5, 1).setDepth(DEPTH.objects);
  }
  fixedUpdate(dt: number, p: Player): void {
    this.squash -= dt;
    const b = p.body;
    if (p.dead || b.vy < 0) return;
    if (Math.abs(b.x - this.x) < 12 && p.feetY > this.y - 18 && p.feetY < this.y + 2) {
      b.vy = -this.power;
      b.onGround = false;
      p.refreshAirDash();
      this.squash = 0.18;
      this.ctx.juice.sfx('bloom', { vol: 0.7 });
      this.ctx.fx.sparks(this.x, this.y - 14, -90, 120, 10, [RAMPS.cyan[5], RAMPS.cyan[6], RAMPS.magenta[6]]);
    }
  }
  render(time: number): void {
    this.img.setFrame(this.squash > 0 ? 'bloom_1' : 'bloom_0');
    this.glow.setAlpha(this.squash > 0 ? 0.7 : 0.3 + Math.sin(time * 2 + this.x) * 0.06);
  }
  destroy(): void {
    this.img.destroy();
    this.glow.destroy();
  }
}

// -----------------------------------------------------------------------------

class Switch implements AnchorPoint {
  readonly hookRadius = 10;
  readonly x: number;
  readonly y: number;
  lit = 0;
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  readonly d: SwitchDef;
  constructor(ctx: Ctx, d: SwitchDef) {
    this.d = d;
    this.x = d.x;
    this.y = d.y;
    this.glow = ctx.scene.add.image(d.x, d.y, 'fx', 'glow32').setDepth(DEPTH.objects - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(RAMPS.gold[5]).setAlpha(0.3);
    this.img = ctx.scene.add.image(d.x, d.y, 'ch2', 'switch_off').setDepth(DEPTH.objects);
  }
  render(time: number): void {
    const blink = this.lit > 0 && this.lit < 1.5 && Math.floor(time * 10) % 2 === 0;
    this.img.setFrame(this.lit > 0 && !blink ? 'switch_on' : 'switch_off');
    this.glow.setAlpha(this.lit > 0 ? 0.6 : 0.22 + Math.sin(time * 3) * 0.06);
  }
  destroy(): void {
    this.img.destroy();
    this.glow.destroy();
  }
}

class Bridges {
  private ctx: Ctx;
  private defs: BridgeDef[];
  constructor(ctx: Ctx, defs: BridgeDef[]) {
    this.ctx = ctx;
    this.defs = defs;
  }
  set(group: number, on: boolean, blinkOff = false): void {
    const w = this.ctx.world;
    for (const b of this.defs) {
      if (b.group !== group) continue;
      for (let x = b.x0; x <= b.x1; x++) {
        if (!blinkOff) w.cells[b.y * w.w + x] = on ? Cell.OneWay : Cell.Empty;
        this.ctx.level.mainLayer?.putTileAt(on ? EXTRA_TILE.bridgeOn : EXTRA_TILE.bridgeOff, x, b.y);
      }
    }
  }
}

// -----------------------------------------------------------------------------

class Rod {
  private t = 0;
  private img: Phaser.GameObjects.Image;
  private struck = false;
  private bolt: [number, number][] = [];
  private boltT = 0;
  private ctx: Ctx;
  private d: RodDef;
  constructor(ctx: Ctx, d: RodDef) {
    this.ctx = ctx;
    this.d = d;
    this.img = ctx.scene.add.image(d.x, d.y, 'ch2', 'rod').setOrigin(0.5, 0).setDepth(DEPTH.objects);
  }
  private get u(): number {
    return (this.t / this.d.period + this.d.phase) % 1;
  }
  fixedUpdate(dt: number, p: Player): void {
    this.t += dt;
    this.boltT -= dt;
    const u = this.u;
    if (u < 0.9) this.struck = false;
    if (u >= 0.9 && !this.struck) {
      this.struck = true;
      this.boltT = 0.16;
      const cam = this.ctx.cam();
      // jagged bolt from the clouds to the rod tip
      this.bolt = [];
      let x = this.d.x + rand(-40, 40);
      const top = Math.min(this.d.y - 60, cam.scrollY - 10);
      for (let y = top; y < this.d.y; y += 10) {
        this.bolt.push([x, y]);
        x += rand(-9, 9) + (this.d.x - x) * 0.18;
      }
      this.bolt.push([this.d.x, this.d.y]);
      const vis = onScreen(this.ctx, this.d.x, this.d.y, 120);
      if (vis) {
        this.ctx.juice.flash(0.55);
        this.ctx.juice.shake(5, 0.3);
        this.ctx.juice.sfx('thunder', { vol: 0.9 });
        this.ctx.fx.sparks(this.d.x, this.d.y, -90, 360, 20, [COLORS.white, COLORS.cyanHot, COLORS.cyan]);
      }
      const b = p.body;
      if (!p.dead && Math.abs(b.x - this.d.x) < this.d.radius && b.y + b.h / 2 > this.d.y - 16 && b.y - b.h / 2 < this.d.base + 4) {
        p.hurt(1, this.d.x, true);
      }
    }
  }
  render(time: number): void {
    const u = this.u;
    const charging = u > 0.66 && u < 0.9;
    this.img.setFrame(charging && Math.floor(time * (u > 0.8 ? 20 : 8)) % 2 === 0 ? 'rod_hot' : 'rod');
    if (!onScreen(this.ctx, this.d.x, this.d.y, 140)) return;
    const g = this.ctx.gFront;
    if (charging) {
      if (Math.random() < 0.4) this.ctx.fx.zap(this.d.x + rand(-3, 3), this.d.y + rand(0, 6));
      // danger radius on the floor and around the rod
      if (Math.floor(time * 10) % 2 === 0) {
        g.fillStyle(RAMPS.cyan[5], 0.75);
        for (let x = -this.d.radius; x <= this.d.radius; x += 4) g.fillRect(this.d.x + x, this.d.base - 1, 2, 1);
        for (let y = this.d.y; y < this.d.base; y += 6) {
          g.fillRect(this.d.x - this.d.radius, y, 1, 2);
          g.fillRect(this.d.x + this.d.radius, y, 1, 2);
        }
      }
    }
    if (this.boltT > 0 && this.bolt.length > 1) {
      for (let i = 0; i < this.bolt.length - 1; i++) {
        const [x0, y0] = this.bolt[i];
        const [x1, y1] = this.bolt[i + 1];
        g.lineStyle(3, RAMPS.cyan[5], 0.6).lineBetween(x0, y0, x1, y1);
        g.lineStyle(1, 0xffffff, 1).lineBetween(x0, y0, x1, y1);
      }
      // ground arcs across the strike radius
      for (let k = 0; k < 4; k++) {
        const ex = this.d.x + rand(-this.d.radius, this.d.radius);
        g.lineStyle(1, RAMPS.cyan[6], 0.9).lineBetween(this.d.x, this.d.y + 4, ex, this.d.base - 2);
      }
    }
    void time;
  }
  reset(): void {
    this.t = 0;
  }
  destroy(): void {
    this.img.destroy();
  }
}

// -----------------------------------------------------------------------------

class Pulse {
  private t = 0;
  private hit = false;
  private img: Phaser.GameObjects.Image;
  private r = 0;
  private ctx: Ctx;
  private d: PulseDef;
  constructor(ctx: Ctx, d: PulseDef) {
    this.ctx = ctx;
    this.d = d;
    this.img = ctx.scene.add.image(d.x, d.y + 6, 'ch2', 'emitter').setDepth(DEPTH.objects);
  }
  fixedUpdate(dt: number, p: Player): void {
    this.t += dt;
    const u = (this.t / this.d.period + this.d.phase) % 1;
    // rings expand at a fixed speed so even a small pad launches crisply
    const span = this.d.radius / 260 / this.d.period;
    if (u > span) {
      this.r = 0;
      this.hit = false;
      return;
    }
    const prev = this.r;
    this.r = Math.max(1, (u / span) * this.d.radius);
    if (prev === 0 && onScreen(this.ctx, this.d.x, this.d.y)) this.ctx.juice.sfx('pulse', { vol: 0.55 });
    const b = p.body;
    const dx = b.x - this.d.x;
    const dy = b.y - this.d.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (!this.hit && !p.dead && dist < this.r + 6) {
      this.hit = true;
      // push away from a point just under the pad, so standing on it launches straight up
      const py = dy - 14;
      const pd = Math.hypot(dx, py) || 1;
      b.vx += (dx / pd) * this.d.force;
      b.vy += (py / pd) * this.d.force * 0.85 - 60;
      b.onGround = false;
      p.refreshAirDash();
      this.ctx.juice.shake(2, 0.1);
      this.ctx.fx.ring(b.x, b.y, COLORS.cyanHot);
    }
  }
  render(): void {
    if (this.r <= 0 || !onScreen(this.ctx, this.d.x, this.d.y, this.d.radius)) return;
    const g = this.ctx.gFront;
    const k = this.r / this.d.radius;
    const n = Math.max(16, Math.floor(this.r / 2));
    for (let ring = 0; ring < 2; ring++) {
      const r = this.r - ring * 5;
      if (r <= 0) continue;
      g.fillStyle(ring ? RAMPS.cyan[4] : 0xffffff, (1 - k) * (ring ? 0.5 : 0.9));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.fillRect(Math.round(this.d.x + Math.cos(a) * r), Math.round(this.d.y + Math.sin(a) * r), 1, 1);
      }
    }
  }
  reset(): void {
    this.t = 0;
  }
  destroy(): void {
    this.img.destroy();
  }
}

// =============================================================================

/** All chapter 2 devices of a stage. */
export class Devices {
  private ctx: Ctx;
  private lasers: Laser[] = [];
  private fans: Fan[] = [];
  private crushers: Crusher[] = [];
  readonly floods: Flood[] = [];
  private wells: Well[] = [];
  private phase: PhaseBlocks;
  private bouncers: Bouncer[] = [];
  private switches: Switch[] = [];
  private bridges: Bridges;
  /** Co-op: a switch was lit / a flood started by the local player. */
  onSwitch: ((i: number) => void) | null = null;
  onFlood: ((i: number) => void) | null = null;
  private rods: Rod[] = [];
  private pulses: Pulse[] = [];
  private zoneGfx: Phaser.GameObjects.Graphics;
  private time = 0;

  constructor(scene: Phaser.Scene, level: Level, fx: Particles, juice: Juice) {
    const g = scene.add.graphics().setDepth(DEPTH.objects - 0.5);
    const gFront = scene.add.graphics().setDepth(DEPTH.fx - 0.5);
    const gBack = scene.add.graphics().setDepth(DEPTH.tiles - 0.5);
    this.ctx = { scene, level, world: level.world, fx, juice, g, gFront, gBack, cam: () => scene.cameras.main };
    const d = level.data;
    for (const l of d.lasers) this.lasers.push(new Laser(this.ctx, l));
    for (const f of d.fans) this.fans.push(new Fan(this.ctx, f));
    for (const c of d.crushers) this.crushers.push(new Crusher(this.ctx, c));
    for (const f of d.floods) this.floods.push(new Flood(this.ctx, f));
    for (const w of d.wells) this.wells.push(new Well(this.ctx, w));
    this.phase = new PhaseBlocks(this.ctx, d.phasePeriod || 2);
    for (const b of d.bouncers) this.bouncers.push(new Bouncer(this.ctx, b.x, b.y, b.power));
    for (const s of d.switches) this.switches.push(new Switch(this.ctx, s));
    this.bridges = new Bridges(this.ctx, d.bridges);
    for (const r of d.rods) this.rods.push(new Rod(this.ctx, r));
    for (const p of d.pulses) this.pulses.push(new Pulse(this.ctx, p));
    // low-gravity pockets: dotted borders drawn once
    this.zoneGfx = scene.add.graphics().setDepth(DEPTH.decorBack + 0.7);
    for (const z of d.zones) {
      this.zoneGfx.fillStyle(RAMPS.violet[4], 0.5);
      for (let x = z.x; x < z.x + z.w; x += 4) {
        this.zoneGfx.fillRect(x, z.y, 2, 1);
        this.zoneGfx.fillRect(x, z.y + z.h - 1, 2, 1);
      }
      for (let y = z.y; y < z.y + z.h; y += 4) {
        this.zoneGfx.fillRect(z.x, y, 1, 2);
        this.zoneGfx.fillRect(z.x + z.w - 1, y, 1, 2);
      }
      this.zoneGfx.fillStyle(RAMPS.violet[2], 0.08).fillRect(z.x, z.y, z.w, z.h);
    }
  }

  /** Extra hook targets (gravity cores, bridge switches). */
  anchors(): AnchorPoint[] {
    return (this.wells as AnchorPoint[]).concat(this.switches);
  }

  fixedUpdate(dt: number, p: Player): void {
    this.time += dt;
    // gravity pockets
    p.gravityScale = 1;
    const b = p.body;
    for (const z of this.ctx.level.data.zones) if (b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h) p.gravityScale = Math.min(p.gravityScale, z.scale);
    for (const l of this.lasers) l.fixedUpdate(dt, p);
    for (const f of this.fans) f.fixedUpdate(dt, p);
    for (const c of this.crushers) c.fixedUpdate(dt, p);
    for (let i = 0; i < this.floods.length; i++) {
      const f = this.floods[i];
      const was = f.rising;
      f.fixedUpdate(dt, p);
      if (!was && f.rising) this.onFlood?.(i);
    }
    for (const w of this.wells) w.fixedUpdate(dt, p);
    this.phase.fixedUpdate(dt, p);
    for (const bo of this.bouncers) bo.fixedUpdate(dt, p);
    for (const r of this.rods) r.fixedUpdate(dt, p);
    for (const pu of this.pulses) pu.fixedUpdate(dt, p);
    // switches: lit by hooking (or slashing) them
    const hb = p.attackHitbox();
    for (let i = 0; i < this.switches.length; i++) {
      const s = this.switches[i];
      const hooked = p.grapple.attachedTo === s;
      const slashed = hb && Math.abs(hb.x + hb.w / 2 - s.x) < hb.w / 2 + 6 && Math.abs(hb.y + hb.h / 2 - s.y) < hb.h / 2 + 6;
      if (hooked || slashed) {
        this.lightSwitch(i);
        this.onSwitch?.(i);
      } else if (s.lit > 0) {
        s.lit -= dt;
        if (s.lit <= 0) {
          this.bridges.set(s.d.group, false);
          this.ctx.juice.sfx('switch', { vol: 0.5, pitch: 0.6 });
        }
      }
    }
  }

  /** Light switch i (by the local player, or the partner over the network). */
  lightSwitch(i: number): void {
    const s = this.switches[i];
    if (!s) return;
    if (s.lit <= 0) {
      this.bridges.set(s.d.group, true);
      this.ctx.juice.sfx('switch', { vol: 0.8 });
      this.ctx.fx.ring(s.x, s.y, COLORS.amberHot);
    }
    s.lit = s.d.duration;
  }

  /** The partner set off flood i. */
  startFlood(i: number): void {
    const f = this.floods[i];
    if (f) f.rising = true;
  }

  render(dt: number): void {
    const t = this.time;
    this.ctx.g.clear();
    this.ctx.gFront.clear();
    this.ctx.gBack.clear();
    for (const l of this.lasers) l.render(t);
    for (const f of this.fans) f.render(dt, t);
    for (const c of this.crushers) c.render(t);
    for (const f of this.floods) f.render(t);
    for (const w of this.wells) w.render(dt, t);
    this.phase.render(t);
    for (const b of this.bouncers) b.render(t);
    for (const s of this.switches) {
      s.render(t);
      // blink the bridge in its last 1.5 s
      if (s.lit > 0 && s.lit < 1.5) this.bridges.set(s.d.group, Math.floor(t * 10) % 2 === 0, true);
    }
    for (const r of this.rods) r.render(t);
    for (const p of this.pulses) p.render();
    // drifting motes inside zero-g pockets
    for (const z of this.ctx.level.data.zones) {
      if (Math.random() < dt * (z.w * z.h) / 6000 && onScreen(this.ctx, z.x + z.w / 2, z.y + z.h / 2, Math.max(z.w, z.h))) {
        this.ctx.fx.emit(z.x + rand(4, z.w - 4), z.y + rand(4, z.h - 4), { frame: 'px1', speed: [6, 16], angle: -90, spread: 60, life: [1.2, 2], tint: [RAMPS.violet[5], RAMPS.gold[5]], add: true });
      }
    }
  }

  reset(): void {
    for (const l of this.lasers) l.reset();
    for (const c of this.crushers) c.reset();
    for (const f of this.floods) f.reset();
    for (const r of this.rods) r.reset();
    for (const p of this.pulses) p.reset();
    this.phase.reset();
    for (const s of this.switches) {
      if (s.lit > 0) this.bridges.set(s.d.group, false);
      s.lit = 0;
    }
  }

  destroy(): void {
    for (const l of this.lasers) l.destroy();
    for (const f of this.fans) f.destroy();
    for (const c of this.crushers) c.destroy();
    for (const f of this.floods) f.destroy();
    for (const w of this.wells) w.destroy();
    for (const b of this.bouncers) b.destroy();
    for (const s of this.switches) s.destroy();
    for (const r of this.rods) r.destroy();
    for (const p of this.pulses) p.destroy();
    this.ctx.g.destroy();
    this.ctx.gFront.destroy();
    this.ctx.gBack.destroy();
    this.zoneGfx.destroy();
  }
}
