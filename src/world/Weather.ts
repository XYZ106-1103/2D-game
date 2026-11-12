import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W } from '../config.ts';
import type { Surface } from './Level.ts';

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
  private lastCamX = 0;
  private lastCamY = 0;
  private surfaces: Surface[];
  private splashAcc = 0;
  private lightningT = 6;
  private flashCb: (a: number) => void;
  private thunderCb: () => void;

  constructor(scene: Phaser.Scene, surfaces: Surface[], flash: (a: number) => void, thunder: () => void) {
    this.surfaces = surfaces;
    this.flashCb = flash;
    this.thunderCb = thunder;
    LAYERS.forEach((L, li) => {
      for (let i = 0; i < L.n; i++) {
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
    this.splashAcc += dt * 55;
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

    // distant lightning
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightningT = 9 + Math.random() * 14;
      this.flashCb(0.18);
      setTimeout(() => this.flashCb(0.1), 90);
      setTimeout(() => this.thunderCb(), 700 + Math.random() * 900);
    }
  }
}
