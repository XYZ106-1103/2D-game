import Phaser from 'phaser';

/**
 * Collects keyboard + mouse input into a per-frame snapshot. Edge-triggered
 * actions are latched until a simulation step consumes them, so presses are
 * never lost when 0 or several fixed steps run in one render frame.
 */
export class Input {
  private scene: Phaser.Scene;
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private latched = new Set<string>();
  private wheel = 0;
  private mouseLeft = false;
  private mouseRight = false;
  /** Pointer position in game (screen) pixels. */
  sx = 240;
  sy = 135;
  /** Last input device used, to switch aim mode. */
  usingMouse = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      left: K.A,
      right: K.D,
      up: K.W,
      down: K.S,
      left2: K.LEFT,
      right2: K.RIGHT,
      up2: K.UP,
      down2: K.DOWN,
      jump: K.SPACE,
      jump2: K.C,
      dash: K.SHIFT,
      dash2: K.L,
      attack: K.J,
      attack2: K.X,
      grapple: K.K,
      grapple2: K.Z,
      pause: K.ESC,
      pause2: K.P,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    const map: Record<string, string> = {
      jump: 'jump',
      jump2: 'jump',
      dash: 'dash',
      dash2: 'dash',
      attack: 'attack',
      attack2: 'attack',
      grapple: 'grapple',
      grapple2: 'grapple',
      pause: 'pause',
      pause2: 'pause',
      up: 'up',
      up2: 'up',
      down: 'down',
      down2: 'down',
    };
    for (const [k, action] of Object.entries(map)) {
      this.keys[k].on('down', () => {
        this.latched.add(action);
        if (action === 'grapple') this.usingMouse = false;
      });
    }

    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.usingMouse = true;
      if (p.leftButtonDown()) {
        this.mouseLeft = true;
        this.latched.add('grapple');
      }
      if (p.rightButtonDown()) {
        this.mouseRight = true;
        this.latched.add('attack');
      }
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) this.mouseLeft = false;
      if (!p.rightButtonDown()) this.mouseRight = false;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.sx = p.x;
      this.sy = p.y;
      this.usingMouse = true;
    });
    scene.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.wheel += Math.sign(dy);
    });
    scene.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
  }

  private down(...names: string[]): boolean {
    return names.some((n) => this.keys[n]?.isDown);
  }

  get left(): boolean {
    return this.down('left', 'left2');
  }
  get right(): boolean {
    return this.down('right', 'right2');
  }
  get up(): boolean {
    return this.down('up', 'up2');
  }
  get downHeld(): boolean {
    return this.down('down', 'down2');
  }
  get jumpHeld(): boolean {
    return this.down('jump', 'jump2');
  }
  get grappleHeld(): boolean {
    return this.mouseLeft || this.down('grapple', 'grapple2');
  }
  get attackHeld(): boolean {
    return this.mouseRight || this.down('attack', 'attack2');
  }
  get dashHeld(): boolean {
    return this.down('dash', 'dash2');
  }

  get moveX(): number {
    return (this.right ? 1 : 0) - (this.left ? 1 : 0);
  }
  get moveY(): number {
    return (this.downHeld ? 1 : 0) - (this.up ? 1 : 0);
  }

  /** Consume an edge-triggered action. */
  take(action: string): boolean {
    if (this.latched.has(action)) {
      this.latched.delete(action);
      return true;
    }
    return false;
  }

  peek(action: string): boolean {
    return this.latched.has(action);
  }

  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** Clear latches that should not leak across scenes (e.g. after pause). */
  reset(): void {
    this.latched.clear();
    this.wheel = 0;
    this.mouseLeft = false;
    this.mouseRight = false;
    for (const k of Object.values(this.keys)) k.reset();
  }

  private onBlur(): void {
    this.reset();
  }

  destroy(): void {
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
  }
}
