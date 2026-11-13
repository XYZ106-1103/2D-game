import Phaser from 'phaser';
import { DEPTH, TILE } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { Cell, type TileWorld } from '../physics/TileWorld.ts';
import type { Player } from '../entities/Player.ts';
import type { AnchorPoint } from '../entities/Grapple.ts';
import type { Particles } from '../fx/Particles.ts';
import type { Juice } from '../fx/Juice.ts';
import { CRUMBLE_TILE, type Level } from './Level.ts';
import { Mat, type MoverDef, type VentDef } from './LevelData.ts';
import { Devices } from './Devices.ts';

/** Tether drone that shuttles along a path; the rope's root follows it. */
export class MovingAnchor implements AnchorPoint {
  readonly moving = true;
  x: number;
  y: number;
  private def: MoverDef;
  private t: number;
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private track: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, def: MoverDef) {
    this.def = def;
    this.t = def.phase * def.period;
    this.x = def.x0;
    this.y = def.y0;
    // faint guide rail showing the path
    this.track = scene.add.graphics().setDepth(DEPTH.decorBack + 0.4);
    const n = Math.ceil(Math.hypot(def.x1 - def.x0, def.y1 - def.y0) / 4);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(def.x0 + ((def.x1 - def.x0) * i) / n);
      const y = Math.round(def.y0 + ((def.y1 - def.y0) * i) / n);
      this.track.fillStyle(i % 2 ? 0x342a58 : 0x463d70, 1).fillRect(x, y, 1, 1);
    }
    this.glow = scene.add.image(this.x, this.y, 'fx', 'glow32').setDepth(DEPTH.objects - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.amberHot).setAlpha(0.35);
    this.sprite = scene.add.image(this.x, this.y, 'props', 'anchor_0').setDepth(DEPTH.objects).setTint(0xffe0b0);
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    const u = (this.t % this.def.period) / this.def.period;
    // ping-pong with smooth ends
    const k = u < 0.5 ? u * 2 : 2 - u * 2;
    const e = k * k * (3 - 2 * k);
    this.x = this.def.x0 + (this.def.x1 - this.def.x0) * e;
    this.y = this.def.y0 + (this.def.y1 - this.def.y0) * e;
  }

  render(time: number): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y)).setFrame(`anchor_${Math.floor(time * 10) % 4}`);
    this.glow.setPosition(Math.round(this.x), Math.round(this.y));
  }

  destroy(): void {
    this.sprite.destroy();
    this.glow.destroy();
    this.track.destroy();
  }
}

interface CrumbleCell {
  tx: number;
  ty: number;
  state: 'solid' | 'shaking' | 'gone';
  t: number;
  img: Phaser.GameObjects.Image | null;
}

/** Rusted grate blocks: shake when stood on, drop, and re-form later. */
class Crumbles {
  private cells: CrumbleCell[] = [];
  private scene: Phaser.Scene;
  private level: Level;
  private world: TileWorld;

  constructor(scene: Phaser.Scene, level: Level) {
    this.scene = scene;
    this.level = level;
    this.world = level.world;
    const d = level.data;
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) if (d.mat[y * d.w + x] === Mat.Crumble) this.cells.push({ tx: x, ty: y, state: 'solid', t: 0, img: null });
  }

  private setCell(c: CrumbleCell, solid: boolean): void {
    this.world.cells[c.ty * this.world.w + c.tx] = solid ? Cell.Solid : Cell.Empty;
    const layer = this.level.mainLayer;
    if (!layer) return;
    if (solid) layer.putTileAt(CRUMBLE_TILE, c.tx, c.ty);
    else layer.removeTileAt(c.tx, c.ty);
  }

  update(dt: number, player: Player, particles: Particles, juice: Juice): void {
    const b = player.body;
    const feet = b.y + b.h / 2;
    for (const c of this.cells) {
      c.t += dt;
      const x0 = c.tx * TILE;
      const top = c.ty * TILE;
      if (c.state === 'solid') {
        const standing = b.onGround && Math.abs(feet - top) < 1.5 && b.x + b.w / 2 > x0 && b.x - b.w / 2 < x0 + TILE;
        // neighbours crumble together for readability
        if (standing) this.trigger(c);
      } else if (c.state === 'shaking') {
        if (c.img) {
          c.img.setPosition(x0 + 8 + (Math.floor(c.t * 40) % 2 ? 1 : -1), top + 8);
          c.img.setTexture(`${c.t > 0.3 ? 'crumble1' : 'crumble0'}-${this.level.tileKey}`);
        }
        if (c.t > 0.5) {
          c.state = 'gone';
          c.t = 0;
          this.world.cells[c.ty * this.world.w + c.tx] = Cell.Empty;
          particles.emit(x0 + 8, top + 8, { frame: 'shard_0', count: 4, speed: [20, 80], angle: 90, spread: 120, gravity: 500, life: [0.5, 0.8], spin: 6 });
          juice.sfx('crumble', { vol: 0.5 });
        }
      } else if (c.state === 'gone') {
        if (c.img) {
          c.img.y += dt * 60 + c.t * 9;
          c.img.setAlpha(Math.max(0, 1 - c.t * 1.6));
          if (c.t > 0.7) {
            c.img.destroy();
            c.img = null;
          }
        }
        if (c.t > 3.5) {
          const overlap = b.x + b.w / 2 > x0 && b.x - b.w / 2 < x0 + TILE && b.y + b.h / 2 > top && b.y - b.h / 2 < top + TILE;
          if (!overlap) {
            c.state = 'solid';
            c.t = 0;
            this.setCell(c, true);
            particles.emit(x0 + 8, top + 8, { frame: 'px1', count: 6, speed: [10, 40], life: [0.2, 0.4], tint: COLORS.amberHot, add: true });
          }
        }
      }
    }
  }

  private trigger(c: CrumbleCell, depth = 0, delay = 0): void {
    if (c.state !== 'solid') return;
    c.state = 'shaking';
    c.t = -delay;
    // keep physics solid while shaking, swap the tile for a jittering sprite
    this.level.mainLayer?.removeTileAt(c.tx, c.ty);
    c.img = this.scene.add.image(c.tx * TILE + 8, c.ty * TILE + 8, `crumble0-${this.level.tileKey}`).setDepth(DEPTH.tiles + 0.5);
    if (depth < 1) for (const n of this.cells) if (n !== c && n.ty === c.ty && Math.abs(n.tx - c.tx) === 1) this.trigger(n, depth + 1, 0.12);
  }

  reset(): void {
    for (const c of this.cells) {
      c.img?.destroy();
      c.img = null;
      c.state = 'solid';
      c.t = 0;
      this.setCell(c, true);
    }
  }
}

interface VentObj {
  def: VentDef;
  t: number;
  on: boolean;
  grate: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
}

/** Container for all stage gimmicks. */
export class Gimmicks {
  readonly movers: MovingAnchor[] = [];
  readonly devices: Devices;
  private crumbles: Crumbles;
  private vents: VentObj[] = [];
  private particles: Particles;
  private juice: Juice;
  private time = 0;

  constructor(scene: Phaser.Scene, level: Level, particles: Particles, juice: Juice) {
    this.particles = particles;
    this.juice = juice;
    for (const m of level.data.movers) this.movers.push(new MovingAnchor(scene, m));
    this.crumbles = new Crumbles(scene, level);
    this.devices = new Devices(scene, level, particles, juice);
    // crumble sprite textures cut from the tileset
    const ts = scene.textures.get(level.tileKey);
    for (const [base, idx] of [
      ['crumble0', CRUMBLE_TILE],
      ['crumble1', CRUMBLE_TILE + 1],
    ] as const) {
      const k = `${base}-${level.tileKey}`;
      if (!scene.textures.exists(k)) {
        const src = ts.getSourceImage() as HTMLImageElement;
        const canvas = scene.textures.createCanvas(k, TILE, TILE)!;
        canvas.context.drawImage(src, (idx % 16) * TILE, Math.floor(idx / 16) * TILE, TILE, TILE, 0, 0, TILE, TILE);
        canvas.refresh();
      }
    }
    for (const v of level.data.vents) {
      const grate = scene.add.image(v.x, v.y, 'props', 'vent').setOrigin(0.5, 1).setDepth(DEPTH.decorFront);
      const glow = scene.add.image(v.x, v.y - 20, 'fx', 'cone').setOrigin(0.5, 1).setFlipY(true).setDepth(DEPTH.decorFront).setBlendMode(Phaser.BlendModes.ADD).setTint(0xb8c4ff).setAlpha(0).setScale(0.5, v.h / 64);
      this.vents.push({ def: v, t: v.phase, on: false, grate, glow });
    }
  }

  fixedUpdate(dt: number, player: Player): void {
    this.time += dt;
    for (const m of this.movers) m.fixedUpdate(dt);
    this.crumbles.update(dt, player, this.particles, this.juice);
    this.devices.fixedUpdate(dt, player);
    const b = player.body;
    for (const v of this.vents) {
      v.t += dt;
      const cycle = v.def.on + v.def.off;
      const on = v.t % cycle < v.def.on;
      if (on && !v.on) this.juice.sfx('steam', { vol: 0.45 });
      v.on = on;
      if (!on || player.dead) continue;
      const inX = Math.abs(b.x - v.def.x) < 12;
      const inY = b.y + b.h / 2 > v.def.y - v.def.h && b.y - b.h / 2 < v.def.y;
      if (inX && inY) {
        // strong updraft, weaker near the top of the jet
        const k = 1 - Math.max(0, Math.min(1, (v.def.y - b.y) / v.def.h));
        b.vy = Math.max(b.vy - (2600 * (0.4 + k)) * dt, -380);
        b.onGround = false;
        player.refreshAirDash();
      }
    }
  }

  render(dt: number): void {
    this.devices.render(dt);
    for (const m of this.movers) m.render(this.time);
    for (const v of this.vents) {
      v.glow.setAlpha(v.on ? 0.22 + Math.sin(this.time * 20) * 0.04 : Math.max(0, v.glow.alpha - dt * 2));
      if (v.on && Math.random() < dt * 40) {
        this.particles.emit(v.def.x + (Math.random() - 0.5) * 10, v.def.y - 4, {
          frames: ['dust_0', 'dust_1', 'dust_2', 'dust_3', 'dust_4', 'dust_5'],
          speed: [120, 200],
          angle: -90,
          spread: 14,
          life: [v.def.h / 260, v.def.h / 180],
          tint: 0xd2d6e8,
          alpha: 0.7,
          fade: true,
        });
      }
    }
  }

  reset(): void {
    this.crumbles.reset();
    this.devices.reset();
  }

  /** Hook targets besides static anchors: movers, gravity cores, switches. */
  anchors(): AnchorPoint[] {
    return (this.movers as AnchorPoint[]).concat(this.devices.anchors());
  }

  destroy(): void {
    for (const m of this.movers) m.destroy();
    this.devices.destroy();
  }
}
