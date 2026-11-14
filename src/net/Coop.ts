import Phaser from 'phaser';
import { DEPTH } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { net, type NetMsg, type Role } from './Net.ts';
import { MirrorGuest, type MirrorHost, type MirrorPacket } from './Mirror.ts';
import { Partner, type PartnerState } from '../entities/Partner.ts';
import type { AnchorPoint } from '../entities/Grapple.ts';
import type { Plat, Player } from '../entities/Player.ts';
import type { HitKind, HitResult } from '../entities/enemies/Enemy.ts';
import type { GameScene } from '../scenes/GameScene.ts';
import type { HudScene } from '../scenes/HudScene.ts';

// Online co-op session inside a stage (two or three players).
//
// Each player simulates their own character and sends its state ~30 times a
// second to everyone. The host simulates the world (enemies, bosses, stage
// flow) and sends a mirror of it ~20 times a second; guests' attacks and zip
// strikes are resolved on the host, and the damage a guest takes is sent back
// to that guest only. Shared progress (checkpoints, logs, dialogue, switches,
// crumbling blocks, alarms) travels as small events between all players.

const r1 = (v: number) => Math.round(v * 10) / 10;

/** World conditions the host shares with the guest each snapshot. */
type Env = { w: number; dk: number; xl: boolean; bh: number; cine: number[] | null; pst: number[] | null };
const STATE_HZ = 30;
const SNAP_HZ = 20;
/** Each guest's attack ids live in their own range so they never collide. */
const GUEST_ID = 1_000_000;
/** Who plays which body: slot 0 hosts as ION, guests are MOTH and RU. */
export const COOP_NAMES = ['ION', 'MOTH', 'RU'];
const SKINS = ['player', 'moth', 'ru'] as const;
/** Host: how long the first ready guest waits for the others before play begins. */
const GATE_WAIT = 6;
/** Host: how long to wait for guests who are still loading before starting anyway. */
const GATE_MAX = 15;

/** A hook target that lives in the host's world (enemy, boss part, lantern). */
class RemoteAnchor implements AnchorPoint {
  readonly moving = true;
  x = 0;
  y = 0;
  alive = true;
  isEnemy: boolean;
  hookRadius: number;
  fx = 0;
  fy = 0;
  tx = 0;
  ty = 0;
  t0 = 0;
  readonly id: number;
  constructor(id: number, enemy: boolean, r: number) {
    this.id = id;
    this.isEnemy = enemy;
    this.hookRadius = r;
  }
}

/** The bits of GameScene the session drives (several are private there). */
interface Link {
  player: Player;
  hud: HudScene;
  stageIndex: number;
  state: string;
  exitLocked: boolean;
  firedTriggers: Set<string>;
  particles: { emit: (x: number, y: number, o: object) => void };
  activateCheckpoint(i: number, silent?: boolean): void;
  takeLog(l: unknown, silent?: boolean): void;
  logs: { id: string; taken: boolean }[];
  npcs: { markTalked(id: string): void };
  gimmicks: GameScene['gimmicks'];
  combat: GameScene['combat'];
  boss: GameScene['boss'];
  cine: GameScene['cine'];
  postFx: GameScene['postFx'];
  windNow: number;
  coopClear(): void;
  advanceStage(): void;
  coopGoto(i: number): void;
  coopBossIntro(kind: string): void;
  endChapter3(kind: 'good' | 'bad'): void;
  sfx(name: string, opts?: object): void;
  shake(a: number, d?: number): void;
  flash(a: number): void;
  cameras: Phaser.Cameras.Scene2D.CameraManager;
  time: Phaser.Time.Clock;
}

export class Coop {
  readonly role: Role;
  /** Puppets of the other players, by room slot. */
  readonly partners = new Map<number, Partner>();
  private scene: GameScene;
  private g: Link;
  private mirror: MirrorHost | null;
  private guest: MirrorGuest | null;
  private offs: (() => void)[] = [];
  private stateT = 0;
  private snapT = 0;
  private gateT = 0;
  /** Everyone is in this stage and play has begun. */
  started = false;
  /** Host: a (re)joined guest still needs the stage + a full mirror. */
  private hostWaiting = true;
  /** Host: guests that reported ready in this stage. */
  private readySlots = new Set<number>();
  private gateWait = -1;
  /** Applying a remote event right now (don't echo it back). */
  relaying = false;
  // host → guest side channels, collected between snapshots
  private fxQ: [number, number, object][] = [];
  private sfxQ: [string, object | undefined][] = [];
  private shakeQ: [number, number][] = [];
  private flashQ: number[] = [];
  private bossRun = 0;
  private windMax = 0;
  // host anchor registry
  private anchorIds = new Map<AnchorPoint, number>();
  private anchorsById = new Map<number, AnchorPoint>();
  private nextAnchor = 1;
  // guest copies
  private remote = new Map<number, RemoteAnchor>();
  private remotePlats: Plat[] = [];
  private env: Env = { w: 0, dk: 0, xl: true, bh: 1, cine: null, pst: null };
  private swT = new Map<number, number>();
  private ring: Phaser.GameObjects.Graphics;
  private reviveT = 0;
  private wasDowned = false;
  private tugT = 0;
  private infoT = 0;
  /** Host: votes on the final decision, by slot. */
  private votes = new Map<number, number>();
  private choosing = false;

  constructor(scene: GameScene, role: Role, mirror: MirrorHost | null) {
    this.scene = scene;
    this.g = scene as unknown as Link;
    this.role = role;
    this.mirror = mirror;
    this.guest = role === 'guest' ? new MirrorGuest(scene) : null;
    const p = this.g.player;
    p.setSkin(SKINS[net.slot] ?? 'moth');
    p.controlLocked = true;
    p.coopDown = true;
    this.ring = scene.add.graphics().setDepth(DEPTH.fx);
    for (const s of net.peers) this.partnerFor(s);

    if (role === 'host') this.wrapHost();
    else this.wrapGuest();
    this.wrapShared();

    this.offs.push(
      net.on('ps', (m) => {
        const src = Number(m.src);
        if (src !== net.slot && net.peers.has(src)) this.partnerFor(src).apply(m as unknown as PartnerState, performance.now());
      }),
    );
    this.offs.push(net.on('ws', (m) => this.onSnapshot(m)));
    this.offs.push(net.on('ev', (m) => this.onEvent(m)));
    this.offs.push(
      net.on('peer', (m) => {
        const slot = Number(m.slot);
        if (m.on) {
          this.partnerFor(slot);
          this.hostWaiting = true;
          this.mirror?.resync();
        } else this.peerLeft(slot);
      }),
    );
    this.offs.push(net.on('closed', () => this.lost()));
    this.offs.push(net.on('disconnected', () => this.lost()));
    // the HUD scene finishes creating on the next tick
    this.g.time.delayedCall(60, () => {
      if (!this.started) this.g.hud?.toast('CO-OP', '동료들을 기다리는 중…');
    });
  }

  /**
   * Game event to the partner — skipped while applying one of theirs, so a
   * mirrored action (a checkpoint, a dialogue line) never echoes back.
   */
  event(ev: Record<string, unknown>): void {
    if (this.relaying) return;
    net.send({ t: 'ev', ...ev });
  }

  /** Protocol reply or a message for one player: always sent, even while relaying. */
  private reply(ev: Record<string, unknown>): void {
    net.send({ t: 'ev', ...ev });
  }

  /** The puppet for a room slot (made on first sight). */
  private partnerFor(slot: number): Partner {
    const had = this.partners.get(slot);
    if (had) return had;
    const p = this.g.player;
    const pt = new Partner(this.scene, p.x, p.feetY, COOP_NAMES[slot] ?? '?', slot);
    // the host's world reaches this guest only
    pt.onHurt = (d, x, hz) => this.reply({ e: 'hurt', to: slot, d, x: r1(x), hz });
    pt.onPush = (vx, vy) => this.reply({ e: 'push', to: slot, vx, vy });
    pt.onLanded = (r, dir, kind) => this.reply({ e: 'landed', to: slot, r, dir, kind, x: r1(pt.hitX), y: r1(pt.hitY) });
    pt.anchorById = (id) => this.anchorsById.get(id) ?? null;
    this.partners.set(slot, pt);
    return pt;
  }

  /** Partners in the room whose state is arriving. */
  livePartners(): Partner[] {
    const out: Partner[] = [];
    for (const pt of this.partners.values()) if (pt.present && net.peers.has(pt.slot)) out.push(pt);
    return out;
  }

  /** Players in the session, us included. */
  playerCount(): number {
    return 1 + net.peers.size;
  }

  /** Every other player in the room stands at the exit. */
  othersAt(at: (a: Partner) => boolean): boolean {
    for (const s of net.peers) {
      const pt = this.partners.get(s);
      if (!pt || !pt.present || !at(pt)) return false;
    }
    return true;
  }

  private peerLeft(slot: number): void {
    const g = this.g;
    if (this.role === 'guest' && slot === 0) {
      this.lost();
      return;
    }
    this.partners.get(slot)?.clear();
    this.readySlots.delete(slot);
    g.hud?.toast('CO-OP', `${COOP_NAMES[slot] ?? '동료'} 연결이 끊어졌습니다`);
    if (this.role === 'host' && this.votes.size > 0) {
      this.votes.delete(slot);
      this.tally();
    }
  }

  // ---------------------------------------------------------------------------
  // wiring

  private wrapHost(): void {
    const g = this.g;
    // particle bursts made by world code are replayed on the guest
    const parts = g.particles;
    const emit = parts.emit.bind(parts);
    parts.emit = (x, y, o) => {
      if (this.mirror && this.mirror.cap > 0) this.fxQ.push([r1(x), r1(y), o]);
      emit(x, y, o);
    };
    const sfx = g.sfx.bind(g);
    g.sfx = (name, opts) => {
      if (this.mirror && this.mirror.cap > 0 && !this.hurting()) this.sfxQ.push([name, opts]);
      sfx(name, opts);
    };
    const shake = g.shake.bind(g);
    g.shake = (a, d) => {
      if (this.bossRun > 0 && !this.hurting()) this.shakeQ.push([a, d ?? 0.2]);
      shake(a, d);
    };
    const flash = g.flash.bind(g);
    g.flash = (a) => {
      if (this.bossRun > 0 && !this.hurting()) this.flashQ.push(a);
      flash(a);
    };
    // boss cinematics on the HUD play on both screens
    const hud = g.hud;
    const letterbox = hud.letterbox.bind(hud);
    hud.letterbox = (on: boolean) => {
      letterbox(on);
      this.event({ e: 'hud', fn: 'letterbox', on });
    };
    const nameCard = hud.nameCard.bind(hud);
    hud.nameCard = (title: string, sub: string) => {
      nameCard(title, sub);
      this.event({ e: 'hud', fn: 'nameCard', title, sub });
    };
    const bossBar = hud.bossBar.bind(hud);
    hud.bossBar = (show: boolean, name = '', hp: () => number = () => 1) => {
      bossBar(show, name, hp);
      this.event({ e: 'bossBar', on: show, name });
    };
  }

  private wrapGuest(): void {
    const g = this.g;
    // the guest's zip strikes land in the host's world
    g.player.onZipStrike = (t) => {
      if (t instanceof RemoteAnchor) this.event({ e: 'zip', to: 0, id: t.id, a: g.player.attackId + GUEST_ID * net.slot });
    };
    // hook targets = the host's enemies / boss parts / lanterns
    g.combat.extraTargets = () => [...this.remote.values()].filter((a) => a.alive);
    g.gimmicks.devices3.onAlarm = null;
  }

  private wrapShared(): void {
    const g = this.g;
    const hud = g.hud;
    const dialog = hud.dialog.bind(hud);
    hud.dialog = (k: string) => {
      dialog(k);
      g.firedTriggers.add(k);
      this.event({ e: 'dlg', k });
    };
    g.gimmicks.crumbles.onTrigger = (tx, ty) => this.event({ e: 'crumble', tx, ty });
    const dev2 = g.gimmicks.devices;
    dev2.onSwitch = (i) => {
      const now = performance.now();
      if (now - (this.swT.get(i) ?? 0) < 400) return;
      this.swT.set(i, now);
      this.event({ e: 'sw', i });
    };
    dev2.onFlood = (i) => this.event({ e: 'flood', i });
    const dev3 = g.gimmicks.devices3;
    const alarm = dev3.alarm.bind(dev3);
    dev3.alarm = (x: number, y: number) => {
      const was = dev3.alarmT <= 0;
      alarm(x, y);
      if (was) this.event({ e: 'alarm', x: r1(x), y: r1(y) });
    };
  }

  private hurting(): boolean {
    return (this.g.player as unknown as { hurtT: number }).hurtT > 0.31;
  }

  /** Host: run boss code with shakes / flashes mirrored. */
  runBoss<T>(fn: () => T): T {
    this.bossRun++;
    try {
      return this.mirror ? this.mirror.run(fn) : fn();
    } finally {
      this.bossRun--;
    }
  }

  /** Host, every fixed step: the guests' swings resolve against the world. */
  hostStep(): void {
    if (this.g.windNow !== 0) this.windMax = this.g.windNow;
    if (!this.mirror) return;
    const c = this.g.combat;
    for (const pt of this.livePartners()) {
      const hb = pt.attackHitbox();
      if (!hb) continue;
      pt.hitX = hb.x + hb.w / 2;
      pt.hitY = hb.y + hb.h / 2;
      c.feedbackMode = 'fx';
      this.mirror.run(() => c.resolveHitbox(hb, pt));
      c.feedbackMode = 'full';
    }
  }

  // ---------------------------------------------------------------------------
  // per frame

  frame(real: number): void {
    const now = performance.now();
    const g = this.g;
    for (const pt of this.partners.values()) pt.render(real, now, now / 1000);
    // gate: everyone in the same stage before play begins
    if (this.role === 'host') {
      this.hostWaiting = [...net.peers].some((s) => !this.readySlots.has(s));
      if (!this.started) {
        // nobody waits forever: a slow guest joins late with its own go,
        // and with nobody left in the room the host plays on (they can rejoin)
        if (this.gateWait < 0) this.gateWait = net.peer ? GATE_MAX : 2;
        this.gateWait -= real;
        if (this.gateWait < 0) this.hostBegin();
      }
    }
    this.gateT -= real;
    if (this.gateT <= 0) {
      this.gateT = 0.5;
      if (this.role === 'host' && this.hostWaiting) this.reply({ e: 'stage', i: g.stageIndex });
      if (this.role === 'guest' && !this.started) this.reply({ e: 'ready', to: 0, i: g.stageIndex });
    }
    // own state out
    this.stateT -= real;
    if (this.stateT <= 0) {
      this.stateT = 1 / STATE_HZ;
      net.send({ t: 'ps', ...this.ownState() } as unknown as NetMsg);
    }
    if (this.role === 'host') {
      this.snapT -= real;
      if (this.snapT <= 0 && net.peer) {
        this.snapT = 1 / SNAP_HZ;
        this.sendSnapshot();
      }
    } else this.guestFrame(real, now);
    this.rules(real, now);
  }

  /** Co-op rules: downed / revive, tugging a partner, the partner status lines. */
  private rules(real: number, now: number): void {
    const g = this.g;
    const p = g.player;
    const live = this.livePartners();
    const ring = this.ring;
    ring.clear();
    if (p.downed) {
      if (!this.wasDowned) {
        this.wasDowned = true;
        g.hud.toast('DOWN', '쓰러짐 — 동료가 다가오면 일어납니다');
      }
      const able = live.filter((pt) => !pt.dead && !pt.downed);
      const near = able.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < 30);
      this.reviveT = near ? this.reviveT + real : Math.max(0, this.reviveT - real);
      // everyone down (or alone): nobody is coming
      if (able.length === 0) p.downT = Math.min(p.downT, 0.05);
      if (this.reviveT >= 1.2) {
        this.reviveT = 0;
        p.revive();
        this.reply({ e: 'revived' });
      }
      const cx = p.x;
      const cy = p.y - 2;
      ring.lineStyle(2, COLORS.crimsonHot, 0.8).beginPath();
      ring.arc(cx, cy, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, p.downT / 10), false).strokePath();
      if (this.reviveT > 0) {
        ring.lineStyle(3, COLORS.cyanHot, 1).beginPath();
        ring.arc(cx, cy, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.reviveT / 1.2), false).strokePath();
      }
    } else {
      this.wasDowned = false;
      this.reviveT = 0;
    }
    // a downed partner calls for help
    for (const pt of live) {
      if (!pt.downed) continue;
      const k = 0.5 + Math.sin(now / 120) * 0.5;
      ring.lineStyle(2, COLORS.cyanHot, 0.5 + k * 0.5).strokeCircle(pt.x, pt.y - 2, 14 + k * 4);
    }
    // tug: reel in while hooked to a partner to haul them toward you
    this.tugT -= real;
    const held = p.grapple.attached ? live.find((pt) => pt === p.grapple.attachedTo) : undefined;
    if (held && g.player.controlLocked === false && (g as unknown as { controls: { up: boolean } }).controls.up && this.tugT <= 0) {
      this.tugT = 0.1;
      this.reply({ e: 'tug', to: held.slot, x: r1(p.x), y: r1(p.y) });
    }
    // partner status under our health
    this.infoT -= real;
    if (this.infoT <= 0) {
      this.infoT = 0.25;
      const lines: [string, number][] = [];
      for (let s = 0; s < COOP_NAMES.length; s++) {
        if (s === net.slot) continue;
        const name = COOP_NAMES[s];
        const pt = this.partners.get(s);
        if (!net.peers.has(s)) {
          if (pt) lines.push([`${name}  연결 끊김`, COLORS.uiDim]);
        } else if (!pt || !pt.present) lines.push([`${name}  …`, COLORS.uiDim]);
        else if (pt.downed) lines.push([`${name}  쓰러짐!`, COLORS.crimsonHot]);
        else lines.push([`${name}  HP ${pt.hp}`, COLORS.cyan]);
      }
      g.hud.partnerInfo(lines);
    }
  }

  private ownState(): PartnerState & { cr?: number[] } {
    const p = this.g.player;
    const pv = p as unknown as { frame: number; hurtT: number; slashT: number; slashKind: string; downed?: boolean };
    const gr = p.grapple;
    let rp: number[] | 0 = 0;
    if (gr.state !== 'idle') {
      const code = gr.state === 'zip' ? 3 : gr.state === 'attached' ? 2 : 1;
      rp = [code, r1(gr.hx), r1(gr.hy)];
      if (code === 2) for (const q of gr.rope.pivots.slice(1)) rp.push(r1(q.x), r1(q.y));
    }
    let sl: [number, number] | 0 = 0;
    if (pv.slashT < 0.16) {
      const f = Math.min(3, Math.floor((pv.slashT / 0.16) * 4));
      const rot = pv.slashKind === 'attack1' ? 0.15 : pv.slashKind === 'attack2' ? -0.9 : (pv.slashT / 0.16) * Math.PI * 2;
      sl = [f, Math.round((p.facing > 0 ? rot : -rot) * 100) / 100];
    }
    const h = p.attackHitbox();
    const tied = p.tetheredTo();
    const crates = this.g.gimmicks.devices3.crates;
    const ci = crates.findIndex((c) => c === tied);
    return {
      x: r1(p.x),
      y: r1(p.y),
      vx: Math.round(p.body.vx),
      vy: Math.round(p.body.vy),
      f: pv.frame,
      fc: p.facing,
      al: Math.round(p.sprite.alpha * 100) / 100,
      wf: pv.hurtT > 0.2,
      sk: p.skin,
      sl,
      rp,
      hb: h ? [r1(h.x), r1(h.y), h.w, h.h, h.id + GUEST_ID * net.slot, h.kind] : 0,
      hp: p.hp,
      dead: p.dead,
      dn: !!pv.downed,
      dash: p.isDashing,
      tid: tied instanceof RemoteAnchor ? tied.id : -1,
      ...(ci >= 0 ? { cr: [ci, r1(crates[ci].body.x), r1(crates[ci].body.y)] } : {}),
    };
  }

  private anchorId(a: AnchorPoint): number {
    let id = this.anchorIds.get(a);
    if (id === undefined) {
      id = this.nextAnchor++;
      this.anchorIds.set(a, id);
      this.anchorsById.set(id, a);
    }
    return id;
  }

  private sendSnapshot(): void {
    const g = this.g;
    if (!this.mirror) return;
    if (this.hostWaiting) this.mirror.resync();
    const m = this.mirror.packet();
    // hook targets near any guest
    const near = this.livePartners();
    const an: number[][] = [];
    const list: AnchorPoint[] = [];
    for (const e of g.combat.enemies) if (e.hookable) list.push(e);
    list.push(...g.combat.extraTargets());
    if (g.boss && 'anchors' in g.boss) list.push(...(g.boss as { anchors(): AnchorPoint[] }).anchors());
    const seen = new Set<AnchorPoint>();
    for (const a of list) {
      if (seen.has(a) || a.alive === false) continue;
      seen.add(a);
      if (!near.some((pt) => Math.abs(a.x - pt.x) < 420 && Math.abs(a.y - pt.y) < 300)) continue;
      an.push([this.anchorId(a), r1(a.x), r1(a.y), a.hookRadius ?? 10, a.isEnemy ? 1 : 0]);
    }
    const pl = g.gimmicks.devices3.extraPlats.map((p) => [r1(p.x), r1(p.y), r1(p.w), r1(p.h), Math.round(p.vx)]);
    const post = g.postFx;
    const boss = g.boss as unknown as { totalHp?: number; maxHp?: number; fin?: number } | null;
    const env: Record<string, unknown> = {
      w: this.windMax,
      dk: post ? Math.round(post.dark * 100) / 100 : 0,
      xl: g.exitLocked,
      bh: boss && boss.maxHp ? Math.round(((boss.totalHp ?? 0) / boss.maxHp) * 1000) / 1000 : 1,
    };
    if (g.cine) env.cine = [r1(g.cine.x), r1(g.cine.y), g.cine.zoom];
    if (post && boss && (boss.fin ?? -1) >= 0) env.pst = [post.light.x, post.light.y, post.light2.x, post.light2.y, post.lightR, post.ripple.a, post.ripple.r, post.ripple.x, post.ripple.y].map((v) => Math.round(v * 1000) / 1000);
    this.windMax = 0;
    net.send({ t: 'ws', m, an, pl, env, fx: this.fxQ, sf: this.sfxQ, sh: this.shakeQ, fl: this.flashQ } as unknown as NetMsg);
    this.fxQ = [];
    this.sfxQ = [];
    this.shakeQ = [];
    this.flashQ = [];
  }

  private onSnapshot(msg: NetMsg): void {
    if (this.role !== 'guest' || !this.guest) return;
    const now = performance.now();
    const m = msg as unknown as { m: MirrorPacket; an: number[][]; pl: number[][]; env: Env; fx: [number, number, object][]; sf: [string, object | undefined][]; sh: [number, number][]; fl: number[] };
    this.guest.apply(m.m, now);
    // anchors
    const live = new Set<number>();
    for (const [id, x, y, r, en] of m.an) {
      live.add(id);
      let a = this.remote.get(id);
      if (!a) {
        a = new RemoteAnchor(id, !!en, r);
        a.x = a.fx = a.tx = x;
        a.y = a.fy = a.ty = y;
        this.remote.set(id, a);
      }
      a.alive = true;
      a.fx = a.x;
      a.fy = a.y;
      a.tx = x;
      a.ty = y;
      a.t0 = now;
    }
    for (const [id, a] of this.remote) {
      if (live.has(id)) continue;
      a.alive = false;
      if (now - a.t0 > 3000) this.remote.delete(id);
    }
    // platforms (the boss train)
    const pl = m.pl;
    while (this.remotePlats.length > pl.length) this.remotePlats.pop();
    pl.forEach(([x, y, w, h, vx], i) => {
      let p = this.remotePlats[i];
      if (!p) {
        p = { x, y, w, h, dx: 0, dy: 0, vx, vy: 0, solid: false };
        this.remotePlats[i] = p;
      }
      p.dx = Math.abs(x - p.x) < 60 ? x - p.x : 0;
      p.x = x;
      p.y = y;
      p.w = w;
      p.h = h;
      p.vx = vx;
    });
    this.env = { ...this.env, ...m.env, cine: m.env.cine ?? null, pst: m.env.pst ?? null };
    const g = this.g;
    for (const [x, y, o] of m.fx) g.particles.emit(x, y, o);
    for (const [name, o] of m.sf) audio.play(name, (o ?? undefined) as never);
    for (const [a, d] of m.sh) g.shake(a, d);
    for (const a of m.fl) g.flash(a);
  }

  private guestFrame(real: number, now: number): void {
    const g = this.g;
    this.guest?.update(now);
    for (const a of this.remote.values()) {
      const k = Math.min(1, (now - a.t0) / 50);
      a.x = a.fx + (a.tx - a.fx) * k;
      a.y = a.fy + (a.ty - a.fy) * k;
    }
    g.gimmicks.devices3.extraPlats = this.remotePlats;
    // the boss's wind reaches us too
    const b = g.player.body;
    if (this.env.w && !g.player.dead) b.vx += this.env.w * (b.onGround ? 520 : 820) * real;
    g.exitLocked = this.env.xl;
    g.cine = this.env.cine ? { x: this.env.cine[0], y: this.env.cine[1], zoom: this.env.cine[2] } : null;
    const post = g.postFx;
    if (post) {
      const s = this.env.pst;
      if (s) {
        post.dark = this.env.dk;
        post.light = { x: s[0], y: s[1] };
        post.light2 = { x: s[2], y: s[3] };
        post.lightR = s[4];
        post.ripple = { a: s[5], r: s[6], x: s[7], y: s[8] };
      } else {
        post.ripple.a = 0;
        post.dark = this.env.dk;
        if (this.env.dk > 0) {
          // eclipse: our own light pool follows us
          const cam = g.cameras.main;
          post.light = { x: (g.player.x - cam.scrollX) / cam.width, y: (g.player.y - cam.scrollY) / cam.height };
          post.lightR = 0.34;
          post.light2 = { x: -2, y: -2 };
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // events

  private onEvent(m: NetMsg): void {
    const g = this.g;
    const e = String(m.e);
    this.relaying = true;
    try {
      switch (e) {
        case 'stage':
          if (this.role === 'guest' && Number(m.i) !== g.stageIndex) g.coopGoto(Number(m.i));
          break;
        case 'ready': {
          if (this.role !== 'host') break;
          const src = Number(m.src);
          if (Number(m.i) !== g.stageIndex) {
            this.reply({ e: 'stage', to: src, i: g.stageIndex });
            break;
          }
          if (!this.readySlots.has(src)) this.mirror?.resync();
          this.readySlots.add(src);
          if (this.started) this.reply({ e: 'go', to: src, i: g.stageIndex });
          else if ([...net.peers].every((s) => this.readySlots.has(s))) this.hostBegin();
          else this.gateWait = Math.min(this.gateWait < 0 ? GATE_WAIT : this.gateWait, GATE_WAIT);
          break;
        }
        case 'go':
          if (this.role === 'guest' && Number(m.i) === g.stageIndex) this.begin();
          break;
        case 'hurt':
          g.player.hurt(Number(m.d), Number(m.x), !!m.hz);
          break;
        case 'push':
          g.player.push(Number(m.vx), Number(m.vy));
          break;
        case 'tug': {
          // the partner reels us in
          const p = g.player;
          if (p.dead || p.downed) break;
          const dx = Number(m.x) - p.x;
          const dy = Number(m.y) - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 20) break;
          p.body.vx += (dx / d) * 90;
          p.body.vy += (dy / d) * 90 - 20;
          const sp = Math.hypot(p.body.vx, p.body.vy);
          if (sp > 320) {
            p.body.vx *= 320 / sp;
            p.body.vy *= 320 / sp;
          }
          p.body.onGround = false;
          break;
        }
        case 'revived':
          g.hud.toast('CO-OP', `${COOP_NAMES[Number(m.src)] ?? '동료'} 다시 일어남!`);
          audio.play('checkpoint', { vol: 0.6, pitch: 1.3 });
          break;
        case 'landed': {
          const r = m.r as HitResult;
          g.player.onAttackLanded(r, Number(m.dir), m.kind as HitKind);
          g.combat.feedbackMode = 'juice';
          g.combat.feedback(r, Number(m.x), Number(m.y), Number(m.dir), m.kind as HitKind);
          g.combat.feedbackMode = 'full';
          break;
        }
        case 'zip': {
          const t = this.anchorsById.get(Number(m.id));
          const pt = this.partners.get(Number(m.src));
          if (this.role === 'host' && t && pt && this.mirror) {
            pt.hitX = t.x;
            pt.hitY = t.y;
            pt.attackId = Number(m.a);
            g.combat.feedbackMode = 'fx';
            this.mirror.run(() => g.combat.zipStrikeBy(pt, t));
            g.combat.feedbackMode = 'full';
          }
          break;
        }
        case 'dlg':
          g.firedTriggers.add(String(m.k));
          g.hud.dialog(String(m.k));
          break;
        case 'cp':
          g.activateCheckpoint(Number(m.i));
          break;
        case 'log': {
          const l = g.logs.find((o) => o.id === m.id);
          if (l && !l.taken) {
            g.takeLog(l, true);
            g.hud.toast('LOG', '동료가 기록을 찾았다');
          }
          break;
        }
        case 'talk':
          g.npcs.markTalked(String(m.id));
          break;
        case 'crumble':
          g.gimmicks.crumbles.triggerAt(Number(m.tx), Number(m.ty));
          break;
        case 'sw':
          g.gimmicks.devices.lightSwitch(Number(m.i));
          break;
        case 'flood':
          g.gimmicks.devices.startFlood(Number(m.i));
          break;
        case 'alarm':
          g.gimmicks.devices3.alarm(Number(m.x), Number(m.y));
          break;
        case 'clear':
          if (this.role === 'guest') g.coopClear();
          break;
        case 'advance':
          if (this.role === 'guest') g.advanceStage();
          break;
        case 'hud':
          if (this.role !== 'guest') break;
          if (m.fn === 'letterbox') g.hud.letterbox(!!m.on);
          else if (m.fn === 'nameCard') g.hud.nameCard(String(m.title), String(m.sub));
          break;
        case 'bossBar':
          if (this.role === 'guest') g.hud.bossBar(!!m.on, String(m.name ?? ''), () => this.env.bh);
          break;
        case 'cineLock':
          g.player.controlLocked = true;
          g.player.invulnT = 99;
          break;
        case 'cineRelease':
          g.player.grapple.release(true);
          break;
        case 'heart':
          audio.heartbeat(Number(m.v));
          break;
        case 'musicStop':
          audio.stopMusic(Number(m.f));
          break;
        case 'choice':
          if (this.role === 'guest') this.openChoice();
          break;
        case 'vote':
          if (this.role === 'host') {
            this.votes.set(Number(m.src), Number(m.i));
            this.tally();
          }
          break;
        case 'revote':
          if (this.role === 'guest') this.disagree();
          break;
        case 'end':
          if (this.role === 'guest') g.endChapter3(m.kind as 'good' | 'bad');
          break;
        default:
          break;
      }
    } finally {
      this.relaying = false;
    }
  }

  /** Host: play begins for everyone ready (late guests get their own go). */
  private hostBegin(): void {
    this.gateWait = -1;
    this.reply({ e: 'go', i: this.g.stageIndex });
    this.begin();
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    const p = this.g.player;
    p.controlLocked = false;
    this.g.hud?.toast('CO-OP', '동료와 연결되었습니다');
    (this.g as unknown as { coopStart(): void }).coopStart();
  }

  /** Host: crate positions follow whoever is dragging them. */
  syncCrates(): void {
    for (const pt of this.livePartners()) {
      const cr = (pt as unknown as { b: { cr?: number[] } | null }).b?.cr;
      if (!cr) continue;
      const c = this.g.gimmicks.devices3.crates[cr[0]];
      if (c) {
        c.body.x = cr[1];
        c.body.y = cr[2];
        c.body.vx = 0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // the final decision: everyone votes; it holds only when all agree

  /** Host: the decision opens for everyone. */
  hostChoice(): void {
    this.votes.clear();
    this.event({ e: 'choice' });
    this.openChoice();
  }

  private openChoice(): void {
    if (this.choosing) return;
    this.choosing = true;
    const g = this.g;
    g.hud.letterbox(true);
    const who = this.playerCount() > 2 ? '세 사람의 선택' : '두 사람의 선택';
    g.hud.showChoice(`합의 코어 — ${who}`, ['열쇠로 돌려준다 — 각자 선택하게', '합의를 멈추고, 모든 기억을 영원히 고정한다'], (i) => {
      this.choosing = false;
      if (this.role === 'host') {
        this.votes.set(0, i);
        if (!this.tally()) g.hud.toast('CO-OP', '동료의 선택을 기다리는 중…');
      } else {
        this.reply({ e: 'vote', to: 0, i });
        g.hud.toast('CO-OP', '다른 사람의 선택을 기다리는 중…');
      }
    });
  }

  /** Host: once everyone in the room voted, end on a unanimous choice or ask again. */
  private tally(): boolean {
    const g = this.g;
    const voters = [0, ...net.peers];
    if (!voters.every((s) => this.votes.has(s))) return false;
    const first = this.votes.get(0)!;
    if (voters.every((s) => this.votes.get(s) === first)) {
      const kind = first === 0 ? 'good' : 'bad';
      this.votes.clear();
      this.reply({ e: 'end', kind });
      g.endChapter3(kind);
      return true;
    }
    this.votes.clear();
    this.reply({ e: 'revote' });
    this.disagree();
    return true;
  }

  /** Disagreement: everyone picks again. */
  private disagree(): void {
    this.g.hud.toast('CO-OP', '의견이 다릅니다 — 다시 골라 주세요');
    this.g.time.delayedCall(1400, () => this.openChoice());
  }

  // ---------------------------------------------------------------------------

  /** We lost the room (the host left, or our own connection dropped). */
  private lost(): void {
    const g = this.g;
    g.hud?.toast('CO-OP', this.role === 'guest' ? '방장과의 연결이 끊어졌습니다' : '서버와의 연결이 끊어졌습니다');
    for (const pt of this.partners.values()) pt.clear();
    this.remote.clear();
    // without the host there is no world to play in
    if (this.role === 'guest') g.time.delayedCall(2500, () => (g as unknown as { coopLeave(): void }).coopLeave());
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.guest?.clear();
    for (const pt of this.partners.values()) pt.destroy();
    this.partners.clear();
    this.ring.destroy();
  }
}

