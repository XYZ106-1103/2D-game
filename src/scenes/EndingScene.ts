import Phaser from 'phaser';
import { GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { Weather } from '../world/Weather.ts';
import { LOGS, UI_TEXT } from '../data/story.ts';
import { Typewriter, panel, text } from '../ui/Ui.ts';
import type { NeonPostFX } from '../fx/NeonPostFX.ts';

const LINES: { t: string; c: number }[] = [
  { t: '기록관이 침묵했다.', c: COLORS.uiText },
  { t: '모스의 코어 깊은 곳에서, 지워졌던 목소리가 재생된다.', c: COLORS.uiText },
  { t: "'이걸 듣고 있다면, 나는 나를 지우는 데 성공한 거야.'", c: COLORS.cyan },
  { t: "'레테가 천백만 명에게서 훔친 그 한 시간은 — 모스, 네 안에 있어.'", c: COLORS.cyan },
  { t: "'첨탑 꼭대기의 방송탑으로 가. 그 시간을 이 도시에 돌려줘.'", c: COLORS.cyan },
];

interface RunStats {
  time: number;
  deaths: number;
  kills: number;
  bestCombo: number;
  logs: string[];
}

/** Chapter ending: typed epilogue over the rain, then run stats and credits. */
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

  constructor() {
    super('Ending');
  }

  init(data: { stats?: RunStats }): void {
    const run = (this.registry.get('run') as RunStats | undefined) ?? { time: 0, deaths: 0, kills: 0, bestCombo: 0, logs: [] };
    const last = data.stats ?? { time: 0, deaths: 0, kills: 0, bestCombo: 0, logs: [] };
    this.stats = {
      time: run.time + last.time,
      deaths: run.deaths + last.deaths,
      kills: run.kills + last.kills,
      bestCombo: Math.max(run.bestCombo, last.bestCombo),
      logs: last.logs,
    };
    this.idx = -1;
    this.wait = 1.4;
    this.phase = 'lines';
    this.elapsed = 0;
    this.canLeave = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#05030a');
    this.spire = this.add.image(GAME_W / 2, 10, 'bg-spire').setOrigin(0.5, 0).setAlpha(0).setTint(0x8c1a72);
    this.weather = new Weather(this, [], () => undefined, () => undefined, 0.6);
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      this.cameras.main.setPostPipeline('NeonPostFX');
      (this.cameras.main.getPostPipeline('NeonPostFX') as NeonPostFX).vignette = 0.85;
    }
    audio.playMusic('title');
    const adv = () => this.advance();
    this.input.keyboard!.on('keydown-SPACE', adv);
    this.input.keyboard!.on('keydown-ENTER', adv);
    this.input.on('pointerdown', adv);
    this.cameras.main.fadeIn(1500, 5, 3, 10);
  }

  private next(): void {
    this.idx++;
    if (this.idx >= LINES.length) {
      this.showTitle();
      return;
    }
    const L = LINES[this.idx];
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
    this.time.delayedCall(1000, () => {
      const logo = this.add.image(GAME_W / 2, 92, 'ui', 'logo').setAlpha(0);
      const a = text(this, 0, 118, 'CHAPTER 1 — 끝', 'galmuri11b', COLORS.white);
      a.x = Math.round((GAME_W - a.width) / 2);
      const b = text(this, 0, 138, 'CHAPTER 2: 첨탑의 심장 — 계속', 'galmuri9', COLORS.magenta);
      b.x = Math.round((GAME_W - b.width) / 2);
      a.setAlpha(0);
      b.setAlpha(0);
      this.titleObjs = [logo, a, b];
      this.tweens.add({ targets: [logo, a, b], alpha: 1, duration: 1400 });
      audio.play('clear', { vol: 0.8 });
      this.time.delayedCall(3800, () => this.showStats());
    });
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
    this.spire.setAlpha(Math.min(0.45, this.elapsed * 0.03));
    if (this.phase !== 'lines') return;
    this.tw?.update(dt);
    if (!this.tw || this.tw.done) {
      this.wait -= dt;
      if (this.wait <= 0) this.next();
    }
  }
}
