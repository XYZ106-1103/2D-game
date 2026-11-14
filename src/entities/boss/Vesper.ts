import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, TILE } from '../../config.ts';
import { COLORS, RAMPS } from '../../art/palette.ts';
import { rand } from '../../core/math.ts';
import type { AnchorPoint } from '../Grapple.ts';
import type { Plat } from '../Player.ts';
import type { HitKind, HitResult } from '../enemies/Enemy.ts';
import type { GameScene } from '../../scenes/GameScene.ts';
import type { Actor } from '../Actor.ts';

const FLOOR_ROW = 21;
const VOICES = ['잊게 해 줘', '기억하고 싶어', '그냥 평온하고 싶어', '내 기억은 내 거야', '무서워', '그 사람 얼굴을 잊고 싶지 않아', '다시 아프기 싫어', '선택하게 해 줘'];

interface Part {
  x: number;
  y: number;
  hp: number;
  max: number;
  lastHit: number;
  flash: number;
  img: Phaser.GameObjects.Image;
  anchor: AnchorPoint;
  bob: number;
}

interface Missile {
  x: number;
  y: number;
  tx: number;
  t: number;
  img: Phaser.GameObjects.Image;
  ret: Phaser.GameObjects.Image;
}

interface Wave {
  x: number;
  dir: number;
  gapY: number;
  /** Players this wall has already struck (each once). */
  hit: Set<Actor>;
}

interface Voice {
  t: Phaser.GameObjects.BitmapText;
  vx: number;
  life: number;
}

/**
 * VESPER — the Consensus. The city itself turns on ION:
 *   1. the sky watches  — eye searchlights call missile strikes, drone flocks; break 3 relay screens
 *   2. the city moves   — trains through the arena, swinging crane loads, guards; break 3 pylons
 *   3. every voice      — static walls with a gap, replayed memories of old bosses; strike its eyes
 *   4. lanterns         — no more damage: light six district lanterns while everything comes at you
 */
export class Vesper {
  active = false;
  defeated = false;
  phase = 1;
  private g: GameScene;
  private sc: Phaser.Scene;
  private t = 0;
  private state = 'intro';
  private stateT = 0;
  private face: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private fx: Phaser.GameObjects.Graphics;
  private readonly fxX: number;
  private readonly fyC = 150;
  private screens: Part[] = [];
  private pylons: Part[] = [];
  private eyes: Part[] = [];
  private lanterns: { x: number; y: number; lit: boolean; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; anchor: AnchorPoint }[] = [];
  private missiles: Missile[] = [];
  private waves: Wave[] = [];
  private voices: Voice[] = [];
  private scales: { x: number; y: number; ph: number; img: Phaser.GameObjects.Image }[] = [];
  private beamAng = Math.PI / 2;
  private beamOn = 0;
  private lockT = 0;
  private atkT = 2;
  private droneT = 5;
  private guardT = 8;
  private voiceT = 1;
  private hurtCd = 0;
  // phase 2 hazards
  private train = { x: -9999, active: false, t: 0, warn: 0, cars: [] as Plat[], imgs: [] as Phaser.GameObjects.Image[] };
  private crane = { x: -9999, dir: 1, t: 0, warn: 0, img: null as unknown as Phaser.GameObjects.Image };
  private slam = { x: 0, t: -1, img: null as unknown as Phaser.GameObjects.Image, shocks: [] as { x: number; dir: number; t: number }[] };
  private readonly floorY = FLOOR_ROW * TILE;
  private readonly arenaW: number;
  onDefeated: (() => void) | null = null;
  // finale (last lantern): real-time clock, -1 = not running
  private fin = -1;
  private finFrom = { x: 0, y: 0 };
  private finPath: { x: number; y: number }[] = [];
  private finCamFrom = 0;
  /** Who lit the last lantern (the close-up frames them). */
  private finBy: Actor | null = null;
  onPhase: ((p: number) => void) | null = null;

  constructor(g: GameScene) {
    this.g = g;
    this.sc = g as unknown as Phaser.Scene;
    this.arenaW = g.level.world.pixelWidth;
    this.fxX = this.arenaW / 2;
    const sc = this.sc;
    this.glow = sc.add.image(this.fxX, this.fyC, 'fx', 'glow128').setDepth(DEPTH.mid + 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(RAMPS.cyan[3]).setAlpha(0).setScale(2.4);
    this.face = sc.add.image(this.fxX, this.fyC, 'boss3', 'face_idle').setDepth(DEPTH.mid + 1).setAlpha(0);
    this.fx = sc.add.graphics().setDepth(DEPTH.fx - 1);
    const self = this;
    const mkPart = (x: number, y: number, hp: number, key: string, frame: string, depth: number, radius: number): Part => {
      const part: Part = { x, y, hp, max: hp, lastHit: -1, flash: 0, bob: rand(0, 6), img: sc.add.image(x, y, key, frame).setDepth(depth).setVisible(false), anchor: null as unknown as AnchorPoint };
      part.anchor = {
        isEnemy: true,
        hookRadius: radius,
        get x() {
          return part.x;
        },
        get y() {
          return part.y;
        },
        get alive() {
          return part.hp > 0 && self.active && !self.defeated && part.img.visible;
        },
      };
      return part;
    };
    for (const [x, y] of [
      [120, 150],
      [this.arenaW / 2, 236],
      [this.arenaW - 120, 150],
    ])
      this.screens.push(mkPart(x, y, 5, 'ch3', 'screen_0', DEPTH.objects + 2, 14));
    for (const x of [150, this.arenaW / 2, this.arenaW - 150]) this.pylons.push(mkPart(x, this.floorY - 42, 6, 'ch3', 'pylon', DEPTH.objects + 1, 12));
    for (const side of [-1, 1]) this.eyes.push(mkPart(this.fxX + side * 38, this.fyC - 78 + 58, 8, 'boss3', 'eye_shut', DEPTH.mid + 2, 16));
    // all six sit inside the locked boss camera (world y >= 150) and clear of the face
    for (const [tx, ty] of [
      [6, 13],
      [41, 13],
      [13, 9],
      [34, 9],
      [20, 17],
      [28, 17],
    ]) {
      const x = tx * TILE + 8;
      const y = ty * TILE + 8;
      const glow = sc.add.image(x, y, 'fx', 'glow64').setDepth(DEPTH.objects - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.amberHot).setAlpha(0).setVisible(false);
      const img = sc.add.image(x, y, 'ch3', 'lantern_off').setDepth(DEPTH.objects).setVisible(false);
      const l = { x, y, lit: false, img, glow, anchor: null as unknown as AnchorPoint };
      l.anchor = {
        hookRadius: 12,
        x,
        y,
        get alive() {
          return self.phase === 4 && !l.lit && self.active && !self.defeated;
        },
      };
      this.lanterns.push(l);
    }
    for (let i = 0; i < 3; i++) {
      this.train.cars.push({ x: -9999, y: 0, w: 92, h: 28, dx: 0, dy: 0, vx: 0, vy: 0, solid: false });
      this.train.imgs.push(sc.add.image(0, 0, 'ch3', i === 2 ? 'train_head' : 'train_car').setOrigin(0, 0).setDepth(DEPTH.objects + 0.5).setVisible(false));
    }
    this.crane.img = sc.add.image(0, 0, 'ch3', 'crane_load').setDepth(DEPTH.objects + 0.6).setVisible(false);
    this.slam.img = sc.add.image(0, 0, 'boss', 'boss_arm_c_6').setDepth(DEPTH.objects + 3).setVisible(false);
  }

  get totalHp(): number {
    const sum = (a: Part[]) => a.reduce((s, p) => s + Math.max(0, p.hp), 0);
    return sum(this.screens) + sum(this.pylons) + sum(this.eyes) + this.lanterns.filter((l) => !l.lit).length * 2;
  }
  get maxHp(): number {
    // screens 3x5, pylons 3x6, eyes 2x8 (x1.5 in co-op), lanterns 6x2
    const sum = (a: Part[]) => a.reduce((s, p) => s + p.max, 0);
    return sum(this.screens) + sum(this.pylons) + sum(this.eyes) + this.lanterns.length * 2;
  }

  /** Online co-op: tougher for two. */
  scaleHp(k: number): void {
    for (const p of [...this.screens, ...this.pylons, ...this.eyes]) p.hp = p.max = Math.ceil(p.max * k);
  }

  hookTargets(): AnchorPoint[] {
    if (!this.active || this.defeated) return [];
    const parts = this.phase === 1 ? this.screens : this.phase === 2 ? this.pylons : this.phase === 3 ? this.eyes : [];
    const out: AnchorPoint[] = parts.filter((p) => p.hp > 0 && (this.phase !== 3 || this.state !== 'wave')).map((p) => p.anchor);
    if (this.phase === 4) for (const l of this.lanterns) if (!l.lit) out.push(l.anchor);
    return out;
  }

  /** Lanterns are plain anchors (hooking lights them, it never zips). */
  anchors(): AnchorPoint[] {
    return this.phase === 4 ? this.lanterns.filter((l) => !l.lit).map((l) => l.anchor) : [];
  }

  begin(): void {
    this.active = true;
    this.setPhase(1);
  }

  private setState(s: string): void {
    this.state = s;
    this.stateT = 0;
  }

  private setPhase(p: number): void {
    this.phase = p;
    this.setState('idle');
    for (const s of this.screens) s.img.setVisible(p === 1 && s.hp > 0);
    for (const s of this.pylons) s.img.setVisible(p === 2 && s.hp > 0);
    for (const e of this.eyes) e.img.setVisible(p === 3 && e.hp > 0);
    for (const l of this.lanterns) {
      l.img.setVisible(p === 4);
      l.glow.setVisible(p === 4);
    }
    this.atkT = 2.5;
    if (p > 1) this.onPhase?.(p);
  }

  // ---------------------------------------------------------------------------

  hit(x: number, y: number, w: number, h: number, id: number, dmg: number, kind: HitKind, dirX: number): HitResult {
    if (!this.active || this.defeated) return 'none';
    const inRect = (px: number, py: number, r: number) => px + r > x && px - r < x + w && py + r > y && py - r < y + h;
    const parts = this.phase === 1 ? this.screens : this.phase === 2 ? this.pylons : this.phase === 3 ? this.eyes : [];
    for (const p of parts) {
      if (p.hp <= 0 || p.lastHit === id || !p.img.visible) continue;
      if (!inRect(p.x, p.y, 14)) continue;
      if (this.phase === 3 && this.state === 'wave') {
        this.g.combat.feedback('block', p.x, p.y, dirX, kind);
        p.lastHit = id;
        return 'block';
      }
      p.lastHit = id;
      p.hp -= dmg;
      p.flash = 0.12;
      this.g.combat.feedback(p.hp <= 0 ? 'kill' : 'hit', p.x, p.y, dirX, kind);
      if (p.hp <= 0) this.breakPart(p);
      return p.hp <= 0 ? 'kill' : 'hit';
    }
    return 'none';
  }

  private breakPart(p: Part): void {
    this.g.combat.boom(p.x, p.y, true);
    this.g.shake(5, 0.35);
    this.g.flash(0.25);
    p.img.setVisible(false);
    for (let i = 0; i < 12; i++) this.g.particles.emit(p.x, p.y, { frame: 'px2', speed: [80, 220], angle: -90, spread: 300, gravity: 400, life: [0.6, 1.1], tint: [RAMPS.cyan[4], COLORS.white] });
    const parts = this.phase === 1 ? this.screens : this.phase === 2 ? this.pylons : this.eyes;
    if (parts.every((q) => q.hp <= 0)) {
      this.g.slowmo(0.35, 0.8);
      this.g.sfx('roar', { pitch: 1.4 });
      this.clearHazards();
      this.setPhase(this.phase + 1);
    }
  }

  private lightLantern(l: (typeof this.lanterns)[number]): void {
    l.lit = true;
    l.img.setFrame('lantern_on');
    this.g.sfx('lantern', { vol: 0.9 });
    this.g.particles.ring(l.x, l.y, COLORS.amberHot);
    this.g.particles.sparks(l.x, l.y, -90, 360, 18, [COLORS.amberHot, COLORS.white, COLORS.amber]);
    this.g.flash(0.15);
    const left = this.lanterns.filter((q) => !q.lit).length;
    if (left === 0) {
      this.startFinale(l);
      return;
    }
    this.spawnVoice(VOICES[(6 - left) % VOICES.length], l.x, l.y - 20, true);
  }

  // ---------------------------------------------------------------------------
  // Finale: (1) time stops on the last hook (close-up, heartbeat, a light
  // shockwave dissolves every attack) → (2) the six lanterns join into a
  // constellation whose light flows into the face, warming it from the rim
  // inward → (3) silence, then the old clock tower bell rings once.
  // ---------------------------------------------------------------------------

  private startFinale(l: { x: number; y: number; anchor: AnchorPoint }): void {
    this.defeated = true; // stops attacks and hazard updates
    this.setState('finale');
    this.fin = 0;
    this.finFrom = { x: l.x, y: l.y };
    this.finPath = this.lanterns.map((q) => ({ x: q.x, y: q.y })).sort((a, b) => a.x - b.x);
    const p = this.lighterOf(l);
    this.finBy = p;
    this.g.cineLock();
    this.g.slowmo(0.02, 1.3);
    this.g.musicStop(0.25);
    this.g.heartbeat(1.1);
    this.g.cinematicHud(true);
    // integer close-up: frame ION and the lantern together when they fit,
    // otherwise keep the lantern in shot with the tether leading into it
    const hw = GAME_W / 4;
    const hh = GAME_H / 4;
    const fit = (a: number, b: number, half: number) => (Math.abs(b - a) <= 2 * (half - 22) ? (a + b) / 2 : a + Math.sign(b - a) * (half - 22));
    const wh = this.g.level.world.pixelHeight;
    this.g.cine = {
      x: Math.max(hw, Math.min(this.arenaW - hw, fit(l.x, p.x, hw))),
      y: Math.max(hh, Math.min(wh - hh, fit(l.y, p.y - 6, hh))),
      zoom: 2,
    };
  }

  /** Camera centre (zoom 1) for the constellation: sweep along the links, then settle on the face. */
  private finaleCamX(T: number, from: number): number {
    const half = GAME_W / 2;
    const left = half;
    const right = this.arenaW - half;
    const ease = (u: number) => u * u * (3 - 2 * u);
    if (T < 2.3) return from + (left - from) * ease(Math.max(0, Math.min(1, (T - 1.9) / 0.4)));
    if (T < 3.5) return left + (right - left) * ease((T - 2.3) / 1.2);
    return right + (this.fxX - right) * ease(Math.min(1, (T - 3.5) / 0.45));
  }

  /** Amber motes where an attack dissolves. */
  private puff(x: number, y: number, n = 8): void {
    this.g.particles.emit(x, y, { frame: 'px2', count: n, speed: [30, 110], angle: -90, spread: 360, gravity: -40, life: [0.6, 1.2], tint: [COLORS.amberHot, 0xffd890, COLORS.white], add: true });
  }

  /** The shockwave front (radius r around the last lantern) unmakes what it touches. */
  private dissolveWithin(r: number): void {
    const L = this.finFrom;
    const near = (x: number, y: number) => Math.hypot(x - L.x, y - L.y) < r;
    this.missiles = this.missiles.filter((m) => {
      if (!near(m.x, m.y)) return true;
      this.puff(m.x, m.y);
      m.img.destroy();
      m.ret.destroy();
      return false;
    });
    this.scales = this.scales.filter((sc) => {
      if (!near(sc.x, sc.y)) return true;
      this.puff(sc.x, sc.y, 4);
      sc.img.destroy();
      return false;
    });
    this.waves = this.waves.filter((w) => {
      if (Math.abs(w.x - L.x) > r) return true;
      for (let y = 40; y < this.floorY; y += 26) if (Math.abs(y - w.gapY) > 30) this.puff(w.x, y, 3);
      return false;
    });
    for (const c of this.train.cars) {
      if (c.x < -9000 || !near(c.x + c.w / 2, c.y + 14)) continue;
      for (let k = 0; k < 4; k++) this.puff(c.x + ((k + 0.5) * c.w) / 4, c.y + 14, 4);
      c.x = -9999;
    }
    if (this.train.cars.every((c) => c.x < -9000)) {
      this.train.active = false;
      this.g.gimmicks.devices3.extraPlats = [];
    }
    if (this.crane.x > -9000 && near(this.crane.x, this.crane.img.y)) {
      this.puff(this.crane.x, this.crane.img.y, 12);
      this.crane.x = -9999;
      this.crane.img.setVisible(false);
    }
    if (this.slam.t >= 0 && near(this.slam.x, this.floorY - 70)) {
      this.puff(this.slam.x, this.floorY - 70, 14);
      this.slam.t = -1;
    }
    this.slam.shocks = this.slam.shocks.filter((k) => !near(k.x, this.floorY - 5));
    for (const e of this.g.combat.enemies) {
      if (!e.alive || !near(e.x, e.y) || (e.kind !== 'drone' && e.kind !== 'trooper' && e.kind !== 'watcher')) continue;
      e.alive = false;
      e.gone = true;
      this.puff(e.x, e.y, 12);
    }
    for (const v of this.voices) if (v.vx !== 0 && near(v.t.x, v.t.y)) v.life = Math.min(v.life, 0.4);
  }

  private updateFinale(dt: number): void {
    const prev = this.fin;
    this.fin += dt;
    const T = this.fin;
    const at = (s: number) => prev < s && T >= s;
    const p = this.finBy ?? this.g.player;
    const post = this.g.postFx;
    const cam = this.g.cameras.main;
    this.g.player.invulnT = Math.max(this.g.player.invulnT, 1);

    // (1) time stops: spotlight on ION and the lantern, a second heartbeat
    if (T < 1.3 && post && this.g.cine) {
      const c = this.g.cine;
      const uv = (x: number, y: number) => ({ x: ((x - Math.round(c.x)) * c.zoom) / GAME_W + 0.5, y: ((y - Math.round(c.y)) * c.zoom) / GAME_H + 0.5 });
      post.dark = Math.min(0.7, T * 4);
      post.light = uv(this.finFrom.x, this.finFrom.y);
      post.light2 = uv(p.x, p.y - 6);
      post.lightR = 0.2;
    } else if (post && post.dark > 0) post.dark = Math.max(0, post.dark - dt * 4);
    if (at(0.75)) this.g.heartbeat(1.5);
    if (at(1.3)) {
      this.g.cine = null;
      this.g.cineRelease();
      this.g.flash(0.6);
      this.g.aberration(1.6);
      this.g.shake(5, 0.4);
      this.g.sfx('shock');
      if (post) post.light2 = { x: -1, y: -1 };
    }
    if (T >= 1.3 && T < 3.2) this.dissolveWithin((T - 1.3) * 620);
    if (at(3.2)) this.clearHazards();
    this.beamOn = Math.max(0, this.beamOn - dt * 3);
    // the camera follows the light: sweep left to right along the links, then the face
    if (at(1.9)) this.finCamFrom = cam.scrollX + GAME_W / 2;
    if (T >= 1.9) this.g.cine = { x: this.finaleCamX(T, this.finCamFrom), y: cam.scrollY + GAME_H / 2, zoom: 1 };

    // (2) the constellation: five links, left to right
    for (let i = 0; i < this.finPath.length - 1; i++) {
      const s0 = 2.3 + i * 0.24;
      if (at(s0)) this.g.sfx('star', { pitch: [1, 1.122, 1.26, 1.335, 1.498][i] ?? 1.5, vol: 0.9 });
      if (at(s0 + 0.24)) {
        const q = this.finPath[i + 1];
        this.g.particles.ring(q.x, q.y, COLORS.amberHot);
        this.g.particles.sparks(q.x, q.y, -90, 360, 8, [COLORS.amberHot, COLORS.white]);
      }
    }
    if (at(3.55)) this.g.sfx('swell');
    if (at(4.25)) {
      this.g.flash(0.25);
      this.g.particles.ring(this.face.x, this.face.y, COLORS.amberHot);
      this.spawnVoice('선택하게 해 줘', this.face.x, this.face.y + 92, true);
    }
    if (T >= 4.25 && T < 5.05) this.face.setFrame(`face_warm_${Math.min(7, Math.floor((T - 4.25) / 0.1))}`);
    if (T >= 4.25) {
      const k = Math.min(1, (T - 4.25) / 0.8);
      this.glow.setTint(COLORS.amberHot).setAlpha(Math.max(this.glow.alpha, 0.45 * k));
    }

    // (3) silence, then the bell
    if (at(5.6)) {
      this.g.sfx('bell', { vol: 1 });
      this.face.setFrame('face_calm');
      this.g.shake(2, 0.6);
      this.g.flash(0.15);
      if (post) {
        post.ripple.x = (this.face.x - cam.scrollX) / GAME_W;
        post.ripple.y = (this.face.y - cam.scrollY) / GAME_H;
      }
    }
    if (post) {
      const k = (T - 5.6) / 1.8;
      post.ripple.a = k >= 0 && k < 1 ? 1.6 * (1 - k) : 0;
      post.ripple.r = Math.max(0, k) * 1.3;
    }
    if (T > 5.9) {
      const k = Math.min(1, (T - 5.9) / 2);
      this.face.setAlpha(1 - k);
      this.glow.setAlpha(0.45 * (1 - k));
    }
    // warm voices drift while the simulation is idle
    for (const v of this.voices) {
      v.life -= dt;
      v.t.y -= 10 * dt;
      v.t.setAlpha(Math.max(0, Math.min(1, v.life * 0.8, (2.5 - v.life) * 2)));
    }
    this.voices = this.voices.filter((v) => {
      if (v.life <= 0) v.t.destroy();
      return v.life > 0;
    });
    if (T >= 7.9) {
      // the camera stays on the calm sky where the face was, through the decision
      this.fin = -1;
      if (post) {
        post.dark = 0;
        post.ripple.a = 0;
      }
      this.setState('dead');
      this.onDefeated?.();
    }
  }

  /** Constellation links and the light flowing into the face. */
  private drawFinale(g: Phaser.GameObjects.Graphics): void {
    const T = this.fin;
    const p = this.finBy ?? this.g.player;
    // the taut, glowing tether while time stands still
    if (T < 1.3) {
      const pulse = 0.7 + Math.sin(T * 18) * 0.3;
      g.lineStyle(3, COLORS.amberHot, 0.35 * pulse).lineBetween(p.x, p.y - 6, this.finFrom.x, this.finFrom.y);
      g.lineStyle(1, 0xfff0c0, pulse).lineBetween(p.x, p.y - 6, this.finFrom.x, this.finFrom.y);
    }
    // the shockwave front
    if (T >= 1.3 && T < 3.2) {
      const r = (T - 1.3) * 620;
      const a = Math.max(0, 1 - (T - 1.3) / 1.9);
      g.lineStyle(4, COLORS.amberHot, 0.4 * a).strokeCircle(this.finFrom.x, this.finFrom.y, Math.max(1, r - 6));
      g.lineStyle(2, 0xffffff, 0.8 * a).strokeCircle(this.finFrom.x, this.finFrom.y, Math.max(1, r));
    }
    const fade = T > 6.4 ? Math.max(0, 1 - (T - 6.4) / 1.2) : 1;
    if (fade <= 0) return;
    // links
    for (let i = 0; i < this.finPath.length - 1; i++) {
      const u = Math.max(0, Math.min(1, (T - (2.3 + i * 0.24)) / 0.24));
      if (u <= 0) continue;
      const a = this.finPath[i];
      const b = this.finPath[i + 1];
      const hx = a.x + (b.x - a.x) * u;
      const hy = a.y + (b.y - a.y) * u;
      g.lineStyle(3, COLORS.amberHot, 0.3 * fade).lineBetween(a.x, a.y, hx, hy);
      g.lineStyle(1, 0xfff0c0, 0.95 * fade).lineBetween(a.x, a.y, hx, hy);
      if (u < 1) g.fillStyle(0xffffff, 1).fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
    }
    // light streams into the face
    if (T >= 3.55) {
      const u = Math.min(1, (T - 3.55) / 0.7);
      const e = u * u;
      for (const q of this.finPath) {
        const hx = q.x + (this.face.x - q.x) * e;
        const hy = q.y + (this.face.y - q.y) * e;
        g.lineStyle(1, 0xffd890, 0.55 * fade * (T < 4.6 ? 1 : Math.max(0, 1 - (T - 4.6) / 0.6))).lineBetween(q.x, q.y, hx, hy);
        if (u < 1) g.fillStyle(0xffffff, 1).fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
      }
    }
  }

  // ---------------------------------------------------------------------------

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.stateT += dt;
    this.hurtCd -= dt;
    const p = this.g.focus(this.fxX, this.fyC);
    if (this.state === 'intro') {
      this.face.setAlpha(Math.min(1, this.face.alpha + dt * 0.5));
      this.glow.setAlpha(Math.min(0.25, this.glow.alpha + dt * 0.12));
      return;
    }
    if (this.state === 'dying') {
      if (Math.random() < dt * 40) this.g.particles.emit(this.fxX + rand(-110, 110), this.fyC + rand(-70, 70), { frame: 'px2', speed: [20, 80], angle: -90, spread: 60, life: [1.2, 2.4], gravity: -30, tint: [COLORS.amberHot, 0xffd890, COLORS.white], add: true });
      this.face.setAlpha(Math.max(0, 1 - this.stateT / 3.2));
      this.glow.setAlpha(Math.max(0, 0.4 - this.stateT / 8));
      if (this.stateT > 3.4 && this.state === 'dying') {
        this.setState('dead');
        this.onDefeated?.();
      }
      return;
    }
    if (!this.active || this.defeated) return;

    // lantern lighting: hooking one lights it
    if (this.phase === 4) for (const l of this.lanterns) if (!l.lit && this.g.actors().some((a) => a.tetheredTo() === l.anchor)) this.lightLantern(l);

    // cadence: phase 4 slows down as lanterns are lit
    const lit = this.lanterns.filter((l) => l.lit).length;
    const pace = this.phase === 4 ? 1.25 - lit * 0.12 : 1;
    this.atkT -= dt * pace;
    this.droneT -= dt * pace;
    this.voiceT -= dt;

    // floating citizen voices (atmosphere, all phases from 3 on)
    if (this.phase >= 3 && this.voiceT <= 0) {
      this.voiceT = 1.6;
      this.spawnVoice(VOICES[Math.floor(rand(0, VOICES.length))], this.g.cameras.main.scrollX + (Math.random() < 0.5 ? -10 : GAME_W + 10), this.g.cameras.main.scrollY + rand(30, 150), false);
    }

    // eye searchlight (phases 1 & 4): tracks slowly, a held lock calls a strike
    if (this.phase === 1 || this.phase === 4) {
      const ex = this.fxX + (Math.sin(this.t * 0.4) > 0 ? 38 : -38);
      const ey = this.fyC - 20;
      const want = Math.atan2(p.y - ey, p.x - ex);
      let d = want - this.beamAng;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.beamAng += Math.max(-0.7 * dt, Math.min(0.7 * dt, d));
      this.beamOn = Math.min(1, this.beamOn + dt);
      const da = Math.abs(d);
      if (da < 0.07 && !p.dead) {
        this.lockT += dt;
        if (this.lockT > 0.7) {
          this.lockT = -1.6;
          this.strike(p.x);
        }
      } else this.lockT = Math.max(Math.min(this.lockT, 0.7) - dt * 0.5, this.lockT < 0 ? this.lockT + dt : 0);
    } else this.beamOn = Math.max(0, this.beamOn - dt * 2);

    // drones (phases 1 & 4)
    if ((this.phase === 1 || this.phase === 4) && this.droneT <= 0) {
      this.droneT = 7;
      const alive = this.g.combat.enemies.filter((e) => e.alive && e.kind === 'drone').length;
      for (let i = alive; i < 2; i++) {
        const e = this.g.combat.spawn({ kind: 'drone', x: rand(80, this.arenaW - 80), y: 120 });
        this.g.particles.ring(e.x, e.y, COLORS.cyan);
      }
    }
    // screens shoot
    if (this.phase === 1) {
      for (const s of this.screens) {
        if (s.hp <= 0) continue;
        s.bob += dt;
        s.y += Math.sin(s.bob * 1.4) * 8 * dt;
        const q = this.g.focus(s.x, s.y);
        if (Math.random() < dt * 0.33 && !q.dead) {
          const dx = q.x - s.x;
          const dy = q.y - 6 - s.y;
          const dd = Math.hypot(dx, dy) || 1;
          this.g.combat.projectiles.spawn(s.x, s.y, (dx / dd) * 170, (dy / dd) * 170, 'enemy', { x: s.x, y: s.y });
        }
      }
    }
    // phase 2: trains, cranes, guards
    if (this.phase === 2 || this.phase === 4) {
      if (this.atkT <= 0) {
        this.atkT = this.phase === 2 ? 3.2 : 4;
        if (!this.train.active && Math.random() < 0.55) this.startTrain();
        else this.startCrane();
      }
      if (this.phase === 2) {
        this.guardT -= dt;
        if (this.guardT <= 0) {
          this.guardT = 11;
          const alive = this.g.combat.enemies.filter((e) => e.alive && e.kind === 'trooper').length;
          if (alive < 2) {
            const e = this.g.combat.spawn({ kind: 'trooper', x: p.x < this.arenaW / 2 ? this.arenaW - 60 : 60, y: this.floorY });
            this.g.particles.ring(e.x, e.y - 20, COLORS.crimsonHot);
          }
        }
      }
    }
    // phase 3: static walls and remembered bosses
    if (this.phase === 3) {
      if (this.state === 'idle' && this.atkT <= 0) {
        this.atkT = 3.4;
        const r = Math.random();
        if (r < 0.5) this.startWave();
        else if (r < 0.75) this.startSlam();
        else this.startScaleRain();
      }
      if (this.state === 'wave' && this.waves.length === 0) this.setState('idle');
    }
    if (this.phase === 4 && this.atkT <= 0) {
      this.atkT = 3.6;
      if (Math.random() < 0.5) this.startWave();
      else this.startScaleRain();
    }

    this.updateHazards(dt);
  }

  private hurtActor(a: Actor, fromX: number, hazard = false): void {
    if (a.invulnT > 0 || a.dead) return;
    if (a === this.g.player) {
      if (this.hurtCd > 0) return;
      this.hurtCd = 0.3;
    }
    a.hurt(1, fromX, hazard);
  }

  /** The player tethered to a lantern (whoever lit it). */
  private lighterOf(l: { anchor: AnchorPoint }): Actor {
    return this.g.actors().find((a) => a.tetheredTo() === l.anchor) ?? this.g.player;
  }

  private spawnVoice(text: string, x: number, y: number, warm: boolean): void {
    const t = this.sc.add.bitmapText(x, y, 'galmuri9', text).setOrigin(0.5).setDepth(DEPTH.fx).setTint(warm ? COLORS.amberHot : RAMPS.cyan[5]).setAlpha(0);
    const cam = this.g.cameras.main;
    this.voices.push({ t, vx: warm ? 0 : x < cam.scrollX + GAME_W / 2 ? rand(20, 40) : -rand(20, 40), life: warm ? 2.5 : 6 });
    if (!warm) this.g.sfx('echo', { vol: 0.25, pitch: rand(0.8, 1.3) });
  }

  private strike(x: number): void {
    this.g.sfx('alarm', { vol: 0.5, pitch: 1.4 });
    for (let i = 0; i < 3; i++) {
      const tx = Math.max(30, Math.min(this.arenaW - 30, x + (i - 1) * 44));
      const ret = this.sc.add.image(tx, this.floorY - 8, 'ch3', 'reticle').setDepth(DEPTH.fx);
      const img = this.sc.add.image(tx, this.g.cameras.main.scrollY - 40 - i * 30, 'ch3', 'missile').setDepth(DEPTH.fx);
      this.missiles.push({ x: tx, y: img.y, tx, t: -0.35 * i, img, ret });
    }
  }

  private startTrain(): void {
    this.train.active = true;
    this.train.t = 0;
    this.train.warn = 1.1;
    this.g.sfx('horn', { vol: 0.9 });
  }

  private startCrane(): void {
    this.crane.dir = Math.random() < 0.5 ? 1 : -1;
    this.crane.x = this.crane.dir > 0 ? -60 : this.arenaW + 60;
    this.crane.warn = 1;
    this.crane.t = 0;
    this.g.sfx('alert', { vol: 0.6, pitch: 0.8 });
  }

  private startWave(): void {
    this.setState('wave');
    const dir = Math.random() < 0.5 ? 1 : -1;
    // the gap is always reachable: a perch height or a grapple height
    const gapY = [this.floorY - 30, 15 * TILE - 20, 11 * TILE - 20][Math.floor(rand(0, 3))];
    this.waves.push({ x: dir > 0 ? 8 : this.arenaW - 8, dir, gapY, hit: new Set() });
    this.face.setFrame('face_speak');
    this.g.sfx('pulse', { vol: 0.8, pitch: 0.6 });
  }

  private startSlam(): void {
    const p = this.g.focus(this.fxX, this.floorY);
    this.slam.x = Math.max(60, Math.min(this.arenaW - 60, p.x));
    this.slam.t = 0;
    this.g.sfx('roar', { vol: 0.5, pitch: 1.2 });
  }

  private startScaleRain(): void {
    const cam = this.g.cameras.main;
    for (let i = 0; i < 9; i++) {
      const x = cam.scrollX + 20 + i * ((GAME_W - 40) / 8) + rand(-10, 10);
      this.scales.push({ x, y: cam.scrollY - 10 - rand(0, 60), ph: rand(0, 6), img: this.sc.add.image(x, 0, 'boss2', 'noc_scale_0').setDepth(DEPTH.fx - 2) });
    }
    this.g.sfx('wing', { vol: 0.5, pitch: 1.3 });
  }

  private updateHazards(dt: number): void {
    const actors = this.g.actors();
    // missiles
    for (const m of this.missiles) {
      m.t += dt;
      m.ret.setVisible(Math.floor(m.t * 12) % 2 === 0 || m.t > 0.6).setRotation(m.t * 3);
      if (m.t > 0.75) {
        m.y += 620 * dt;
        if (m.y >= this.floorY - 6) {
          this.g.combat.boom(m.x, this.floorY - 8, false);
          this.g.shake(3, 0.2);
          for (const a of actors) if (Math.abs(a.x - m.x) < 26 && a.feetY > this.floorY - 40 && !a.dead) this.hurtActor(a, m.x);
          m.t = 99;
        }
      }
      m.img.setPosition(Math.round(m.x), Math.round(m.y));
    }
    this.missiles = this.missiles.filter((m) => {
      if (m.t >= 99) {
        m.img.destroy();
        m.ret.destroy();
      }
      return m.t < 99;
    });
    // train through the arena (roof is a platform; the body hits)
    const tr = this.train;
    const railY = 16 * TILE;
    const roofY = railY - 28;
    if (tr.active) {
      if (tr.warn > 0) tr.warn -= dt;
      else {
        tr.t += dt;
        const front = -40 + tr.t * 300;
        for (let i = 0; i < 3; i++) {
          const c = tr.cars[i];
          const nx = front - (3 - i) * 96 + 2;
          c.dx = c.x > -9000 ? nx - c.x : 0;
          c.x = nx;
          c.y = roofY;
          c.vx = 300;
        }
        const tail = front - 288;
        for (const a of actors) {
          const pb = a.body;
          if (!a.dead && pb.x + pb.w / 2 > tail && pb.x - pb.w / 2 < front && pb.y + pb.h / 2 > roofY + 4 && pb.y - pb.h / 2 < railY) this.hurtActor(a, front + 40, true);
        }
        if (tail > this.arenaW + 20) {
          tr.active = false;
          for (const c of tr.cars) c.x = -9999;
        }
      }
    }
    const dev = this.g.gimmicks.devices3;
    dev.extraPlats = tr.active && tr.warn <= 0 ? tr.cars : [];
    // crane load sweeping just above the floor
    const cr = this.crane;
    if (cr.warn > 0) cr.warn -= dt;
    else if (cr.x > -9000) {
      cr.x += cr.dir * 230 * dt;
      const cy = this.floorY - 20 - Math.abs(Math.sin(cr.x / 90)) * 6;
      cr.img.setVisible(true).setPosition(Math.round(cr.x), Math.round(cy));
      for (const a of actors) if (!a.dead && Math.abs(a.body.x - cr.x) < 24 && Math.abs(a.body.y - cy) < 22) this.hurtActor(a, cr.x - cr.dir * 30, true);
      if (cr.x < -80 || cr.x > this.arenaW + 80) {
        cr.x = -9999;
        cr.img.setVisible(false);
      }
    }
    // static walls with a gap
    for (const w of this.waves) {
      w.x += w.dir * 210 * dt;
      for (const a of actors) {
        if (!w.hit.has(a) && !a.dead && Math.abs(a.body.x - w.x) < 7 && Math.abs(a.body.y - w.gapY) > 30) {
          w.hit.add(a);
          this.hurtActor(a, w.x - w.dir * 20, true);
        }
      }
    }
    this.waves = this.waves.filter((w) => w.x > -10 && w.x < this.arenaW + 10);
    if (this.waves.length === 0 && this.face.frame.name === 'face_speak' && this.state !== 'dying') this.face.setFrame('face_idle');
    // remembered Archivist arm slam
    const s = this.slam;
    if (s.t >= 0) {
      s.t += dt;
      if (s.t > 0.8 && s.t - dt <= 0.8) {
        this.g.sfx('slam');
        this.g.shake(6, 0.35);
        this.g.particles.landDust(s.x, this.floorY, 1);
        s.shocks.push({ x: s.x, dir: -1, t: 0 }, { x: s.x, dir: 1, t: 0 });
        for (const a of actors) if (Math.abs(a.x - s.x) < 22 && a.feetY > this.floorY - 40) this.hurtActor(a, s.x);
      }
      if (s.t > 1.4) s.t = -1;
    }
    for (const k of s.shocks) {
      k.t += dt;
      k.x += k.dir * 230 * dt;
      for (const a of actors) if (Math.abs(a.x - k.x) < 10 && a.feetY > this.floorY - 14 && !a.dead) this.hurtActor(a, k.x - k.dir * 10);
    }
    s.shocks = s.shocks.filter((k) => k.t < 1.6);
    // remembered NOCTURNE scale rain
    for (const sc of this.scales) {
      sc.y += 80 * dt;
      sc.ph += dt * 2.4;
      const x = sc.x + Math.sin(sc.ph) * 18;
      sc.img.setPosition(Math.round(x), Math.round(sc.y));
      for (const a of actors) {
        const pb = a.body;
        if (!a.dead && sc.y < 9000 && Math.abs(x - pb.x) < pb.w / 2 + 2 && Math.abs(sc.y - pb.y) < pb.h / 2) {
          this.hurtActor(a, x);
          sc.y = 9999;
        }
      }
      if (sc.y > this.floorY) sc.y = 9999;
    }
    this.scales = this.scales.filter((sc) => {
      if (sc.y > 9000) sc.img.destroy();
      return sc.y < 9000;
    });
    // voices drift and fade
    for (const v of this.voices) {
      v.life -= dt;
      v.t.x += v.vx * dt;
      v.t.y -= (v.vx === 0 ? 14 : 3) * dt;
      v.t.setAlpha(Math.min(1, v.life * 0.8, (6 - v.life) * 1.5) * (v.vx === 0 ? 1 : 0.7));
    }
    this.voices = this.voices.filter((v) => {
      if (v.life <= 0) v.t.destroy();
      return v.life > 0;
    });
  }

  private clearHazards(): void {
    for (const m of this.missiles) {
      m.img.destroy();
      m.ret.destroy();
    }
    this.missiles = [];
    this.waves = [];
    for (const sc of this.scales) sc.img.destroy();
    this.scales = [];
    this.slam.t = -1;
    this.slam.shocks = [];
    this.train.active = false;
    for (const c of this.train.cars) c.x = -9999;
    this.crane.x = -9999;
    this.crane.img.setVisible(false);
    if (this.g.gimmicks) this.g.gimmicks.devices3.extraPlats = [];
    for (const e of this.g.combat.enemies) {
      if (e.alive && (e.kind === 'drone' || e.kind === 'trooper')) {
        e.alive = false;
        e.gone = true;
        this.g.combat.boom(e.x, e.y, false);
      }
    }
  }

  // ---------------------------------------------------------------------------

  render(_alpha: number, _dt: number): void {
    const g = this.fx;
    g.clear();
    if (this.fin >= 0) this.updateFinale(Math.min(0.05, this.sc.game.loop.delta / 1000));
    if (this.state === 'dead') return;
    // the face drifts and glitches when hurt
    const hurt = [...this.screens, ...this.pylons, ...this.eyes].some((p) => p.flash > 0);
    for (const p of [...this.screens, ...this.pylons, ...this.eyes]) p.flash -= 1 / 60;
    this.face.setPosition(Math.round(this.fxX + Math.sin(this.t * 0.3) * 6), Math.round(this.fyC + Math.sin(this.t * 0.5) * 4));
    if (this.state !== 'dying' && this.state !== 'finale') this.face.setFrame(hurt ? 'face_hurt' : this.waves.length ? 'face_speak' : 'face_idle');
    this.glow.setPosition(this.face.x, this.face.y);
    for (const s of this.screens) if (s.img.visible) s.img.setPosition(Math.round(s.x), Math.round(s.y)).setFrame(s.flash > 0 ? 'screen_2' : `screen_${Math.floor(this.t * 2) % 2}`);
    for (const s of this.pylons) if (s.img.visible) s.img.setPosition(s.x, s.y + 20).setTint(s.flash > 0 ? 0xffffff : 0xffffff);
    for (let i = 0; i < this.eyes.length; i++) {
      const e = this.eyes[i];
      e.x = this.face.x + (i ? 38 : -38);
      e.y = this.face.y - 20;
      if (e.img.visible) e.img.setPosition(Math.round(e.x), Math.round(e.y)).setFrame(this.state === 'wave' ? 'eye_shut' : e.flash > 0 ? 'eye_hurt' : 'eye_open');
    }
    for (const l of this.lanterns) {
      if (!l.img.visible) continue;
      // unlit lanterns beckon: a slow warm pulse and a gentle bob so they read against the city
      const bob = l.lit ? 0 : Math.round(Math.sin(this.t * 2.2 + l.x) * 1.5);
      l.img.setPosition(l.x, l.y + bob);
      l.glow.setPosition(l.x, l.y + bob).setAlpha(l.lit ? 0.6 + Math.sin(this.t * 5 + l.x) * 0.08 : 0.3 + Math.sin(this.t * 3 + l.x) * 0.12);
    }
    // searchlight from the eyes
    if (this.beamOn > 0) {
      const ex = this.face.x + (Math.sin(this.t * 0.4) > 0 ? 38 : -38);
      const ey = this.face.y - 20;
      const len = 520;
      const a0 = this.beamAng - 0.07;
      const a1 = this.beamAng + 0.07;
      const locking = this.lockT > 0.1;
      g.fillStyle(locking ? RAMPS.crimson[5] : 0xf0fffe, (locking ? 0.22 : 0.12) * this.beamOn);
      g.fillTriangle(ex, ey, ex + Math.cos(a0) * len, ey + Math.sin(a0) * len, ex + Math.cos(a1) * len, ey + Math.sin(a1) * len);
    }
    // train warning on the rail + the rail itself
    const railY = 16 * TILE;
    const cam = this.g.cameras.main;
    if (this.train.active && this.train.warn > 0 && Math.floor(this.t * 12) % 2 === 0) {
      g.fillStyle(RAMPS.crimson[5], 0.85);
      for (let x = cam.scrollX; x < cam.scrollX + GAME_W; x += 6) g.fillRect(Math.round(x), railY, 3, 1);
    }
    for (let i = 0; i < 3; i++) {
      const c = this.train.cars[i];
      const vis = this.train.active && this.train.warn <= 0 && c.x > cam.scrollX - 100 && c.x < cam.scrollX + GAME_W + 100;
      this.train.imgs[i].setVisible(vis);
      if (vis) this.train.imgs[i].setPosition(Math.round(c.x - 2), Math.round(c.y));
    }
    if (this.crane.x > -9000 && this.crane.warn > 0 && Math.floor(this.t * 12) % 2 === 0) {
      g.fillStyle(RAMPS.amber[4], 0.8);
      const ex = this.crane.dir > 0 ? cam.scrollX + 4 : cam.scrollX + GAME_W - 8;
      g.fillRect(Math.round(ex), this.floorY - 30, 4, 20);
    }
    // static walls
    for (const w of this.waves) {
      for (let y = Math.max(0, cam.scrollY); y < this.floorY; y += 2) {
        if (Math.abs(y - w.gapY) < 30) continue;
        const flick = (Math.floor(this.t * 30) + y) % 3;
        g.fillStyle(flick ? RAMPS.cyan[5] : 0xffffff, 0.85).fillRect(Math.round(w.x) - 3 + ((y * 7) % 5) - 2, y, 6, 2);
      }
      g.fillStyle(RAMPS.amber[4], 0.9).fillRect(Math.round(w.x) - 6, w.gapY - 31, 12, 1).fillRect(Math.round(w.x) - 6, w.gapY + 30, 12, 1);
    }
    // remembered arm slam
    const s = this.slam;
    if (s.t >= 0) {
      const k = Math.min(1, s.t / 0.8);
      const y = s.t < 0.8 ? cam.scrollY - 60 + k * k * (this.floorY - cam.scrollY - 20) : this.floorY - 70;
      this.slam.img.setVisible(true).setPosition(Math.round(s.x), Math.round(y)).setAlpha(0.75).setTint(RAMPS.cyan[5]);
      if (s.t < 0.8 && Math.floor(this.t * 14) % 2 === 0) {
        g.fillStyle(RAMPS.crimson[5], 0.9);
        for (let i = -12; i <= 12; i += 3) g.fillRect(Math.round(s.x + i), this.floorY - 2, 2, 1);
      }
    } else this.slam.img.setVisible(false);
    for (const k of s.shocks) {
      g.fillStyle(RAMPS.cyan[5], Math.max(0, 1 - k.t / 1.6));
      g.fillRect(Math.round(k.x) - 3, this.floorY - 10, 6, 10);
    }
    if (this.fin >= 0) this.drawFinale(g);
  }

  reset(): void {
    // the city doesn't heal on a retry, but the hazards stop
    this.clearHazards();
    this.lockT = -1;
    this.atkT = 3;
    if (this.active && !this.defeated) this.setPhase(this.phase);
  }

  destroy(): void {
    this.clearHazards();
    const post = this.g.postFx;
    if (post) {
      post.dark = 0;
      post.ripple.a = 0;
    }
    this.g.cine = null;
    for (const o of [this.face, this.glow, this.fx, this.crane.img, this.slam.img]) o.destroy();
    for (const p of [...this.screens, ...this.pylons, ...this.eyes]) p.img.destroy();
    for (const l of this.lanterns) {
      l.img.destroy();
      l.glow.destroy();
    }
    for (const i of this.train.imgs) i.destroy();
    for (const v of this.voices) v.t.destroy();
  }
}
