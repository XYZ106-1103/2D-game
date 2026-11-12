import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { Parallax } from '../world/Parallax.ts';
import { Weather } from '../world/Weather.ts';
import { Level } from '../world/Level.ts';
import { LevelBuilder } from '../world/LevelData.ts';
import { Scarf } from '../entities/Scarf.ts';
import { Menu } from '../ui/Menu.ts';
import { ControlsPanel, OptionsPanel } from '../ui/Panels.ts';
import { text } from '../ui/Ui.ts';
import { UI_TEXT } from '../data/story.ts';
import { loadProgress, saveProgress, settings, unlockedStage } from '../core/Settings.ts';
import { STAGE_NAMES } from '../world/levels/index.ts';
import { panel } from '../ui/Ui.ts';
import type { NeonPostFX } from '../fx/NeonPostFX.ts';
import type { PlayerSheet } from '../entities/Player.ts';

export class TitleScene extends Phaser.Scene {
  private parallax!: Parallax;
  private weather!: Weather;
  private camX = 0;
  private elapsed = 0;
  private logo!: Phaser.GameObjects.Image;
  private ghostA!: Phaser.GameObjects.Image;
  private ghostB!: Phaser.GameObjects.Image;
  private press!: Phaser.GameObjects.BitmapText;
  private menu: Menu | null = null;
  private overlay: OptionsPanel | ControlsPanel | null = null;
  private started = false;
  private hero!: Phaser.GameObjects.Sprite;
  private scarf!: Scarf;
  private sheet!: PlayerSheet;
  private post: NeonPostFX | null = null;
  private glitchT = 2;
  private leaving = false;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super('Title');
  }

  create(): void {
    this.started = false;
    this.leaving = false;
    this.menu = null;
    this.overlay = null;
    this.elapsed = 0;
    this.cameras.main.setRoundPixels(true);
    this.parallax = new Parallax(this, 800);

    // foreground rooftop the hero stands on
    const b = new LevelBuilder('title', '', '', 32, 18);
    b.building(22, 31, 13);
    b.fill(21, 13, 21, 13, 0);
    const lvl = new Level(b.build());
    lvl.render(this);
    this.add.image(452, 208, 'props', 'antenna').setOrigin(0.5, 1).setDepth(DEPTH.decorFront);
    this.add.image(430, 208, 'props', 'ac').setOrigin(0.5, 1).setDepth(DEPTH.decorFront);

    this.sheet = this.cache.json.get('player-sheet') as PlayerSheet;
    this.hero = this.add.sprite(372, 208, 'player', 0).setDepth(DEPTH.player).setFlipX(true);
    this.hero.setOrigin(this.sheet.origin[0] / 48, this.sheet.origin[1] / 48);
    this.scarf = new Scarf(this, 372, 190);

    this.weather = new Weather(
      this,
      lvl.surfaces,
      (a) => this.flash(a),
      () => audio.play('thunder', { vol: 0.6 }),
    );

    this.logo = this.add.image(GAME_W / 2, 46, 'ui', 'logo').setDepth(100);
    this.ghostA = this.add.image(GAME_W / 2, 46, 'ui', 'logo').setDepth(99).setTint(COLORS.magenta).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.ghostB = this.add.image(GAME_W / 2, 46, 'ui', 'logo').setDepth(99).setTint(COLORS.cyan).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.add.image(GAME_W / 2, 70, 'ui', 'logo_wire').setDepth(100);
    // Second camera without post FX: crisp UI text; the world + logo keep the bloom.
    this.uiCam = this.cameras.add(0, 0, GAME_W, GAME_H).setRoundPixels(true);
    this.uiCam.ignore(this.children.list.slice());
    const sub = text(this, 0, 78, 'CHAPTER 1  ·  9구역: 잠긴 옥상', 'galmuri7', COLORS.uiDim);
    sub.x = Math.round((GAME_W - sub.width) / 2);
    sub.setDepth(100);
    this.press = text(this, 0, 200, UI_TEXT.pressAny, 'galmuri9', COLORS.cyan).setDepth(100);
    this.press.x = Math.round((GAME_W - this.press.width) / 2);
    const credits = text(this, 6, GAME_H - 12, UI_TEXT.credits, 'galmuri7', COLORS.uiDim).setDepth(100);
    this.cameras.main.ignore([sub, this.press, credits]);

    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      this.cameras.main.setPostPipeline('NeonPostFX');
      this.post = this.cameras.main.getPostPipeline('NeonPostFX') as NeonPostFX;
    }

    const start = () => this.begin();
    this.input.keyboard!.once('keydown', start);
    this.input.once('pointerdown', start);
    this.cameras.main.fadeIn(900, 5, 3, 10);
    this.uiCam.fadeIn(900, 5, 3, 10);
  }

  private flash(a: number): void {
    if (this.post && settings.flash) this.post.flash = Math.max(this.post.flash, a);
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    audio.unlock();
    audio.play('boot');
    audio.playMusic('title');
    audio.startAmbience();
    this.press.setVisible(false);
    this.openMenu();
  }

  private openMenu(): void {
    const progress = loadProgress();
    this.menu = new Menu(this, 44, 150, [
      { label: UI_TEXT.newGame, action: () => this.go(false) },
      { label: UI_TEXT.continue, action: () => this.go(true), disabled: !progress },
      { label: UI_TEXT.stageSelect, action: () => this.openStageSelect(), disabled: unlockedStage() < 1 },
      { label: UI_TEXT.controls, action: () => this.openOverlay('controls') },
      { label: UI_TEXT.options, action: () => this.openOverlay('options') },
    ]);
    this.menu.container.setDepth(100);
    this.cameras.main.ignore(this.menu.container);
  }

  private openOverlay(kind: 'controls' | 'options'): void {
    if (!this.menu) return;
    this.menu.setVisible(false);
    const close = () => {
        const o = this.overlay;
      this.overlay = null;
      // defer so the closing key doesn't also trigger the title menu
        this.events.once('postupdate', () => {
        o?.destroy();
        this.menu?.setVisible(true);
      });
    };
    this.overlay = kind === 'controls' ? new ControlsPanel(this, close) : new OptionsPanel(this, close);
    this.cameras.main.ignore(this.overlay.root);
  }

  private openStageSelect(): void {
    if (!this.menu) return;
    this.menu.setVisible(false);
    const root = this.add.container(0, 0).setDepth(200);
    const w = 200;
    const h = 34 + STAGE_NAMES.length * 15;
    const x = Math.round((GAME_W - w) / 2);
    const y = 96;
    root.add(panel(this, x, y, w, h));
    root.add(text(this, x + 12, y + 7, UI_TEXT.stageSelect, 'galmuri11b', COLORS.cyan));
    const max = unlockedStage();
    let sub: Menu | null = null;
    const close = () => {
      this.events.once('postupdate', () => {
        sub?.destroy();
        root.destroy();
        this.menu?.setVisible(true);
      });
    };
    sub = new Menu(
      this,
      x + 20,
      y + 28,
      STAGE_NAMES.map((n, i) => ({ label: `${i + 1}. ${i <= max ? n : '???'}`, disabled: i > max, action: () => this.go(false, i) })),
      { width: w - 44, spacing: 15 },
    );
    sub.onBack = close;
    root.add(sub.container);
    this.cameras.main.ignore(root);
  }

  private go(cont: boolean, stage?: number): void {
    if (this.leaving) return;
    this.leaving = true;
    if (!cont) saveProgress(null);
    this.menu?.setVisible(false);
    audio.stopMusic(1.2);
    this.cameras.main.fadeOut(700, 5, 3, 10);
    this.uiCam.fadeOut(700, 5, 3, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (cont) this.scene.start('Game', { continue: true });
      else if (stage !== undefined && stage > 0) {
        this.registry.set('run', { time: 0, deaths: 0, kills: 0, bestCombo: 0, logs: [] });
        this.scene.start('Game', { stage });
      }
      else this.scene.start('Intro');
    });
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    this.elapsed += dt;
    this.camX += dt * 14;
    this.parallax.update(dt, this.camX, 0);
    this.weather.update(dt, 0, 0);

    // hero idle + scarf
    const idle = this.sheet.anims.idle;
    const fi = idle.frames[Math.floor(this.elapsed * idle.fps) % idle.frames.length];
    this.hero.setFrame(fi);
    const m = this.sheet.meta[fi];
    const nx = this.hero.x - (m.neck[0] - this.sheet.origin[0]);
    const ny = this.hero.y + (m.neck[1] - this.sheet.origin[1]);
    this.scarf.step(dt, nx, ny, -1, 25);
    this.scarf.draw(true);

    // logo glitch
    this.glitchT -= dt;
    const glitching = this.glitchT < 0.12;
    if (this.glitchT <= 0) this.glitchT = 1.5 + Math.random() * 3;
    this.ghostA.setVisible(glitching).setPosition(GAME_W / 2 - 2 - Math.round(Math.random() * 2), 46);
    this.ghostB.setVisible(glitching).setPosition(GAME_W / 2 + 2, 46 + (Math.random() < 0.5 ? 1 : 0));
    this.logo.x = glitching ? GAME_W / 2 + (Math.random() < 0.5 ? -1 : 1) : GAME_W / 2;
    if (this.post) {
      this.post.flash = Math.max(0, this.post.flash - dt * 1.5);
      this.post.aberration = glitching ? 0.6 : 0;
    }
    if (!this.started) this.press.setVisible(Math.floor(this.elapsed * 1.6) % 2 === 0);
    this.menu?.update(dt);
    this.overlay?.update(dt);
  }
}
