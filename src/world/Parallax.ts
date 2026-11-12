import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';

export type ThemeName = 'rooftops' | 'market' | 'tower';

interface LayerDef {
  key: string;
  depth: number;
  fx: number;
  fy: number;
  baseY: number;
  tile?: boolean;
  baseX?: number;
  drift?: number;
}

interface ThemeDef {
  layers: LayerDef[];
  cars: number; // traffic density multiplier (0 = none)
  beams: boolean;
  blinkers: boolean;
  fog: { depth: number; fx: number; fy: number; baseY: number; speed: number; tint: number; alpha: number }[];
}

export const THEMES: Record<ThemeName, ThemeDef> = {
  rooftops: {
    layers: [
      { key: 'bg-sky', depth: DEPTH.sky, fx: 0, fy: 0, baseY: 0, tile: false },
      { key: 'bg-spire', depth: DEPTH.spire, fx: 0.03, fy: 0.02, baseY: 30, tile: false, baseX: 300 },
      { key: 'bg-far', depth: DEPTH.far, fx: 0.1, fy: 0.06, baseY: 40 },
      { key: 'bg-mid', depth: DEPTH.mid, fx: 0.25, fy: 0.14, baseY: 70 },
      { key: 'bg-near', depth: DEPTH.near, fx: 0.5, fy: 0.32, baseY: 110 },
    ],
    cars: 1,
    beams: true,
    blinkers: true,
    fog: [
      { depth: DEPTH.fogBack, fx: 0.4, fy: 0.3, baseY: 190, speed: 6, tint: 0x6a3a8a, alpha: 0.35 },
      { depth: DEPTH.fogBack, fx: 0.6, fy: 0.5, baseY: 240, speed: -9, tint: 0x3a4a8a, alpha: 0.3 },
      { depth: DEPTH.fogFront, fx: 1.15, fy: 1.0, baseY: 0, speed: 14, tint: 0x4a3a7a, alpha: 0.22 },
    ],
  },
  market: {
    layers: [
      { key: 'bg-market_sky', depth: DEPTH.sky, fx: 0, fy: 0, baseY: 0, tile: false },
      { key: 'bg-market_far', depth: DEPTH.far, fx: 0.1, fy: 0.05, baseY: 10 },
      { key: 'bg-market_mid', depth: DEPTH.mid, fx: 0.24, fy: 0.12, baseY: 20 },
      { key: 'bg-market_near', depth: DEPTH.near, fx: 0.5, fy: 0.28, baseY: 40 },
    ],
    cars: 0.6,
    beams: false,
    blinkers: false,
    fog: [
      { depth: DEPTH.fogBack, fx: 0.4, fy: 0.3, baseY: 180, speed: 5, tint: 0x8a3a3a, alpha: 0.3 },
      { depth: DEPTH.fogBack, fx: 0.6, fy: 0.45, baseY: 230, speed: -7, tint: 0x7a2a5a, alpha: 0.3 },
      { depth: DEPTH.fogFront, fx: 1.15, fy: 1.0, baseY: 0, speed: 10, tint: 0x6a2a3a, alpha: 0.22 },
    ],
  },
  tower: {
    layers: [
      { key: 'bg-tower_sky', depth: DEPTH.sky, fx: 0, fy: 0, baseY: 0, tile: false },
      { key: 'bg-tower_far', depth: DEPTH.far, fx: 0.05, fy: 0.02, baseY: 60 },
      { key: 'bg-tower_clouds', depth: DEPTH.mid - 0.5, fx: 0.1, fy: 0.05, baseY: 150, drift: 4 },
      { key: 'bg-tower_mid', depth: DEPTH.mid, fx: 0.18, fy: 0.08, baseY: 120 },
    ],
    cars: 0,
    beams: true,
    blinkers: false,
    fog: [
      { depth: DEPTH.fogBack, fx: 0.3, fy: 0.12, baseY: 200, speed: 12, tint: 0x6a70a0, alpha: 0.28 },
      { depth: DEPTH.fogFront, fx: 1.2, fy: 1.0, baseY: 0, speed: 24, tint: 0x8890c0, alpha: 0.16 },
    ],
  },
};

interface Layer {
  obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image;
  fx: number;
  fy: number;
  baseY: number;
  baseX: number;
  tile: boolean;
  drift: number;
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

  private drift = 0;

  constructor(scene: Phaser.Scene, worldH: number, themeName: ThemeName = 'rooftops') {
    const theme = THEMES[themeName];
    this.worldH = worldH;
    for (const L of theme.layers) {
      const tile = L.tile ?? true;
      const tex = scene.textures.get(L.key).getSourceImage() as HTMLImageElement;
      const obj = tile ? scene.add.tileSprite(0, 0, GAME_W, tex.height, L.key).setOrigin(0, 0) : scene.add.image(0, 0, L.key).setOrigin(0, 0);
      obj.setScrollFactor(0).setDepth(L.depth);
      this.layers.push({ obj, fx: L.fx, fy: L.fy, baseY: L.baseY, baseX: L.baseX ?? 0, tile, drift: L.drift ?? 0 });
    }

    // traffic lanes
    const lanes = [
      { y: 70, fx: 0.18, fy: 0.1, v: 46, depth: DEPTH.carsFar, n: 4, alpha: 0.55 },
      { y: 112, fx: 0.18, fy: 0.1, v: -38, depth: DEPTH.carsFar, n: 3, alpha: 0.55 },
      { y: 150, fx: 0.32, fy: 0.18, v: 70, depth: DEPTH.carsMid, n: 3, alpha: 0.85 },
      { y: 95, fx: 0.32, fy: 0.18, v: -62, depth: DEPTH.carsMid, n: 2, alpha: 0.85 },
    ];
    for (const lane of lanes) {
      for (let i = 0; i < Math.round(lane.n * theme.cars); i++) {
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
    for (let i = 0; i < (theme.beams ? 3 : 0); i++) {
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
    for (let i = 0; i < (theme.blinkers ? 10 : 0); i++) {
      const img = scene.add.image(0, 0, 'fx', 'px2').setScrollFactor(0).setDepth(DEPTH.far).setTint(COLORS.crimsonHot).setBlendMode(Phaser.BlendModes.ADD);
      this.blinkers.push({ img, x: Math.random() * 960, y: 60 + Math.random() * 70, fx: 0.1, fy: 0.06, phase: Math.random() * 3 });
    }

    // fog banks
    const fogDefs = theme.fog;
    for (const f of fogDefs) {
      const obj = scene.add.tileSprite(0, 0, GAME_W, 64, 'bg-fog').setOrigin(0, 0).setScrollFactor(0).setDepth(f.depth).setTint(f.tint).setAlpha(f.alpha);
      this.fog.push({ obj, fx: f.fx, fy: f.fy, baseY: f.baseY, speed: f.speed, off: Math.random() * 500 });
    }
  }

  update(dt: number, camX: number, camY: number): void {
    this.time += dt;
    this.drift += dt;
    for (const l of this.layers) {
      const y = Math.round(l.baseY - camY * l.fy);
      if (l.tile) {
        const ts = l.obj as Phaser.GameObjects.TileSprite;
        ts.tilePositionX = Math.round(camX * l.fx + this.drift * l.drift);
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
