import Phaser from 'phaser';
import { COLORS } from '../art/palette.ts';

export type FontKey = 'galmuri7' | 'galmuri9' | 'galmuri11' | 'galmuri11b';

/** Pixel-perfect bitmap text with an optional 1px drop shadow. */
export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  font: FontKey = 'galmuri9',
  color: number = COLORS.uiText,
  shadow = true,
): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), font, str);
  t.setTint(color);
  if (shadow) t.setDropShadow(1, 1, 0x0a0612, 1);
  return t;
}

/** Nine-slice panel from the ui atlas. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, frame = 'panel'): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(Math.round(x), Math.round(y), 'ui', frame, Math.round(w), Math.round(h), 8, 8, 8, 8).setOrigin(0, 0);
}

/** Typewriter helper: reveals `full` over time. Returns true when finished. */
export class Typewriter {
  private full = '';
  private shown = 0;
  private acc = 0;
  private target: Phaser.GameObjects.BitmapText;
  private cps: number;
  onChar: (() => void) | null = null;

  constructor(target: Phaser.GameObjects.BitmapText, cps = 38) {
    this.target = target;
    this.cps = cps;
  }

  start(str: string): void {
    this.full = str;
    this.shown = 0;
    this.acc = 0;
    this.target.setText('');
  }

  get done(): boolean {
    return this.shown >= this.full.length;
  }

  finish(): void {
    this.shown = this.full.length;
    this.target.setText(this.full);
  }

  update(dt: number): void {
    if (this.done) return;
    this.acc += dt * this.cps;
    let changed = false;
    while (this.acc >= 1 && this.shown < this.full.length) {
      this.acc -= 1;
      this.shown++;
      changed = true;
      if (this.onChar && this.full[this.shown - 1] !== ' ' && this.shown % 2 === 0) this.onChar();
    }
    if (changed) this.target.setText(this.full.slice(0, this.shown));
  }
}

/** Wrap text to a pixel width using the bitmap font metrics. */
export function wrap(scene: Phaser.Scene, font: FontKey, str: string, maxW: number): string {
  const probe = scene.add.bitmapText(-1000, -1000, font, '');
  const words = str.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    probe.setText(next);
    if (probe.width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  probe.destroy();
  return lines.join('\n');
}
