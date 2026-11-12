import Phaser from 'phaser';
import { DEPTH } from '../config.ts';
import { rand, pick, RAD } from '../core/math.ts';
import { COLORS } from '../art/palette.ts';

interface P {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  frames: string[] | null;
  fade: boolean;
  spin: number;
  scaleTo: number;
  align: boolean;
}

export interface EmitOpts {
  frame?: string;
  frames?: string[];
  count?: number;
  speed?: [number, number];
  angle?: number; // degrees
  spread?: number; // degrees
  life?: [number, number];
  gravity?: number;
  drag?: number;
  tint?: number | number[];
  add?: boolean;
  fade?: boolean;
  depth?: number;
  align?: boolean;
  rot?: number;
  spin?: number;
  flipX?: boolean;
  scaleTo?: number;
  alpha?: number;
  jitter?: number;
}

/** Pooled sprite particles drawn from the `fx` atlas. */
export class Particles {
  private pool: P[] = [];
  private cursor = 0;

  constructor(scene: Phaser.Scene, size = 420) {
    for (let i = 0; i < size; i++) {
      const img = scene.add.image(0, 0, 'fx', 'px1').setVisible(false).setDepth(DEPTH.fx);
      this.pool.push({ img, alive: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 0, max: 1, frames: null, fade: true, spin: 0, scaleTo: 1, align: false });
    }
  }

  private next(): P {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[(this.cursor + i) % this.pool.length];
      if (!p.alive) {
        this.cursor = (this.cursor + i + 1) % this.pool.length;
        return p;
      }
    }
    // steal the oldest slot
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return p;
  }

  emit(x: number, y: number, o: EmitOpts): void {
    const n = o.count ?? 1;
    for (let i = 0; i < n; i++) {
      const p = this.next();
      const a = ((o.angle ?? -90) + rand(-(o.spread ?? 360) / 2, (o.spread ?? 360) / 2)) * RAD;
      const sp = rand(o.speed?.[0] ?? 0, o.speed?.[1] ?? 0);
      const j = o.jitter ?? 0;
      p.x = x + rand(-j, j);
      p.y = y + rand(-j, j);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.g = o.gravity ?? 0;
      p.drag = o.drag ?? 0;
      p.max = rand(o.life?.[0] ?? 0.3, o.life?.[1] ?? 0.5);
      p.life = p.max;
      p.frames = o.frames ?? null;
      p.fade = o.fade ?? true;
      p.spin = o.spin ?? 0;
      p.scaleTo = o.scaleTo ?? 1;
      p.align = o.align ?? false;
      p.alive = true;
      const img = p.img;
      img.setFrame(o.frames ? o.frames[0] : (o.frame ?? 'px1'));
      img.setVisible(true);
      img.setAlpha(o.alpha ?? 1);
      img.setScale(1);
      img.setFlipX(o.flipX ?? false);
      img.setRotation((o.rot ?? 0) * RAD);
      img.setDepth(o.depth ?? DEPTH.fx);
      img.setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      const tint = Array.isArray(o.tint) ? pick(o.tint) : o.tint;
      if (tint !== undefined) img.setTint(tint);
      else img.clearTint();
      img.setPosition(Math.round(p.x), Math.round(p.y));
      if (p.align) img.setRotation(Math.atan2(p.vy, p.vx));
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        p.img.setVisible(false);
        continue;
      }
      p.vy += p.g * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = 1 - p.life / p.max;
      const img = p.img;
      img.setPosition(Math.round(p.x), Math.round(p.y));
      if (p.frames) img.setFrame(p.frames[Math.min(p.frames.length - 1, Math.floor(t * p.frames.length))]);
      if (p.fade) img.setAlpha(Math.min(img.alpha, 1 - t * t));
      if (p.spin) img.rotation += p.spin * dt;
      if (p.align) img.setRotation(Math.atan2(p.vy, p.vx));
      if (p.scaleTo !== 1) img.setScale(1 + (p.scaleTo - 1) * t);
    }
  }

  // ---------------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------------

  sparks(x: number, y: number, angle: number, spread: number, count: number, colors: number[] = [COLORS.cyan, COLORS.cyanHot, COLORS.white]): void {
    this.emit(x, y, { frame: 'px1', count, angle, spread, speed: [90, 260], life: [0.15, 0.4], gravity: 420, drag: 3, tint: colors, add: true });
    this.emit(x, y, { frame: 'px2', count: Math.ceil(count / 3), angle, spread, speed: [60, 180], life: [0.1, 0.25], gravity: 300, drag: 4, tint: colors, add: true });
  }

  dust(x: number, y: number, dir: number, count = 2): void {
    const frames = ['dust_0', 'dust_1', 'dust_2', 'dust_3', 'dust_4', 'dust_5'];
    for (let i = 0; i < count; i++) {
      this.emit(x + dir * i * 4, y - 4, { frames, speed: [10, 40], angle: dir > 0 ? -160 : -20, spread: 30, life: [0.3, 0.45], drag: 4, fade: false, flipX: dir > 0 });
    }
  }

  landDust(x: number, y: number, power: number): void {
    const frames = ['dust_0', 'dust_1', 'dust_2', 'dust_3', 'dust_4', 'dust_5'];
    const n = power > 0.6 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      this.emit(x - 5 - i * 3, y - 4, { frames, speed: [30, 70 * power + 20], angle: 180, spread: 20, life: [0.3, 0.5], drag: 5, fade: false });
      this.emit(x + 5 + i * 3, y - 4, { frames, speed: [30, 70 * power + 20], angle: 0, spread: 20, life: [0.3, 0.5], drag: 5, fade: false, flipX: true });
    }
  }

  ring(x: number, y: number, tint = COLORS.cyan): void {
    this.emit(x, y, { frames: ['ring_0', 'ring_1', 'ring_2', 'ring_3', 'ring_4'], life: [0.22, 0.22], tint, add: true, fade: false });
  }

  impact(x: number, y: number, tint?: number): void {
    this.emit(x, y, { frames: ['impact_0', 'impact_1', 'impact_2', 'impact_3'], life: [0.16, 0.16], tint, add: true, fade: false, rot: rand(0, 45) });
  }

  speedLines(x: number, y: number, vx: number, vy: number, count = 3): void {
    const a = Math.atan2(vy, vx) / RAD;
    for (let i = 0; i < count; i++) {
      this.emit(x, y, { frame: 'speedline', speed: [20, 60], angle: a + 180, spread: 10, life: [0.12, 0.2], jitter: 10, tint: [COLORS.cyanHot, COLORS.white, COLORS.magenta], add: true, rot: a, alpha: 0.8 });
    }
  }

  zap(x: number, y: number): void {
    this.emit(x, y, { frames: ['zap_0', 'zap_1', 'zap_2', 'zap_3'], life: [0.12, 0.2], add: true, tint: [COLORS.cyanHot, COLORS.white], fade: false, flipX: Math.random() < 0.5 });
  }
}
