import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, HOOK, MAX_STEPS_PER_FRAME, STEP } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { Input } from '../core/Input.ts';
import { clamp } from '../core/math.ts';
import { loadProgress, markEnding, saveProgress, settings, unlockStage } from '../core/Settings.ts';
import { Player } from '../entities/Player.ts';
import { Grapple, type AnchorPoint } from '../entities/Grapple.ts';
import { CameraDirector } from '../fx/CameraDirector.ts';
import { Particles } from '../fx/Particles.ts';
import type { Juice } from '../fx/Juice.ts';
import type { NeonPostFX } from '../fx/NeonPostFX.ts';
import { Level } from '../world/Level.ts';
import { Parallax } from '../world/Parallax.ts';
import { Weather } from '../world/Weather.ts';
import { CHAPTER1_END, CHAPTER2_END, STAGES } from '../world/levels/index.ts';
import { Gimmicks } from '../world/Gimmicks.ts';
import { Npcs } from '../world/Npcs.ts';
import { Archivist } from '../entities/boss/Archivist.ts';
import { Nocturne } from '../entities/boss/Nocturne.ts';
import { Vesper } from '../entities/boss/Vesper.ts';
import type { HudScene } from './HudScene.ts';
import { Combat } from '../combat/Combat.ts';

interface AnchorObj extends AnchorPoint {
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  phase: number;
}

interface CheckpointObj {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  active: boolean;
}

interface LogObj {
  x: number;
  y: number;
  id: string;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  taken: boolean;
}

interface Flicker {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image | null;
  on: string;
  off: string;
  t: number;
  glowAlpha: number;
}

const SIGN_COLORS: Record<string, number> = {
  lethe: COLORS.magenta,
  memory: COLORS.cyan,
  hotel: COLORS.magenta,
  ramen: COLORS.amber,
  bar: COLORS.cyan,
  open: COLORS.yellow,
  pharm: COLORS.acid,
  danger: COLORS.crimsonHot,
};

export class GameScene extends Phaser.Scene implements Juice {
  level!: Level;
  player!: Player;
  controls!: Input;
  private cam!: CameraDirector;
  private parallax!: Parallax;
  private weather!: Weather;
  particles!: Particles;
  private post: NeonPostFX | null = null;
  private anchors: AnchorObj[] = [];
  private checkpoints: CheckpointObj[] = [];
  private logs: LogObj[] = [];
  private exit!: { x: number; y: number; sprite: Phaser.GameObjects.Image };
  private flickers: Flicker[] = [];
  private billboards: { screen: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; t: number; i: number }[] = [];
  private rails: { x: number; y: number }[] = [];
  private firedTriggers = new Set<string>();
  private crosshair!: Phaser.GameObjects.Image;
  private lockRing!: Phaser.GameObjects.Image;
  private hitMark!: Phaser.GameObjects.Image;
  private acc = 0;
  private hitstopT = 0;
  private slowT = 0;
  private slowScale = 1;
  timeScale = 1;
  private elapsed = 0;
  private currentCp = -1;
  state: 'play' | 'dead' | 'clear' = 'play';
  private deadT = 0;
  private respawning = false;
  stats = { time: 0, deaths: 0, logs: [] as string[], kills: 0, bestCombo: 0 };
  combat!: Combat;
  private hookTargets: AnchorPoint[] = [];
  private hud!: HudScene;
  private dev = false;
  private heartT = 0;
  private musicHeat = 0;
  private exitT = 0;
  stageIndex = 0;
  gimmicks!: Gimmicks;
  npcs!: Npcs;
  private talkLock = false;
  /** Set by the boss controller: blocks the exit until the fight is won. */
  exitLocked = false;
  boss: Archivist | Nocturne | Vesper | null = null;
  /** Continue straight into the final decision (chapter 3). */
  private choiceOnly = false;

  get postFx(): NeonPostFX | null {
    return this.post;
  }

  constructor() {
    super('Game');
  }

  init(data: { continue?: boolean; stage?: number; carry?: string[] }): void {
    const progress = data.continue ? loadProgress() : null;
    this.choiceOnly = !!progress && progress.checkpoint === -2;
    const urlStage = new URLSearchParams(location.search).get('stage');
    this.stageIndex = Math.max(0, Math.min(STAGES.length - 1, data.stage ?? progress?.stage ?? (urlStage ? Number(urlStage) : 0)));
    this.boss = null;
    this.exitLocked = false;
    this.anchors = [];
    this.checkpoints = [];
    this.logs = [];
    this.flickers = [];
    this.billboards = [];
    this.firedTriggers = new Set();
    this.acc = 0;
    this.hitstopT = 0;
    this.slowT = 0;
    this.timeScale = 1;
    this.elapsed = 0;
    this.currentCp = -1;
    this.state = 'play';
    this.deadT = 0;
    this.respawning = false;
    this.exitT = 0;
    this.stats = { time: 0, deaths: 0, logs: [], kills: 0, bestCombo: 0 };
    this.registry.set('continue', !!data.continue);
    if (!data.continue && data.stage === undefined) this.registry.set('run', { time: 0, deaths: 0, kills: 0, bestCombo: 0, logs: [] });
    if (data.carry) this.stats.logs = [...data.carry];
  }

  create(): void {
    this.dev = new URLSearchParams(location.search).has('dev');
    const data = STAGES[this.stageIndex]();
    this.level = new Level(data);
    const world = this.level.world;
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#05030a');

    this.parallax = new Parallax(this, world.pixelHeight, data.theme);
    this.level.render(this);
    this.particles = new Particles(this);
    this.controls = new Input(this);

    this.buildObjects();

    // spawn (new game or continue)
    let spawn = data.spawn;
    const progress = this.registry.get('continue') ? loadProgress() : null;
    if (progress && progress.level === data.id && this.checkpoints[progress.checkpoint] && progress.checkpoint > 0) {
      const cp = this.checkpoints[progress.checkpoint];
      spawn = { x: cp.x, y: cp.y };
      this.activateCheckpoint(progress.checkpoint, true);
      for (const id of progress.logs) {
        const l = this.logs.find((o) => o.id === id);
        if (l) this.takeLog(l, true);
      }
      for (const k of ['intro', 'move', 'm_intro', 't_intro', 'a_intro', 'r_intro', 'c_intro', 's_intro', 'g_intro', 'mast_intro']) this.firedTriggers.add(k);
    }
    if (progress) for (const id of progress.logs) if (!this.stats.logs.includes(id)) this.stats.logs.push(id);
    this.player = new Player(this, world, spawn.x, spawn.y, this.particles, this);
    this.combat = new Combat(this, world, this.player, this.particles, this, data.enemies);
    this.combat.onCombo = (n) => this.hud?.combo(n);
    this.gimmicks = new Gimmicks(this, this.level, this.particles, this);
    // chapter 3 hubs: talk to people; required talks open the way on
    this.npcs = new Npcs(this, data.npcs);
    this.talkLock = false;
    if (data.hub) {
      this.exitLocked = data.npcs.some((n) => n.required);
      this.npcs.onTalk = (key) => {
        this.talkLock = true;
        this.player.controlLocked = true;
        this.hud?.dialog(key);
      };
      this.npcs.onAllRequired = () => {
        this.exitLocked = false;
        this.particles.ring(this.level.data.exit.x, this.level.data.exit.y - 20, COLORS.acid);
      };
    }
    // chapter 3: searchlights / watcher drones raise the district alarm
    if (data.lights.length || data.enemies.some((e) => e.kind === 'watcher')) {
      const dev = this.gimmicks.devices3;
      this.combat.ctx.alarm = (x, y) => dev.alarm(x, y);
      dev.onAlarm = (x, y) => {
        this.hud?.toast('ALERT', '경보 — 셔터 폐쇄');
        const alive = this.combat.enemies.filter((e) => e.alive && e.kind === 'drone' && Math.abs(e.x - x) < 300).length;
        for (let i = alive; i < 2; i++) {
          const e = this.combat.spawn({ kind: 'drone', x: x + (i ? 50 : -50), y: y + 20 });
          this.particles.ring(e.x, e.y, COLORS.crimsonHot);
        }
      };
    }
    if (data.boss && this.choiceOnly) this.time.delayedCall(1200, () => this.finalChoice());
    else if (data.boss) this.setupBoss(data.boss);

    this.cam = new CameraDirector(cam, world.pixelWidth, world.pixelHeight);
    // boss arena: hold a fixed height so the boss and the floor stay framed
    if (data.boss) this.cam.lockY = data.boss === 'vesper' ? 96 : 60;
    this.cam.snap(this.player.x, this.player.feetY, this.player.facing);
    this.weather = new Weather(
      this,
      this.level.surfaces,
      (a) => this.flash(a),
      () => audio.play('thunder', { vol: 0.7 }),
      data.rain,
      data.theme === 'tower' || data.theme === 'mast',
      data.weather,
    );

    this.crosshair = this.add.image(0, 0, 'fx', 'cross_idle').setScrollFactor(0).setDepth(DEPTH.cursor);
    this.lockRing = this.add.image(0, 0, 'fx', 'lockring_0').setDepth(DEPTH.cursor - 1).setTint(COLORS.magenta).setVisible(false);
    this.hitMark = this.add.image(0, 0, 'fx', 'px2').setDepth(DEPTH.cursor - 1).setTint(COLORS.cyanHot).setVisible(false);

    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      cam.setPostPipeline('NeonPostFX');
      this.post = cam.getPostPipeline('NeonPostFX') as NeonPostFX;
    }

    this.scene.launch('Hud');
    this.hud = this.scene.get('Hud') as HudScene;
    this.time.delayedCall(0, () => {
      if (this.hud) this.hud.manualDialog = data.hub;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    audio.unlock();
    audio.playMusic(data.music);
    audio.startAmbience();
    cam.fadeIn(900, 5, 3, 10);
    this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
  }

  private setupBoss(kind: 'archivist' | 'nocturne' | 'vesper'): void {
    const meta = {
      archivist: { key: 'b', name: '기록관', sub: 'LETHE 집행 유닛 LT-0 · ARCHIVIST', sfx: 'roar', wait: 9800 },
      nocturne: { key: 'n', name: '녹턴', sub: 'PROJECT NOCTURNE · 기억을 먹는 나방', sfx: 'screech', wait: 11800 },
      vesper: { key: 'vs', name: '베스퍼', sub: '천백만의 합의 · THE CONSENSUS', sfx: 'roar', wait: 13800 },
    }[kind];
    const boss = kind === 'nocturne' ? new Nocturne(this) : kind === 'vesper' ? new Vesper(this) : new Archivist(this);
    this.boss = boss;
    this.exitLocked = true;
    this.combat.extraTargets = () => boss.hookTargets();
    this.combat.extraHit = (x, y, w, h, id, dmg, kind2, dir) => boss.hit(x, y, w, h, id, dmg, kind2, dir);
    boss.onPhase = (ph) => this.hud?.dialog(`${meta.key}_phase${ph}`);
    boss.onDefeated = () => {
      if (kind === 'vesper') {
        this.hud?.bossBar(false);
        this.hud?.dialog('vs_end');
        audio.stopMusic(3);
        this.time.delayedCall(1500, () => this.finalChoice());
        return;
      }
      this.time.delayedCall(1600, () => {
        this.hud?.bossBar(false);
        this.hud?.dialog(`${meta.key}_end`);
        this.exitLocked = false;
        this.particles.ring(this.exit.x, this.exit.y - 20, COLORS.acid);
        audio.stopMusic(2);
      });
    };
    // intro cinematic: lock controls, letterbox, rise, name card, dialogue
    this.player.controlLocked = true;
    this.time.delayedCall(400, () => {
      this.hud?.letterbox(true);
      audio.play(meta.sfx);
      this.shake(4, 1.2);
    });
    this.time.delayedCall(1700, () => this.hud?.nameCard(meta.name, meta.sub));
    this.time.delayedCall(2600, () => this.hud?.dialog(`${meta.key}_intro`));
    this.time.delayedCall(meta.wait, () => {
      this.hud?.letterbox(false);
      this.hud?.bossBar(true, meta.name, () => boss.totalHp / boss.maxHp);
      this.player.controlLocked = false;
      boss.begin();
    });
  }

  /** Chapter 3: the decision at the Consensus core (after VESPER, or on continue). */
  private finalChoice(): void {
    this.player.controlLocked = true;
    this.player.grapple.release();
    saveProgress({ level: this.level.data.id, stage: this.stageIndex, checkpoint: -2, logs: [...this.stats.logs] });
    const open = () => {
      if (this.hud?.talking) {
        this.time.delayedCall(300, open);
        return;
      }
      this.hud?.letterbox(true);
      this.hud?.showChoice('합의 코어', ['열쇠로 돌려준다 — 각자 선택하게', '합의를 멈추고, 모든 기억을 영원히 고정한다'], (i) => this.endChapter3(i === 0 ? 'good' : 'bad'));
    };
    open();
  }

  private endChapter3(kind: 'good' | 'bad'): void {
    markEnding(kind);
    const run = (this.registry.get('run') as { time: number; deaths: number; kills: number; bestCombo: number } | undefined) ?? { time: 0, deaths: 0, kills: 0, bestCombo: 0 };
    this.registry.set('run', { time: run.time + this.stats.time, deaths: run.deaths + this.stats.deaths, kills: run.kills + this.stats.kills, bestCombo: Math.max(run.bestCombo, this.stats.bestCombo), logs: [...this.stats.logs] });
    this.state = 'clear';
    this.flash(0.6);
    audio.play(kind === 'good' ? 'clear' : 'thunder', { vol: 0.8 });
    this.cameras.main.fadeOut(1400, kind === 'good' ? 255 : 5, kind === 'good' ? 240 : 3, kind === 'good' ? 210 : 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.start('Ending', { chapter: 3, ending: kind });
    });
  }

  private cleanup(): void {
    this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.controls.destroy();
    audio.intensity = 0;
    this.combat?.destroy();
    this.gimmicks?.destroy();
    this.npcs?.destroy();
    this.boss?.destroy();
    this.player?.destroy();
    this.level.destroy();
    this.scene.stop('Hud');
  }

  private autoPause(): void {
    if (this.state === 'play' && this.scene.isActive()) this.openPause();
  }

  // ---------------------------------------------------------------------------
  // World objects
  // ---------------------------------------------------------------------------

  private buildObjects(): void {
    const d = this.level.data;
    for (const a of d.anchors) {
      const glow = this.add.image(a.x, a.y, 'fx', 'glow32').setDepth(DEPTH.objects - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.cyan).setAlpha(0.35);
      const sprite = this.add.image(a.x, a.y, 'props', 'anchor_0').setDepth(DEPTH.objects);
      this.anchors.push({ x: a.x, y: a.y, sprite, glow, phase: Math.random() * 6 });
    }
    d.checkpoints.forEach((c) => {
      const glow = this.add.image(c.x, c.y - 26, 'fx', 'glow64').setDepth(DEPTH.objects - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.cyan).setAlpha(0);
      const sprite = this.add.image(c.x, c.y, 'props', 'checkpoint_off').setOrigin(0.5, 1).setDepth(DEPTH.objects);
      this.checkpoints.push({ x: c.x, y: c.y, sprite, glow, active: false });
    });
    for (const l of d.logs) {
      const glow = this.add.image(l.x, l.y, 'fx', 'glow32').setDepth(DEPTH.objects - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.magenta).setAlpha(0.5);
      const sprite = this.add.image(l.x, l.y, 'props', 'log_0').setDepth(DEPTH.objects);
      this.logs.push({ x: l.x, y: l.y, id: l.id, sprite, glow, taken: false });
    }
    const ex = this.add.image(d.exit.x, d.exit.y, 'props', 'exit').setOrigin(0.5, 1).setDepth(DEPTH.decorFront);
    this.add.image(d.exit.x, d.exit.y - 40, 'fx', 'glow64').setDepth(DEPTH.decorFront - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.acid).setAlpha(0.25);
    this.exit = { x: d.exit.x, y: d.exit.y, sprite: ex };

    for (const dec of d.decor) {
      const depth = dec.front ? DEPTH.decorFront : DEPTH.decorBack + 0.5;
      if (dec.key === 'billboard') {
        this.add.image(dec.x, dec.y, 'props', 'bill_frame').setOrigin(0.5, 1).setDepth(DEPTH.decorFront);
        const screen = this.add.image(dec.x, dec.y - 26 - 22, 'props', 'bill_0').setDepth(DEPTH.decorFront);
        const glow = this.add.image(dec.x, dec.y - 48, 'fx', 'glow128').setDepth(DEPTH.decorBack).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.magenta).setAlpha(0.22);
        this.billboards.push({ screen, glow, t: Math.random() * 2, i: Math.floor(Math.random() * 5) });
      } else if (dec.key === 'lamp') {
        const g = this.add.graphics().setDepth(DEPTH.decorBack + 0.5);
        g.fillStyle(0x2a2f45, 1).fillRect(dec.x, dec.y - 44, 2, 44);
        g.fillStyle(0x5a6585, 1).fillRect(dec.x, dec.y - 44, 1, 44);
        g.fillStyle(0x2a2f45, 1).fillRect(dec.x - 6, dec.y - 46, 9, 2);
        this.add.image(dec.x - 4, dec.y - 44, 'props', 'lamp').setDepth(DEPTH.decorBack + 0.6);
        const cone = this.add.image(dec.x - 4, dec.y - 41, 'fx', 'cone').setOrigin(0.5, 0).setDepth(DEPTH.decorFront).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.amber).setAlpha(0.35).setScale(1, 0.7);
        const glow = this.add.image(dec.x - 4, dec.y - 42, 'fx', 'glow32').setDepth(DEPTH.decorFront).setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.amberHot).setAlpha(0.5);
        this.flickers.push({ img: cone, glow, on: '', off: '', t: 2 + Math.random() * 6, glowAlpha: 0.5 });
      } else if (dec.key.startsWith('sign:')) {
        const name = dec.key.slice(5);
        const img = this.add.image(dec.x, dec.y, 'props', `sign_${name}_on`).setOrigin(0.5, 1).setDepth(depth);
        const glow = this.add
          .image(dec.x, dec.y - img.height / 2, 'fx', img.height > 40 ? 'glow128' : 'glow64')
          .setDepth(depth - 0.1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(SIGN_COLORS[name] ?? COLORS.cyan)
          .setAlpha(0.32);
        this.flickers.push({ img, glow, on: `sign_${name}_on`, off: `sign_${name}_off`, t: 1 + Math.random() * 5, glowAlpha: 0.32 });
      } else {
        this.add.image(dec.x, dec.y, 'props', dec.key).setOrigin(0.5, 1).setDepth(depth).setFlipX(!!dec.flip);
      }
    }
    // rooftop railings along the start roof edge for scale
    this.rails = this.level.hazardCells();
  }

  private activateCheckpoint(i: number, silent = false): void {
    const cp = this.checkpoints[i];
    if (!cp) return;
    if (this.currentCp >= 0 && this.currentCp !== i) {
      const old = this.checkpoints[this.currentCp];
      old.active = false;
    }
    if (cp.active && this.currentCp === i) return;
    cp.active = true;
    this.currentCp = i;
    saveProgress({ level: this.level.data.id, stage: this.stageIndex, checkpoint: i, logs: [...this.stats.logs] });
    if (!silent) {
      audio.play('checkpoint');
      this.particles.ring(cp.x, cp.y - 26, COLORS.cyan);
      this.particles.sparks(cp.x, cp.y - 26, -90, 180, 14);
      this.hud?.toast('CHECKPOINT', '메모리 동기화');
      this.player.hp = Math.max(this.player.hp, 5);
    }
  }

  private takeLog(l: LogObj, silent = false): void {
    l.taken = true;
    l.sprite.setVisible(false);
    l.glow.setVisible(false);
    if (!this.stats.logs.includes(l.id)) this.stats.logs.push(l.id);
    if (!silent) {
      audio.play('log');
      this.particles.sparks(l.x, l.y, -90, 360, 18, [COLORS.magenta, 0xffa0d8, COLORS.white]);
      this.particles.ring(l.x, l.y, COLORS.magenta);
      this.hud?.showLog(l.id);
      if (this.currentCp >= 0) saveProgress({ level: this.level.data.id, stage: this.stageIndex, checkpoint: this.currentCp, logs: [...this.stats.logs] });
    }
  }

  // ---------------------------------------------------------------------------
  // Juice implementation
  // ---------------------------------------------------------------------------

  shake(amount: number, duration = 0.2): void {
    if (!settings.shake) return;
    this.cam.shake(amount, duration);
  }
  hitstop(seconds: number): void {
    this.hitstopT = Math.max(this.hitstopT, seconds);
  }
  slowmo(scale: number, seconds: number): void {
    this.slowScale = scale;
    this.slowT = seconds;
  }
  flash(amount: number): void {
    if (this.post && settings.flash) this.post.flash = Math.max(this.post.flash, amount);
  }
  aberration(amount: number): void {
    if (this.post) this.post.aberration = Math.max(this.post.aberration, amount);
  }
  sfx(name: string, opts?: { vol?: number; pitch?: number; pan?: number }): void {
    audio.play(name, opts);
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  openPause(): void {
    if (this.state !== 'play') return;
    this.controls.reset();
    this.scene.pause();
    this.scene.launch('Pause');
    this.crosshair.setVisible(false);
  }

  onResume(): void {
    this.controls.reset();
    this.crosshair.setVisible(true);
  }

  restartFromCheckpoint(): void {
    this.player.die(true);
    this.deadT = 1.4;
  }

  override update(_time: number, deltaMs: number): void {
    const real = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += real;
    if (this.state === 'play') this.stats.time += real;

    if (this.controls.take('pause')) {
      this.openPause();
      return;
    }

    // time control: hit stop freezes the simulation, slow-mo scales it
    if (this.slowT > 0) {
      this.slowT -= real;
      this.timeScale = this.slowScale;
    } else this.timeScale = Math.min(1, this.timeScale + real * 2.5);
    let simDt = real * this.timeScale;
    if (this.hitstopT > 0) {
      this.hitstopT -= real;
      simDt = 0;
    }

    // aim in world space
    const cam = this.cameras.main;
    const aim = this.computeAim(cam);
    this.player.aimX = aim.x;
    this.player.aimY = aim.y;

    this.acc += simDt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
      this.gimmicks.fixedUpdate(STEP, this.player);
      this.hookTargets = (this.anchors as AnchorPoint[]).concat(this.gimmicks.anchors(), this.combat.targets());
      this.player.fixedUpdate(STEP, this.controls, this.hookTargets);
      this.combat.fixedUpdate(STEP);
      this.boss?.fixedUpdate(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0;
    const alpha = this.acc / STEP;

    this.player.render(real * this.timeScale, alpha, this.elapsed);
    this.combat.render(alpha, real * this.timeScale);
    this.gimmicks.render(real * this.timeScale);
    this.boss?.render(alpha, real * this.timeScale);
    this.stats.kills = this.combat.kills;
    this.stats.bestCombo = this.combat.bestCombo;
    const b = this.player.body;
    this.cam.update(real, this.player.sprite.x, this.player.sprite.y, b.vx, b.onGround && !this.player.dead, this.lookUpTarget());
    this.parallax.update(real, cam.scrollX, cam.scrollY);
    this.weather.update(real, cam.scrollX, cam.scrollY);
    this.particles.update(real * this.timeScale);
    this.updateObjects(real);
    if (this.npcs.any) {
      const talking = !!this.hud?.talking;
      this.npcs.update(real, this.player, this.controls, talking || this.state !== 'play');
      if (this.talkLock && !talking) {
        this.talkLock = false;
        this.player.controlLocked = false;
        this.controls.reset();
      }
    }
    this.updateCrosshair(aim);
    this.checkTriggers();
    this.updateDeath(real);
    this.updatePost(real);
    if (this.dev) this.devKeys();
  }

  /**
   * Highest point the player will probably need to see above them: a tether
   * node within hook reach, or a ledge within a jump / short swing. null when
   * nothing above matters (or the camera is locked for a boss).
   */
  private lookUpTarget(): number | null {
    const p = this.player;
    if (p.dead || this.state !== 'play' || this.boss) return null;
    const fy = p.feetY;
    const px = p.x;
    let best: number | null = null;
    for (const a of this.hookTargets) {
      if (a.isEnemy || a.alive === false) continue;
      if (fy - a.y < 60 || Math.abs(a.x - px) > 200) continue;
      if (Math.hypot(a.x - px, a.y - (p.y - 10)) > HOOK.maxLen + 30) continue;
      const y = a.y - 8;
      if (best === null || y < best) best = y;
    }
    for (const sf of this.level.surfaces) {
      if (sf.y > fy - 44 || sf.y < fy - 150) continue;
      if (sf.x1 < px - 96 || sf.x0 > px + 96) continue;
      // show the ledge plus the player's height standing on it
      const y = sf.y - 26;
      if (best === null || y < best) best = y;
    }
    return best;
  }

  private computeAim(cam: Phaser.Cameras.Scene2D.Camera): { x: number; y: number } {
    if (this.controls.usingMouse) {
      return { x: this.controls.sx + cam.scrollX, y: this.controls.sy + cam.scrollY };
    }
    // keyboard aim: nearest anchor ahead/above, else diagonal up-forward
    const p = this.player;
    let best: AnchorPoint | null = null;
    let bd = Infinity;
    for (const a of this.anchors) {
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > HOOK.maxLen || dy > 10) continue;
      const score = d - dx * p.facing * 0.6;
      if (score < bd && this.level.world.clear(p.x, p.y - 10, a.x, a.y)) {
        bd = score;
        best = a;
      }
    }
    if (best) return { x: best.x, y: best.y };
    return { x: p.x + p.facing * 110, y: p.y - 110 };
  }

  private updateCrosshair(aim: { x: number; y: number }): void {
    const cam = this.cameras.main;
    const p = this.player;
    this.crosshair.setPosition(Math.round(aim.x - cam.scrollX), Math.round(aim.y - cam.scrollY));
    this.crosshair.setVisible(this.controls.usingMouse && this.state === 'play');
    const [hx, hy] = p.handPos();
    const target = this.state === 'play' ? Grapple.pickAnchor(this.level.world, hx, hy, aim.x, aim.y, this.hookTargets.length ? this.hookTargets : this.anchors) : null;
    this.hitMark.setVisible(false);
    if (target && !p.grapple.attached) {
      this.crosshair.setFrame('cross_lock');
      this.lockRing.setVisible(true).setPosition(target.x, target.y);
      this.lockRing.setFrame(`lockring_${Math.floor(this.elapsed * 6) % 2}`);
      this.lockRing.rotation += 0.04;
      return;
    }
    this.lockRing.setVisible(false);
    const dx = aim.x - hx;
    const dy = aim.y - hy;
    const d = Math.hypot(dx, dy) || 1;
    const ex = hx + (dx / d) * HOOK.maxLen;
    const ey = hy + (dy / d) * HOOK.maxLen;
    const hit = this.level.world.raycast(hx, hy, ex, ey);
    if (hit && this.level.world.isHookable(hit.tx, hit.ty)) {
      this.crosshair.setFrame('cross_valid');
      this.hitMark.setVisible(Math.floor(this.elapsed * 8) % 2 === 0).setPosition(Math.round(hit.x), Math.round(hit.y));
    } else if (hit) this.crosshair.setFrame('cross_far');
    else this.crosshair.setFrame('cross_idle');
  }

  private updateObjects(dt: number): void {
    const t = this.elapsed;
    const p = this.player;
    for (const a of this.anchors) {
      const f = Math.floor(t * 8 + a.phase) % 4;
      a.sprite.setFrame(`anchor_${f}`);
      a.sprite.y = Math.round(a.y + Math.sin(t * 2 + a.phase));
      a.glow.setAlpha(0.28 + Math.sin(t * 4 + a.phase) * 0.08);
    }
    this.checkpoints.forEach((cp, i) => {
      if (cp.active) {
        cp.sprite.setFrame(`checkpoint_on_${Math.floor(t * 6) % 4}`);
        cp.glow.setAlpha(0.32 + Math.sin(t * 3) * 0.06);
      } else {
        cp.sprite.setFrame('checkpoint_off');
        cp.glow.setAlpha(0);
      }
      if (this.state === 'play' && !p.dead && Math.abs(p.x - cp.x) < 14 && Math.abs(p.feetY - cp.y) < 30 && this.currentCp !== i) this.activateCheckpoint(i);
    });
    for (const l of this.logs) {
      if (l.taken) continue;
      l.sprite.setFrame(`log_${Math.floor(t * 10) % 6}`);
      l.sprite.y = Math.round(l.y + Math.sin(t * 2.5) * 2);
      l.glow.setAlpha(0.4 + Math.sin(t * 5) * 0.12);
      if (Math.hypot(p.x - l.x, p.y - l.y) < 16 && !p.dead) this.takeLog(l);
    }
    for (const f of this.flickers) {
      f.t -= dt;
      if (f.t <= 0) {
        // brief stutter: off for a few frames
        const off = f.t > -0.12 ? Math.floor(-f.t * 40) % 2 === 0 : false;
        if (f.on) f.img.setFrame(off ? f.off : f.on);
        else f.img.setAlpha(off ? 0.08 : 0.35);
        if (f.glow) f.glow.setAlpha(off ? 0.04 : f.glowAlpha);
        if (f.t < -0.12) {
          f.t = 2 + Math.random() * 7;
          if (f.on) f.img.setFrame(f.on);
          else f.img.setAlpha(0.35);
          if (f.glow) f.glow.setAlpha(f.glowAlpha);
        }
      }
    }
    for (const b of this.billboards) {
      b.t -= dt;
      if (b.t <= 0) {
        b.t = 2.6;
        b.i = (b.i + 1) % 5;
        b.screen.setFrame(`bill_${b.i}`);
        b.glow.setTint(b.i < 2 ? COLORS.magenta : b.i < 4 ? COLORS.cyan : 0x8c58e8);
      }
      b.screen.setAlpha(b.t > 2.5 ? 0.4 : 1);
    }
    // hazard rail sparks near the camera
    const cam = this.cameras.main;
    if (this.rails.length && Math.random() < dt * 14) {
      const r = this.rails[Math.floor(Math.random() * this.rails.length)];
      if (r.x > cam.scrollX - 20 && r.x < cam.scrollX + GAME_W + 20 && r.y > cam.scrollY - 20 && r.y < cam.scrollY + GAME_H + 20) {
        this.particles.zap(r.x + 8, r.y + 8);
        this.particles.sparks(r.x + 8, r.y + 9, -90, 90, 3);
      }
    }
    // exit
    this.exit.sprite.setVisible(!this.exitLocked);
    if (this.state === 'play' && !this.exitLocked && !p.dead && Math.abs(p.x - this.exit.x) < 12 && Math.abs(p.feetY - this.exit.y) < 20) this.stageClear();
    if (this.state === 'clear') {
      this.exitT += dt;
      p.sprite.setAlpha(Math.max(0, 1 - this.exitT * 1.5));
    }
  }

  private checkTriggers(): void {
    if (this.state !== 'play') return;
    const b = this.player.body;
    for (const tr of this.level.data.triggers) {
      if (this.firedTriggers.has(tr.dialog)) continue;
      if (b.x > tr.x && b.x < tr.x + tr.w && b.y > tr.y && b.y < tr.y + tr.h) {
        this.firedTriggers.add(tr.dialog);
        this.hud?.dialog(tr.dialog);
      }
    }
  }

  private updateDeath(dt: number): void {
    const p = this.player;
    if (p.dead && this.state === 'play') {
      this.state = 'dead';
      this.deadT = 0;
      this.stats.deaths++;
      if (p.fellOut) this.flash(0.25);
    }
    if (this.state !== 'dead') return;
    this.deadT += dt;
    if (this.post) this.post.desat = Math.min(0.85, this.deadT * 1.2);
    if (this.deadT > 0.45) this.hud?.showSignalLost(true);
    if (this.deadT > 1.6 && !this.respawning) {
      this.respawning = true;
      this.cameras.main.fadeOut(260, 5, 3, 10);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        const cp = this.checkpoints[this.currentCp];
        const sp = cp ? { x: cp.x, y: cp.y } : this.level.data.spawn;
        p.respawn(sp.x, sp.y);
        this.combat.reset();
        this.gimmicks.reset();
        this.boss?.reset();
        this.cam.snap(p.x, p.feetY, p.facing);
        this.state = 'play';
        this.respawning = false;
        this.hud?.showSignalLost(false);
        if (this.post) this.post.desat = 0;
        this.cameras.main.fadeIn(380, 5, 3, 10);
        this.particles.ring(sp.x, sp.y - 14, COLORS.cyan);
        audio.play('checkpoint', { vol: 0.5 });
      });
    }
  }

  private stageClear(): void {
    this.state = 'clear';
    this.player.controlLocked = true;
    this.player.grapple.release();
    audio.stopMusic(0.8);
    audio.play('clear');
    this.particles.ring(this.exit.x, this.exit.y - 20, COLORS.acid);
    this.flash(0.3);
    const next = this.stageIndex + 1;
    unlockStage(Math.min(next, STAGES.length - 1));
    if (next < STAGES.length) saveProgress({ level: '', stage: next, checkpoint: 0, logs: [...this.stats.logs] });
    else saveProgress(null);
    this.time.delayedCall(900, () => this.hud?.showClear(this.stats, this.level.data.clearText || undefined));
  }

  /** Called by the HUD when the clear panel is confirmed. */
  advanceStage(): void {
    const next = this.stageIndex + 1;
    const run = (this.registry.get('run') as { time: number; deaths: number; kills: number; bestCombo: number } | undefined) ?? { time: 0, deaths: 0, kills: 0, bestCombo: 0 };
    this.registry.set('run', {
      time: run.time + this.stats.time,
      deaths: run.deaths + this.stats.deaths,
      kills: run.kills + this.stats.kills,
      bestCombo: Math.max(run.bestCombo, this.stats.bestCombo),
      logs: [...this.stats.logs],
    });
    this.cameras.main.fadeOut(600, 5, 3, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      if (this.stageIndex === CHAPTER1_END) this.scene.start('Ending', { chapter: 1, next, carry: this.stats.logs });
      else if (this.stageIndex === CHAPTER2_END) this.scene.start('Ending', { chapter: 2, next, carry: this.stats.logs });
      else if (next < STAGES.length) this.scene.restart({ stage: next, carry: this.stats.logs });
      else this.scene.start('Ending', { chapter: 2 });
    });
  }

  private updatePost(dt: number): void {
    if (!this.post) return;
    this.post.flash = Math.max(0, this.post.flash - dt * 2.4);
    this.post.aberration = Math.max(0, this.post.aberration - dt * 3);
    // stronger bloom while fast — "energy" feel
    const sp = clamp(this.player.speed / 500, 0, 1);
    this.post.bloom = 0.85 + sp * 0.35;
    // low health: pulsing red edges + heartbeat
    const low = this.state === 'play' && this.player.hp <= 1 && !this.player.dead;
    const beat = Math.pow(Math.max(0, Math.sin(this.elapsed * 7)), 6);
    this.post.danger = low ? 0.35 + beat * 0.45 : Math.max(0, this.post.danger - dt * 2);
    if (low) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = 0.9;
        audio.heartbeat(0.8);
      }
    }
    // dynamic music: layer in combat percussion when enemies are engaged
    let engaged = this.boss?.active && !this.boss.defeated ? 1 : 0;
    if (!engaged) {
      const p = this.player;
      for (const e of this.combat.enemies) {
        if (!e.alive || e.state === 'patrol') continue;
        if (Math.abs(e.x - p.x) < 260 && Math.abs(e.y - p.y) < 180) {
          engaged = 1;
          break;
        }
      }
    }
    this.musicHeat += ((engaged ? 1 : 0) - this.musicHeat) * Math.min(1, dt * (engaged ? 2 : 0.5));
    audio.intensity = this.musicHeat;
  }

  private devKeys(): void {
    const kb = this.input.keyboard!;
    for (let i = 0; i < this.checkpoints.length; i++) {
      const key = kb.addKey(49 + i);
      if (Phaser.Input.Keyboard.JustDown(key)) {
        const cp = this.checkpoints[i];
        this.player.respawn(cp.x, cp.y);
        this.cam.snap(cp.x, cp.y, this.player.facing);
      }
    }
  }
}
