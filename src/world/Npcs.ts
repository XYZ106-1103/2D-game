import Phaser from 'phaser';
import { DEPTH } from '../config.ts';
import type { Player } from '../entities/Player.ts';
import type { Input } from '../core/Input.ts';
import type { NpcDef } from './LevelData.ts';

interface NpcObj {
  def: NpcDef;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  talked: boolean;
  t: number;
}

/**
 * Hub characters. Walk up and press [W]/[↑] to talk; the scene locks the
 * player while the conversation plays. Required characters gate the exit.
 */
export class Npcs {
  private list: NpcObj[] = [];
  private prompt: Phaser.GameObjects.Image;
  /** Opens a conversation (scene → HUD). */
  onTalk: ((dialog: string, npc: NpcDef) => void) | null = null;
  /** All required conversations done. */
  onAllRequired: (() => void) | null = null;
  private doneFired = false;

  constructor(scene: Phaser.Scene, defs: NpcDef[]) {
    for (const def of defs) {
      const sprite = scene.add.image(def.x, def.y, 'npcs', `${def.id}_0`).setOrigin(0.5, 1).setDepth(DEPTH.player - 2).setFlipX(def.face < 0);
      const label = scene.add.bitmapText(def.x, def.y - 46, 'galmuri7', def.name).setOrigin(0.5, 1).setDepth(DEPTH.player - 1).setTint(def.required ? 0xffc870 : 0xd2d6e8).setAlpha(0);
      this.list.push({ def, sprite, label, talked: false, t: Math.random() * 3 });
    }
    this.prompt = scene.add.image(0, 0, 'ch3', 'talk').setDepth(DEPTH.cursor - 2).setVisible(false);
  }

  get any(): boolean {
    return this.list.length > 0;
  }

  get requiredDone(): boolean {
    return this.list.every((n) => !n.def.required || n.talked);
  }

  /** The co-op partner talked to this NPC. */
  markTalked(id: string): void {
    const n = this.list.find((q) => q.def.id === id);
    if (n) n.talked = true;
  }

  /** Ids of everyone talked to (for saves / endings). */
  talkedIds(): string[] {
    return this.list.filter((n) => n.talked).map((n) => n.def.id);
  }

  update(dt: number, p: Player, input: Input, busy: boolean): void {
    let near: NpcObj | null = null;
    for (const n of this.list) {
      n.t += dt;
      const dx = p.x - n.def.x;
      const close = Math.abs(dx) < 26 && Math.abs(p.feetY - n.def.y) < 30;
      if (Math.abs(dx) < 90) n.sprite.setFlipX(dx < 0);
      n.sprite.setFrame(`${n.def.id}_${Math.floor(n.t * 1.6) % 2}`);
      n.label.setAlpha(Math.max(0, Math.min(1, n.label.alpha + (Math.abs(dx) < 70 ? dt * 4 : -dt * 4))));
      if (close && !near) near = n;
    }
    const can = !!near && !busy && p.onGround && !p.dead;
    this.prompt.setVisible(can);
    if (near && can) {
      this.prompt.setPosition(near.def.x, near.def.y - 56 + Math.round(Math.sin(near.t * 5)));
      if (input.take('up')) {
        near.talked = true;
        this.onTalk?.(near.def.dialog, near.def);
      }
    } else input.take('up');
    if (!this.doneFired && this.list.length && this.requiredDone) {
      this.doneFired = true;
      this.onAllRequired?.();
    }
  }

  destroy(): void {
    for (const n of this.list) {
      n.sprite.destroy();
      n.label.destroy();
    }
    this.prompt.destroy();
  }
}
