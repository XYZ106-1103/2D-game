import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { Weather } from '../world/Weather.ts';
import { PROLOGUE, UI_TEXT } from '../data/story.ts';
import { Typewriter, text } from '../ui/Ui.ts';
import type { NeonPostFX } from '../fx/NeonPostFX.ts';

/** Prologue: typed lines over a rainy black screen. */
export class IntroScene extends Phaser.Scene {
  private weather!: Weather;
  private lines: Phaser.GameObjects.BitmapText[] = [];
  private tw: Typewriter | null = null;
  private index = -1;
  private wait = 0.8;
  private leaving = false;
  private spire!: Phaser.GameObjects.Image;
  private elapsed = 0;

  constructor() {
    super('Intro');
  }

  create(): void {
    this.lines = [];
    this.index = -1;
    this.wait = 0.8;
    this.leaving = false;
    this.elapsed = 0;
    this.cameras.main.setBackgroundColor('#05030a');
    this.spire = this.add.image(GAME_W / 2, 20, 'bg-spire').setOrigin(0.5, 0).setAlpha(0).setTint(0x8c1a72);
    this.weather = new Weather(this, [], () => undefined, () => undefined);
    const hint = text(this, 0, GAME_H - 14, UI_TEXT.skip, 'galmuri7', COLORS.uiDim);
    hint.x = GAME_W - hint.width - 8;
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      this.cameras.main.setPostPipeline('NeonPostFX');
      const p = this.cameras.main.getPostPipeline('NeonPostFX') as NeonPostFX;
      p.vignette = 0.8;
    }
    audio.playMusic('title');
    const advance = () => this.advance();
    this.input.keyboard!.on('keydown-SPACE', advance);
    this.input.keyboard!.on('keydown-ENTER', advance);
    this.input.keyboard!.on('keydown-ESC', () => this.leave());
    this.input.on('pointerdown', advance);
    this.cameras.main.fadeIn(800, 5, 3, 10);
  }

  private next(): void {
    this.index++;
    if (this.index >= PROLOGUE.length) {
      this.wait = 1.6;
      return;
    }
    const y = 86 + this.index * 26;
    const t = text(this, 0, y, '', 'galmuri11', this.index === PROLOGUE.length - 1 ? COLORS.cyan : COLORS.uiText);
    this.lines.push(t);
    // centre using the final width
    t.setText(PROLOGUE[this.index]);
    t.x = Math.round((GAME_W - t.width) / 2);
    t.setText('');
    this.tw = new Typewriter(t, 22);
    this.tw.onChar = () => audio.play('type');
    this.tw.start(PROLOGUE[this.index]);
    this.wait = 1.1;
  }

  private advance(): void {
    if (this.tw && !this.tw.done) {
      this.tw.finish();
      return;
    }
    if (this.index >= PROLOGUE.length - 1) this.leave();
    else this.next();
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.stopMusic(1.5);
    this.cameras.main.fadeOut(1000, 5, 3, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game', { continue: false }));
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    this.elapsed += dt;
    this.weather.update(dt, 0, 0);
    this.spire.setAlpha(Math.min(0.35, this.elapsed * 0.04));
    if (this.tw) this.tw.update(dt);
    if (!this.tw || this.tw.done) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.index >= PROLOGUE.length - 1) this.leave();
        else this.next();
      }
    }
  }
}
