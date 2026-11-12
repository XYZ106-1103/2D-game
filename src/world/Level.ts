import Phaser from 'phaser';
import { DEPTH, TILE } from '../config.ts';
import { Cell, TileWorld } from '../physics/TileWorld.ts';
import { Mat, type LevelData } from './LevelData.ts';

const N = 1;
const E = 2;
const S = 4;
const W = 8;

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 974711) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tile indices in public/assets/sprites/tiles.png (see tools/art/tiles.ts). */
const IDX = {
  concrete: (mask: number, v: number) => v * 16 + mask,
  interior: (k: number) => 32 + k,
  steel: (mask: number) => 48 + mask,
  glass: (mask: number) => 64 + mask,
  catwalk: (p: number) => 80 + p,
  rail: (p: number) => 84 + p,
  backwall: (k: number) => (k < 8 ? 88 + k : 96 + (k - 8)),
};

export interface Surface {
  x0: number;
  x1: number;
  y: number;
}

/** Runtime level: physics grid + rendered tile layers. */
export class Level {
  readonly data: LevelData;
  readonly world: TileWorld;
  readonly surfaces: Surface[] = [];
  private maps: Phaser.Tilemaps.Tilemap[] = [];

  constructor(data: LevelData) {
    this.data = data;
    const cells = new Uint8Array(data.w * data.h);
    for (let i = 0; i < cells.length; i++) {
      switch (data.mat[i]) {
        case Mat.Concrete:
        case Mat.Steel:
          cells[i] = Cell.Solid;
          break;
        case Mat.Glass:
          cells[i] = Cell.Glass;
          break;
        case Mat.Catwalk:
          cells[i] = Cell.OneWay;
          break;
        case Mat.Rail:
          cells[i] = Cell.Hazard;
          break;
        default:
          cells[i] = Cell.Empty;
      }
    }
    this.world = new TileWorld(data.w, data.h, cells);
    // Walkable top surfaces (for rain splashes & ambient).
    for (let y = 0; y < data.h; y++) {
      let run = -1;
      for (let x = 0; x <= data.w; x++) {
        const top = x < data.w && this.isTop(x, y);
        if (top && run < 0) run = x;
        if (!top && run >= 0) {
          this.surfaces.push({ x0: run * TILE, x1: x * TILE, y: y * TILE });
          run = -1;
        }
      }
    }
  }

  private matAt(x: number, y: number): number {
    if (x < 0 || x >= this.data.w) return Mat.Concrete;
    if (y < 0) return Mat.Empty;
    if (y >= this.data.h) return this.matAt(x, this.data.h - 1);
    return this.data.mat[y * this.data.w + x];
  }

  private isTop(x: number, y: number): boolean {
    const m = this.matAt(x, y);
    const solid = m === Mat.Concrete || m === Mat.Steel || m === Mat.Glass || m === Mat.Catwalk;
    return solid && this.matAt(x, y - 1) === Mat.Empty;
  }

  private mask(x: number, y: number, m: number): number {
    let k = 0;
    if (this.matAt(x, y - 1) !== m) k |= N;
    if (this.matAt(x + 1, y) !== m) k |= E;
    if (this.matAt(x, y + 1) !== m) k |= S;
    if (this.matAt(x - 1, y) !== m) k |= W;
    return k;
  }

  private tileFor(x: number, y: number): number {
    const m = this.matAt(x, y);
    switch (m) {
      case Mat.Concrete: {
        const k = this.mask(x, y, m);
        if (k !== 0) return IDX.concrete(k, hash(x, y) > 0.5 ? 1 : 0);
        // depth below the roof line
        let depth = 0;
        while (depth < 4 && this.matAt(x, y - depth - 1) === Mat.Concrete) depth++;
        if (depth >= 2 && hash(x, 0, 7) < 0.07) return IDX.interior(7); // vertical pipe run
        if (depth >= 2 && x % 3 === 1 && y % 2 === 0) {
          const r = hash(x, y, 3);
          if (r < 0.58) return IDX.interior(3);
          if (r < 0.78) return IDX.interior(4);
          if (r < 0.9) return IDX.interior(5);
          return IDX.interior(8);
        }
        const r = hash(x, y, 5);
        if (r < 0.06) return IDX.interior(2);
        if (r < 0.1) return IDX.interior(6);
        return IDX.interior(r < 0.55 ? 0 : 1);
      }
      case Mat.Steel:
        return IDX.steel(this.mask(x, y, m));
      case Mat.Glass:
        return IDX.glass(this.mask(x, y, m));
      case Mat.Catwalk: {
        const l = this.matAt(x - 1, y) === m;
        const r = this.matAt(x + 1, y) === m;
        return IDX.catwalk(l && r ? 1 : !l && r ? 0 : l && !r ? 2 : 3);
      }
      case Mat.Rail: {
        const l = this.matAt(x - 1, y) === m;
        const r = this.matAt(x + 1, y) === m;
        return IDX.rail(l && r ? 1 : !l && r ? 0 : l && !r ? 2 : 3);
      }
      default:
        return -1;
    }
  }

  /** Create tile layers in the scene. */
  render(scene: Phaser.Scene): void {
    const { w, h } = this.data;
    const main: number[][] = [];
    const back: number[][] = [];
    for (let y = 0; y < h; y++) {
      const row: number[] = [];
      const brow: number[] = [];
      for (let x = 0; x < w; x++) {
        row.push(this.tileFor(x, y));
        const b = this.data.back[y * w + x];
        brow.push(b ? IDX.backwall(Math.floor(hash(x, y, 9) * 16) % 16) : -1);
      }
      main.push(row);
      back.push(brow);
    }
    const make = (data: number[][], depth: number) => {
      const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const ts = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
      const layer = map.createLayer(0, ts, 0, 0)!;
      layer.setDepth(depth);
      this.maps.push(map);
      return layer;
    };
    make(back, DEPTH.backwall);
    make(main, DEPTH.tiles);
  }

  /** Hazard rail cells (for spark FX). */
  hazardCells(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < this.data.h; y++)
      for (let x = 0; x < this.data.w; x++) if (this.data.mat[y * this.data.w + x] === Mat.Rail) out.push({ x: x * TILE, y: y * TILE });
    return out;
  }

  destroy(): void {
    for (const m of this.maps) m.destroy();
    this.maps = [];
  }
}
