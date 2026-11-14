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
  private toastPanel!: Phaser.GameObjects.NineSlice;
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
  private comboNum!: Phaser.GameObjects.BitmapText;
  private comboLbl!: Phaser.GameObjects.BitmapText;
  private comboT = 0;
  private comboPop = 0;
  // cinematic pieces
  private barTop!: Phaser.GameObjects.Rectangle;
  private barBot!: Phaser.GameObjects.Rectangle;
  private barsOn = false;
  private barsK = 0;
  private card: Phaser.GameObjects.Container | null = null;
  private cardLife = 0;
  private boss: { frame: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Rectangle; ghost: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.BitmapText; hp: () => number; shown: number } | null = null;
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
    // co-op: the partners' names and health under ours (up to two)
    this.partnerLbls = [0, 1].map((i) => text(this, 8, 31 + i * 9, '', 'galmuri7', COLORS.cyan).setVisible(false));
    this.timer = text(this, GAME_W - 46, 6, '00:00', 'galmuri7', COLORS.uiDim);

    // --- dialogue box --------------------------------------------------------------
    // tall enough for two wrapped lines (most long lines wrap once)
    const dw = 292;
    const dx = Math.round((GAME_W - dw) / 2);
    const dy = GAME_H - 54;
    this.dlgBox = this.add.container(0, 0);
    this.dlgBox.add(panel(this, dx, dy, dw, 48));
    this.dlgName = text(this, dx + 10, dy + 4, 'MOTH', 'galmuri7', COLORS.cyan);
    this.dlgText = text(this, dx + 10, dy + 15, '', 'galmuri9', COLORS.uiText);
    this.dlgBox.add([this.dlgName, this.dlgText]);
    this.dlgBox.setVisible(false).setDepth(320);
    this.dlgTw = new Typewriter(this.dlgText, 40);
    this.dlgTw.onChar = () => audio.play('type', { vol: 0.6 });

    // --- toast ----------------------------------------------------------------------
    this.toastBox = this.add.container(0, 0).setVisible(false);
    this.toastPanel = panel(this, GAME_W - 132, 20, 124, 30);
    this.toastBox.add(this.toastPanel);
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
    // a soft dark band keeps the title readable over bright daylight stages
    const band = this.add.rectangle(GAME_W / 2, 104, Math.max(t1.width, t2.width, 200) + 48, 38, 0x05030a, 0.55).setOrigin(0.5, 0.5);
    this.stageCard.add([line, band, t1, t2]);
    this.cardT = this.game_.level.data.boss ? 99 : 0;

    this.comboNum = text(this, 0, 78, '', 'galmuri11b', COLORS.cyan).setVisible(false);
    this.comboLbl = text(this, 0, 94, 'HIT', 'galmuri7', COLORS.uiText).setVisible(false);

    this.barTop = this.add.rectangle(0, 0, GAME_W, 26, 0x000000).setOrigin(0, 0).setDepth(300);
    this.barBot = this.add.rectangle(0, GAME_H, GAME_W, 26, 0x000000).setOrigin(0, 0).setDepth(300);
    this.barsK = 0;
    this.barsOn = false;
    this.card = null;
    this.boss = null;

    this.input.keyboard!.on('keydown-SPACE', () => this.onConfirm());
    this.input.keyboard!.on('keydown-ENTER', () => this.onConfirm());
  }

  private partnerLbls: Phaser.GameObjects.BitmapText[] = [];

  /** Co-op partner status lines, one per partner (an empty list hides them). */
  partnerInfo(lines: [string, number][]): void {
    this.partnerLbls.forEach((lbl, i) => {
      const l = lines[i];
      if (l) lbl.setVisible(true).setText(l[0]).setTint(l[1]);
      else lbl.setVisible(false);
    });
  }

  /** True while a conversation is on screen. */
  get talking(): boolean {
    return this.dlgOpen;
  }

  /** Hubs: Space / Enter advances the conversation. */
  advanceDialog(): void {
    if (!this.dlgOpen) return;
    if (!this.dlgTw.done) this.dlgTw.finish();
    else this.nextLine();
  }

  /** Make conversations wait for a key press instead of timing out. */
  manualDialog = false;

  private choice: { box: Phaser.GameObjects.Container; items: Phaser.GameObjects.BitmapText[]; idx: number; cb: (i: number) => void } | null = null;

  /** Modal choice (the final decision). Up/Down to move, Space/Enter to pick. */
  showChoice(title: string, options: string[], cb: (i: number) => void): void {
    const w = 300;
    const h = 40 + options.length * 22;
    const x = Math.round((GAME_W - w) / 2);
    const y = Math.round((GAME_H - h) / 2) - 10;
    const box = this.add.container(0, 0).setDepth(50);
    box.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.55).setOrigin(0, 0));
    box.add(panel(this, x, y, w, h));
    const t = text(this, 0, y + 9, title, 'galmuri11b', COLORS.cyan);
    t.x = Math.round((GAME_W - t.width) / 2);
    box.add(t);
    const items = options.map((o, i) => {
      const it = text(this, x + 26, y + 34 + i * 22, o, 'galmuri9', COLORS.uiText);
      box.add(it);
      return it;
    });
    this.choice = { box, items, idx: 0, cb };
    this.paintChoice();
    const kb = this.input.keyboard!;
    const move = (d: number) => {
      if (!this.choice) return;
      this.choice.idx = (this.choice.idx + d + this.choice.items.length) % this.choice.items.length;
      audio.play('ui_move');
      this.paintChoice();
    };
    const keys: [string, () => void][] = [
      ['keydown-UP', () => move(-1)],
      ['keydown-W', () => move(-1)],
      ['keydown-DOWN', () => move(1)],
      ['keydown-S', () => move(1)],
    ];
    for (const [k, fn] of keys) kb.on(k, fn);
    this.choiceKeys = keys;
  }

  private choiceKeys: [string, () => void][] = [];

  private paintChoice(): void {
    if (!this.choice) return;
    this.choice.items.forEach((it, i) => {
      const on = i === this.choice!.idx;
      it.setTint(on ? COLORS.amberHot : COLORS.uiDim);
      it.setText((on ? '▶ ' : '  ') + it.text.replace(/^(▶ | {2})/, ''));
    });
  }

  private pickChoice(): void {
    if (!this.choice) return;
    const c = this.choice;
    this.choice = null;
    for (const [k, fn] of this.choiceKeys) this.input.keyboard!.off(k, fn);
    this.choiceKeys = [];
    audio.play('ui_select');
    c.box.destroy();
    c.cb(c.idx);
  }

  private onConfirm(): void {
    if (this.choice) {
      this.pickChoice();
      return;
    }
    if (this.manualDialog && this.dlgOpen && !this.clear) {
      this.advanceDialog();
      return;
    }
    if (this.clear) {
      audio.play('ui_select');
      this.clear = null;
      this.game_.advanceStage();
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
    const SPEAKER: Record<string, [string, number]> = {
      MOTH: ['MOTH', COLORS.cyan],
      ION: ['이온', COLORS.amberHot],
      NOCTURNE: ['녹턴', COLORS.magenta],
      SYSTEM: ['SYSTEM', COLORS.acid],
      VESPER: ['합의', COLORS.crimsonHot],
      SERIN: ['세린', 0xc0a0ff],
    };
    const [name, tint] = SPEAKER[line.who] ?? [line.who, COLORS.white];
    this.dlgName.setText(name);
    this.dlgName.setTint(tint);
    this.dlgTw.start(wrap(this, 'galmuri9', line.text, 272));
    this.dlgHold = 2.2 + line.text.length * 0.03;
  }

  letterbox(on: boolean): void {
    this.barsOn = on;
  }

  nameCard(title: string, sub: string): void {
    this.card?.destroy();
    const c = this.add.container(0, 0).setDepth(310);
    const t = text(this, 0, 104, title, 'galmuri11b', COLORS.magenta);
    t.x = Math.round((GAME_W - t.width) / 2);
    const st = text(this, 0, 124, sub, 'galmuri7', COLORS.uiText);
    st.x = Math.round((GAME_W - st.width) / 2);
    const line = this.add.rectangle(GAME_W / 2, 120, 160, 1, COLORS.magenta);
    c.add([line, t, st]);
    this.card = c;
    this.cardLife = 3.2;
    audio.play('lock', { pitch: 0.5 });
  }

  bossBar(show: boolean, name = '', hp: () => number = () => 1): void {
    if (!show) {
      if (this.boss) {
        this.boss.frame.destroy();
        this.boss.fill.destroy();
        this.boss.ghost.destroy();
        this.boss.name.destroy();
      }
      this.boss = null;
      return;
    }
    const x = Math.round((GAME_W - 204) / 2);
    const y = 18;
    const frame = this.add.image(x, y, 'ui', 'bossbar').setOrigin(0, 0);
    const ghost = this.add.rectangle(x + 2, y + 2, 200, 5, 0xffffff).setOrigin(0, 0);
    const fill = this.add.rectangle(x + 2, y + 2, 200, 5, COLORS.magenta).setOrigin(0, 0);
    const nm = text(this, x, y - 12, name, 'galmuri9', COLORS.magenta);
    this.boss = { frame, fill, ghost, name: nm, hp, shown: 1 };
  }

  combo(n: number): void {
    this.comboT = 1.6;
    this.comboPop = 0.12;
    if (n < 2) return;
    this.comboNum.setText(`${n}`).setVisible(true);
    this.comboNum.x = GAME_W - 12 - this.comboNum.width;
    this.comboLbl.setVisible(true);
    this.comboLbl.x = GAME_W - 12 - this.comboLbl.width;
    this.comboNum.setTint(n >= 10 ? COLORS.magenta : n >= 5 ? COLORS.amberHot : COLORS.cyan);
  }

  toast(title: string, sub: string): void {
    this.toastTitle.setText(title);
    this.toastSub.setText(sub);
    // the box grows to fit longer messages, anchored to the right edge
    const w = Math.max(124, Math.ceil(Math.max(this.toastTitle.width, this.toastSub.width)) + 20);
    const x = GAME_W - 8 - w;
    this.toastPanel.setPosition(x, 20).setSize(w, 30);
    this.toastTitle.x = x + 10;
    this.toastSub.x = x + 10;
    this.toastBox.setVisible(true);
    this.toastT = 2.4;
  }

  showLog(id: string): void {
    const entry = LOGS[id];
    if (!entry) return;
    this.logBox?.destroy();
    const w = 320;
    const body = entry.body.flatMap((b) => wrap(this, 'galmuri9', b, w - 30).split('\n'));
    const h = 30 + body.length * 14 + 16;
    const x = Math.round((GAME_W - w) / 2);
    const y = 40;
    const c = this.add.container(0, 0);
    c.add(panel(this, x, y, w, h, 'panel_mg'));
    c.add(this.add.image(x + 10, y + 9, 'ui', 'icon_log').setOrigin(0, 0));
    c.add(text(this, x + 24, y + 8, `${UI_TEXT.logPickup} · ${entry.title}`, 'galmuri9', COLORS.magenta));
    body.forEach((b, i) => c.add(text(this, x + 14, y + 28 + i * 14, b, 'galmuri9', COLORS.uiText)));
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

  showClear(stats: { time: number; deaths: number; logs: string[]; kills?: number; bestCombo?: number }, sub = UI_TEXT.stageClearSub): void {
    this.dlgQueue = [];
    this.dlgOpen = false;
    this.dlgBox.setVisible(false);
    const w = 240;
    const h = 138;
    const x = Math.round((GAME_W - w) / 2);
    const y = 70;
    const c = this.add.container(0, 0);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.55).setOrigin(0, 0));
    c.add(panel(this, x, y, w, h));
    const t = text(this, 0, y + 10, UI_TEXT.stageClear, 'galmuri11b', COLORS.acid);
    t.x = Math.round((GAME_W - t.width) / 2);
    const s = text(this, 0, y + 28, sub, 'galmuri9', COLORS.uiText);
    s.x = Math.round((GAME_W - s.width) / 2);
    c.add([t, s]);
    const rows: [string, string][] = [
      [UI_TEXT.time, fmtTime(stats.time)],
      [UI_TEXT.deaths, `${stats.deaths}`],
      [UI_TEXT.kills, `${stats.kills ?? 0}`],
      [UI_TEXT.bestCombo, `${stats.bestCombo ?? 0}`],
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

    // cinematic letterbox
    this.barsK += ((this.barsOn ? 1 : 0) - this.barsK) * Math.min(1, dt * 4);
    this.barTop.y = Math.round(-26 + this.barsK * 26);
    this.barBot.y = Math.round(GAME_H - this.barsK * 26);
    if (this.card) {
      this.cardLife -= dt;
      this.card.setAlpha(Math.min(1, this.cardLife * 2) * (Math.floor(this.elapsed * 30) % 9 === 0 ? 0.5 : 1));
      if (this.cardLife <= 0) {
        this.card.destroy();
        this.card = null;
      }
    }
    if (this.boss) {
      const v = Math.max(0, Math.min(1, this.boss.hp()));
      this.boss.fill.width = Math.round(200 * v);
      this.boss.shown += (v - this.boss.shown) * Math.min(1, dt * 2.5);
      this.boss.ghost.width = Math.round(200 * Math.max(v, this.boss.shown));
    }

    // combo counter
    if (this.comboT > 0) {
      this.comboT -= dt;
      this.comboPop -= dt;
      const pop = this.comboPop > 0 ? -2 : 0;
      this.comboNum.y = 78 + pop;
      const a = Math.min(1, this.comboT * 2.5);
      this.comboNum.setAlpha(a);
      this.comboLbl.setAlpha(a);
      if (this.comboT <= 0) {
        this.comboNum.setVisible(false);
        this.comboLbl.setVisible(false);
      }
    }

    // stage card
    this.cardT += dt;
    const a = this.cardT < 0.6 ? this.cardT / 0.6 : this.cardT > 3.4 ? Math.max(0, 1 - (this.cardT - 3.4) / 0.6) : 1;
    this.stageCard.setAlpha(a).setVisible(a > 0);
    const line = this.stageCard.list[0] as Phaser.GameObjects.Rectangle;
    line.width = Math.min(200, this.cardT * 300);

    // dialogue
    if (this.dlgOpen) {
      this.dlgTw.update(dt);
      if (this.dlgTw.done && !this.manualDialog) {
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
