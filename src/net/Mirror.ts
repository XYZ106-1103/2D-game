import Phaser from 'phaser';

// World mirroring for online co-op.
//
// The host runs enemies, bosses and their projectiles. While that code runs,
// every display object it creates is tracked; ~20 times a second the host
// sends the visual state of whatever changed. The guest recreates those
// objects and eases them between updates, so it sees the same fight without
// simulating it (and without one serializer per enemy or boss).

type Obj = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  depth: number;
  visible: boolean;
  alpha: number;
  blendMode: number | string;
};
/** Compact state of one object: [id, type, ...fields]. */
export type ObjState = (string | number | number[])[];
export interface MirrorPacket {
  o: ObjState[];
  d: number[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const blendNum = (b: number | string) => (typeof b === 'number' ? b : 0);

function frameName(o: Phaser.GameObjects.Image): string | number {
  const n = o.frame?.name;
  return typeof n === 'number' ? n : String(n ?? 0);
}

function serialize(id: number, o: Obj): ObjState | null {
  if (o instanceof Phaser.GameObjects.Graphics) {
    const buf = (o as unknown as { commandBuffer: number[] }).commandBuffer.map((v) => (Number.isInteger(v) ? v : r2(v)));
    return [id, 'g', r1(o.x), r1(o.y), r2(o.alpha), o.visible ? 1 : 0, o.depth, blendNum(o.blendMode), buf];
  }
  if (o instanceof Phaser.GameObjects.BitmapText) {
    return [id, 't', o.font, o.text, r1(o.x), r1(o.y), r2(o.originX), r2(o.originY), o.tintTopLeft, r2(o.alpha), o.visible ? 1 : 0, o.depth, r2(o.scaleX)];
  }
  if (o instanceof Phaser.GameObjects.Rectangle) {
    return [id, 'r', r1(o.x), r1(o.y), r1(o.width), r1(o.height), r2(o.originX), r2(o.originY), o.fillColor, r2(o.fillAlpha), r2(o.alpha), o.visible ? 1 : 0, o.depth, blendNum(o.blendMode)];
  }
  if (o instanceof Phaser.GameObjects.TileSprite) {
    return [id, 's', o.texture.key, frameName(o as unknown as Phaser.GameObjects.Image), r1(o.x), r1(o.y), r1(o.width), r1(o.height), r2(o.originX), r2(o.originY), r1(o.tilePositionX), r1(o.tilePositionY), r2(o.alpha), o.visible ? 1 : 0, o.depth];
  }
  if (o instanceof Phaser.GameObjects.Image || o instanceof Phaser.GameObjects.Sprite) {
    const im = o as Phaser.GameObjects.Image;
    return [
      id,
      'i',
      im.texture.key,
      frameName(im),
      r1(im.x),
      r1(im.y),
      r3(im.originX),
      r3(im.originY),
      r2(im.scaleX),
      r2(im.scaleY),
      r3(im.rotation),
      r2(im.alpha),
      im.visible ? 1 : 0,
      (im.flipX ? 1 : 0) | (im.flipY ? 2 : 0),
      im.tintTopLeft,
      im.tintFill ? 1 : 0,
      im.depth,
      blendNum(im.blendMode),
    ];
  }
  return null;
}

/** Host side: tracks objects made by world code and produces delta packets. */
export class MirrorHost {
  /** >0 while world code (enemies, bosses, projectiles) is running. */
  cap = 0;
  private nextId = 1;
  private live = new Map<number, Obj>();
  private last = new Map<number, string>();
  private gone: number[] = [];
  private restore: (() => void)[] = [];

  constructor(scene: Phaser.Scene) {
    const add = scene.add as unknown as Record<string, (...a: unknown[]) => Obj>;
    for (const name of ['image', 'sprite', 'graphics', 'bitmapText', 'rectangle', 'tileSprite']) {
      const orig = add[name];
      const own = Object.prototype.hasOwnProperty.call(add, name);
      add[name] = (...args: unknown[]) => {
        const o = orig.apply(scene.add, args);
        if (this.cap > 0) this.track(o);
        return o;
      };
      this.restore.push(() => {
        if (own) add[name] = orig;
        else delete add[name];
      });
    }
  }

  track(o: Obj): void {
    const id = this.nextId++;
    this.live.set(id, o);
    o.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.live.delete(id);
      this.last.delete(id);
      this.gone.push(id);
    });
  }

  /** Run world code with object tracking on. */
  run<T>(fn: () => T): T {
    this.cap++;
    try {
      return fn();
    } finally {
      this.cap--;
    }
  }

  /** Forget what was sent: the next packet carries everything (a guest (re)joined). */
  resync(): void {
    this.last.clear();
  }

  packet(): MirrorPacket {
    const o: ObjState[] = [];
    for (const [id, obj] of this.live) {
      if (!obj.active && !(obj instanceof Phaser.GameObjects.Graphics)) continue;
      const s = serialize(id, obj);
      if (!s) continue;
      const key = JSON.stringify(s);
      if (this.last.get(id) === key) continue;
      this.last.set(id, key);
      o.push(s);
    }
    const d = this.gone;
    this.gone = [];
    return { o, d };
  }

  destroy(): void {
    for (const r of this.restore) r();
    this.restore = [];
  }
}

interface Shadow {
  obj: Phaser.GameObjects.GameObject;
  type: string;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t0: number;
}

/** Guest side: recreates the host's world objects and eases them between packets. */
export class MirrorGuest {
  private scene: Phaser.Scene;
  private map = new Map<number, Shadow>();
  private interval = 50;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  apply(p: MirrorPacket, now: number): void {
    for (const id of p.d) {
      const sh = this.map.get(id);
      if (sh) sh.obj.destroy();
      this.map.delete(id);
    }
    for (const s of p.o) this.applyOne(s, now);
  }

  private applyOne(s: ObjState, now: number): void {
    const id = s[0] as number;
    const type = s[1] as string;
    let sh = this.map.get(id);
    if (sh && sh.type !== type) {
      sh.obj.destroy();
      this.map.delete(id);
      sh = undefined;
    }
    const sc = this.scene;
    if (!sh) {
      let obj: Phaser.GameObjects.GameObject;
      if (type === 'g') obj = sc.add.graphics();
      else if (type === 't') obj = sc.add.bitmapText(0, 0, s[2] as string, '');
      else if (type === 'r') obj = sc.add.rectangle(0, 0, 1, 1, 0xffffff);
      else if (type === 's') obj = sc.add.tileSprite(0, 0, s[6] as number, s[7] as number, s[2] as string, s[3] as string);
      else obj = sc.add.image(0, 0, s[2] as string, s[3] as string);
      sh = { obj, type, fx: NaN, fy: NaN, tx: 0, ty: 0, t0: now };
      this.map.set(id, sh);
    }
    const o = sh.obj as unknown as Obj;
    const ease = (x: number, y: number) => {
      const cur = o as unknown as { x: number; y: number };
      // big jumps (respawns, wraps) snap; small moves glide to the new spot
      if (Number.isNaN(sh.fx) || Math.abs(x - cur.x) > 64 || Math.abs(y - cur.y) > 64) {
        sh.fx = sh.tx = x;
        sh.fy = sh.ty = y;
        cur.x = x;
        cur.y = y;
      } else {
        sh.fx = cur.x;
        sh.fy = cur.y;
        sh.tx = x;
        sh.ty = y;
      }
      sh.t0 = now;
    };
    if (type === 'g') {
      const g = o as unknown as Phaser.GameObjects.Graphics;
      g.setPosition(s[2] as number, s[3] as number).setAlpha(s[4] as number).setVisible(!!s[5]).setDepth(s[6] as number).setBlendMode(s[7] as number);
      (g as unknown as { commandBuffer: number[] }).commandBuffer = (s[8] as number[]).slice();
      return;
    }
    if (type === 't') {
      const t = o as unknown as Phaser.GameObjects.BitmapText;
      if (t.font !== s[2]) t.setFont(s[2] as string);
      t.setText(s[3] as string).setOrigin(s[6] as number, s[7] as number).setTint(s[8] as number).setAlpha(s[9] as number).setVisible(!!s[10]).setDepth(s[11] as number).setScale(s[12] as number);
      ease(s[4] as number, s[5] as number);
      return;
    }
    if (type === 'r') {
      const r = o as unknown as Phaser.GameObjects.Rectangle;
      r.setSize(s[4] as number, s[5] as number).setOrigin(s[6] as number, s[7] as number).setFillStyle(s[8] as number, s[9] as number).setAlpha(s[10] as number).setVisible(!!s[11]).setDepth(s[12] as number).setBlendMode(s[13] as number);
      ease(s[2] as number, s[3] as number);
      return;
    }
    if (type === 's') {
      const ts = o as unknown as Phaser.GameObjects.TileSprite;
      ts.setFrame(s[3] as string).setSize(s[6] as number, s[7] as number).setOrigin(s[8] as number, s[9] as number).setTilePosition(s[10] as number, s[11] as number).setAlpha(s[12] as number).setVisible(!!s[13]).setDepth(s[14] as number);
      ease(s[4] as number, s[5] as number);
      return;
    }
    const im = o as unknown as Phaser.GameObjects.Image;
    if (im.texture.key !== s[2]) im.setTexture(s[2] as string, s[3] as string);
    else im.setFrame(s[3] as string);
    const flip = s[13] as number;
    im.setOrigin(s[6] as number, s[7] as number)
      .setScale(s[8] as number, s[9] as number)
      .setRotation(s[10] as number)
      .setAlpha(s[11] as number)
      .setVisible(!!s[12])
      .setFlip(!!(flip & 1), !!(flip & 2))
      .setDepth(s[16] as number)
      .setBlendMode(s[17] as number);
    if (s[15]) im.setTintFill(s[14] as number);
    else if ((s[14] as number) !== 0xffffff) im.setTint(s[14] as number);
    else im.clearTint();
    ease(s[4] as number, s[5] as number);
  }

  /** Per frame: glide moving objects toward their latest position. */
  update(now: number): void {
    for (const sh of this.map.values()) {
      if (sh.type === 'g') continue;
      const k = Math.min(1, (now - sh.t0) / this.interval);
      const o = sh.obj as unknown as { x: number; y: number };
      o.x = sh.fx + (sh.tx - sh.fx) * k;
      o.y = sh.fy + (sh.ty - sh.fy) * k;
    }
  }

  clear(): void {
    for (const sh of this.map.values()) sh.obj.destroy();
    this.map.clear();
  }
}
