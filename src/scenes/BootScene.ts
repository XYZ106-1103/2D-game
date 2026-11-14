import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config.ts';
import { NeonPostFX } from '../fx/NeonPostFX.ts';
import { applyAudioSettings } from '../core/Settings.ts';

/** Loads every baked asset with a pixel progress bar, registers the post pipeline. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const bar = this.add.graphics();
    const w = 160;
    const x = (GAME_W - w) / 2;
    const y = GAME_H / 2;
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillStyle(0x1b1530, 1).fillRect(x - 1, y - 1, w + 2, 5);
      bar.fillStyle(0x0e6e80, 1).fillRect(x, y, Math.round(w * p), 3);
      bar.fillStyle(0x3ff0ea, 1).fillRect(x, y, Math.round(w * p), 1);
    });
    this.load.setPath('assets/');
    this.load.spritesheet('player', 'sprites/player.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('moth', 'sprites/moth.png', { frameWidth: 48, frameHeight: 48 });
    this.load.json('player-sheet', 'sprites/player.json');
    this.load.image('tiles', 'sprites/tiles.png');
    for (const k of ['archive', 'refinery', 'core', 'memory', 'garden', 'mast', 'sunroof', 'drowned', 'avenue', 'transit', 'lab', 'harbor', 'clock']) this.load.image(`tiles-${k}`, `sprites/tiles_${k}.png`);
    this.load.spritesheet('trooper', 'sprites/trooper.png', { frameWidth: 48, frameHeight: 48 });
    this.load.json('trooper-sheet', 'sprites/trooper.json');
    this.load.atlas('enemies', 'sprites/enemies.png', 'sprites/enemies.json');
    this.load.atlas('boss', 'sprites/boss.png', 'sprites/boss.json');
    this.load.atlas('props', 'sprites/props.png', 'sprites/props.json');
    this.load.atlas('fx', 'sprites/fx.png', 'sprites/fx.json');
    this.load.atlas('ui', 'sprites/ui.png', 'sprites/ui.json');
    this.load.atlas('ch2', 'sprites/ch2.png', 'sprites/ch2.json');
    this.load.atlas('boss2', 'sprites/boss2.png', 'sprites/boss2.json');
    this.load.atlas('ch3', 'sprites/ch3.png', 'sprites/ch3.json');
    this.load.atlas('npcs', 'sprites/npcs.png', 'sprites/npcs.json');
    this.load.atlas('boss3', 'sprites/boss3.png', 'sprites/boss3.json');
    const ch2 = ['archive_sky', 'archive_far', 'archive_mid', 'archive_near', 'refinery_sky', 'refinery_far', 'refinery_mid', 'refinery_near', 'core_sky', 'core_sphere', 'core_far', 'core_mid', 'memory_sky', 'memory_far', 'memory_mid', 'memory_near', 'garden_sky', 'garden_far', 'garden_mid', 'garden_near', 'mast_sky', 'mast_clouds', 'mast_far', 'mast_mid', 'dawn_sky', 'dawn_clouds', 'dawn_far'];
    for (const t of ['sunroof', 'drowned', 'avenue', 'transit']) for (const l of ['sky', 'far', 'mid', 'near']) ch2.push(`${t}_${l}`);
    for (const t of ['lab', 'harbor', 'clock', 'vesper']) for (const l of ['sky', 'far', 'mid']) ch2.push(`${t}_${l}`);
    for (const k of ['sky', 'spire', 'far', 'mid', 'near', 'fog', 'market_sky', 'market_far', 'market_mid', 'market_near', 'tower_sky', 'tower_far', 'tower_clouds', 'tower_mid', ...ch2])
      this.load.image(`bg-${k}`, `bg/${k}.png`);
    for (const f of ['galmuri7', 'galmuri9', 'galmuri11', 'galmuri11b']) this.load.bitmapFont(f, `fonts/${f}.png`, `fonts/${f}.xml`);
  }

  create(): void {
    const r = this.renderer;
    if (r instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      r.pipelines.addPostPipeline('NeonPostFX', NeonPostFX);
    }
    applyAudioSettings();
    this.scene.start('Title');
  }
}
