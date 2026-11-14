import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W } from '../config.ts';
import type { Surface } from './Level.ts';
import type { WeatherKind } from './LevelData.ts';

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  par: number;
  ph: number;
  spin: number;
}

/** Non-rain atmospheres: drifting particles in screen space with parallax. */
const MOTES: Record<Exclude<WeatherKind, 'rain' | 'none'>, { n: number; frames: [string, string][]; tints: number[]; vx: [number, number]; vy: [number, number]; sway: number; alpha: [number, number]; add: boolean; spin: number }> = {
  frost: { n: 70, frames: [['fx', 'px1']], tints: [0xd0ecf4, 0x9cc4d4, 0xf4fcff], vx: [-8, 4], vy: [10, 28], sway: 10, alpha: [0.35, 0.8], add: false, spin: 0 },
  embers: { n: 46, frames: [['fx', 'px1'], ['fx', 'px2']], tints: [0xffbe5c, 0xe08a34, 0xff9030, 0xff4fb0], vx: [-10, 10], vy: [-46, -16], sway: 16, alpha: [0.5, 1], add: true, spin: 0 },
  motes: { n: 60, frames: [['fx', 'px1'], ['ch2', 'spark_star']], tints: [0xc0a0ff, 0xd8b048, 0x8c58e8, 0xf4dc8a], vx: [-6, 6], vy: [-14, -3], sway: 8, alpha: [0.3, 0.9], add: true, spin: 0 },
  frozen: { n: 150, frames: [['fx', 'streak6'], ['fx', 'streak9'], ['fx', 'streak12']], tints: [0xa4a4ac, 0xc8c8ce, 0x82828c], vx: [0, 0], vy: [0, 0], sway: 0, alpha: [0.3, 0.6], add: false, spin: 0 },
  petals: { n: 46, frames: [['ch2', 'petal_0'], ['ch2', 'petal_1'], ['ch2', 'spark_star']], tints: [0xffffff], vx: [14, 34], vy: [12, 28], sway: 14, alpha: [0.6, 1], add: false, spin: 2.5 },
  dust: { n: 50, frames: [['fx', 'px1']], tints: [0xfff6d0, 0xf4dc8a, 0xffffff], vx: [-4, 6], vy: [-6, 6], sway: 6, alpha: [0.25, 0.65], add: true, spin: 0 },
  gulls: { n: 7, frames: [['ch3', 'gull_0'], ['ch3', 'gull_1']], tints: [0x2a1a2a], vx: [26, 46], vy: [-3, 3], sway: 4, alpha: [0.75, 0.95], add: false, spin: 0 },
  leaves: { n: 34, frames: [['ch3', 'leaf_0'], ['ch3', 'leaf_1']], tints: [0xffffff], vx: [10, 30], vy: [14, 30], sway: 18, alpha: [0.7, 1], add: false, spin: 3 },
};

interface Drop {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  v: number;
  layer: number;
}

const LAYERS = [
  { n: 90, frame: 'streak6', speed: [300, 380], parallax: 0.45, alpha: 0.28, tint: 0x8a7ab8, depth: DEPTH.rainBack },
  { n: 70, frame: 'streak9', speed: [430, 520], parallax: 1.0, alpha: 0.42, tint: 0xa8b8e8, depth: DEPTH.rainBack },
  { n: 26, frame: 'streak12', speed: [620, 720], parallax: 1.35, alpha: 0.55, tint: 0xc8d4ff, depth: DEPTH.rainFront },
] as const;

/** Slanted multi-depth rain, surface splashes and the occasional lightning flash. */
export class Weather {
  private drops: Drop[] = [];
  private splashes: { img: Phaser.GameObjects.Image; t: number }[] = [];
  private wind = -0.16; // dx per dy
  private gusts = false;
  private gustT = 2;
  private scene: Phaser.Scene;
  private lastCamX = 0;
  private lastCamY = 0;
  private surfaces: Surface[];
  private splashAcc = 0;
  private lightningT = 6;
  private flashCb: (a: number) => void;
  private thunderCb: () => void;

  private density: number;
  private kind: WeatherKind;
  private motes: Mote[] = [];
  private time = 0;

  constructor(scene: Phaser.Scene, surfaces: Surface[], flash: (a: number) => void, thunder: () => void, density = 1, windy = false, kind: WeatherKind = 'rain') {
    this.scene = scene;
    this.kind = kind;
    if (kind !== 'rain') {
      this.density = density;
      this.surfaces = [];
      this.flashCb = flash;
      this.thunderCb = thunder;
      if (kind !== 'none') {
        const M = MOTES[kind];
        for (let i = 0; i < Math.round(M.n * density); i++) {
          const [tex, frame] = M.frames[i % M.frames.length];
          const img = scene.add.image(0, 0, tex, frame).setScrollFactor(0).setDepth(i % 4 === 0 ? DEPTH.rainFront : DEPTH.rainBack);
          img.setTint(M.tints[i % M.tints.length]).setAlpha(M.alpha[0] + Math.random() * (M.alpha[1] - M.alpha[0]));
          if (M.add) img.setBlendMode(Phaser.BlendModes.ADD);
          if (kind === 'frozen') img.setRotation(-0.16);
          const r = (a: [number, number]) => a[0] + Math.random() * (a[1] - a[0]);
          this.motes.push({ img, x: Math.random() * (GAME_W + 40) - 20, y: Math.random() * (GAME_H + 40) - 20, vx: r(M.vx), vy: r(M.vy), par: 0.4 + Math.random() * 0.9, ph: Math.random() * 7, spin: (Math.random() - 0.5) * M.spin });
        }
      }
      return;
    }
    this.gusts = windy;
    if (windy) this.wind = -0.42;
    this.density = density;
    this.surfaces = surfaces;
    this.flashCb = flash;
    this.thunderCb = thunder;
    LAYERS.forEach((L, li) => {
      for (let i = 0; i < Math.round(L.n * density); i++) {
        const img = scene.add.image(0, 0, 'fx', L.frame).setScrollFactor(0).setDepth(L.depth).setAlpha(L.alpha).setTint(L.tint);
        img.setRotation(-this.wind);
        this.drops.push({ img, x: Math.random() * (GAME_W + 60), y: Math.random() * GAME_H, v: L.speed[0] + Math.random() * (L.speed[1] - L.speed[0]), layer: li });
      }
    });
    for (let i = 0; i < 40; i++) {
      const img = scene.add.image(0, 0, 'fx', 'splash_0').setVisible(false).setDepth(DEPTH.decorFront).setAlpha(0.7).setTint(0xb8c4ff);
      this.splashes.push({ img, t: 0 });
    }
  }

  update(dt: number, camX: number, camY: number): void {
    const dcx = camX - this.lastCamX;
    const dcy = camY - this.lastCamY;
    this.lastCamX = camX;
    this.lastCamY = camY;
    if (this.kind !== 'rain') {
      this.updateMotes(dt, dcx, dcy);
      return;
    }
    for (const d of this.drops) {
      const L = LAYERS[d.layer];
      d.y += d.v * dt - (Math.abs(dcy) < 200 ? dcy * L.parallax : 0);
      d.x += d.v * dt * this.wind - (Math.abs(dcx) < 200 ? dcx * L.parallax : 0);
      if (d.y > GAME_H + 10) {
        d.y -= GAME_H + 20;
        d.x = Math.random() * (GAME_W + 60);
      } else if (d.y < -20) d.y += GAME_H + 20;
      if (d.x < -30) d.x += GAME_W + 60;
      else if (d.x > GAME_W + 30) d.x -= GAME_W + 60;
      d.img.setPosition(Math.round(d.x), Math.round(d.y));
    }

    // splashes on visible rooftop surfaces
    this.splashAcc += dt * 55 * this.density;
    while (this.splashAcc > 1) {
      this.splashAcc -= 1;
      const s = this.surfaces[Math.floor(Math.random() * this.surfaces.length)];
      if (!s) break;
      if (s.y < camY || s.y > camY + GAME_H || s.x1 < camX || s.x0 > camX + GAME_W) continue;
      const x = Math.max(s.x0, camX) + Math.random() * (Math.min(s.x1, camX + GAME_W) - Math.max(s.x0, camX));
      const sp = this.splashes.find((p) => p.t <= 0);
      if (!sp) break;
      sp.t = 0.2;
      sp.img.setPosition(Math.round(x), s.y - 2).setVisible(true);
    }
    for (const sp of this.splashes) {
      if (sp.t <= 0) continue;
      sp.t -= dt;
      const f = Math.min(3, Math.floor((1 - sp.t / 0.2) * 4));
      sp.img.setFrame(`splash_${f}`);
      if (sp.t <= 0) sp.img.setVisible(false);
    }

    // high-altitude wind gusts: long pale streaks racing across the screen
    if (this.gusts) {
      this.gustT -= dt;
      if (this.gustT <= 0) {
        this.gustT = 0.05 + Math.random() * 0.12;
        const y = Math.random() * GAME_H;
        const img = this.scene.add.image(GAME_W + 20, y, 'fx', 'speedline').setScrollFactor(0).setDepth(DEPTH.rainFront).setTint(0xc8d4ff).setAlpha(0.35).setFlipX(true).setScale(2 + Math.random() * 3, 1);
        this.scene.tweens.add({ targets: img, x: -60, duration: 380 + Math.random() * 300, onComplete: () => img.destroy() });
      }
    }

    // distant lightning
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightningT = 9 + Math.random() * 14;
      this.flashCb(0.18);
      setTimeout(() => this.flashCb(0.1), 90);
      setTimeout(() => this.thunderCb(), 700 + Math.random() * 900);
    }
  }

  private updateMotes(dt: number, dcx: number, dcy: number): void {
    this.time += dt;
    const M = this.kind === 'none' ? null : MOTES[this.kind as keyof typeof MOTES];
    const jump = Math.abs(dcx) > 200 || Math.abs(dcy) > 200;
    for (const m of this.motes) {
      m.x += m.vx * dt - (jump ? 0 : dcx * m.par);
      m.y += m.vy * dt - (jump ? 0 : dcy * m.par);
      if (M && M.sway) m.x += Math.sin(this.time * 1.3 + m.ph) * M.sway * dt;
      if (m.y > GAME_H + 20) m.y -= GAME_H + 40;
      else if (m.y < -20) m.y += GAME_H + 40;
      if (m.x < -20) m.x += GAME_W + 40;
      else if (m.x > GAME_W + 20) m.x -= GAME_W + 40;
      m.img.setPosition(Math.round(m.x), Math.round(m.y));
      if (m.spin) m.img.rotation += m.spin * dt;
      if (this.kind === 'frozen') m.img.setVisible(Math.sin(this.time * 0.7 + m.ph * 3) > -0.92);
      if (this.kind === 'embers') m.img.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(this.time * 6 + m.ph)));
      if (this.kind === 'gulls') m.img.setFrame(`gull_${Math.floor(this.time * 5 + m.ph) % 2}`);
    }
  }
}
