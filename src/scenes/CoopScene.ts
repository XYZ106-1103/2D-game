import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { unlockedStage } from '../core/Settings.ts';
import { CHAPTER_STARTS } from '../world/levels/index.ts';
import { Parallax } from '../world/Parallax.ts';
import { Menu, type MenuItem } from '../ui/Menu.ts';
import { panel, text } from '../ui/Ui.ts';
import { coopServerUrl, net, saveCoopServerUrl, type NetMsg } from '../net/Net.ts';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Display names by room slot: the host is ION, guests MOTH then RU. */
const NAMES = ['이온', '모스', '루'];
const ROOM_SIZE = 3;

/**
 * Online co-op lobby (two or three players): host a room (play as ION) or
 * join one with its code (play as MOTH or RU, by arrival). The host picks
 * where to start once at least one guest is in; guests follow.
 */
export class CoopScene extends Phaser.Scene {
  private menu: Menu | null = null;
  private box!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.BitmapText;
  private info!: Phaser.GameObjects.BitmapText;
  private codeText!: Phaser.GameObjects.BitmapText;
  private parallax!: Parallax;
  private mode: 'menu' | 'busy' | 'host' | 'join' | 'wait' = 'menu';
  private typed = '';
  private offs: (() => void)[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super('Coop');
  }

  create(): void {
    this.mode = 'menu';
    this.typed = '';
    this.menu = null;
    this.offs = [];
    this.cameras.main.setBackgroundColor('#05030a');
    this.parallax = new Parallax(this, 800);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.45).setOrigin(0, 0).setDepth(90);
    this.add.image(GAME_W / 2, 34, 'ui', 'logo').setDepth(100);
    const w = 300;
    const x = Math.round((GAME_W - w) / 2);
    this.box = this.add.container(0, 0).setDepth(100);
    this.box.add(panel(this, x, 64, w, 178));
    this.title = text(this, 0, 72, '온라인 협동 — 최대 3인', 'galmuri11b', COLORS.cyan);
    this.title.x = Math.round((GAME_W - this.title.width) / 2);
    this.info = text(this, x + 14, 92, '', 'galmuri9', COLORS.uiDim);
    this.codeText = text(this, 0, 112, '', 'galmuri11b', COLORS.amberHot).setVisible(false);
    this.box.add([this.title, this.info, this.codeText]);
    this.keyHandler = (e) => this.onKey(e);
    this.input.keyboard!.on('keydown', this.keyHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.offs.push(
      net.on('peer', () => {
        if (this.mode === 'host') this.showHost();
        else if (this.mode === 'wait') this.showWait();
      }),
    );
    this.offs.push(net.on('ev', (m) => this.onEvent(m)));
    this.offs.push(net.on('disconnected', () => this.fail('서버와의 연결이 끊어졌습니다.')));
    this.offs.push(net.on('closed', () => this.mode === 'wait' && this.fail('방장이 방을 닫았습니다.')));
    this.cameras.main.fadeIn(400, 5, 3, 10);
    if (net.active) {
      // came back from a game while still connected
      if (net.role === 'host') this.showHost();
      else this.showWait();
    } else this.showMenu();
  }

  private setInfo(s: string, col: number = COLORS.uiDim): void {
    this.info.setText(s).setTint(col);
  }

  private setMenu(items: MenuItem[], y = 150): void {
    this.menu?.container.destroy();
    this.menu?.destroy();
    this.menu = new Menu(this, Math.round((GAME_W - 300) / 2) + 40, y, items, { width: 220 });
    this.menu.container.setDepth(101);
    this.menu.onBack = () => this.back();
  }

  private showMenu(): void {
    this.mode = 'menu';
    this.codeText.setVisible(false);
    const url = coopServerUrl();
    this.setInfo(url ? `서버: ${url.replace(/^https?:\/\//, '').slice(0, 34)}` : '서버 주소가 아직 없습니다 — 먼저 설정해 주세요.', url ? COLORS.uiDim : COLORS.amberHot);
    this.setMenu([
      { label: '방 만들기 — 이온으로 플레이', action: () => this.host(), disabled: !url },
      { label: '방 참가 — 모스 / 루로 플레이', action: () => this.showJoin(), disabled: !url },
      { label: '서버 주소 설정', action: () => this.setServer() },
      { label: '돌아가기', action: () => this.back() },
    ], 118);
  }

  private setServer(): void {
    const cur = coopServerUrl();
    const v = window.prompt('협동 서버 주소 (예: https://tetherfall-coop.onrender.com)', cur);
    if (v === null) return;
    saveCoopServerUrl(v.trim().replace(/\/+$/, ''));
    this.showMenu();
  }

  private async connect(): Promise<boolean> {
    this.mode = 'busy';
    this.setMenu([{ label: '취소', action: () => this.back() }], 196);
    try {
      await net.connect(undefined, (s) => this.setInfo(s === 'waking' ? '서버를 깨우는 중… (처음엔 최대 1분)' : '연결 중…', COLORS.cyan));
      return true;
    } catch {
      this.fail('서버에 연결하지 못했습니다. 주소와 인터넷 연결을 확인해 주세요.');
      return false;
    }
  }

  private async host(): Promise<void> {
    if (!(await this.connect())) return;
    try {
      await net.create();
      this.showHost();
    } catch {
      this.fail('방을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  private showHost(): void {
    this.mode = 'host';
    this.codeText.setText(`방 코드  ${net.code}   ${this.count()}`).setVisible(true);
    this.codeText.x = Math.round((GAME_W - this.codeText.width) / 2);
    if (!net.peer) {
      this.setInfo('동료에게 방 코드를 알려 주세요. 기다리는 중…', COLORS.cyan);
      this.setMenu([{ label: '방 닫기', action: () => this.back() }], 196);
      return;
    }
    const who = [...net.peers].sort().map((s) => NAMES[s] ?? '?').join(' · ');
    this.setInfo(net.peers.size + 1 < ROOM_SIZE ? `${who} 입장! 시작하거나 한 명 더 기다리세요` : `${who} 입장! 어디서 시작할까요?`, COLORS.acid);
    const max = unlockedStage();
    this.setMenu([
      { label: '처음부터 — CHAPTER 1', action: () => this.start(CHAPTER_STARTS[0]) },
      { label: 'CHAPTER 2부터', action: () => this.start(CHAPTER_STARTS[1]), disabled: max < CHAPTER_STARTS[1] },
      { label: 'CHAPTER 3부터', action: () => this.start(CHAPTER_STARTS[2]), disabled: max < CHAPTER_STARTS[2] },
      { label: '방 닫기', action: () => this.back() },
    ], 140);
  }

  private showJoin(): void {
    this.mode = 'join';
    this.typed = '';
    this.menu?.container.destroy();
    this.menu?.destroy();
    this.menu = null;
    this.setInfo('방 코드 4자리를 입력하고 Enter (Esc: 돌아가기)', COLORS.cyan);
    this.refreshCode();
  }

  private refreshCode(): void {
    const shown = (this.typed + '____').slice(0, 4).split('').join(' ');
    this.codeText.setText(shown).setVisible(true);
    this.codeText.x = Math.round((GAME_W - this.codeText.width) / 2);
  }

  private async join(): Promise<void> {
    const code = this.typed;
    if (!(await this.connect())) return;
    try {
      await net.join(code);
      this.showWait();
    } catch (e) {
      const r = (e as Error).message;
      this.fail(r === 'nocode' ? '그런 방이 없습니다. 코드를 확인해 주세요.' : r === 'full' ? '이미 세 사람이 있는 방입니다.' : '방에 들어가지 못했습니다.');
    }
  }

  private showWait(): void {
    this.mode = 'wait';
    this.codeText.setText(`방 ${net.code}   ${this.count()}`).setVisible(true);
    this.codeText.x = Math.round((GAME_W - this.codeText.width) / 2);
    this.setInfo(`연결됨! ${NAMES[net.slot] ?? '동료'}로 참가 — 방장 대기 중…`, COLORS.acid);
    this.setMenu([{ label: '나가기', action: () => this.back() }], 196);
  }

  /** Players in the room, e.g. "2/3". */
  private count(): string {
    return `${net.peers.size + 1}/${ROOM_SIZE}`;
  }

  private onEvent(m: NetMsg): void {
    // the host's game announces its stage: follow it in
    if (this.mode === 'wait' && m.e === 'stage') this.launch(Number(m.i));
  }

  private start(stage: number): void {
    audio.play('ui_select');
    this.launch(stage);
  }

  private launch(stage: number): void {
    this.registry.set('coop', true);
    this.registry.set('run', { time: 0, deaths: 0, kills: 0, bestCombo: 0, logs: [] });
    this.registry.set('continue', false);
    this.input.keyboard!.enabled = false;
    this.cameras.main.fadeOut(400, 5, 3, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.input.keyboard!.enabled = true;
      this.scene.start('Game', { stage });
    });
  }

  private fail(msg: string): void {
    net.close();
    this.mode = 'menu';
    this.codeText.setVisible(false);
    this.setInfo(msg, COLORS.crimsonHot);
    this.setMenu([
      { label: '다시 시도', action: () => this.showMenu() },
      { label: '돌아가기', action: () => this.back() },
    ], 150);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.mode !== 'join') return;
    if (e.key === 'Escape') {
      this.showMenu();
      return;
    }
    if (e.key === 'Backspace') {
      this.typed = this.typed.slice(0, -1);
      this.refreshCode();
      return;
    }
    if (e.key === 'Enter') {
      if (this.typed.length === 4) void this.join();
      return;
    }
    const ch = e.key.toUpperCase();
    if (ch.length === 1 && CODE_CHARS.includes(ch) && this.typed.length < 4) {
      this.typed += ch;
      audio.play('ui_move');
      this.refreshCode();
    }
  }

  private back(): void {
    net.close();
    this.registry.set('coop', false);
    this.scene.start('Title');
  }

  override update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.menu?.update(dt);
    this.parallax.update(dt, (this.time.now / 1000) * 12, 0);
  }

  private cleanup(): void {
    for (const off of this.offs) off();
    this.offs = [];
    if (this.keyHandler) this.input.keyboard?.off('keydown', this.keyHandler);
    this.keyHandler = null;
  }
}
