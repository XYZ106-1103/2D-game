import { TILE } from '../config.ts';

/** Materials painted by level builders. */
export const Mat = {
  Empty: 0,
  Concrete: 1,
  Steel: 2,
  Glass: 3,
  Catwalk: 4,
  Rail: 5,
} as const;
export type MatType = (typeof Mat)[keyof typeof Mat];

export interface DecorDef {
  key: string; // atlas frame (props) or special: 'lamp', 'billboard', 'sign:<name>'
  x: number; // pixels (bottom-centre)
  y: number;
  front?: boolean;
  flip?: boolean;
}

export interface TriggerDef {
  x: number;
  y: number;
  w: number;
  h: number;
  dialog: string;
}

export interface EnemySpawn {
  kind: 'drone' | 'sentry' | 'trooper';
  x: number;
  y: number;
}

export interface LevelData {
  id: string;
  title: string;
  subtitle: string;
  w: number;
  h: number;
  mat: Uint8Array;
  back: Uint8Array;
  spawn: { x: number; y: number };
  anchors: { x: number; y: number }[];
  checkpoints: { x: number; y: number }[];
  logs: { x: number; y: number; id: string }[];
  exit: { x: number; y: number };
  triggers: TriggerDef[];
  decor: DecorDef[];
  enemies: EnemySpawn[];
}

/** Small DSL for authoring levels in tile coordinates. */
export class LevelBuilder {
  readonly w: number;
  readonly h: number;
  readonly mat: Uint8Array;
  readonly back: Uint8Array;
  readonly data: Omit<LevelData, 'mat' | 'back' | 'w' | 'h'>;

  constructor(id: string, title: string, subtitle: string, w: number, h: number) {
    this.w = w;
    this.h = h;
    this.mat = new Uint8Array(w * h);
    this.back = new Uint8Array(w * h);
    this.data = {
      id,
      title,
      subtitle,
      spawn: { x: 0, y: 0 },
      anchors: [],
      checkpoints: [],
      logs: [],
      exit: { x: 0, y: 0 },
      triggers: [],
      decor: [],
      enemies: [],
    };
  }

  /** Fill an inclusive tile rectangle with a material. */
  fill(x0: number, y0: number, x1: number, y1: number, m: MatType): this {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.mat[y * this.w + x] = m;
    }
    return this;
  }

  /** A building: rooftop at row `top`, extending to the bottom of the map. */
  building(x0: number, x1: number, top: number, m: MatType = Mat.Concrete): this {
    return this.fill(x0, top, x1, this.h - 1, m);
  }

  clear(x0: number, y0: number, x1: number, y1: number): this {
    return this.fill(x0, y0, x1, y1, Mat.Empty);
  }

  backwall(x0: number, y0: number, x1: number, y1: number): this {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.back[y * this.w + x] = 1;
    }
    return this;
  }

  catwalk(x0: number, x1: number, y: number): this {
    return this.fill(x0, y, x1, y, Mat.Catwalk);
  }

  rail(x0: number, x1: number, y: number): this {
    return this.fill(x0, y, x1, y, Mat.Rail);
  }

  spawn(tx: number, ty: number): this {
    this.data.spawn = { x: tx * TILE + 8, y: (ty + 1) * TILE };
    return this;
  }

  anchor(tx: number, ty: number): this {
    this.data.anchors.push({ x: tx * TILE + 8, y: ty * TILE + 8 });
    return this;
  }

  checkpoint(tx: number, ty: number): this {
    this.data.checkpoints.push({ x: tx * TILE + 8, y: (ty + 1) * TILE });
    return this;
  }

  log(tx: number, ty: number, id: string): this {
    this.data.logs.push({ x: tx * TILE + 8, y: ty * TILE + 8, id });
    return this;
  }

  exit(tx: number, ty: number): this {
    this.data.exit = { x: tx * TILE + 8, y: (ty + 1) * TILE };
    return this;
  }

  trigger(tx: number, ty: number, tw: number, th: number, dialog: string): this {
    this.data.triggers.push({ x: tx * TILE, y: ty * TILE, w: tw * TILE, h: th * TILE, dialog });
    return this;
  }

  /** Enemy spawn. Drones float at the tile centre; ground units stand on row ty+1. */
  enemy(kind: EnemySpawn['kind'], tx: number, ty: number): this {
    const x = tx * TILE + 8;
    this.data.enemies.push({ kind, x, y: kind === 'drone' ? ty * TILE + 8 : (ty + 1) * TILE });
    return this;
  }

  /** Decor standing on top of row `ty` (bottom = top edge of that row). */
  prop(key: string, tx: number, ty: number, opts: { dx?: number; front?: boolean; flip?: boolean; dy?: number } = {}): this {
    this.data.decor.push({ key, x: tx * TILE + 8 + (opts.dx ?? 0), y: ty * TILE + (opts.dy ?? 0), front: opts.front, flip: opts.flip });
    return this;
  }

  build(): LevelData {
    return { ...this.data, w: this.w, h: this.h, mat: this.mat, back: this.back };
  }
}
