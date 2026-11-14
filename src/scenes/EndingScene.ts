import Phaser from 'phaser';
import { GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { Weather } from '../world/Weather.ts';
import { EPILOGUE, LOGS, UI_TEXT } from '../data/story.ts';
import { Typewriter, panel, text } from '../ui/Ui.ts';
import type { NeonPostFX } from '../fx/NeonPostFX.ts';

const TONE: Record<string, number> = { text: COLORS.uiText, cyan: COLORS.cyan, amber: COLORS.amberHot };

interface RunStats {
  time: number;
  deaths: number;
  kills: number;
  bestCombo: number;
  logs: string[];
}

/**
 * Chapter endings. Chapter 1: typed epilogue over the rain, then the chapter
 * card, then straight into chapter 2. Chapter 2 (finale): epilogue at dawn,
 * title card, run stats and credits.
 */
export class EndingScene extends Phaser.Scene {
  private weather!: Weather;
  private tw: Typewriter | null = null;
  private idx = -1;
  private wait = 1;
  private phase: 'lines' | 'title' | 'stats' = 'lines';
  private stats!: RunStats;
  private elapsed = 0;
  private spire!: Phaser.GameObjects.Image;
  private canLeave = false;
  private titleObjs: Phaser.GameObjects.GameObject[] = [];
  private chapter = 2;
  private ending: 'good' | 'bad' = 'good';
  private nextStage = 0;
  private carry: string[] = [];
  private lines: { t: string; c: number }[] = [];
  private band: Phaser.GameObjects.Rectangle | null = null;

  constructor() {
    super('Ending');
  }

  init(data: { chapter?: number; next?: number; carry?: string[]; ending?: 'good' | 'bad' }): void {
    this.ending = data.ending ?? 'good';
    const run = (this.registry.get('run') as RunStats | undefined) ?? { time: 0, deaths: 0, kills: 0, bestCombo: 0, logs: [] };
    this.stats = { ...run, logs: run.logs ?? [] };
    this.chapter = data.chapter ?? 2;
    this.nextStage = data.next ?? 0;
    this.carry = data.carry ?? this.stats.logs;
    const src = this.chapter === 1 ? EPILOGUE.ch1 : this.chapter === 2 ? EPILOGUE.ch2 : this.ending === 'good' ? EPILOGUE.good : EPILOGUE.bad;
    this.lines = src.map((l) => ({ t: l.t, c: TONE[l.c] ?? COLORS.uiText }));
    this.idx = -1;
    this.wait = 1.4;
    this.phase = 'lines';
    this.elapsed = 0;
    this.canLeave = false;
    this.band = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#05030a');
    if (this.chapter === 1) {
      this.spire = this.add.image(GAME_W / 2, 10, 'bg-spire').setOrigin(0.5, 0).setAlpha(0).setTint(0x8c1a72);
      this.weather = new Weather(this, [], () => undefined, () => undefined, 0.6);
    } else if (this.chapter === 2) {
      this.spire = this.add.image(0, 0, 'bg-dawn_sky').setOrigin(0, 0).setAlpha(0);
      this.weather = new Weather(this, [], () => undefined, () => undefined, 0.5, false, 'petals');
    } else if (this.ending === 'good') {
      this.spire = this.add.image(0, 0, 'bg-sunroof_sky').setOrigin(0, 0).setAlpha(0);
      this.weather = new Weather(this, [], () => undefined, () => undefined, 0.6, false, 'dust');
      // the morning sky gets bright: a soft band keeps the epilogue readable
      this.band = this.add.rectangle(GAME_W / 2, 62 + 4 * 22, GAME_W, 9 * 22 + 20, 0x05030a, 0.42);
    } else {
      this.spire = this.add.image(0, 0, 'bg-vesper_sky').setOrigin(0, 0).setAlpha(0);
      this.weather = new Weather(this, [], () => undefined, () => undefined, 0.9, false, 'rain');
    }
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      this.cameras.main.setPostPipeline('NeonPostFX');
      (this.cameras.main.getPostPipeline('NeonPostFX') as NeonPostFX).vignette = 0.85;
    }
    audio.playMusic(this.chapter === 3 ? (this.ending === 'good' ? 'end_good' : 'end_bad') : 'title');
    const adv = () => this.advance();
    this.input.keyboard!.on('keydown-SPACE', adv);
    this.input.keyboard!.on('keydown-ENTER', adv);
    this.input.on('pointerdown', adv);
    this.cameras.main.fadeIn(1500, 5, 3, 10);
  }

  private next(): void {
    this.idx++;
    if (this.idx >= this.lines.length) {
      this.showTitle();
      return;
    }
    const L = this.lines[this.idx];
    const y = 70 + this.idx * 22;
    const t = text(this, 0, y, L.t, 'galmuri9', L.c);
    t.x = Math.round((GAME_W - t.width) / 2);
    t.setText('');
    this.tw = new Typewriter(t, 24);
    this.tw.onChar = () => audio.play('type', { vol: 0.7 });
    this.tw.start(L.t);
    this.wait = 1.3;
  }

  private showTitle(): void {
    this.phase = 'title';
    this.children.list.filter((o) => o instanceof Phaser.GameObjects.BitmapText).forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: 900 }));
    if (this.band) this.tweens.add({ targets: this.band, alpha: 0, duration: 1400 });
    this.time.delayedCall(1000, () => {
      const interlude = this.chapter < 3;
      const head = interlude ? `CHAPTER ${this.chapter} — 끝` : this.ending === 'good' ? 'ENDING — 열쇠의 아침' : 'BAD END — 고정된 도시';
      const sub = this.chapter === 1 ? 'CHAPTER 2: 첨탑의 심장' : this.chapter === 2 ? 'CHAPTER 3: 깨어난 도시' : this.ending === 'good' ? 'TETHERFALL — 끝' : '다른 선택이 있었을지도 모른다.';
      const subCol = this.chapter === 1 ? COLORS.magenta : this.chapter === 2 ? COLORS.amberHot : this.ending === 'good' ? COLORS.amberHot : COLORS.uiDim;
      if (this.chapter === 3 && this.ending === 'bad') {
        // the new Archivist, alone on the tower in the rain
        const ion = this.add.sprite(GAME_W / 2, 200, 'player', 0).setAlpha(0).setTint(0x4a4a56);
        const card = text(this, 0, 150, '기록관', 'galmuri11b', COLORS.crimsonHot);
        card.x = Math.round((GAME_W - card.width) / 2);
        card.setAlpha(0);
        this.tweens.add({ targets: [ion, card], alpha: 1, duration: 1600 });
        this.time.delayedCall(3400, () => this.tweens.add({ targets: [ion, card], alpha: 0, duration: 900 }));
        this.time.delayedCall(4400, () => this.titleCard(head, sub, subCol, false));
        return;
      }
      this.titleCard(head, sub, subCol, interlude);
    });
  }

  private titleCard(head: string, sub: string, subCol: number, interlude: boolean): void {
    const logo = this.add.image(GAME_W / 2, 92, 'ui', 'logo').setAlpha(0);
    const a = text(this, 0, 118, head, 'galmuri11b', COLORS.white);
    a.x = Math.round((GAME_W - a.width) / 2);
    const b = text(this, 0, 138, sub, 'galmuri9', subCol);
    b.x = Math.round((GAME_W - b.width) / 2);
    a.setAlpha(0);
    b.setAlpha(0);
    this.titleObjs = [logo, a, b];
    this.tweens.add({ targets: [logo, a, b], alpha: 1, duration: 1400 });
    audio.play(this.chapter === 3 && this.ending === 'bad' ? 'thunder' : 'clear', { vol: 0.8 });
    if (interlude) {
      this.time.delayedCall(4200, () => {
        audio.stopMusic(1.2);
        this.cameras.main.fadeOut(1000, 5, 3, 10);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game', { stage: this.nextStage, carry: this.carry }));
      });
    } else this.time.delayedCall(3800, () => this.showStats());
  }

  private showStats(): void {
    this.phase = 'stats';
    const w = 250;
    const h = 150;
    const x = Math.round((GAME_W - w) / 2);
    const y = 60;
    for (const o of this.titleObjs) this.tweens.add({ targets: o, alpha: 0, duration: 600 });
    const c = this.add.container(0, 0).setDepth(10);
    c.add(panel(this, x, y, w, h));
    const title = text(this, 0, y + 10, '기록 요약', 'galmuri11b', COLORS.cyan);
    title.x = Math.round((GAME_W - title.width) / 2);
    c.add(title);
    const m = Math.floor(this.stats.time / 60);
    const sec = Math.floor(this.stats.time % 60);
    const rows: [string, string][] = [
      ['총 시간', `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`],
      [UI_TEXT.deaths, `${this.stats.deaths}`],
      [UI_TEXT.kills, `${this.stats.kills}`],
      [UI_TEXT.bestCombo, `${this.stats.bestCombo}`],
      ['수집한 기록', `${this.stats.logs.length} / ${Object.keys(LOGS).length}`],
    ];
    rows.forEach(([k, v], i) => {
      c.add(text(this, x + 30, y + 34 + i * 14, k, 'galmuri9', COLORS.uiDim));
      const vt = text(this, 0, y + 34 + i * 14, v, 'galmuri9', COLORS.white);
      vt.x = x + w - 30 - vt.width;
      c.add(vt);
    });
    const cred = text(this, 0, y + h - 30, '그래픽 · 사운드 · 음악: 절차적 생성 / 폰트: Galmuri (OFL)', 'galmuri7', COLORS.uiDim);
    cred.x = Math.round((GAME_W - cred.width) / 2);
    const hint = text(this, 0, y + h - 16, UI_TEXT.continuePrompt, 'galmuri7', COLORS.cyan);
    hint.x = Math.round((GAME_W - hint.width) / 2);
    c.add([cred, hint]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 800 });
    this.time.delayedCall(800, () => (this.canLeave = true));
  }

  private advance(): void {
    if (this.phase === 'lines') {
      if (this.tw && !this.tw.done) this.tw.finish();
      else this.next();
      return;
    }
    if (this.phase === 'stats' && this.canLeave) {
      this.canLeave = false;
      audio.stopMusic(1.2);
      this.cameras.main.fadeOut(1000, 5, 3, 10);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Title'));
    }
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    this.elapsed += dt;
    this.weather.update(dt, 0, 0);
    this.spire.setAlpha(Math.min(this.chapter === 1 ? 0.45 : this.ending === 'bad' && this.chapter === 3 ? 0.5 : 0.85, this.elapsed * (this.chapter === 1 ? 0.03 : 0.06)));
    if (this.phase !== 'lines') return;
    this.tw?.update(dt);
    if (!this.tw || this.tw.done) {
      this.wait -= dt;
      if (this.wait <= 0) this.next();
    }
  }
}
