import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';

interface Layer {
  obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image;
  fx: number;
  fy: number;
  baseY: number;
  baseX: number;
  tile: boolean;
}

interface Car {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  v: number;
  fx: number;
  fy: number;
}

/**
 * Multi-layer parallax city with living details: traffic lanes, blinking
 * aviation lights, searchlights and drifting fog.
 */
export class Parallax {
  private layers: Layer[] = [];
  private cars: Car[] = [];
  private beams: { img: Phaser.GameObjects.Image; base: number; speed: number; phase: number; fx: number; x: number; y: number }[] = [];
  private blinkers: { img: Phaser.GameObjects.Image; x: number; y: number; fx: number; fy: number; phase: number }[] = [];
  private fog: { obj: Phaser.GameObjects.TileSprite; fx: number; fy: number; baseY: number; speed: number; off: number }[] = [];
  private time = 0;
  private worldH: number;

  constructor(scene: Phaser.Scene, worldH: number) {
    this.worldH = worldH;
    const add = (key: string, depth: number, fx: number, fy: number, baseY: number, tile = true, baseX = 0) => {
      const tex = scene.textures.get(key).getSourceImage() as HTMLImageElement;
      const obj = tile
        ? scene.add.tileSprite(0, 0, GAME_W, tex.height, key).setOrigin(0, 0)
        : scene.add.image(0, 0, key).setOrigin(0, 0);
      obj.setScrollFactor(0).setDepth(depth);
      this.layers.push({ obj, fx, fy, baseY, baseX, tile });
      return obj;
    };
    add('bg-sky', DEPTH.sky, 0, 0, 0, false);
    add('bg-spire', DEPTH.spire, 0.03, 0.02, 30, false, 300);
    add('bg-far', DEPTH.far, 0.1, 0.06, 40);
    add('bg-mid', DEPTH.mid, 0.25, 0.14, 70);
    add('bg-near', DEPTH.near, 0.5, 0.32, 110);

    // traffic lanes
    const lanes = [
      { y: 70, fx: 0.18, fy: 0.1, v: 46, depth: DEPTH.carsFar, n: 4, alpha: 0.55 },
      { y: 112, fx: 0.18, fy: 0.1, v: -38, depth: DEPTH.carsFar, n: 3, alpha: 0.55 },
      { y: 150, fx: 0.32, fy: 0.18, v: 70, depth: DEPTH.carsMid, n: 3, alpha: 0.85 },
      { y: 95, fx: 0.32, fy: 0.18, v: -62, depth: DEPTH.carsMid, n: 2, alpha: 0.85 },
    ];
    for (const lane of lanes) {
      for (let i = 0; i < lane.n; i++) {
        const img = scene.add.image(0, 0, 'props', `car_${(i + lane.n) % 3}`).setScrollFactor(0).setDepth(lane.depth).setAlpha(lane.alpha);
        img.setFlipX(lane.v < 0);
        const glow = scene.add
          .image(0, 0, 'fx', 'glow16')
          .setScrollFactor(0)
          .setDepth(lane.depth)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(COLORS.cyan)
          .setAlpha(lane.alpha * 0.6);
        this.cars.push({ img, glow, x: Math.random() * 1400, y: lane.y + (Math.random() - 0.5) * 10, v: lane.v * (0.8 + Math.random() * 0.4), fx: lane.fx, fy: lane.fy });
      }
    }

    // searchlight beams sweeping from the far city
    for (let i = 0; i < 3; i++) {
      const img = scene.add
        .image(0, 0, 'fx', 'cone')
        .setScrollFactor(0)
        .setDepth(DEPTH.far)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setOrigin(0.5, 0)
        .setScale(1.2, 3.2)
        .setAlpha(0.18)
        .setTint(i === 1 ? COLORS.magenta : 0x8a9cff);
      this.beams.push({ img, base: Math.PI, speed: 0.25 + i * 0.08, phase: i * 2.1, fx: 0.08, x: 120 + i * 330, y: 230 });
    }

    // aviation blinkers on distant towers
    for (let i = 0; i < 10; i++) {
      const img = scene.add.image(0, 0, 'fx', 'px2').setScrollFactor(0).setDepth(DEPTH.far).setTint(COLORS.crimsonHot).setBlendMode(Phaser.BlendModes.ADD);
      this.blinkers.push({ img, x: Math.random() * 960, y: 60 + Math.random() * 70, fx: 0.1, fy: 0.06, phase: Math.random() * 3 });
    }

    // fog banks
    const fogDefs = [
      { depth: DEPTH.fogBack, fx: 0.4, fy: 0.3, baseY: 190, speed: 6, tint: 0x6a3a8a, alpha: 0.35 },
      { depth: DEPTH.fogBack, fx: 0.6, fy: 0.5, baseY: 240, speed: -9, tint: 0x3a4a8a, alpha: 0.3 },
      { depth: DEPTH.fogFront, fx: 1.15, fy: 1.0, baseY: 0, speed: 14, tint: 0x4a3a7a, alpha: 0.22 },
    ];
    for (const f of fogDefs) {
      const obj = scene.add.tileSprite(0, 0, GAME_W, 64, 'bg-fog').setOrigin(0, 0).setScrollFactor(0).setDepth(f.depth).setTint(f.tint).setAlpha(f.alpha);
      this.fog.push({ obj, fx: f.fx, fy: f.fy, baseY: f.baseY, speed: f.speed, off: Math.random() * 500 });
    }
  }

  update(dt: number, camX: number, camY: number): void {
    this.time += dt;
    for (const l of this.layers) {
      const y = Math.round(l.baseY - camY * l.fy);
      if (l.tile) {
        const ts = l.obj as Phaser.GameObjects.TileSprite;
        ts.tilePositionX = Math.round(camX * l.fx);
        ts.y = y;
      } else {
        l.obj.x = Math.round(l.baseX - camX * l.fx);
        l.obj.y = l.fx === 0 ? 0 : y;
      }
    }
    for (const c of this.cars) {
      c.x += c.v * dt;
      const span = 1400;
      let sx = (c.x - camX * c.fx) % span;
      if (sx < 0) sx += span;
      sx -= 200;
      const sy = Math.round(c.y - camY * c.fy + Math.sin(this.time * 2 + c.x * 0.01) * 1.2);
      c.img.setPosition(Math.round(sx), sy);
      c.glow.setPosition(Math.round(sx + (c.v > 0 ? 10 : -10)), sy);
    }
    for (const b of this.beams) {
      const a = Math.sin(this.time * b.speed + b.phase) * 0.55;
      b.img.setRotation(Math.PI + a);
      b.img.setPosition(Math.round(((b.x - camX * b.fx) % 1000 + 1000) % 1000 - 100), Math.round(b.y - camY * 0.06));
    }
    for (const bl of this.blinkers) {
      const sx = (((bl.x - camX * bl.fx) % 960) + 960) % 960 - 240;
      bl.img.setPosition(Math.round(sx), Math.round(bl.y - camY * bl.fy));
      bl.img.setVisible(Math.sin(this.time * 2.2 + bl.phase) > 0.75);
    }
    for (const f of this.fog) {
      f.off += f.speed * dt;
      f.obj.tilePositionX = Math.round(camX * f.fx + f.off);
      const y = f.fx > 1 ? GAME_H - 54 + Math.round(Math.sin(this.time * 0.3) * 4) : Math.round(f.baseY - camY * f.fy);
      f.obj.y = y;
      // front fog only near the bottom of the world (the abyss)
      if (f.fx > 1) f.obj.setVisible(camY + GAME_H > this.worldH - 240);
    }
  }
}
