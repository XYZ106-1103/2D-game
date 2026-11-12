// Shared "game feel" services: hit stop, slow motion, shake, flashes.
// Entities talk to this instead of directly to the camera / post FX.

export interface Juice {
  shake(amount: number, duration?: number): void;
  hitstop(seconds: number): void;
  slowmo(scale: number, seconds: number): void;
  flash(amount: number): void;
  aberration(amount: number): void;
  sfx(name: string, opts?: { vol?: number; pitch?: number; pan?: number }): void;
}
