import Phaser from 'phaser';
import { COLORS } from '../art/palette.ts';
import { audio } from '../audio/AudioEngine.ts';
import { text, type FontKey } from './Ui.ts';

export interface MenuItem {
  label: string | (() => string);
  action?: () => void;
  /** Left/right adjust (sliders, toggles). */
  adjust?: (dir: number) => void;
  disabled?: boolean;
}

/**
 * Keyboard + mouse vertical menu. Up/Down/W/S to move, Enter/Space to pick,
 * Left/Right to adjust, Esc to back.
 */
export class Menu {
  private scene: Phaser.Scene;
  private items: MenuItem[];
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private cursor: Phaser.GameObjects.Image;
  private bar: Phaser.GameObjects.Image;
  private index = 0;
  private x: number;
  private y: number;
  private spacing: number;
  private width: number;
  private time = 0;
  onBack: (() => void) | null = null;
  private keyHandler: (e: KeyboardEvent) => void;
  active = true;
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, items: MenuItem[], opts: { spacing?: number; width?: number; font?: FontKey; center?: boolean } = {}) {
    this.scene = scene;
    this.items = items;
    this.x = x;
    this.y = y;
    this.spacing = opts.spacing ?? 16;
    this.width = opts.width ?? 140;
    this.container = scene.add.container(0, 0);
    this.bar = scene.add.image(x - 8, y, 'ui', 'selbar').setOrigin(0, 0).setDisplaySize(this.width + 16, 12).setAlpha(0.8);
    this.cursor = scene.add.image(x - 6, y, 'ui', 'cursor').setOrigin(0, 0);
    this.container.add([this.bar, this.cursor]);
    items.forEach((it, i) => {
      const t = text(scene, x + 4, y + i * this.spacing, this.labelOf(it), opts.font ?? 'galmuri9', it.disabled ? COLORS.uiDim : COLORS.uiText);
      t.setInteractive(new Phaser.Geom.Rectangle(-8, -2, this.width + 12, 14), Phaser.Geom.Rectangle.Contains);
      t.on('pointerover', () => {
        if (!this.active || it.disabled) return;
        if (this.index !== i) audio.play('ui_move');
        this.index = i;
        this.refresh();
      });
      t.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!this.active || it.disabled) return;
        this.index = i;
        if (it.adjust) it.adjust(p.x > x + this.width * 0.6 ? 1 : -1);
        else this.pick();
        this.refresh();
      });
      this.labels.push(t);
      this.container.add(t);
    });
    while (this.items[this.index]?.disabled) this.index++;
    this.keyHandler = (e: KeyboardEvent) => this.onKey(e);
    scene.input.keyboard!.on('keydown', this.keyHandler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.refresh();
  }

  private labelOf(it: MenuItem): string {
    return typeof it.label === 'function' ? it.label() : it.label;
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.active) return;
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.move(-1);
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.move(1);
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.items[this.index].adjust?.(-1);
        this.refresh();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.items[this.index].adjust?.(1);
        this.refresh();
        break;
      case 'Enter':
      case 'Space':
      case 'KeyJ':
        if (this.items[this.index].adjust) {
          this.items[this.index].adjust!(1);
          this.refresh();
        } else this.pick();
        break;
      case 'Escape':
      case 'Backspace':
        if (this.onBack) {
          audio.play('ui_back');
          this.onBack();
        }
        break;
      default:
        break;
    }
  }

  private move(d: number): void {
    const n = this.items.length;
    let i = this.index;
    for (let k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (!this.items[i].disabled) break;
    }
    if (i !== this.index) audio.play('ui_move');
    this.index = i;
    this.refresh();
  }

  private pick(): void {
    const it = this.items[this.index];
    if (it.disabled || !it.action) return;
    audio.play('ui_select');
    it.action();
  }

  refresh(): void {
    this.items.forEach((it, i) => {
      const sel = i === this.index;
      this.labels[i].setText(this.labelOf(it));
      this.labels[i].setTint(it.disabled ? COLORS.uiDim : sel ? COLORS.white : COLORS.uiText);
      this.labels[i].x = this.x + 4 + (sel ? 4 : 0);
    });
    this.bar.y = this.y + this.index * this.spacing - 2;
    this.cursor.y = this.y + this.index * this.spacing + 1;
  }

  update(dt: number): void {
    this.time += dt;
    this.cursor.x = this.x - 6 + (Math.floor(this.time * 3) % 2);
    this.bar.setAlpha(0.55 + Math.sin(this.time * 4) * 0.15);
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
    this.active = v;
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.container.destroy();
  }
}
