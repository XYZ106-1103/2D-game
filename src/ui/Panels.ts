import Phaser from 'phaser';
import { COLORS } from '../art/palette.ts';
import { GAME_W } from '../config.ts';
import { CONTROLS, UI_TEXT } from '../data/story.ts';
import { settings, saveSettings } from '../core/Settings.ts';
import { audio } from '../audio/AudioEngine.ts';
import { Menu } from './Menu.ts';
import { panel, text } from './Ui.ts';

/** Options overlay (volume sliders, toggles, fullscreen). */
export class OptionsPanel {
  readonly root: Phaser.GameObjects.Container;
  private menu: Menu;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    const w = 236;
    const h = 150;
    const x = Math.round((GAME_W - w) / 2);
    const y = 62;
    this.root = scene.add.container(0, 0).setDepth(200);
    const bg = panel(scene, x, y, w, h);
    const title = text(scene, x + 12, y + 8, UI_TEXT.options, 'galmuri11b', COLORS.cyan);
    this.root.add([bg, title]);
    const vol = (k: 'master' | 'music' | 'sfx', label: string) => ({
      label: () => `${label.padEnd(8, ' ')}  ${slider(settings[k])}`,
      adjust: (d: number) => {
        settings[k] = Math.round(Math.max(0, Math.min(1, settings[k] + d * 0.1)) * 10) / 10;
        saveSettings();
        audio.play('ui_move');
      },
    });
    const tog = (k: 'shake' | 'flash', label: string) => ({
      label: () => `${label}  ${settings[k] ? UI_TEXT.on : UI_TEXT.off}`,
      adjust: () => {
        settings[k] = !settings[k];
        saveSettings();
        audio.play('ui_move');
      },
    });
    this.menu = new Menu(
      scene,
      x + 20,
      y + 30,
      [
        vol('master', UI_TEXT.master),
        vol('music', UI_TEXT.music),
        vol('sfx', UI_TEXT.sfx),
        tog('shake', UI_TEXT.shake),
        tog('flash', UI_TEXT.flash),
        {
          label: UI_TEXT.fullscreen,
          action: () => {
            if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
            else scene.scale.startFullscreen();
          },
        },
        { label: UI_TEXT.back, action: onClose },
      ],
      { width: w - 48, spacing: 15 },
    );
    this.menu.onBack = onClose;
    this.root.add(this.menu.container);
  }

  update(dt: number): void {
    this.menu.update(dt);
  }

  destroy(): void {
    this.menu.destroy();
    this.root.destroy();
  }
}

function slider(v: number): string {
  const n = Math.round(v * 10);
  return '■'.repeat(n) + '□'.repeat(10 - n);
}

/** Controls reference overlay with key caps. */
export class ControlsPanel {
  readonly root: Phaser.GameObjects.Container;
  private menu: Menu;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    const w = 300;
    const h = 176;
    const x = Math.round((GAME_W - w) / 2);
    const y = 50;
    this.root = scene.add.container(0, 0).setDepth(200);
    this.root.add(panel(scene, x, y, w, h));
    this.root.add(text(scene, x + 12, y + 8, UI_TEXT.controls, 'galmuri11b', COLORS.cyan));
    CONTROLS.forEach((c, i) => {
      const ry = y + 30 + i * 18;
      let kx = x + 16;
      for (const k of c.keys) {
        if (k.startsWith('MOUSE')) {
          const img = scene.add.image(kx, ry - 2, 'ui', k === 'MOUSE_L' ? 'mouse_l' : 'mouse_r').setOrigin(0, 0);
          this.root.add(img);
          kx += 18;
          continue;
        }
        const wide = k.length > 1;
        const frame = k === 'SPACE' ? 'key_space' : wide ? 'key_wide' : 'key';
        const cap = scene.add.image(kx, ry, 'ui', frame).setOrigin(0, 0);
        const capW = cap.width;
        const lbl = text(scene, kx + 1, ry - 1, k, 'galmuri7', COLORS.white, false);
        lbl.x = Math.round(kx + (capW - lbl.width) / 2);
        this.root.add([cap, lbl]);
        kx += capW + 3;
      }
      this.root.add(text(scene, x + 108, ry + 1, c.label, 'galmuri9', COLORS.uiText));
    });
    this.menu = new Menu(scene, x + w - 70, y + h - 18, [{ label: UI_TEXT.back, action: onClose }], { width: 50 });
    this.menu.onBack = onClose;
    this.root.add(this.menu.container);
  }

  update(dt: number): void {
    this.menu.update(dt);
  }

  destroy(): void {
    this.menu.destroy();
    this.root.destroy();
  }
}
