// Chapter 3 stage devices — one new rule per stage:
//   Cable     — hook a cable and slide along it (zip line)            [sunlit roofs]
//   Water     — buoyancy, drag, currents                              [drowned undercity]
//   Light     — sweeping searchlights; a sighting raises the alarm,
//               shutters slam and drones come                         [restless avenue]
//   Train     — high-speed cars to ride; gantries to jump              [transit line]
//   Portal    — momentum-preserving gates                              [relay lab]
//   Crate     — cargo you drag with the tether: steps, vent plugs      [crane harbor]
//   Rotor / Pendulum — orbiting platforms, swinging hookable weights  [clock tower]
import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, TILE } from '../config.ts';
import { COLORS, RAMPS } from '../art/palette.ts';
import { approach, rand } from '../core/math.ts';
import { Cell, makeBody, type Body, type TileWorld } from '../physics/TileWorld.ts';
import type { Carrier, Plat, Player } from '../entities/Player.ts';
import type { AnchorPoint } from '../entities/Grapple.ts';
import type { Particles } from '../fx/Particles.ts';
import type { Juice } from '../fx/Juice.ts';
import type { Level } from './Level.ts';
import type { CableDef, Facing, LightDef, PendulumDef, PortalDef, RotorDef, TrainDef, WaterDef } from './LevelData.ts';

interface Ctx {
  scene: Phaser.Scene;
  level: Level;
  world: TileWorld;
  fx: Particles;
  juice: Juice;
  g: Phaser.GameObjects.Graphics;
  gFront: Phaser.GameObjects.Graphics;
  cam: () => Phaser.Cameras.Scene2D.Camera;
}

const onScreen = (ctx: Ctx, x: number, y: number, m = 60) => {
  const c = ctx.cam();
  return x > c.scrollX - m && x < c.scrollX + GAME_W + m && y > c.scrollY - m && y < c.scrollY + GAME_H + m;
};

function overlap(b: Body, x: number, y: number, w: number, h: number): boolean {
  return b.x + b.w / 2 > x && b.x - b.w / 2 < x + w && b.y + b.h / 2 > y && b.y - b.h / 2 < y + h;
}

/** Segment-segment intersection parameter along the second segment (or -1). */
function segHit(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const r1x = bx - ax;
  const r1y = by - ay;
  const r2x = dx - cx;
  const r2y = dy - cy;
  const den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-6) return -1;
  const t = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
  const u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : -1;
}

// =============================================================================
// Cable (zip line)
// =============================================================================

class Cable {
  readonly len: number;
  readonly ux: number;
  readonly uy: number;
  private poles: Phaser.GameObjects.Image[] = [];
  readonly d: CableDef;
  constructor(ctx: Ctx, d: CableDef) {
    this.d = d;
    this.len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
    this.ux = (d.x1 - d.x0) / this.len;
    this.uy = (d.y1 - d.y0) / this.len;
    for (const [x, y] of [
      [d.x0, d.y0],
      [d.x1, d.y1],
    ])
      this.poles.push(ctx.scene.add.image(x, y, 'ch3', 'pulley').setDepth(DEPTH.objects));
  }
  at(s: number): [number, number] {
    // slight sag in the middle
    const sag = Math.sin(s * Math.PI) * Math.min(10, this.len * 0.02);
    return [this.d.x0 + (this.d.x1 - this.d.x0) * s, this.d.y0 + (this.d.y1 - this.d.y0) * s + sag];
  }
  draw(g: Phaser.GameObjects.Graphics): void {
    const n = Math.ceil(this.len / 2);
    for (let i = 0; i <= n; i++) {
      const [x, y] = this.at(i / n);
      g.fillStyle(0x1a1626, 1).fillRect(Math.round(x), Math.round(y), 1, 1);
      g.fillStyle(0x4a4058, 1).fillRect(Math.round(x), Math.round(y) - 1, 1, 1);
    }
  }
  destroy(): void {
    for (const p of this.poles) p.destroy();
  }
}

class CableRide implements Carrier {
  private v: number;
  private s: number;
  private trolley: Phaser.GameObjects.Image;
  private sparkT = 0;
  private ctx: Ctx;
  private c: Cable;
  constructor(ctx: Ctx, c: Cable, s: number, vx: number, vy: number) {
    this.ctx = ctx;
    this.c = c;
    this.s = s;
    this.v = vx * c.ux + vy * c.uy;
    this.trolley = ctx.scene.add.image(0, 0, 'ch3', 'trolley').setDepth(DEPTH.player + 1);
    ctx.juice.sfx('zipline', { vol: 0.6 });
  }
  step(dt: number, p: Player, jump: boolean, held: boolean): boolean {
    const c = this.c;
    // gravity along the cable, a little friction, a speed cap
    this.v += 1000 * c.uy * dt;
    this.v *= Math.exp(-0.18 * dt);
    this.v = Math.max(-540, Math.min(540, this.v));
    this.s += (this.v * dt) / c.len;
    const b = p.body;
    const [tx, ty] = c.at(Math.max(0, Math.min(1, this.s)));
    b.vx = this.v * c.ux;
    b.vy = this.v * c.uy;
    const nx = tx;
    const ny = ty + 26;
    // blocked by geometry → let go
    if (this.ctx.world.solidAtPoint(nx, ny - 8) || this.ctx.world.solidAtPoint(nx, ny + 10)) return this.end(p, false);
    b.x = nx;
    b.y = ny;
    b.onGround = false;
    p.facing = this.v >= 0 ? (c.ux >= 0 ? 1 : -1) : c.ux >= 0 ? -1 : 1;
    this.trolley.setPosition(Math.round(tx), Math.round(ty));
    this.sparkT -= dt;
    if (Math.abs(this.v) > 180 && this.sparkT <= 0) {
      this.sparkT = 0.05;
      this.ctx.fx.sparks(tx, ty, this.v * c.ux > 0 ? 180 : 0, 40, 2, [COLORS.amberHot, COLORS.white]);
    }
    if (jump) {
      b.vy = Math.min(b.vy, 0) - 300;
      this.ctx.juice.sfx('jump');
      return this.end(p, true);
    }
    if (!held || this.s <= 0 || this.s >= 1) return this.end(p, true);
    return true;
  }
  private end(p: Player, fling: boolean): boolean {
    if (fling) {
      const b = p.body;
      b.vx *= 1.05;
      this.ctx.fx.speedLines(b.x, b.y, b.vx, b.vy, 3);
    }
    this.trolley.destroy();
    return false;
  }
}

// =============================================================================
// Water
// =============================================================================

class Water {
  private ctx: Ctx;
  readonly d: WaterDef;
  constructor(ctx: Ctx, d: WaterDef) {
    this.ctx = ctx;
    this.d = d;
  }
  depthOf(b: Body): number {
    const d = this.d;
    if (b.x < d.x || b.x > d.x + d.w || b.y - b.h / 2 > d.y + d.h || b.y + b.h / 2 < d.y) return 0;
    return Math.max(0, Math.min(1, (b.y + b.h / 2 - d.y) / b.h));
  }
  render(time: number): void {
    const d = this.d;
    const cam = this.ctx.cam();
    const x0 = Math.max(d.x, Math.floor(cam.scrollX) - 2);
    const x1 = Math.min(d.x + d.w, cam.scrollX + GAME_W + 2);
    const y1 = Math.min(d.y + d.h, cam.scrollY + GAME_H + 2);
    if (x1 <= x0 || d.y > cam.scrollY + GAME_H || y1 < cam.scrollY) return;
    const g = this.ctx.gFront;
    g.fillStyle(0x1c5a6a, 0.38).fillRect(x0, d.y + 2, x1 - x0, y1 - d.y - 2);
    g.fillStyle(0x0c2a36, 0.28).fillRect(x0, d.y + 18, x1 - x0, Math.max(0, y1 - d.y - 18));
    for (let x = Math.floor(x0 / 2) * 2; x < x1; x += 2) {
      const wy = d.y + Math.round(Math.sin(x * 0.09 + time * 2.4) * 1.2);
      g.fillStyle(0xbcf0f4, 0.9).fillRect(x, wy, 2, 1);
      g.fillStyle(0x46a4b4, 0.7).fillRect(x, wy + 1, 2, 1);
    }
    // drifting caustic glints
    for (let i = 0; i < 14; i++) {
      const gx = x0 + ((i * 61 + Math.floor(time * 12) * 3) % Math.max(1, x1 - x0));
      const gy = d.y + 6 + ((i * 29 + Math.floor(time * 7)) % Math.max(6, Math.min(80, y1 - d.y - 6)));
      g.fillStyle(0x7cdce8, 0.35).fillRect(gx, gy, 3, 1);
    }
    // current arrows
    if (d.cx || d.cy) {
      const a = Math.atan2(d.cy, d.cx);
      for (let i = 0; i < 6; i++) {
        const px = d.x + (((i * 97 + time * 40 * Math.sign(d.cx || 1)) % d.w) + d.w) % d.w;
        const py = d.y + 12 + ((i * 53) % Math.max(10, d.h - 16));
        if (px < x0 || px > x1) continue;
        g.fillStyle(0xd0ecf4, 0.3).fillRect(Math.round(px), Math.round(py), 4, 1);
        g.fillRect(Math.round(px + Math.cos(a) * 4), Math.round(py + Math.sin(a) * 4) - 1, 1, 1);
      }
    }
  }
}

// =============================================================================
// Searchlights + alarm
// =============================================================================

class Light {
  private head: Phaser.GameObjects.Image;
  angle = 0;
  seen = 0;
  private ctx: Ctx;
  readonly d: LightDef;
  constructor(ctx: Ctx, d: LightDef) {
    this.ctx = ctx;
    this.d = d;
    this.head = ctx.scene.add.image(d.x, d.y, 'ch3', 'lamp').setDepth(DEPTH.objects + 1);
  }
  update(t: number): void {
    const d = this.d;
    const k = 0.5 - 0.5 * Math.cos(((t / d.period + d.phase) % 1) * Math.PI * 2);
    this.angle = d.a0 + (d.a1 - d.a0) * k;
  }
  sees(p: Player): boolean {
    const d = this.d;
    if (p.dead) return false;
    const dx = p.x - d.x;
    const dy = p.y - 4 - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist > d.range || dist < 4) return false;
    let da = (Math.atan2(dy, dx) * 180) / Math.PI - this.angle;
    while (da > 180) da -= 360;
    while (da < -180) da += 360;
    if (Math.abs(da) > d.width / 2) return false;
    return this.ctx.world.clear(d.x, d.y, p.x, p.y - 4);
  }
  render(alarm: boolean): void {
    const d = this.d;
    this.head.setRotation(((this.angle - 90) * Math.PI) / 180);
    if (!onScreen(this.ctx, d.x, d.y, d.range)) return;
    const g = this.ctx.g;
    const col = alarm ? RAMPS.crimson[5] : this.seen > 0 ? RAMPS.amber[4] : 0xfff4c8;
    const a0 = ((this.angle - d.width / 2) * Math.PI) / 180;
    const a1 = ((this.angle + d.width / 2) * Math.PI) / 180;
    // the cone stops at walls: cast a few rays
    const pts: [number, number][] = [[d.x, d.y]];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const ex = d.x + Math.cos(a) * d.range;
      const ey = d.y + Math.sin(a) * d.range;
      const hit = this.ctx.world.raycast(d.x, d.y, ex, ey);
      pts.push(hit ? [hit.x, hit.y] : [ex, ey]);
    }
    g.fillStyle(col, alarm ? 0.2 : 0.13);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, col, 0.55);
    g.lineBetween(d.x, d.y, pts[1][0], pts[1][1]);
    g.lineBetween(d.x, d.y, pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }
  destroy(): void {
    this.head.destroy();
  }
}

// =============================================================================
// Trains
// =============================================================================

class Train {
  readonly cars: Plat[] = [];
  private carLeft: number[] = [];
  private imgs: Phaser.GameObjects.Image[] = [];
  private t = 0;
  private active = false;
  private horn = false;
  private ctx: Ctx;
  readonly d: TrainDef;
  constructor(ctx: Ctx, d: TrainDef) {
    this.ctx = ctx;
    this.d = d;
    for (let i = 0; i < d.cars; i++) {
      this.cars.push({ x: -9999, y: d.y, w: d.carW - 4, h: 28, dx: 0, dy: 0, vx: d.speed, vy: 0, solid: false });
      this.imgs.push(ctx.scene.add.image(0, 0, 'ch3', i === d.cars - 1 ? 'train_head' : 'train_car').setOrigin(0, 0).setDepth(DEPTH.objects + 0.5).setVisible(false));
    }
  }
  get length(): number {
    return this.d.cars * this.d.carW;
  }
  fixedUpdate(dt: number, p: Player): void {
    this.t += dt;
    const d = this.d;
    const u = (this.t + d.phase * d.period) % d.period;
    const front = d.x0 + u * d.speed;
    const tail = front - this.length;
    this.active = tail < d.x1;
    for (let i = 0; i < d.cars; i++) {
      const c = this.cars[i];
      const left = tail + i * d.carW;
      // clip to the visible track between the tunnel mouths
      const l = Math.max(left + 2, d.x0);
      const r = Math.min(left + d.carW - 2, d.x1);
      const live = this.active && r - l > 8;
      c.dx = live && c.x > -9000 ? l - c.x : 0;
      if (Math.abs(c.dx) > 100) c.dx = 0;
      c.x = live ? l : -9999;
      c.w = live ? r - l : 0;
      this.carLeft[i] = left;
    }
    // warning horn as the head enters the view
    const vis = this.active && onScreen(this.ctx, front, d.y, 40);
    if (vis && !this.horn) this.ctx.juice.sfx('horn', { vol: 0.7 });
    this.horn = vis;
    // the side of the train (not its roof) hits hard
    if (this.active && !p.dead) {
      const b = p.body;
      const l = Math.max(tail, d.x0);
      const r = Math.min(front, d.x1);
      if (r > l && overlap(b, l, d.y + 4, r - l, 24) && b.y + b.h / 2 > d.y + 4) {
        p.hurt(1, front + 40, true);
        b.vx = d.speed * 0.9;
      }
    }
  }
  render(g: Phaser.GameObjects.Graphics): void {
    const d = this.d;
    // the rail beam
    if (onScreen(this.ctx, this.ctx.cam().scrollX + GAME_W / 2, d.y + 28, 40)) {
      const cam = this.ctx.cam();
      const x0 = Math.max(d.x0, Math.floor(cam.scrollX) - 4);
      const x1 = Math.min(d.x1, cam.scrollX + GAME_W + 4);
      if (x1 > x0) {
        g.fillStyle(0x3a3f55, 1).fillRect(x0, d.y + 28, x1 - x0, 3);
        g.fillStyle(0x8090b0, 1).fillRect(x0, d.y + 28, x1 - x0, 1);
        for (let x = Math.ceil(x0 / 24) * 24; x < x1; x += 24) g.fillStyle(0x2a2f45, 1).fillRect(x, d.y + 31, 3, 6);
      }
    }
    for (let i = 0; i < d.cars; i++) {
      const c = this.cars[i];
      const img = this.imgs[i];
      const vis = c.x > -9000 && onScreen(this.ctx, c.x + c.w / 2, c.y, 120);
      img.setVisible(vis);
      if (!vis) continue;
      const left = this.carLeft[i] ?? c.x;
      const cropL = Math.max(0, Math.round(c.x - left - 2));
      const w = Math.max(1, Math.round(c.w + 4) - (cropL > 0 ? 2 : 0));
      img.setPosition(Math.round(left), Math.round(c.y)).setCrop(cropL, 0, Math.min(d.carW - cropL, w + (cropL > 0 ? 0 : 0)), 28);
    }
  }
  destroy(): void {
    for (const i of this.imgs) i.destroy();
  }
}

// =============================================================================
// Portals
// =============================================================================

const NORMAL: Record<Facing, [number, number]> = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };

class PortalPair {
  private imgs: Phaser.GameObjects.Image[] = [];
  private cd = 0;
  private ctx: Ctx;
  readonly d: PortalDef;
  constructor(ctx: Ctx, d: PortalDef) {
    this.ctx = ctx;
    this.d = d;
    for (const [x, y, n, key] of [
      [d.ax, d.ay, d.an, 'portal_a'],
      [d.bx, d.by, d.bn, 'portal_b'],
    ] as const) {
      const rot = n === 'R' ? 0 : n === 'L' ? Math.PI : n === 'U' ? -Math.PI / 2 : Math.PI / 2;
      this.imgs.push(ctx.scene.add.image(x, y, 'ch3', key).setDepth(DEPTH.objects + 1).setRotation(rot));
    }
  }
  private rect(x: number, y: number, n: Facing): [number, number, number, number] {
    return n === 'L' || n === 'R' ? [x - 4, y - 16, 8, 32] : [x - 16, y - 4, 32, 8];
  }
  fixedUpdate(dt: number, p: Player): void {
    this.cd -= dt;
    if (this.cd > 0 || p.dead) return;
    const d = this.d;
    const b = p.body;
    for (const [from, to] of [
      [
        [d.ax, d.ay, d.an],
        [d.bx, d.by, d.bn],
      ],
      [
        [d.bx, d.by, d.bn],
        [d.ax, d.ay, d.an],
      ],
    ] as const) {
      const [fx, fy, fn] = from;
      const [tx, ty, tn] = to;
      const [rx, ry, rw, rh] = this.rect(fx, fy, fn);
      if (!overlap(b, rx, ry, rw, rh)) continue;
      const [nx, ny] = NORMAL[fn];
      const into = -(b.vx * nx + b.vy * ny);
      if (into < 10) continue;
      // keep the speed you went in with, leave along the exit's facing
      const [ox, oy] = NORMAL[tn];
      const tang = b.vx * -ny + b.vy * nx;
      const speed = Math.max(into, 200);
      p.grapple.release(true);
      b.vx = ox * speed + -oy * tang * 0.6;
      b.vy = oy * speed + ox * tang * 0.6;
      if (oy < 0) b.vy = Math.min(b.vy, -speed);
      const off = tn === 'L' || tn === 'R' ? b.w / 2 + 8 : b.h / 2 + 8;
      b.x = tx + ox * off;
      b.y = ty + oy * off;
      b.onGround = false;
      p.refreshAirDash();
      this.cd = 0.25;
      this.ctx.juice.sfx('portal', { vol: 0.8 });
      this.ctx.juice.aberration(0.6);
      this.ctx.fx.ring(fx, fy, 0xffa040);
      this.ctx.fx.ring(tx, ty, COLORS.cyan);
      return;
    }
  }
  render(time: number): void {
    this.imgs[0].setAlpha(0.85 + Math.sin(time * 6) * 0.15);
    this.imgs[1].setAlpha(0.85 + Math.sin(time * 6 + 2) * 0.15);
    const d = this.d;
    if (Math.random() < 0.4) {
      for (const [x, y, n, c] of [
        [d.ax, d.ay, d.an, 0xffa040],
        [d.bx, d.by, d.bn, COLORS.cyan],
      ] as const) {
        if (!onScreen(this.ctx, x, y)) continue;
        const [nx, ny] = NORMAL[n];
        const t = rand(-14, 14);
        this.ctx.fx.emit(x + -ny * t, y + nx * t, { frame: 'px1', speed: [20, 50], angle: (Math.atan2(ny, nx) * 180) / Math.PI, spread: 30, life: [0.3, 0.5], tint: c, add: true });
      }
    }
    void time;
  }
  destroy(): void {
    for (const i of this.imgs) i.destroy();
  }
}

// =============================================================================
// Crates (drag them with the tether)
// =============================================================================

class Crate implements AnchorPoint {
  readonly moving = true;
  readonly hookRadius = 15;
  readonly body: Body;
  readonly plat: Plat;
  private img: Phaser.GameObjects.Image;
  private sx: number;
  private sy: number;
  private scrape = 0;
  private ctx: Ctx;
  constructor(ctx: Ctx, x: number, y: number) {
    this.ctx = ctx;
    this.sx = x;
    this.sy = y;
    this.body = makeBody(x, y - 14, 28, 28);
    this.plat = { x: x - 14, y: y - 28, w: 28, h: 28, dx: 0, dy: 0, vx: 0, vy: 0, solid: true };
    this.img = ctx.scene.add.image(x, y, 'ch3', 'crate').setOrigin(0.5, 1).setDepth(DEPTH.objects - 0.2);
  }
  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }
  fixedUpdate(dt: number, p: Player): void {
    const b = this.body;
    const px0 = b.x;
    const py0 = b.y;
    // dragged: tethered player on the ground pulling away from the crate
    const tethered = p.grapple.attachedTo === this && p.grapple.attached;
    const away = Math.sign(p.x - b.x);
    const pulling = tethered && p.onGround && p.lastInput === away && Math.hypot(p.x - b.x, p.y - b.y) >= p.grapple.rope.length - 3;
    if (pulling && b.onGround) b.vx = approach(b.vx, away * 92, 900 * dt);
    else b.vx = approach(b.vx, 0, (b.onGround ? 900 : 60) * dt);
    b.vy = Math.min(b.vy + 1000 * dt, 460);
    this.ctx.world.moveX(b, b.vx * dt);
    b.onGround = false;
    this.ctx.world.moveY(b, b.vy * dt);
    if (!b.onGround && b.vy >= 0) b.onGround = this.ctx.world.groundProbe(b);
    if (b.y > this.ctx.world.pixelHeight + 80) this.reset();
    const pl = this.plat;
    pl.dx = b.x - px0;
    pl.dy = b.y - py0;
    pl.x = b.x - 14;
    pl.y = b.y - 14;
    pl.vx = b.vx;
    pl.vy = b.vy;
    if (pulling && Math.abs(b.vx) > 20) {
      this.scrape -= dt;
      if (this.scrape <= 0) {
        this.scrape = 0.12;
        this.ctx.fx.dust(b.x - away * 12, b.y + 14, -away, 1);
        this.ctx.juice.sfx('scrape', { vol: 0.35 });
      }
    }
  }
  render(): void {
    this.img.setPosition(Math.round(this.body.x), Math.round(this.body.y + 14));
  }
  reset(): void {
    const b = this.body;
    b.x = this.sx;
    b.y = this.sy - 14;
    b.vx = b.vy = 0;
  }
  destroy(): void {
    this.img.destroy();
  }
}

// =============================================================================
// Rotors & pendulums
// =============================================================================

class Rotor {
  readonly plats: Plat[] = [];
  private planks: Phaser.GameObjects.Image[] = [];
  private axle: Phaser.GameObjects.Image;
  private a = 0;
  private ctx: Ctx;
  readonly d: RotorDef;
  constructor(ctx: Ctx, d: RotorDef) {
    this.ctx = ctx;
    this.d = d;
    this.axle = ctx.scene.add.image(d.cx, d.cy, 'ch3', 'axle').setDepth(DEPTH.objects - 0.4);
    for (let i = 0; i < d.n; i++) {
      this.plats.push({ x: 0, y: 0, w: d.w, h: 6, dx: 0, dy: 0, vx: 0, vy: 0, solid: false });
      this.planks.push(ctx.scene.add.image(0, 0, 'ch3', d.w >= 48 ? 'plank3' : 'plank2').setOrigin(0, 0).setDepth(DEPTH.objects - 0.3));
    }
    this.place(0);
  }
  private place(dt: number): void {
    const d = this.d;
    for (let i = 0; i < d.n; i++) {
      const a = this.a + (i / d.n) * Math.PI * 2;
      const nx = d.cx + Math.cos(a) * d.r - d.w / 2;
      const ny = d.cy + Math.sin(a) * d.r;
      const p = this.plats[i];
      if (dt > 0) {
        p.dx = nx - p.x;
        p.dy = ny - p.y;
        p.vx = p.dx / dt;
        p.vy = p.dy / dt;
      }
      p.x = nx;
      p.y = ny;
    }
  }
  fixedUpdate(dt: number): void {
    this.a += this.d.speed * dt;
    this.place(dt);
  }
  render(): void {
    const g = this.ctx.g;
    const d = this.d;
    if (!onScreen(this.ctx, d.cx, d.cy, d.r + 40)) return;
    for (let i = 0; i < d.n; i++) {
      const p = this.plats[i];
      g.lineStyle(2, 0x3a2a1a, 1).lineBetween(d.cx, d.cy, p.x + d.w / 2, p.y + 3);
      g.lineStyle(1, 0x8a6a3a, 1).lineBetween(d.cx, d.cy - 1, p.x + d.w / 2, p.y + 2);
      this.planks[i].setPosition(Math.round(p.x), Math.round(p.y));
    }
    this.axle.setRotation(this.a);
  }
  reset(): void {
    this.a = 0;
    this.place(0);
  }
  destroy(): void {
    this.axle.destroy();
    for (const p of this.planks) p.destroy();
  }
}

class Pendulum implements AnchorPoint {
  readonly moving = true;
  readonly hookRadius = 11;
  x = 0;
  y = 0;
  private t = 0;
  private bob: Phaser.GameObjects.Image;
  private ctx: Ctx;
  readonly d: PendulumDef;
  constructor(ctx: Ctx, d: PendulumDef) {
    this.ctx = ctx;
    this.d = d;
    this.bob = ctx.scene.add.image(0, 0, 'ch3', 'bob').setDepth(DEPTH.objects);
    this.fixedUpdate(0);
  }
  fixedUpdate(dt: number): void {
    this.t += dt;
    const d = this.d;
    const a = d.amp * Math.sin(((this.t / d.period + d.phase) % 1) * Math.PI * 2);
    this.x = d.px + Math.sin(a) * d.len;
    this.y = d.py + Math.cos(a) * d.len;
  }
  render(): void {
    const g = this.ctx.g;
    if (!onScreen(this.ctx, this.x, this.y, this.d.len)) return;
    g.lineStyle(2, 0x2a2018, 1).lineBetween(this.d.px, this.d.py, this.x, this.y);
    g.lineStyle(1, 0xb08024, 1).lineBetween(this.d.px + 1, this.d.py, this.x + 1, this.y);
    g.fillStyle(0xd8b048, 1).fillCircle(this.d.px, this.d.py, 3);
    this.bob.setPosition(Math.round(this.x), Math.round(this.y));
  }
  reset(): void {
    this.t = 0;
    this.fixedUpdate(0);
  }
  destroy(): void {
    this.bob.destroy();
  }
}

// =============================================================================

/** All chapter 3 devices of a stage. */
export class Devices3 {
  private ctx: Ctx;
  private cables: Cable[] = [];
  private waters: Water[] = [];
  private lights: Light[] = [];
  private trains: Train[] = [];
  private portals: PortalPair[] = [];
  readonly crates: Crate[] = [];
  private rotors: Rotor[] = [];
  private pendulums: Pendulum[] = [];
  private gantryImgs: Phaser.GameObjects.Image[] = [];
  private shutterImgs: Phaser.GameObjects.TileSprite[] = [];
  private lastHook: [number, number] | null = null;
  private time = 0;
  /** Seconds of alarm left (shutters closed while > 0). */
  alarmT = 0;
  /** Spawns guards when the alarm goes off (set by the scene). */
  onAlarm: ((x: number, y: number) => void) | null = null;
  private plats: Plat[] = [];
  /** Platforms owned by others (the boss's train) for this step. */
  extraPlats: Plat[] = [];

  constructor(scene: Phaser.Scene, level: Level, fx: Particles, juice: Juice) {
    const g = scene.add.graphics().setDepth(DEPTH.objects - 0.6);
    const gFront = scene.add.graphics().setDepth(DEPTH.player + 1.5);
    this.ctx = { scene, level, world: level.world, fx, juice, g, gFront, cam: () => scene.cameras.main };
    const d = level.data;
    for (const c of d.cables) this.cables.push(new Cable(this.ctx, c));
    for (const w of d.water) this.waters.push(new Water(this.ctx, w));
    for (const l of d.lights) this.lights.push(new Light(this.ctx, l));
    for (const t of d.trains) this.trains.push(new Train(this.ctx, t));
    for (const p of d.portals) this.portals.push(new PortalPair(this.ctx, p));
    for (const c of d.crates) this.crates.push(new Crate(this.ctx, c.x, c.y));
    for (const r of d.rotors) this.rotors.push(new Rotor(this.ctx, r));
    for (const p of d.pendulums) this.pendulums.push(new Pendulum(this.ctx, p));
    for (const gt of d.gantries) this.gantryImgs.push(scene.add.image(gt.x + gt.w / 2, gt.y + gt.h / 2, 'ch3', 'gantry').setDepth(DEPTH.objects + 0.6));
    for (const s of d.shutters) {
      this.shutterImgs.push(
        scene.add
          .tileSprite(s.x0 * TILE, s.y0 * TILE, (s.x1 - s.x0 + 1) * TILE, (s.y1 - s.y0 + 1) * TILE, 'ch3', 'shutter')
          .setOrigin(0, 0)
          .setDepth(DEPTH.tiles + 0.4)
          .setVisible(false),
      );
    }
    this.plats = ([] as Plat[]).concat(...this.trains.map((t) => t.cars), ...this.crates.map((c) => c.plat), ...this.rotors.map((r) => r.plats));
  }

  anchors(): AnchorPoint[] {
    return (this.crates as AnchorPoint[]).concat(this.pendulums);
  }

  /** Does a crate sit on this vent (steam blocked)? */
  blocksVent(x: number, y: number): boolean {
    return this.crates.some((c) => Math.abs(c.x - x) < 14 && Math.abs(c.body.y + 14 - y) < 6);
  }

  private player: Player | null = null;

  private setShutters(closed: boolean): void {
    const w = this.ctx.world;
    const pb = this.player?.body;
    for (const s of this.ctx.level.data.shutters)
      for (let y = s.y0; y <= s.y1; y++)
        for (let x = s.x0; x <= s.x1; x++) {
          const i = y * w.w + x;
          if (closed && pb && overlap(pb, x * TILE, y * TILE, TILE, TILE)) continue;
          if (closed && w.cells[i] === Cell.Empty) w.cells[i] = Cell.Glass;
          else if (!closed && w.cells[i] === Cell.Glass) w.cells[i] = Cell.Empty;
        }
    for (const img of this.shutterImgs) img.setVisible(closed);
  }

  /** Raise the alarm (searchlight or watcher drone). */
  alarm(x: number, y: number): void {
    const wasOff = this.alarmT <= 0;
    this.alarmT = 6;
    if (!wasOff) return;
    this.setShutters(true);
    this.ctx.juice.sfx('alarm', { vol: 0.9 });
    this.ctx.juice.shake(2, 0.3);
    this.onAlarm?.(x, y);
  }

  fixedUpdate(dt: number, p: Player): void {
    this.time += dt;
    this.player = p;
    const b = p.body;
    // water
    let water: { depth: number; cx: number; cy: number } | null = null;
    for (const w of this.waters) {
      const depth = w.depthOf(b);
      if (depth > 0 && (!water || depth > water.depth)) water = { depth, cx: w.d.cx, cy: w.d.cy };
    }
    if (water && !p.water && b.vy > 120) {
      this.ctx.juice.sfx('splash', { vol: 0.6 });
      this.ctx.fx.emit(b.x, b.y + b.h / 2, { frame: 'px2', count: 10, speed: [60, 150], angle: -90, spread: 70, gravity: 500, life: [0.4, 0.7], tint: [0xbcf0f4, 0x7cdce8] });
    }
    p.water = water;
    // cables: catch the flying hook
    const gr = p.grapple;
    if (gr.state === 'flying' && !p.carrier) {
      if (this.lastHook) {
        for (const c of this.cables) {
          const s = segHit(this.lastHook[0], this.lastHook[1], gr.hx, gr.hy, c.d.x0, c.d.y0, c.d.x1, c.d.y1);
          if (s > 0.02 && s < 0.98) {
            gr.release(true);
            p.carrier = new CableRide(this.ctx, c, s, b.vx, b.vy);
            this.ctx.fx.ring(...c.at(s), COLORS.amberHot);
            break;
          }
        }
      }
      this.lastHook = [gr.hx, gr.hy];
    } else this.lastHook = null;
    // searchlights
    for (const l of this.lights) {
      l.update(this.time);
      if (l.sees(p)) {
        l.seen += dt;
        if (l.seen > 0.45) this.alarm(l.d.x, l.d.y);
      } else l.seen = Math.max(0, l.seen - dt * 2);
    }
    if (this.alarmT > 0) {
      this.alarmT -= dt;
      if (this.alarmT <= 0) {
        // never trap the player inside a shutter
        const blocked = this.ctx.level.data.shutters.some((s) => overlap(b, s.x0 * TILE, s.y0 * TILE, (s.x1 - s.x0 + 1) * TILE, (s.y1 - s.y0 + 1) * TILE));
        if (!blocked) this.setShutters(false);
        this.ctx.juice.sfx('switch', { vol: 0.5, pitch: 0.7 });
      }
    }
    for (const t of this.trains) t.fixedUpdate(dt, p);
    for (const gt of this.ctx.level.data.gantries) if (!p.dead && overlap(b, gt.x, gt.y, gt.w, gt.h)) p.hurt(1, gt.x + gt.w + 10, true);
    for (const pp of this.portals) pp.fixedUpdate(dt, p);
    for (const c of this.crates) c.fixedUpdate(dt, p);
    for (const r of this.rotors) r.fixedUpdate(dt);
    for (const pe of this.pendulums) pe.fixedUpdate(dt);
    // platforms near the player
    const near = this.plats.filter((pl) => pl.x < b.x + 200 && pl.x + pl.w > b.x - 200 && Math.abs(pl.y - b.y) < 200);
    p.platforms = this.extraPlats.length ? near.concat(this.extraPlats) : near;
  }

  render(dt: number): void {
    const t = this.time;
    this.ctx.g.clear();
    this.ctx.gFront.clear();
    for (const c of this.cables) if (onScreen(this.ctx, (c.d.x0 + c.d.x1) / 2, (c.d.y0 + c.d.y1) / 2, c.len)) c.draw(this.ctx.g);
    for (const w of this.waters) w.render(t);
    for (const l of this.lights) l.render(this.alarmT > 0);
    for (const tr of this.trains) tr.render(this.ctx.g);
    for (const pp of this.portals) pp.render(t);
    for (const c of this.crates) c.render();
    for (const r of this.rotors) r.render();
    for (const pe of this.pendulums) pe.render();
    for (const img of this.shutterImgs) if (img.visible) img.tilePositionY = Math.floor(t * 30) % 2;
    // overhead frames the signal boxes hang from (decor, behind the player)
    for (const gt of this.ctx.level.data.gantries) {
      if (!onScreen(this.ctx, gt.x, gt.y, 160)) continue;
      const top = Math.max(0, gt.y - 150);
      this.ctx.g.fillStyle(RAMPS.steel[1], 1).fillRect(gt.x + 7, top, 2, gt.y - top);
      this.ctx.g.fillStyle(RAMPS.steel[2], 1).fillRect(gt.x - 10, top, 36, 3);
    }
    void dt;
  }

  reset(): void {
    this.alarmT = 0;
    this.setShutters(false);
    for (const c of this.crates) c.reset();
    for (const r of this.rotors) r.reset();
    for (const pe of this.pendulums) pe.reset();
    for (const l of this.lights) l.seen = 0;
  }

  destroy(): void {
    for (const c of this.cables) c.destroy();
    for (const l of this.lights) l.destroy();
    for (const tr of this.trains) tr.destroy();
    for (const pp of this.portals) pp.destroy();
    for (const c of this.crates) c.destroy();
    for (const r of this.rotors) r.destroy();
    for (const pe of this.pendulums) pe.destroy();
    for (const i of this.gantryImgs) i.destroy();
    for (const i of this.shutterImgs) i.destroy();
    this.ctx.g.destroy();
    this.ctx.gFront.destroy();
  }
}
