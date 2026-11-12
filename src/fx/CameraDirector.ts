import Phaser from 'phaser';
import { CAMERA, GAME_H, GAME_W } from '../config.ts';
import { clamp, damp, shakeNoise } from '../core/math.ts';

/**
 * Hand-rolled camera: velocity look-ahead, aim bias, spring smoothing,
 * trauma-based shake and integer-pixel output (pixel-perfect).
 */
export class CameraDirector {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private x = 0;
  private y = 0;
  private lookX = 0;
  private lookY = 0;
  private trauma = 0;
  private traumaDur = 0.2;
  private time = 0;
  private bounds: { w: number; h: number };
  shakeScale = 1;
  /** Extra offset for cinematic moments. */
  biasX = 0;
  biasY = 0;
  shakeX = 0;
  shakeY = 0;

  constructor(cam: Phaser.Cameras.Scene2D.Camera, worldW: number, worldH: number) {
    this.cam = cam;
    this.bounds = { w: worldW, h: worldH };
  }

  snap(tx: number, ty: number): void {
    this.x = tx - GAME_W / 2;
    this.y = ty - GAME_H / 2 - 20;
    this.lookX = this.lookY = 0;
    this.clampPos();
    this.apply();
  }

  shake(amount: number, duration = 0.2): void {
    this.trauma = Math.min(8, Math.max(this.trauma, amount));
    this.traumaDur = Math.max(0.05, duration);
  }

  update(dt: number, tx: number, ty: number, vx: number, vy: number, aimX: number, aimY: number, grounded: boolean): void {
    this.time += dt;
    // look-ahead follows velocity (smoothed separately so it doesn't jitter)
    const wantLX = clamp(vx * CAMERA.lookAheadX, -CAMERA.maxLookX, CAMERA.maxLookX);
    const wantLY = clamp(vy * CAMERA.lookAheadY, -CAMERA.maxLookY * 0.6, CAMERA.maxLookY);
    this.lookX += (wantLX - this.lookX) * damp(2.4, dt);
    this.lookY += (wantLY - this.lookY) * damp(2.0, dt);
    const ax = (aimX - tx) * CAMERA.aimInfluence;
    const ay = (aimY - ty) * CAMERA.aimInfluence;
    const gx = tx + this.lookX + clamp(ax, -40, 40) + this.biasX - GAME_W / 2;
    const gy = ty + this.lookY + clamp(ay, -24, 24) + this.biasY - GAME_H / 2 - (grounded ? 18 : 8);
    this.x += (gx - this.x) * damp(CAMERA.stiffness, dt);
    this.y += (gy - this.y) * damp(CAMERA.verticalStiffness, dt);
    this.clampPos();

    // shake decays linearly over its duration; magnitude ∝ trauma²-ish
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - (dt / this.traumaDur) * this.trauma * 1.0 - dt * 2);
    }
    const mag = this.trauma * this.shakeScale;
    this.shakeX = Math.round(shakeNoise(this.time, 1) * mag);
    this.shakeY = Math.round(shakeNoise(this.time, 2) * mag);
    this.apply();
  }

  private clampPos(): void {
    this.x = clamp(this.x, 0, Math.max(0, this.bounds.w - GAME_W));
    this.y = clamp(this.y, -120, Math.max(0, this.bounds.h - GAME_H));
  }

  private apply(): void {
    this.cam.setScroll(Math.round(this.x) + this.shakeX, Math.round(this.y) + this.shakeY);
  }

  get scrollX(): number {
    return this.cam.scrollX;
  }
  get scrollY(): number {
    return this.cam.scrollY;
  }
}
