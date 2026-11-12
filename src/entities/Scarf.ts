import Phaser from 'phaser';
import { DEPTH } from '../config.ts';
import { RAMPS } from '../art/palette.ts';

/**
 * Verlet-simulated scarf tail. Pure secondary motion: it reads the neck
 * anchor every step and trails behind with inertia, wind and gravity.
 * Rendered pixel-by-pixel (Bresenham) so it stays on the pixel grid.
 */
export class Scarf {
  private xs: number[] = [];
  private ys: number[] = [];
  private pxs: number[] = [];
  private pys: number[] = [];
  private readonly n = 9;
  private readonly seg = 2.4;
  private g: Phaser.GameObjects.Graphics;
  private time = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    for (let i = 0; i < this.n; i++) {
      this.xs.push(x - i * this.seg);
      this.ys.push(y);
      this.pxs.push(x - i * this.seg);
      this.pys.push(y);
    }
    this.g = scene.add.graphics().setDepth(DEPTH.scarf);
  }

  reset(x: number, y: number): void {
    for (let i = 0; i < this.n; i++) {
      this.xs[i] = this.pxs[i] = x - i * this.seg;
      this.ys[i] = this.pys[i] = y;
    }
  }

  step(dt: number, ax: number, ay: number, facing: number, wind: number): void {
    this.time += dt;
    this.xs[0] = ax;
    this.ys[0] = ay;
    this.pxs[0] = ax;
    this.pys[0] = ay;
    const gravity = 300;
    const drag = 0.94;
    for (let i = 1; i < this.n; i++) {
      const vx = (this.xs[i] - this.pxs[i]) * drag;
      const vy = (this.ys[i] - this.pys[i]) * drag;
      this.pxs[i] = this.xs[i];
      this.pys[i] = this.ys[i];
      const k = i / this.n;
      // travelling wave along the cloth + a constant trailing breeze
      const flutter = Math.sin(this.time * 11 - i * 1.1) * 260 * k;
      const ax2 = (wind * 3 - facing * 60) * (0.4 + k);
      this.xs[i] += vx + ax2 * dt * dt;
      this.ys[i] += vy + (gravity + flutter) * dt * dt;
    }
    // distance constraints (a few relaxation passes)
    for (let k = 0; k < 4; k++) {
      for (let i = 1; i < this.n; i++) {
        const dx = this.xs[i] - this.xs[i - 1];
        const dy = this.ys[i] - this.ys[i - 1];
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = (d - this.seg) / d;
        if (i === 1) {
          this.xs[i] -= dx * diff;
          this.ys[i] -= dy * diff;
        } else {
          this.xs[i] -= dx * diff * 0.5;
          this.ys[i] -= dy * diff * 0.5;
          this.xs[i - 1] += dx * diff * 0.5;
          this.ys[i - 1] += dy * diff * 0.5;
        }
      }
      this.xs[0] = ax;
      this.ys[0] = ay;
    }
  }

  draw(visible: boolean, alpha = 1): void {
    const g = this.g;
    g.clear();
    g.setAlpha(alpha);
    if (!visible || alpha <= 0.01) return;
    const C = RAMPS.crimson;
    const plotted = new Set<number>();
    const outline: [number, number][] = [];
    const px = (x: number, y: number, c: number) => {
      const k = (y + 4096) * 8192 + (x + 4096);
      plotted.add(k);
      g.fillStyle(c, 1);
      g.fillRect(x, y, 1, 1);
    };
    for (let i = 0; i < this.n - 1; i++) {
      const x0 = Math.round(this.xs[i]);
      const y0 = Math.round(this.ys[i]);
      const x1 = Math.round(this.xs[i + 1]);
      const y1 = Math.round(this.ys[i + 1]);
      const thick = i < 4 ? 3 : i < 7 ? 2 : 1;
      // Bresenham
      let x = x0;
      let y = y0;
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let guard = 0; guard < 64; guard++) {
        px(x, y, i % 3 === 2 ? C[4] : C[5]);
        if (thick > 1) px(x, y + 1, C[4]);
        if (thick > 2) px(x, y + 2, C[3]);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y += sy;
        }
      }
    }
    // tip
    const tx = Math.round(this.xs[this.n - 1]);
    const ty = Math.round(this.ys[this.n - 1]);
    px(tx, ty, C[3]);
    // 1px ink outline around the scarf
    for (const k of plotted) {
      const x = (k % 8192) - 4096;
      const y = Math.floor(k / 8192) - 4096;
      for (const [ox, oy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nk = (y + oy + 4096) * 8192 + (x + ox + 4096);
        if (!plotted.has(nk)) outline.push([x + ox, y + oy]);
      }
    }
    g.fillStyle(0x0a0612, 1);
    for (const [x, y] of outline) g.fillRect(x, y, 1, 1);
  }

  destroy(): void {
    this.g.destroy();
  }
}
