import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config.ts';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { UI_TEXT } from '../data/story.ts';
import { Menu } from '../ui/Menu.ts';
import { ControlsPanel, OptionsPanel } from '../ui/Panels.ts';
import { panel, text } from '../ui/Ui.ts';
import type { GameScene } from './GameScene.ts';

export class PauseScene extends Phaser.Scene {
  private menu!: Menu;
  private overlay: OptionsPanel | ControlsPanel | null = null;
  private box!: Phaser.GameObjects.Container;

  constructor() {
    super('Pause');
  }

  create(): void {
    this.overlay = null;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.62).setOrigin(0, 0);
    const w = 168;
    const h = 108;
    const x = Math.round((GAME_W - w) / 2);
    const y = 70;
    this.box = this.add.container(0, 0);
    this.box.add(panel(this, x, y, w, h));
    const t = text(this, 0, y + 8, UI_TEXT.paused, 'galmuri11b', COLORS.cyan);
    t.x = Math.round((GAME_W - t.width) / 2);
    this.box.add(t);
    this.menu = new Menu(this, x + 24, y + 32, [
      { label: UI_TEXT.resume, action: () => this.resume() },
      { label: UI_TEXT.restart, action: () => this.restart() },
      { label: UI_TEXT.controls, action: () => this.openOverlay('controls') },
      { label: UI_TEXT.options, action: () => this.openOverlay('options') },
      { label: UI_TEXT.toTitle, action: () => this.toTitle() },
    ], { width: w - 52 });
    this.menu.onBack = () => this.resume();
    this.box.add(this.menu.container);
    audio.play('ui_back');
  }

  private openOverlay(kind: 'controls' | 'options'): void {
    this.box.setVisible(false);
    this.menu.active = false;
    const close = () => {
      const o = this.overlay;
      this.overlay = null;
      this.events.once('postupdate', () => {
        o?.destroy();
        this.box.setVisible(true);
        this.menu.active = true;
      });
    };
    this.overlay = kind === 'controls' ? new ControlsPanel(this, close) : new OptionsPanel(this, close);
  }

  private resume(): void {
    const g = this.scene.get('Game') as GameScene;
    this.scene.stop();
    this.scene.resume('Game');
    g.onResume();
  }

  private restart(): void {
    const g = this.scene.get('Game') as GameScene;
    this.resume();
    g.restartFromCheckpoint();
  }

  private toTitle(): void {
    audio.stopMusic(0);
    audio.resumeGame();
    this.scene.stop('Hud');
    this.scene.stop('Game');
    this.scene.start('Title');
  }

  override update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.menu.update(dt);
    this.overlay?.update(dt);
  }
}
