import Phaser from 'phaser';
import { GAME_H, GAME_W, PLAYER } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { DIALOGS, LOGS, UI_TEXT, type DialogLine } from '../data/story.ts';
import { Typewriter, panel, text, wrap } from '../ui/Ui.ts';
import type { GameScene } from './GameScene.ts';

/** In-game overlay: health, dialogue, toasts, logs, death & clear screens. */
export class HudScene extends Phaser.Scene {
  private game_!: GameScene;
  private hp: Phaser.GameObjects.Image[] = [];
  private lastHp: number = PLAYER.hp;
  private hpFlash = 0;
  private logCount!: Phaser.GameObjects.BitmapText;
  private timer!: Phaser.GameObjects.BitmapText;
  // dialogue
  private dlgQueue: DialogLine[] = [];
  private dlgBox!: Phaser.GameObjects.Container;
  private dlgName!: Phaser.GameObjects.BitmapText;
  private dlgText!: Phaser.GameObjects.BitmapText;
  private dlgTw!: Typewriter;
  private dlgHold = 0;
  private dlgOpen = false;
  // toast
  private toastBox!: Phaser.GameObjects.Container;
  private toastT = 0;
  private toastTitle!: Phaser.GameObjects.BitmapText;
  private toastSub!: Phaser.GameObjects.BitmapText;
  // log panel
  private logBox: Phaser.GameObjects.Container | null = null;
  private logT = 0;
  // overlays
  private lost!: Phaser.GameObjects.Container;
  private lostT = 0;
  private clear: Phaser.GameObjects.Container | null = null;
  private elapsed = 0;
  private stageCard!: Phaser.GameObjects.Container;
  private cardT = 0;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.game_ = this.scene.get('Game') as GameScene;
    this.hp = [];
    this.dlgQueue = [];
    this.dlgOpen = false;
    this.logBox = null;
    this.clear = null;
    this.elapsed = 0;
    this.lastHp = PLAYER.hp;

    // --- health ---------------------------------------------------------------
    this.add.image(6, 6, 'ui', 'emblem').setOrigin(0, 0);
    for (let i = 0; i < PLAYER.hp; i++) this.hp.push(this.add.image(26 + i * 7, 10, 'ui', 'hp_full').setOrigin(0, 0));
    this.add.image(26, 21, 'ui', 'icon_log').setOrigin(0, 0);
    this.logCount = text(this, 37, 20, '0/3', 'galmuri7', COLORS.magenta);
    this.timer = text(this, GAME_W - 46, 6, '00:00', 'galmuri7', COLORS.uiDim);

    // --- dialogue box --------------------------------------------------------------
    const dw = 292;
    const dx = Math.round((GAME_W - dw) / 2);
    const dy = GAME_H - 42;
    this.dlgBox = this.add.container(0, 0);
    this.dlgBox.add(panel(this, dx, dy, dw, 36));
    this.dlgName = text(this, dx + 10, dy + 4, 'MOTH', 'galmuri7', COLORS.cyan);
    this.dlgText = text(this, dx + 10, dy + 15, '', 'galmuri9', COLORS.uiText);
    this.dlgBox.add([this.dlgName, this.dlgText]);
    this.dlgBox.setVisible(false);
    this.dlgTw = new Typewriter(this.dlgText, 40);
    this.dlgTw.onChar = () => audio.play('type', { vol: 0.6 });

    // --- toast ----------------------------------------------------------------------
    this.toastBox = this.add.container(0, 0).setVisible(false);
    this.toastBox.add(panel(this, GAME_W - 132, 20, 124, 30));
    this.toastTitle = text(this, GAME_W - 122, 24, '', 'galmuri9', COLORS.cyan);
    this.toastSub = text(this, GAME_W - 122, 36, '', 'galmuri7', COLORS.uiText);
    this.toastBox.add([this.toastTitle, this.toastSub]);

    // --- signal lost ------------------------------------------------------------------
    this.lost = this.add.container(0, 0).setVisible(false);
    const bar = this.add.rectangle(0, GAME_H / 2 - 22, GAME_W, 44, 0x05030a, 0.8).setOrigin(0, 0);
    const l1 = text(this, 0, GAME_H / 2 - 16, UI_TEXT.signalLost, 'galmuri11b', COLORS.danger);
    l1.x = Math.round((GAME_W - l1.width) / 2);
    const l2 = text(this, 0, GAME_H / 2 + 4, UI_TEXT.signalLostSub, 'galmuri7', COLORS.uiDim);
    l2.x = Math.round((GAME_W - l2.width) / 2);
    this.lost.add([bar, l1, l2]);

    // --- stage title card ----------------------------------------------------------------
    this.stageCard = this.add.container(0, 0);
    const t1 = text(this, 0, 92, this.game_.level.data.title, 'galmuri11b', COLORS.white);
    t1.x = Math.round((GAME_W - t1.width) / 2);
    const t2 = text(this, 0, 110, this.game_.level.data.subtitle, 'galmuri7', COLORS.cyan);
    t2.x = Math.round((GAME_W - t2.width) / 2);
    const line = this.add.rectangle(GAME_W / 2, 106, 0, 1, COLORS.cyan).setOrigin(0.5, 0.5);
    this.stageCard.add([line, t1, t2]);
    this.cardT = 0;

    this.input.keyboard!.on('keydown-SPACE', () => this.onConfirm());
    this.input.keyboard!.on('keydown-ENTER', () => this.onConfirm());
  }

  private onConfirm(): void {
    if (this.clear) {
      audio.play('ui_select');
      this.game_.cameras.main.fadeOut(600, 5, 3, 10);
      this.game_.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop('Game');
        this.scene.start('Title');
      });
      this.clear = null;
      return;
    }
    if (this.logBox && this.logT > 0.4) this.closeLog();
  }

  // ---------------------------------------------------------------------------

  dialog(key: string): void {
    const lines = DIALOGS[key];
    if (!lines) return;
    this.dlgQueue.push(...lines);
    if (!this.dlgOpen) this.nextLine();
  }

  private nextLine(): void {
    const line = this.dlgQueue.shift();
    if (!line) {
      this.dlgOpen = false;
      this.dlgBox.setVisible(false);
      return;
    }
    this.dlgOpen = true;
    this.dlgBox.setVisible(true);
    this.dlgName.setText(line.who === 'ION' ? '이온' : line.who);
    this.dlgName.setTint(line.who === 'MOTH' ? COLORS.cyan : line.who === 'ION' ? COLORS.amberHot : COLORS.acid);
    this.dlgTw.start(wrap(this, 'galmuri9', line.text, 272));
    this.dlgHold = 2.2 + line.text.length * 0.03;
  }

  toast(title: string, sub: string): void {
    this.toastTitle.setText(title);
    this.toastSub.setText(sub);
    this.toastBox.setVisible(true);
    this.toastT = 2.4;
  }

  showLog(id: string): void {
    const entry = LOGS[id];
    if (!entry) return;
    this.logBox?.destroy();
    const w = 320;
    const h = 30 + entry.body.length * 14 + 16;
    const x = Math.round((GAME_W - w) / 2);
    const y = 40;
    const c = this.add.container(0, 0);
    c.add(panel(this, x, y, w, h, 'panel_mg'));
    c.add(this.add.image(x + 10, y + 9, 'ui', 'icon_log').setOrigin(0, 0));
    c.add(text(this, x + 24, y + 8, `${UI_TEXT.logPickup} · ${entry.title}`, 'galmuri9', COLORS.magenta));
    entry.body.forEach((b, i) => c.add(text(this, x + 14, y + 28 + i * 14, b, 'galmuri9', COLORS.uiText)));
    const hint = text(this, 0, y + h - 13, UI_TEXT.continuePrompt, 'galmuri7', COLORS.uiDim);
    hint.x = x + w - hint.width - 8;
    c.add(hint);
    this.logBox = c;
    this.logT = 0;
  }

  private closeLog(): void {
    this.logBox?.destroy();
    this.logBox = null;
  }

  showSignalLost(v: boolean): void {
    if (v && !this.lost.visible) this.lostT = 0;
    this.lost.setVisible(v);
  }

  showClear(stats: { time: number; deaths: number; logs: string[] }): void {
    this.dlgQueue = [];
    this.dlgOpen = false;
    this.dlgBox.setVisible(false);
    const w = 240;
    const h = 112;
    const x = Math.round((GAME_W - w) / 2);
    const y = 70;
    const c = this.add.container(0, 0);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.55).setOrigin(0, 0));
    c.add(panel(this, x, y, w, h));
    const t = text(this, 0, y + 10, UI_TEXT.stageClear, 'galmuri11b', COLORS.acid);
    t.x = Math.round((GAME_W - t.width) / 2);
    const s = text(this, 0, y + 28, UI_TEXT.stageClearSub, 'galmuri9', COLORS.uiText);
    s.x = Math.round((GAME_W - s.width) / 2);
    c.add([t, s]);
    const rows: [string, string][] = [
      [UI_TEXT.time, fmtTime(stats.time)],
      [UI_TEXT.deaths, `${stats.deaths}`],
      [UI_TEXT.logs, `${stats.logs.length} / ${Object.keys(LOGS).length}`],
    ];
    rows.forEach(([k, v], i) => {
      c.add(text(this, x + 40, y + 50 + i * 13, k, 'galmuri9', COLORS.uiDim));
      const vt = text(this, 0, y + 50 + i * 13, v, 'galmuri9', COLORS.white);
      vt.x = x + w - 40 - vt.width;
      c.add(vt);
    });
    const hint = text(this, 0, y + h - 14, UI_TEXT.continuePrompt, 'galmuri7', COLORS.cyan);
    hint.x = Math.round((GAME_W - hint.width) / 2);
    c.add(hint);
    this.clear = c;
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += dt;
    const g = this.game_;
    if (!g || !g.player) return;

    // health
    const hp = Math.max(0, g.player.hp);
    if (hp < this.lastHp) this.hpFlash = 0.5;
    this.lastHp = hp;
    this.hpFlash -= dt;
    this.hp.forEach((img, i) => {
      if (i < hp) img.setFrame(this.hpFlash > 0 && Math.floor(this.elapsed * 20) % 2 ? 'hp_flash' : 'hp_full');
      else img.setFrame('hp_empty');
      img.y = i < hp && hp <= 1 ? 10 + (Math.floor(this.elapsed * 6) % 2) : 10;
    });
    this.logCount.setText(`${g.stats.logs.length}/${Object.keys(LOGS).length}`);
    this.timer.setText(fmtTime(g.stats.time));

    // stage card
    this.cardT += dt;
    const a = this.cardT < 0.6 ? this.cardT / 0.6 : this.cardT > 3.4 ? Math.max(0, 1 - (this.cardT - 3.4) / 0.6) : 1;
    this.stageCard.setAlpha(a).setVisible(a > 0);
    const line = this.stageCard.list[0] as Phaser.GameObjects.Rectangle;
    line.width = Math.min(200, this.cardT * 300);

    // dialogue
    if (this.dlgOpen) {
      this.dlgTw.update(dt);
      if (this.dlgTw.done) {
        this.dlgHold -= dt;
        if (this.dlgHold <= 0) this.nextLine();
      }
    }
    // toast
    if (this.toastT > 0) {
      this.toastT -= dt;
      this.toastBox.setAlpha(Math.min(1, this.toastT * 3));
      if (this.toastT <= 0) this.toastBox.setVisible(false);
    }
    // log panel auto-dismiss
    if (this.logBox) {
      this.logT += dt;
      if (this.logT > 9) this.closeLog();
    }
    if (this.lost.visible) {
      this.lostT += dt;
      this.lost.setAlpha(Math.min(1, this.lostT * 4) * (Math.floor(this.elapsed * 12) % 7 === 0 ? 0.6 : 1));
    }
  }
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
