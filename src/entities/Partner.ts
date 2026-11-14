import Phaser from 'phaser';
import { DEPTH, PLAYER } from '../config.ts';
import { COLORS, RAMPS } from '../art/palette.ts';
import { makeBody, type Body } from '../physics/TileWorld.ts';
import { Scarf } from './Scarf.ts';
import type { PlayerSheet } from './Player.ts';
import type { Actor, Attacker } from './Actor.ts';
import type { AnchorPoint } from './Grapple.ts';
import type { HitKind, HitResult } from './enemies/Enemy.ts';

/** The other player's character as sent over the network ~30 times a second. */
export interface PartnerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** sprite frame index, facing (-1 or 1), alpha, white flash */
  f: number;
  fc: number;
  al: number;
  wf: boolean;
  sk: 'player' | 'moth';
  /** slash smear [frame, rotation] or 0 */
  sl: [number, number] | 0;
  /** rope: [state 1 flying / 2 attached / 3 zip, hookX, hookY, pivots…] or 0 */
  rp: number[] | 0;
  /** live attack hitbox [x, y, w, h, id, kind] or 0 */
  hb: [number, number, number, number, number, HitKind] | 0;
  hp: number;
  dead: boolean;
  dn: boolean;
  dash: boolean;
  /** remote anchor id the rope is tied to (-1 = none) */
  tid: number;
}

/**
 * Puppet of the co-op partner. It renders their character from the network
 * state (interpolated ~100 ms behind) and stands in for them in this world:
 * enemies target it, hazards "hurt" it — which is forwarded to its owner,
 * who applies the damage to their real player.
 */
export class Partner implements Actor, Attacker, AnchorPoint {
  readonly body: Body;
  readonly hookRadius = 10;
  readonly moving = true;
  private sprite: Phaser.GameObjects.Sprite;
  private slash: Phaser.GameObjects.Image;
  private rope: Phaser.GameObjects.Graphics;
  private tag: Phaser.GameObjects.BitmapText;
  private scarf: Scarf;
  private sheet: PlayerSheet;
  /** Latest state, and a short timeline of states for smooth playback. */
  private b: PartnerState | null = null;
  private buf: { s: PartnerState; t: number }[] = [];
  private guardT = 0;
  /** Forwarders (set by the co-op session). */
  onHurt: ((dmg: number, fromX: number, hazard: boolean) => void) | null = null;
  onPush: ((vx: number, vy: number) => void) | null = null;
  onLanded: ((r: HitResult, dirX: number, kind: HitKind) => void) | null = null;
  /** Resolves the partner's rope anchor id to an anchor in this world. */
  anchorById: (id: number) => AnchorPoint | null = () => null;
  facing = 1;
  attackId = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string) {
    this.sheet = scene.cache.json.get('player-sheet') as PlayerSheet;
    this.body = makeBody(x, y - PLAYER.h / 2, PLAYER.w, PLAYER.h);
    this.sprite = scene.add.sprite(x, y, 'player', 0).setDepth(DEPTH.player - 0.5);
    this.sprite.setOrigin(this.sheet.origin[0] / this.sheet.frameWidth, this.sheet.origin[1] / this.sheet.frameHeight);
    this.slash = scene.add.image(0, 0, 'fx', 'slash_0').setVisible(false).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
    this.rope = scene.add.graphics().setDepth(DEPTH.player - 0.6);
    this.scarf = new Scarf(scene, x, y - 20);
    this.tag = scene.add.bitmapText(x, y - 34, 'galmuri7', label).setOrigin(0.5, 1).setDepth(DEPTH.player + 1).setTint(COLORS.cyan).setAlpha(0.8);
    this.sprite.setVisible(false);
    this.tag.setVisible(false);
  }

  get present(): boolean {
    return this.b !== null;
  }
  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }
  get feetY(): number {
    return this.body.y + this.body.h / 2;
  }
  get dead(): boolean {
    return !this.b || this.b.dead || this.b.dn;
  }
  get hp(): number {
    return this.b?.hp ?? 0;
  }
  get invulnT(): number {
    return this.guardT;
  }
  get isDashing(): boolean {
    return !!this.b?.dash;
  }
  get alive(): boolean {
    return !this.dead;
  }
  get downed(): boolean {
    return !!this.b?.dn;
  }

  /** New network state. */
  apply(s: PartnerState, now: number): void {
    this.b = s;
    this.buf.push({ s, t: now });
    while (this.buf.length > 2 && now - this.buf[0].t > 1000) this.buf.shift();
    // gameplay uses the freshest position (fairer to the remote player)
    this.body.x = s.x;
    this.body.y = s.y;
    this.body.vx = s.vx;
    this.body.vy = s.vy;
    this.facing = s.fc;
    if (s.hb) this.attackId = s.hb[4];
  }

  /** The partner left: hide until they send state again. */
  clear(): void {
    this.b = null;
    this.buf = [];
  }

  hurt(dmg: number, fromX: number, hazard = false): void {
    if (this.guardT > 0 || this.dead) return;
    this.guardT = PLAYER.invuln;
    this.onHurt?.(dmg, fromX, hazard);
  }
  push(vx: number, vy: number): void {
    this.onPush?.(vx, vy);
  }
  tetheredTo(): unknown {
    return this.b && this.b.tid >= 0 ? this.anchorById(this.b.tid) : null;
  }
  attackHitbox(): { x: number; y: number; w: number; h: number; id: number; kind: HitKind } | null {
    const h = this.b?.hb;
    return h ? { x: h[0], y: h[1], w: h[2], h: h[3], id: h[4], kind: h[5] } : null;
  }
  onAttackLanded(r: HitResult, dirX: number, kind: HitKind): void {
    this.onLanded?.(r, dirX, kind);
  }

  render(dt: number, now: number, time: number): void {
    this.guardT -= dt;
    const s = this.b;
    const vis = !!s;
    this.sprite.setVisible(vis);
    this.tag.setVisible(vis);
    if (!s) {
      this.rope.clear();
      this.slash.setVisible(false);
      this.scarf.draw(false);
      return;
    }
    // play back ~100 ms behind, between the two states around that moment
    const rt = now - 100;
    let ix = s.x;
    let iy = s.y;
    for (let i = this.buf.length - 1; i > 0; i--) {
      const p = this.buf[i - 1];
      const q = this.buf[i];
      if (p.t <= rt) {
        const k = Math.max(0, Math.min(1, (rt - p.t) / Math.max(1, q.t - p.t)));
        ix = p.s.x + (q.s.x - p.s.x) * k;
        iy = p.s.y + (q.s.y - p.s.y) * k;
        break;
      }
      if (i === 1) {
        ix = p.s.x;
        iy = p.s.y;
      }
    }
    if (this.sprite.texture.key !== s.sk) {
      this.sprite.setTexture(s.sk, s.f);
      this.scarf.ramp = s.sk === 'moth' ? RAMPS.violet : RAMPS.crimson;
    }
    this.sprite.setFrame(s.f).setFlipX(s.fc < 0).setPosition(Math.round(ix), Math.round(iy + PLAYER.h / 2));
    const blink = this.guardT > 0 && Math.floor(time * 20) % 2 === 0;
    this.sprite.setAlpha(s.dn ? 0.45 : blink ? Math.min(s.al, 0.5) : s.al);
    if (s.wf) this.sprite.setTintFill(0xffffff);
    else this.sprite.clearTint();
    this.tag.setPosition(this.sprite.x, this.sprite.y - 30);
    // scarf from the frame's neck anchor
    const m = this.sheet.meta[s.f] ?? this.sheet.meta[0];
    const ox = this.sheet.origin[0];
    const oy = this.sheet.origin[1];
    const nx = this.sprite.x + (m.neck[0] - ox) * s.fc;
    const ny = this.sprite.y + (m.neck[1] - oy);
    this.scarf.step(Math.min(dt, 1 / 30), nx, ny, s.fc, -12 - s.vx * 0.08);
    this.scarf.draw(true, this.sprite.alpha);
    // slash smear
    if (s.sl) {
      this.slash.setVisible(true).setFrame(`slash_${s.sl[0]}`).setFlipX(s.fc < 0).setOrigin(s.fc > 0 ? 14 / 48 : 34 / 48, 0.5).setRotation(s.sl[1]).setPosition(this.sprite.x + s.fc * 2, this.sprite.y - 16);
    } else this.slash.setVisible(false);
    // rope from the rendered hand through its pivots to the hook
    const g = this.rope;
    g.clear();
    if (s.rp) {
      const hx = this.sprite.x + (m.hand[0] - ox) * s.fc;
      const hy = this.sprite.y + (m.hand[1] - oy);
      const pts: number[] = [];
      for (let i = 1; i < s.rp.length; i += 2) pts.push(s.rp[i], s.rp[i + 1]);
      // rope goes hook → pivots → hand
      pts.push(hx, hy);
      const col = s.rp[0] === 3 ? 0xffffff : RAMPS.cyan[5];
      g.lineStyle(1, col, 0.95);
      g.beginPath();
      g.moveTo(Math.round(pts[0]), Math.round(pts[1]));
      for (let i = 2; i < pts.length; i += 2) g.lineTo(Math.round(pts[i]), Math.round(pts[i + 1]));
      g.strokePath();
      g.fillStyle(RAMPS.cyan[6], 1).fillRect(Math.round(pts[0]) - 1, Math.round(pts[1]) - 1, 3, 3);
    }
  }

  destroy(): void {
    this.sprite.destroy();
    this.slash.destroy();
    this.rope.destroy();
    this.tag.destroy();
    this.scarf.destroy();
  }
}
