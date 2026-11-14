import { TILE } from '../config.ts';

/** Materials painted by level builders. */
export const Mat = {
  Empty: 0,
  Concrete: 1,
  Steel: 2,
  Glass: 3,
  Catwalk: 4,
  Rail: 5,
  Crumble: 6,
  /** Memory phase blocks: A is solid first, B second; they swap on a beat. */
  PhaseA: 7,
  PhaseB: 8,
  /** Hard-light bridge, solid only while its switch is lit. */
  Bridge: 9,
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
  kind: 'drone' | 'sentry' | 'trooper' | 'mine' | 'echo' | 'watcher';
  x: number;
  y: number;
}

export interface MoverDef {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  period: number; // seconds for a full round trip
  phase: number;
}

export interface VentDef {
  x: number; // centre
  y: number; // floor (bottom)
  h: number; // jet height in px
  on: number;
  off: number;
  phase: number;
}

/** Timed security beam between an emitter and a receiver. */
export interface LaserDef {
  x: number;
  y: number;
  len: number;
  dir: 'h' | 'v';
  on: number;
  off: number;
  phase: number;
}

/** Constant air stream inside a rectangle (px/s² acceleration). */
export interface FanDef {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

/** Hydraulic press: rests at `top`, slams down to `bottom` (head bottom edge). */
export interface CrusherDef {
  x: number;
  top: number;
  bottom: number;
  w: number;
  period: number;
  phase: number;
}

/** Rising fluid that starts when the player enters `trigger`. */
export interface FloodDef {
  y0: number;
  y1: number;
  speed: number;
  trigger: { x: number; y: number; w: number; h: number };
}

/** Area with scaled gravity (zero-g pockets in the core). */
export interface GravityZoneDef {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

/** Gravity well: pulls the airborne player toward a hookable core. */
export interface WellDef {
  x: number;
  y: number;
  r: number;
  strength: number;
}

/** Springy bloom: landing on it launches the player upward. */
export interface BouncerDef {
  x: number;
  y: number;
  power: number;
}

/** Hookable switch lighting a hard-light bridge for `duration` seconds. */
export interface SwitchDef {
  x: number;
  y: number;
  group: number;
  duration: number;
}

export interface BridgeDef {
  x0: number;
  x1: number;
  y: number;
  group: number;
}

/** Lightning rod: charges, then a bolt strikes it and arcs to its surroundings. */
export interface RodDef {
  x: number;
  y: number;
  base: number;
  period: number;
  phase: number;
  radius: number;
}

/** Broadcast emitter: rings of signal that shove the player outward. */
export interface PulseDef {
  x: number;
  y: number;
  period: number;
  phase: number;
  radius: number;
  force: number;
}

// --- chapter 3 ----------------------------------------------------------------

/** Cable you can hook and slide along (zip line). */
export interface CableDef {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Water volume: buoyancy, drag and an optional current (px/s²). */
export interface WaterDef {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

/** Sweeping searchlight; a sustained sighting raises the alarm. */
export interface LightDef {
  x: number;
  y: number;
  a0: number;
  a1: number;
  period: number;
  range: number;
  width: number;
  phase: number;
}

/** Cells that slam shut while the alarm is up (inclusive tile rect). */
export interface ShutterDef {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Train on a straight track; cars are moving platforms, the body hurts. */
export interface TrainDef {
  y: number;
  x0: number;
  x1: number;
  speed: number;
  cars: number;
  carW: number;
  period: number;
  phase: number;
}

/** Static hazard rect (signal gantry over the track). */
export interface GantryDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Facing = 'L' | 'R' | 'U' | 'D';
/** Pair of momentum-preserving gates. */
export interface PortalDef {
  ax: number;
  ay: number;
  an: Facing;
  bx: number;
  by: number;
  bn: Facing;
}

/** Cargo crate standing on row ty (bottom = y). */
export interface CrateDef {
  x: number;
  y: number;
}

/** Platforms orbiting an axle. */
export interface RotorDef {
  cx: number;
  cy: number;
  r: number;
  n: number;
  speed: number;
  w: number;
}

/** Swinging weight you can hook (moving anchor on an arc). */
export interface PendulumDef {
  px: number;
  py: number;
  len: number;
  amp: number;
  period: number;
  phase: number;
}

/** Hub character: talk with [W]/[↑]. */
export interface NpcDef {
  x: number;
  y: number;
  id: string;
  name: string;
  dialog: string;
  required: boolean;
  face: number;
}

export type ThemeKey = 'rooftops' | 'market' | 'tower' | 'archive' | 'refinery' | 'core' | 'memory' | 'garden' | 'mast' | 'dawn' | 'sunroof' | 'drowned' | 'avenue' | 'transit' | 'lab' | 'harbor' | 'clock' | 'vesper';
export type MusicKey = 'stage' | 'market' | 'tower' | 'boss' | 'archive' | 'refinery' | 'core' | 'memory' | 'garden' | 'mast' | 'nocturne' | 'sunroof' | 'drowned' | 'avenue' | 'transit' | 'lab' | 'harbor' | 'clock' | 'hub' | 'vesper';
export type WeatherKind = 'rain' | 'frost' | 'embers' | 'motes' | 'frozen' | 'petals' | 'none' | 'dust' | 'gulls' | 'leaves';

export interface LevelData {
  id: string;
  title: string;
  subtitle: string;
  theme: ThemeKey;
  music: MusicKey;
  rain: number;
  weather: WeatherKind;
  /** Tile kit name (tiles_<name>.png), '' for the chapter 1 set. */
  tileset: string;
  boss: false | 'archivist' | 'nocturne' | 'vesper';
  /** Safe hub: no timer pressure, NPCs to talk to; exit opens after required talks. */
  hub: boolean;
  /** Line under STAGE CLEAR. */
  clearText: string;
  /** Seconds between phase-block swaps (0 = none). */
  phasePeriod: number;
  movers: MoverDef[];
  vents: VentDef[];
  lasers: LaserDef[];
  fans: FanDef[];
  crushers: CrusherDef[];
  floods: FloodDef[];
  zones: GravityZoneDef[];
  wells: WellDef[];
  bouncers: BouncerDef[];
  switches: SwitchDef[];
  bridges: BridgeDef[];
  rods: RodDef[];
  pulses: PulseDef[];
  cables: CableDef[];
  water: WaterDef[];
  lights: LightDef[];
  shutters: ShutterDef[];
  trains: TrainDef[];
  gantries: GantryDef[];
  portals: PortalDef[];
  crates: CrateDef[];
  rotors: RotorDef[];
  pendulums: PendulumDef[];
  npcs: NpcDef[];
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
      theme: 'rooftops',
      music: 'stage',
      rain: 1,
      weather: 'rain',
      tileset: '',
      boss: false,
      clearText: '',
      phasePeriod: 0,
      movers: [],
      vents: [],
      lasers: [],
      fans: [],
      crushers: [],
      floods: [],
      zones: [],
      wells: [],
      bouncers: [],
      switches: [],
      bridges: [],
      rods: [],
      pulses: [],
      cables: [],
      water: [],
      lights: [],
      shutters: [],
      trains: [],
      gantries: [],
      portals: [],
      crates: [],
      rotors: [],
      pendulums: [],
      npcs: [],
      hub: false,
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

  setTheme(theme: LevelData['theme'], music: LevelData['music'], rain = 1): this {
    this.data.theme = theme;
    this.data.music = music;
    this.data.rain = rain;
    return this;
  }

  /** Chapter 2 look: tile kit + weather kind (density reuses `rain`). */
  look(tileset: string, weather: WeatherKind, density = 1): this {
    this.data.tileset = tileset;
    this.data.weather = weather;
    this.data.rain = density;
    return this;
  }

  clearText(t: string): this {
    this.data.clearText = t;
    return this;
  }

  /** Security beam from tile (tx,ty) running `tiles` tiles right ('h') or down ('v'). */
  laser(tx: number, ty: number, tiles: number, dir: 'h' | 'v', on = 1.4, off = 1.4, phase = 0): this {
    this.data.lasers.push({ x: tx * TILE + 8, y: ty * TILE + 8, len: tiles * TILE, dir, on, off, phase });
    return this;
  }

  /** Air stream filling an inclusive tile rect. */
  fan(x0: number, y0: number, x1: number, y1: number, ax: number, ay: number): this {
    this.data.fans.push({ x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE, ax, ay });
    return this;
  }

  /** Press centred on tile column tx, `w` tiles wide, hanging from row `ceil` and slamming onto row `floor`. */
  crusher(tx: number, ceil: number, floor: number, w = 2, period = 2.6, phase = 0): this {
    this.data.crushers.push({ x: tx * TILE + (w % 2 ? 8 : 0), top: (ceil + 2) * TILE, bottom: floor * TILE, w: w * TILE, period, phase });
    return this;
  }

  flood(fromRow: number, toRow: number, speed: number, tx: number, ty: number, tw: number, th: number): this {
    this.data.floods.push({ y0: fromRow * TILE, y1: toRow * TILE, speed, trigger: { x: tx * TILE, y: ty * TILE, w: tw * TILE, h: th * TILE } });
    return this;
  }

  zeroG(x0: number, y0: number, x1: number, y1: number, scale = 0.3): this {
    this.data.zones.push({ x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE, scale });
    return this;
  }

  well(tx: number, ty: number, rTiles: number, strength = 900): this {
    this.data.wells.push({ x: tx * TILE + 8, y: ty * TILE + 8, r: rTiles * TILE, strength });
    return this;
  }

  /** Bloom standing on top of row ty. */
  bouncer(tx: number, ty: number, power = 560): this {
    this.data.bouncers.push({ x: tx * TILE + 8, y: ty * TILE, power });
    return this;
  }

  switchNode(tx: number, ty: number, group: number, duration = 6): this {
    this.data.switches.push({ x: tx * TILE + 8, y: ty * TILE + 8, group, duration });
    return this;
  }

  bridge(x0: number, x1: number, y: number, group: number): this {
    this.data.bridges.push({ x0, x1, y, group });
    return this.fill(x0, y, x1, y, Mat.Bridge);
  }

  /** Lightning rod with its tip at row ty and its base on row baseRow. */
  rod(tx: number, ty: number, baseRow: number, period = 5, phase = 0, radius = 40): this {
    this.data.rods.push({ x: tx * TILE + 8, y: ty * TILE, base: baseRow * TILE, period, phase, radius });
    return this;
  }

  pulse(tx: number, ty: number, period = 3, phase = 0, radius = 110, force = 260): this {
    this.data.pulses.push({ x: tx * TILE + 8, y: ty * TILE + 8, period, phase, radius, force });
    return this;
  }

  // --- chapter 3 builders (tile coordinates) -------------------------------------

  /** Cable between two tile centres. */
  cable(tx0: number, ty0: number, tx1: number, ty1: number): this {
    this.data.cables.push({ x0: tx0 * TILE + 8, y0: ty0 * TILE + 8, x1: tx1 * TILE + 8, y1: ty1 * TILE + 8 });
    return this;
  }

  /** Water filling an inclusive tile rect; surface on the top edge of row y0. */
  pool(x0: number, y0: number, x1: number, y1: number, cx = 0, cy = 0): this {
    this.data.water.push({ x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE, cx, cy });
    return this;
  }

  /** Searchlight mounted at a tile centre sweeping between angles (deg, 0 = right, 90 = down). */
  light(tx: number, ty: number, a0: number, a1: number, period = 4, range = 150, width = 26, phase = 0): this {
    this.data.lights.push({ x: tx * TILE + 8, y: ty * TILE + 8, a0, a1, period, range, width, phase });
    return this;
  }

  shutter(x0: number, y0: number, x1: number, y1: number): this {
    this.data.shutters.push({ x0, y0, x1, y1 });
    return this;
  }

  /** Train running right, its wheels on the rail at the top of row `railRow` (roof 28px above). */
  train(railRow: number, tx0: number, tx1: number, speed = 220, cars = 4, period = 9, phase = 0): this {
    this.data.trains.push({ y: railRow * TILE - 28, x0: tx0 * TILE, x1: tx1 * TILE, speed, cars, carW: 96, period, phase });
    return this;
  }

  gantry(tx: number, ty: number, tw = 1, th = 1): this {
    this.data.gantries.push({ x: tx * TILE, y: ty * TILE, w: tw * TILE, h: th * TILE });
    return this;
  }

  /** Signal box hanging at head height over a train roof (rail row as for train()): jump it. */
  signal(tx: number, railRow: number): this {
    this.data.gantries.push({ x: tx * TILE, y: railRow * TILE - 28 - 22, w: TILE, h: 14 });
    return this;
  }

  portal(atx: number, aty: number, an: Facing, btx: number, bty: number, bn: Facing): this {
    this.data.portals.push({ ax: atx * TILE + 8, ay: aty * TILE + 8, an, bx: btx * TILE + 8, by: bty * TILE + 8, bn });
    return this;
  }

  /** Crate standing on top of row ty (centred on tile column tx). */
  crate(tx: number, ty: number): this {
    this.data.crates.push({ x: tx * TILE + 8, y: ty * TILE });
    return this;
  }

  rotor(tx: number, ty: number, rTiles: number, n = 3, speed = 0.9, wTiles = 3): this {
    this.data.rotors.push({ cx: tx * TILE + 8, cy: ty * TILE + 8, r: rTiles * TILE, n, speed, w: wTiles * TILE });
    return this;
  }

  pendulum(tx: number, ty: number, lenTiles: number, ampDeg = 50, period = 3.2, phase = 0): this {
    this.data.pendulums.push({ px: tx * TILE + 8, py: ty * TILE + 8, len: lenTiles * TILE, amp: (ampDeg * Math.PI) / 180, period, phase });
    return this;
  }

  /** NPC standing on top of row ty+1 (like a ground enemy). */
  npc(id: string, name: string, tx: number, ty: number, dialog: string, required = false, face = -1): this {
    this.data.npcs.push({ id, name, x: tx * TILE + 8, y: (ty + 1) * TILE, dialog, required, face });
    return this;
  }

  phase(x0: number, y0: number, x1: number, y1: number, which: 'A' | 'B'): this {
    return this.fill(x0, y0, x1, y1, which === 'A' ? Mat.PhaseA : Mat.PhaseB);
  }

  /** Anchor drone shuttling between two tile positions. */
  mover(tx0: number, ty0: number, tx1: number, ty1: number, period = 4, phase = 0): this {
    this.data.movers.push({ x0: tx0 * TILE + 8, y0: ty0 * TILE + 8, x1: tx1 * TILE + 8, y1: ty1 * TILE + 8, period, phase });
    return this;
  }

  /** Steam vent on the floor of row ty+1 blowing upward `h` tiles. */
  vent(tx: number, ty: number, h: number, on = 1.6, off = 1.2, phase = 0): this {
    this.data.vents.push({ x: tx * TILE + 8, y: (ty + 1) * TILE, h: h * TILE, on, off, phase });
    return this;
  }

  crumble(x0: number, x1: number, y: number): this {
    return this.fill(x0, y, x1, y, Mat.Crumble);
  }

  /** Enemy spawn. Drones float at the tile centre; ground units stand on row ty+1. */
  enemy(kind: EnemySpawn['kind'], tx: number, ty: number): this {
    const x = tx * TILE + 8;
    const floating = kind === 'drone' || kind === 'mine' || kind === 'echo' || kind === 'watcher';
    this.data.enemies.push({ kind, x, y: floating ? ty * TILE + 8 : (ty + 1) * TILE });
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
