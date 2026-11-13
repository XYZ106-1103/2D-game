import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, TILE } from '../../config.ts';
import { COLORS, RAMPS } from '../../art/palette.ts';
import { rand } from '../../core/math.ts';
import type { AnchorPoint } from '../Grapple.ts';
import type { HitKind, HitResult } from '../enemies/Enemy.ts';
import type { GameScene } from '../../scenes/GameScene.ts';

// Geometry baked by tools/art/boss2.ts
const WING = { w: 116, h: 176, rootX: 2, rootY: 84 };
const LENS = { fore: [66, -42], hind: [44, 46] } as const;
const FLAP = [1, 0.88, 0.7, 0.52, 0.7, 0.88];
const LIFT = 0.55;
const FLOOR_ROW = 19;
const LENS_HP = 4;

interface Lens {
  side: -1 | 1;
  part: 'fore' | 'hind';
  hp: number;
  lastHit: number;
  flash: number;
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  anchor: AnchorPoint;
}

interface Scale {
  x: number;
  y: number;
  vy: number;
  ph: number;
  amp: number;
  img: Phaser.GameObjects.Image;
}

interface Moth {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  alive: boolean;
  img: Phaser.GameObjects.Image;
}

interface Ring {
  r: number;
  gap: number;
  hit: boolean;
}

/**
 * PROJECT NOCTURNE — the moth that eats nights. Three phases:
 *   1. four wing lenses — scale rain, gales, telegraphed dives
 *   2. two lenses left — it takes the light: eclipse, mothling swarms
 *   3. wings torn — it clings to the mast, core exposed, memory rings
 */
export class Nocturne {
  active = false;
  defeated = false;
  phase = 1;
  x: number;
  y: number;
  private vx = 0;
  private vy = 0;
  private g: GameScene;
  private sc: Phaser.Scene;
  private state = 'intro';
  private stateT = 0;
  private t = 0;
  private flapT = 0;
  private flapRate = 8;
  private frame = 0;
  private lenses: Lens[] = [];
  private coreHp = 12;
  private readonly coreMax = 12;
  /** After a hit the moth folds its wings: lenses can't be hooked for a moment. */
  private guardT = 0;
  private coreLast = -1;
  private coreFlash = 0;
  private bodySpr: Phaser.GameObjects.Image;
  private coreSpr: Phaser.GameObjects.Image;
  private wingL: Phaser.GameObjects.Image;
  private wingR: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private fx: Phaser.GameObjects.Graphics;
  private scales: Scale[] = [];
  private moths: Moth[] = [];
  private rings: Ring[] = [];
  private attackIdx = 0;
  private hurtCd = 0;
  private dive: { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number } | null = null;
  private galeDir = 0;
  private dark = 0;
  private corePart: AnchorPoint;
  private readonly floorY = FLOOR_ROW * TILE;
  private readonly arenaW: number;
  onDefeated: (() => void) | null = null;
  onPhase: ((p: number) => void) | null = null;

  constructor(g: GameScene) {
    this.g = g;
    this.sc = g as unknown as Phaser.Scene;
    this.arenaW = g.level.world.pixelWidth;
    this.x = this.arenaW / 2;
    this.y = -120;
    const sc = this.sc;
    this.aura = sc.add.image(this.x, this.y, 'fx', 'glow128').setDepth(DEPTH.objects - 3).setBlendMode(Phaser.BlendModes.ADD).setTint(RAMPS.dawn[5]).setAlpha(0.3).setScale(2);
    this.wingL = sc.add.image(0, 0, 'boss2', 'noc_wing_0_0').setDepth(DEPTH.objects + 2).setFlipX(true).setOrigin((WING.w - WING.rootX) / WING.w, WING.rootY / WING.h);
    this.wingR = sc.add.image(0, 0, 'boss2', 'noc_wing_0_0').setDepth(DEPTH.objects + 2).setOrigin(WING.rootX / WING.w, WING.rootY / WING.h);
    this.bodySpr = sc.add.image(this.x, this.y, 'boss2', 'noc_body').setDepth(DEPTH.objects + 4);
    this.coreSpr = sc.add.image(this.x, this.y, 'boss2', 'noc_core_0').setDepth(DEPTH.objects + 5).setVisible(false);
    this.fx = sc.add.graphics().setDepth(DEPTH.fx - 1);
    for (const side of [-1, 1] as const) {
      for (const part of ['fore', 'hind'] as const) {
        const lens: Lens = {
          side,
          part,
          hp: LENS_HP,
          lastHit: -1,
          flash: 0,
          glow: sc.add.image(0, 0, 'fx', 'glow32').setDepth(DEPTH.objects + 3).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.magenta).setAlpha(0.6),
          img: sc.add.image(0, 0, 'boss2', 'noc_lens').setDepth(DEPTH.objects + 3),
          anchor: null as unknown as AnchorPoint,
        };
        const self = this;
        lens.anchor = {
          isEnemy: true,
          hookRadius: 12,
          get x() {
            return self.lensPos(lens)[0];
          },
          get y() {
            return self.lensPos(lens)[1];
          },
          get alive() {
            return lens.hp > 0 && self.active && !self.defeated && self.guardT <= 0;
          },
        };
        this.lenses.push(lens);
      }
    }
    const self = this;
    this.corePart = {
      isEnemy: true,
      hookRadius: 14,
      get x() {
        return self.x;
      },
      get y() {
        return self.y + 24;
      },
      get alive() {
        return self.phase === 3 && self.coreHp > 0 && self.active && !self.defeated && self.guardT <= 0;
      },
    };
  }

  get totalHp(): number {
    return this.lenses.reduce((s, l) => s + Math.max(0, l.hp), 0) + Math.max(0, this.coreHp);
  }
  get maxHp(): number {
    return this.lenses.length * LENS_HP + this.coreMax;
  }
  /** Wing art per side: bit0 fore lens broken, bit1 hind lens broken. */
  private wingVariant(side: -1 | 1): number {
    let v = 0;
    for (const l of this.lenses) if (l.side === side && l.hp <= 0) v |= l.part === 'fore' ? 1 : 2;
    return v;
  }

  private lensPos(l: Lens): [number, number] {
    const s = FLAP[this.frame];
    const [lx, ly] = LENS[l.part];
    const rx = this.x + l.side * 6;
    const ry = this.y - 10;
    return [rx + l.side * lx * s, ry + ly - (1 - s) * lx * LIFT];
  }

  hookTargets(): AnchorPoint[] {
    if (!this.active || this.defeated) return [];
    const out: AnchorPoint[] = [];
    if (this.guardT <= 0) for (const l of this.lenses) if (l.hp > 0) out.push(l.anchor);
    if (this.phase === 3 && this.coreHp > 0 && this.guardT <= 0) out.push(this.corePart);
    return out;
  }

  begin(): void {
    this.active = true;
    this.setState('idle');
  }

  private setState(s: string): void {
    this.state = s;
    this.stateT = 0;
  }

  // ---------------------------------------------------------------------------
  // Damage
  // ---------------------------------------------------------------------------

  hit(x: number, y: number, w: number, h: number, id: number, dmg: number, kind: HitKind, dirX: number): HitResult {
    if (!this.active || this.defeated) return 'none';
    const inRect = (px: number, py: number, r: number) => px + r > x && px - r < x + w && py + r > y && py - r < y + h;
    // mothlings pop on any slash
    for (const m of this.moths) {
      if (m.alive && inRect(m.x, m.y, 6)) {
        m.alive = false;
        m.img.setVisible(false);
        this.g.particles.sparks(m.x, m.y, -90, 360, 8, [RAMPS.dawn[7], COLORS.white]);
        this.g.sfx('hit', { pitch: 1.4 });
      }
    }
    for (const l of this.lenses) {
      if (l.hp <= 0 || l.lastHit === id) continue;
      const [lx, ly] = this.lensPos(l);
      if (!inRect(lx, ly, 11)) continue;
      l.lastHit = id;
      l.hp -= dmg;
      l.flash = 0.12;
      this.g.combat.feedback(l.hp <= 0 ? 'kill' : 'hit', lx, ly, dirX, kind);
      if (l.hp <= 0) this.breakLens(l);
      else this.flinch();
      return l.hp <= 0 ? 'kill' : 'hit';
    }
    if (this.phase === 3 && this.coreHp > 0 && this.coreLast !== id && inRect(this.x, this.y + 24, 13)) {
      this.coreLast = id;
      this.coreHp -= dmg;
      this.coreFlash = 0.12;
      this.g.combat.feedback(this.coreHp <= 0 ? 'kill' : 'hit', this.x, this.y + 24, dirX, kind);
      if (this.coreHp <= 0) this.die();
      else if (kind === 'zip') this.flinch();
      return this.coreHp <= 0 ? 'kill' : 'hit';
    }
    if (inRect(this.x, this.y, 22)) {
      if (this.coreLast === id) return 'none';
      this.coreLast = id;
      this.g.combat.feedback('block', this.x - dirX * 14, this.y, dirX, kind);
      return 'block';
    }
    return 'none';
  }

  /** Wing snap: shove the player away and close the lenses briefly. */
  private flinch(): void {
    this.guardT = 1.1;
    const p = this.g.player;
    const dir = p.x >= this.x ? 1 : -1;
    p.grapple.release();
    p.body.vx = dir * 260;
    p.body.vy = -200;
    this.g.sfx('wing', { vol: 0.7, pitch: 1.3 });
    this.flapT += 2;
  }

  private breakLens(l: Lens): void {
    const [lx, ly] = this.lensPos(l);
    this.g.combat.boom(lx, ly, true);
    this.g.sfx('shatter');
    this.g.slowmo(0.3, 0.5);
    this.g.flash(0.3);
    this.g.shake(6, 0.4);
    for (let i = 0; i < 14; i++) this.g.particles.emit(lx, ly, { frame: `shard_${i % 4}`, speed: [100, 260], angle: -90, spread: 300, gravity: 500, life: [0.8, 1.3], spin: rand(-14, 14), tint: [RAMPS.magenta[5], RAMPS.dawn[7], COLORS.white] });
    const left = this.lenses.filter((o) => o.hp > 0).length;
    const next = left === 0 ? 3 : left <= 2 ? 2 : 1;
    if (next !== this.phase) {
      this.phase = next;
      this.setState('stagger');
      if (next === 3) {
        this.bodySpr.setFrame('noc_body_open');
        this.coreSpr.setVisible(true);
        this.clearMinions();
      }
      this.onPhase?.(next);
    } else if (this.state !== 'dive') this.setState('stagger');
  }

  private die(): void {
    this.defeated = true;
    this.setState('dying');
    this.g.slowmo(0.3, 1.6);
    this.g.sfx('screech', { vol: 1, pitch: 0.6 });
    this.clearMinions();
    this.rings = [];
  }

  private clearMinions(): void {
    for (const m of this.moths) m.img.destroy();
    this.moths = [];
    for (const s of this.scales) s.img.destroy();
    this.scales = [];
  }

  // ---------------------------------------------------------------------------
  // Behaviour
  // ---------------------------------------------------------------------------

  private moveTo(tx: number, ty: number, k: number, dt: number): void {
    this.vx += ((tx - this.x) * k - this.vx * 2.2) * dt * 4;
    this.vy += ((ty - this.y) * k - this.vy * 2.2) * dt * 4;
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.stateT += dt;
    this.hurtCd -= dt;
    this.coreFlash -= dt;
    this.guardT -= dt;
    for (const l of this.lenses) l.flash -= dt;
    const p = this.g.player;
    const k = this.phase === 3 ? 1.3 : this.phase === 2 ? 1.15 : 1;
    const midX = this.arenaW / 2;
    this.flapRate = 8;

    switch (this.state) {
      case 'intro':
        this.moveTo(midX, 160, 0.8, dt);
        this.flapRate = 10;
        break;
      case 'idle': {
        if (this.phase === 3) {
          // clinging to the antenna crown, shuddering
          this.moveTo(midX + Math.sin(this.t * 1.3) * 26, 168 + Math.sin(this.t * 2.6) * 6, 1.2, dt);
          this.flapRate = 4;
        } else {
          const tx = midX + Math.sin(this.t * 0.55) * 150;
          const ty = 162 + Math.sin(this.t * 1.1) * 16;
          this.moveTo(tx, ty, 0.9, dt);
        }
        if (this.stateT > 1.2 / k) this.nextAttack();
        break;
      }
      case 'scales': {
        this.moveTo(this.x, 150, 0.8, dt);
        const waves = this.phase === 3 ? 4 : 3;
        const gap = 0.55 / k;
        const wave = Math.floor(this.stateT / gap);
        if (wave < waves && this.stateT - dt < wave * gap + 0.001 && this.stateT >= wave * gap) this.shedScales(wave);
        if (this.stateT > waves * gap + 0.6) this.setState('idle');
        break;
      }
      case 'gale_wind': {
        // wings raised: telegraph
        this.moveTo(this.x, 152, 0.8, dt);
        this.flapRate = 0;
        this.frame = 3;
        if (this.stateT > 0.7) {
          this.galeDir = p.x < this.x ? -1 : 1;
          this.setState('gale');
          this.g.sfx('wing', { vol: 1 });
          this.g.shake(4, 0.4);
        }
        break;
      }
      case 'gale': {
        this.flapRate = 18;
        this.vx *= 0.9;
        this.vy *= 0.9;
        const b = p.body;
        if (!p.dead) b.vx += this.galeDir * (b.onGround ? 520 : 820) * dt;
        if (Math.random() < 0.7) {
          const y = this.g.cameras.main.scrollY + rand(20, GAME_H - 20);
          this.g.particles.emit(this.x + this.galeDir * 40, y, { frame: 'speedline', speed: [380, 460], angle: this.galeDir > 0 ? 0 : 180, spread: 3, life: [0.5, 0.6], tint: RAMPS.dawn[8], alpha: 0.5, align: true });
        }
        if (this.stateT % 0.5 < dt) this.g.sfx('wing', { vol: 0.6 });
        if (this.stateT > 1.8) this.setState('idle');
        break;
      }
      case 'dive_rise': {
        // climb, pick a lane through the player, telegraph the arc
        const fromLeft = p.x > midX;
        const x0 = fromLeft ? 90 : this.arenaW - 90;
        this.moveTo(x0, 130, 1.4, dt);
        if (this.stateT > 0.9) {
          const x1 = fromLeft ? this.arenaW - 90 : 90;
          this.dive = { x0: this.x, y0: this.y, cx: p.x, cy: this.floorY + 40, x1, y1: 140 };
          this.setState('dive_warn');
          this.g.sfx('screech', { vol: 0.8 });
        }
        break;
      }
      case 'dive_warn':
        this.vx *= 0.85;
        this.vy *= 0.85;
        if (this.stateT > 0.75 / Math.min(1.15, k)) {
          this.setState('dive');
          this.g.sfx('dive');
        }
        break;
      case 'dive': {
        const d = this.dive!;
        const u = Math.min(1, this.stateT / 1.05);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const nx = (1 - e) * (1 - e) * d.x0 + 2 * (1 - e) * e * d.cx + e * e * d.x1;
        const ny = (1 - e) * (1 - e) * d.y0 + 2 * (1 - e) * e * d.cy + e * e * d.y1;
        this.vx = (nx - this.x) / dt;
        this.vy = (ny - this.y) / dt;
        this.flapRate = 3;
        if (Math.random() < 0.6) this.g.particles.emit(this.x + rand(-40, 40), this.y + rand(-20, 20), { frame: 'px2', speed: [10, 40], life: [0.4, 0.7], tint: [RAMPS.dawn[7], RAMPS.magenta[5]], add: true });
        if (u >= 1) {
          this.vx = this.vy = 0;
          this.setState('dive_rest');
        }
        break;
      }
      case 'dive_rest':
        // vulnerable: hovering low and slow after the dive
        this.moveTo(this.x, 185, 0.4, dt);
        this.flapRate = 5;
        if (this.stateT > 1.4) this.setState('idle');
        break;
      case 'swarm':
        this.moveTo(this.x, 150, 0.8, dt);
        if (this.stateT > 0.4 && this.stateT - dt <= 0.4) {
          for (let i = 0; i < 4; i++) this.spawnMoth(this.x + (i < 2 ? -50 : 50), this.y + (i % 2 ? 30 : -10));
          this.g.sfx('screech', { vol: 0.5, pitch: 1.6 });
        }
        if (this.stateT > 1.2) this.setState('idle');
        break;
      case 'rings':
        this.moveTo(midX, 168, 1.2, dt);
        this.flapRate = 4;
        if (this.stateT > 0.5 && this.stateT - dt <= 0.5) this.emitRing();
        if (this.stateT > 1.3 && this.stateT - dt <= 1.3) this.emitRing();
        if (this.stateT > 2.2) this.setState('idle');
        break;
      case 'stagger':
        this.vy += 50 * dt;
        this.vx *= 0.95;
        this.flapRate = 14;
        if (this.stateT > 1.4) this.setState('idle');
        break;
      case 'dying':
        this.vy = Math.min(this.vy + 20 * dt, 30);
        this.vx *= 0.95;
        this.flapRate = 2;
        if (Math.random() < dt * 30) this.dissolveBurst(14);
        this.g.shake(2.5, 0.1);
        if (this.stateT > 2.8) {
          this.setState('dead');
          for (let i = 0; i < 6; i++) this.dissolveBurst(40);
          this.g.flash(1);
          this.g.shake(8, 0.7);
          this.g.sfx('explode', { vol: 1 });
          for (const o of [this.bodySpr, this.coreSpr, this.wingL, this.wingR, this.aura]) o.setVisible(false);
          for (const l of this.lenses) {
            l.img.setVisible(false);
            l.glow.setVisible(false);
          }
          this.onDefeated?.();
        }
        break;
      default:
        break;
    }

    // wing animation (frame drives lens positions too)
    if (this.flapRate > 0) {
      this.flapT += dt * this.flapRate;
      this.frame = Math.floor(this.flapT) % FLAP.length;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.state !== 'dive' && this.state !== 'intro' && this.state !== 'dying' && this.state !== 'dead') {
      this.x = Math.max(70, Math.min(this.arenaW - 70, this.x));
      this.y = Math.max(100, Math.min(this.floorY - 70, this.y));
    }

    this.updateEclipse(dt);
    this.updateProjectiles(dt);

    // body contact
    if (this.active && !this.defeated && !p.dead && Math.abs(p.x - this.x) < 20 && Math.abs(p.y - this.y) < 46) this.hurtPlayer(this.x);
  }

  private nextAttack(): void {
    const seq = this.phase === 1 ? ['scales', 'gale', 'dive', 'scales', 'dive'] : this.phase === 2 ? ['swarm', 'scales', 'dive', 'gale', 'dive'] : ['rings', 'scales', 'rings', 'dive'];
    const pick = seq[this.attackIdx++ % seq.length];
    if (pick === 'gale') this.setState('gale_wind');
    else if (pick === 'dive') this.setState('dive_rise');
    else this.setState(pick);
  }

  private shedScales(wave: number): void {
    const n = this.phase === 3 ? 7 : 5;
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const x = this.x + side * (30 + i * 14 + (wave % 2) * 7);
        const img = this.sc.add.image(x, this.y, 'boss2', 'noc_scale_0').setDepth(DEPTH.fx - 2);
        this.scales.push({ x, y: this.y + rand(-10, 10), vy: rand(60, 85), ph: rand(0, 6), amp: rand(14, 26), img });
      }
    }
    this.g.sfx('wing', { vol: 0.4, pitch: 1.4 });
  }

  private spawnMoth(x: number, y: number): void {
    const img = this.sc.add.image(x, y, 'boss2', 'noc_moth_0').setDepth(DEPTH.fx - 2);
    this.moths.push({ x, y, vx: rand(-40, 40), vy: rand(-60, -20), t: 0, alive: true, img });
    this.g.particles.ring(x, y, RAMPS.dawn[7]);
  }

  private emitRing(): void {
    this.rings.push({ r: 10, gap: rand(0, Math.PI * 2), hit: false });
    this.g.sfx('pulse', { vol: 0.8, pitch: 0.7 });
    this.g.shake(2.5, 0.2);
  }

  private dissolveBurst(n: number): void {
    for (let i = 0; i < n; i++) {
      this.g.particles.emit(this.x + rand(-110, 110), this.y + rand(-60, 70), { frame: i % 3 ? 'px1' : 'px2', speed: [30, 120], angle: -90, spread: 70, life: [1, 2.2], gravity: -40, tint: [RAMPS.dawn[7], RAMPS.dawn[8], RAMPS.magenta[6], RAMPS.cyan[5]], add: true });
    }
  }

  private updateProjectiles(dt: number): void {
    const p = this.g.player;
    const pb = p.body;
    const hb = p.attackHitbox();
    for (const s of this.scales) {
      s.y += s.vy * dt;
      s.ph += dt * 2.4;
      const x = s.x + Math.sin(s.ph) * s.amp;
      s.img.setPosition(Math.round(x), Math.round(s.y)).setFrame(`noc_scale_${Math.floor(this.t * 8) % 2}`);
      if (hb && x > hb.x - 3 && x < hb.x + hb.w + 3 && s.y > hb.y - 3 && s.y < hb.y + hb.h + 3) {
        this.g.particles.sparks(x, s.y, -90, 180, 4, [RAMPS.dawn[8], COLORS.white]);
        s.y = 9999;
        continue;
      }
      if (!p.dead && Math.abs(x - pb.x) < pb.w / 2 + 2 && Math.abs(s.y - pb.y) < pb.h / 2) {
        this.hurtPlayer(x);
        s.y = 9999;
      }
      if (s.y > this.floorY) {
        if (s.y < 9000) this.g.particles.sparks(x, this.floorY - 1, -90, 120, 2, [RAMPS.dawn[7]]);
        s.y = 9999;
      }
    }
    this.scales = this.scales.filter((s) => {
      if (s.y > 9000) s.img.destroy();
      return s.y < 9000;
    });
    for (const m of this.moths) {
      if (!m.alive) continue;
      m.t += dt;
      const dx = p.x - m.x;
      const dy = p.y - 6 - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const acc = m.t < 0.6 ? 0 : 260;
      m.vx += (dx / d) * acc * dt + Math.sin(m.t * 9) * 80 * dt;
      m.vy += (dy / d) * acc * dt;
      const sp = Math.hypot(m.vx, m.vy);
      if (sp > 95) {
        m.vx *= 95 / sp;
        m.vy *= 95 / sp;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.img.setPosition(Math.round(m.x), Math.round(m.y)).setFrame(`noc_moth_${Math.floor(m.t * 14) % 2}`).setFlipX(m.vx < 0);
      if (!p.dead && Math.abs(m.x - pb.x) < 8 && Math.abs(m.y - pb.y) < 14) {
        this.hurtPlayer(m.x);
        m.alive = false;
        m.img.setVisible(false);
      }
      if (m.t > 6) {
        m.alive = false;
        m.img.setVisible(false);
        this.g.particles.sparks(m.x, m.y, -90, 360, 5, [RAMPS.dawn[7]]);
      }
    }
    this.moths = this.moths.filter((m) => {
      if (!m.alive) m.img.destroy();
      return m.alive;
    });
    for (const r of this.rings) {
      r.r += 150 * dt;
      const cx = this.x;
      const cy = this.y + 24;
      const dx = pb.x - cx;
      const dy = pb.y - cy;
      const dist = Math.hypot(dx, dy);
      if (!r.hit && !p.dead && Math.abs(dist - r.r) < 7) {
        let da = Math.atan2(dy, dx) - r.gap;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > 0.42) {
          r.hit = true;
          this.hurtPlayer(cx);
        }
      }
    }
    this.rings = this.rings.filter((r) => r.r < 520);
  }

  private updateEclipse(dt: number): void {
    const want = this.phase === 2 && this.active && !this.defeated ? 0.88 : 0;
    this.dark += (want - this.dark) * Math.min(1, dt * 1.2);
    const post = this.g.postFx;
    if (!post) return;
    post.dark = this.dark;
    const cam = this.g.cameras.main;
    const p = this.g.player;
    post.light.x = (p.x - cam.scrollX) / GAME_W;
    post.light.y = (p.y - cam.scrollY) / GAME_H;
    post.lightR = 0.34;
    post.light2.x = -2;
    post.light2.y = -2;
  }

  private hurtPlayer(fromX: number): void {
    if (this.hurtCd > 0) return;
    const p = this.g.player;
    if (p.invulnT > 0 || p.dead) return;
    this.hurtCd = 0.3;
    p.hurt(1, fromX);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  render(_alpha: number, _dt: number): void {
    const g = this.fx;
    g.clear();
    if (this.state === 'dead') return;
    const shake = this.state === 'stagger' || this.state === 'dying' ? (Math.floor(this.t * 40) % 2 ? 1 : -1) : 0;
    const bx = Math.round(this.x) + shake;
    const by = Math.round(this.y + Math.sin(this.t * 3) * 1.5);
    const f = this.frame;
    this.wingR.setFrame(`noc_wing_${this.wingVariant(1)}_${f}`).setPosition(bx + 6, by - 10);
    this.wingL.setFrame(`noc_wing_${this.wingVariant(-1)}_${f}`).setPosition(bx - 6, by - 10);
    this.bodySpr.setPosition(bx, by);
    this.coreSpr.setFrame(`noc_core_${Math.floor(this.t * 8) % 4}`).setPosition(bx, by + 24);
    if (this.coreFlash > 0) this.coreSpr.setTintFill(0xffffff);
    else this.coreSpr.clearTint();
    const flashBody = this.state === 'dying' && Math.floor(this.t * 16) % 2 === 0;
    for (const o of [this.bodySpr, this.wingL, this.wingR]) {
      if (flashBody) o.setTintFill(0xffffff);
      else o.clearTint();
    }
    this.aura.setPosition(bx, by).setAlpha(0.22 + Math.sin(this.t * 2) * 0.05);
    const hot = this.state === 'dive_warn' || this.state === 'gale_wind';
    for (const l of this.lenses) {
      const [lx, ly] = this.lensPos(l);
      const alive = l.hp > 0;
      l.img.setPosition(Math.round(lx) + shake, Math.round(ly)).setFrame(alive ? (hot && Math.floor(this.t * 12) % 2 ? 'noc_lens_hot' : 'noc_lens') : 'noc_lens_broken');
      if (l.flash > 0) l.img.setTintFill(0xffffff);
      else l.img.clearTint();
      l.img.setAlpha(this.guardT > 0 && alive ? 0.45 : 1);
      l.glow.setPosition(Math.round(lx), Math.round(ly)).setVisible(alive && this.guardT <= 0).setAlpha(0.5 + Math.sin(this.t * 6 + l.side) * 0.2);
    }
    // dive telegraph: the arc it will follow
    if (this.state === 'dive_warn' && this.dive && Math.floor(this.t * 14) % 2 === 0) {
      const d = this.dive;
      g.fillStyle(RAMPS.dawn[8], 0.85);
      for (let i = 0; i <= 40; i++) {
        const e = i / 40;
        const x = (1 - e) * (1 - e) * d.x0 + 2 * (1 - e) * e * d.cx + e * e * d.x1;
        const y = (1 - e) * (1 - e) * d.y0 + 2 * (1 - e) * e * d.cy + e * e * d.y1;
        if (i % 2 === 0) g.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
    // memory rings with a gap
    for (const r of this.rings) {
      const n = Math.max(24, Math.floor(r.r / 2));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let da = a - r.gap;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < 0.42) continue;
        const x = Math.round(this.x + Math.cos(a) * r.r);
        const y = Math.round(this.y + 24 + Math.sin(a) * r.r);
        g.fillStyle(i % 3 === 0 ? 0xffffff : RAMPS.cyan[5], 0.9).fillRect(x, y, 1, 1);
        g.fillStyle(RAMPS.cyan[3], 0.5).fillRect(x, y + 1, 1, 1);
      }
    }
  }

  reset(): void {
    this.defeated = false;
    this.phase = 1;
    this.coreHp = this.coreMax;
    this.x = this.arenaW / 2;
    this.y = 160;
    this.vx = this.vy = 0;
    this.attackIdx = 0;
    this.dark = 0;
    if (this.g.postFx) this.g.postFx.dark = 0;
    for (const l of this.lenses) {
      l.hp = LENS_HP;
      l.img.setVisible(true);
      l.glow.setVisible(true);
    }
    this.bodySpr.setFrame('noc_body').setVisible(true);
    this.coreSpr.setVisible(false);
    for (const o of [this.wingL, this.wingR, this.aura]) o.setVisible(true);
    this.clearMinions();
    this.rings = [];
    this.setState(this.active ? 'idle' : 'intro');
  }

  destroy(): void {
    this.clearMinions();
    for (const o of [this.bodySpr, this.coreSpr, this.wingL, this.wingR, this.aura, this.fx]) o.destroy();
    for (const l of this.lenses) {
      l.img.destroy();
      l.glow.destroy();
    }
  }
}
