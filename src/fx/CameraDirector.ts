import Phaser from 'phaser';
import { CAMERA, GAME_H, GAME_W } from '../config.ts';
import { clamp, damp, shakeNoise } from '../core/math.ts';

/**
 * Platformer camera, pixel-perfect output.
 *
 * Horizontal: a follow point sits CAMERA.lookAhead px ahead of the player in
 * the direction of travel; the camera only scrolls when that point leaves a
 * CAMERA.deadZoneW-wide window centred on the screen (same semantics as a
 * Phaser follow offset + dead zone).
 *
 * Vertical: the camera re-frames only when the player lands; jumps, swings
 * and falls keep the current height unless the player would leave the safe
 * band at the top or bottom of the screen. Exception: when a tether node or
 * a ledge the player has to reach sits just above the view, the camera lifts
 * a little (CAMERA.lookUpMax) so it stays visible — upward only, any time.
 */
export class CameraDirector {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private x = 0;
  private y = 0;
  /** Smoothed look-ahead offset (−lookAhead … +lookAhead). */
  private lookX = 0;
  private dir = 1;
  /** How long the player has been travelling against the current look direction. */
  private turnT = 0;
  /** Camera centre the dead zone currently allows. */
  private wantCX = 0;
  /** Vertical scroll target, refreshed on landing. */
  private wantY = 0;
  /** Landing framing (before any look-up lift) — the lift budget is measured from it. */
  private restY = 0;
  private trauma = 0;
  private traumaDur = 0.2;
  private time = 0;
  private bounds: { w: number; h: number };
  /** Fixed vertical scroll (boss arenas), or null. */
  lockY: number | null = null;
  shakeScale = 1;
  shakeX = 0;
  shakeY = 0;

  constructor(cam: Phaser.Cameras.Scene2D.Camera, worldW: number, worldH: number) {
    this.cam = cam;
    this.bounds = { w: worldW, h: worldH };
  }

  /** Jump straight to the player (spawn / respawn). */
  snap(px: number, feetY: number, facing = this.dir): void {
    this.dir = facing >= 0 ? 1 : -1;
    this.lookX = this.dir * CAMERA.lookAhead;
    this.wantCX = px + this.lookX;
    this.x = this.wantCX - GAME_W / 2;
    this.wantY = this.lockY ?? feetY - CAMERA.groundScreenY;
    this.restY = this.wantY;
    this.y = this.wantY;
    this.clampPos();
    this.wantY = this.y;
    this.apply();
  }

  shake(amount: number, duration = 0.2): void {
    this.trauma = Math.min(8, Math.max(this.trauma, amount));
    this.traumaDur = Math.max(0.05, duration);
  }

  update(dt: number, px: number, feetY: number, vx: number, grounded: boolean, lookUpY: number | null = null): void {
    this.time += dt;

    // --- horizontal: look-ahead point + dead zone ------------------------------
    // Commit to a new travel direction only after sustained movement, so a
    // quick turn, an attack or a pendulum swing doesn't whip the view around.
    const against = vx * this.dir < 0;
    const fast = Math.abs(vx) > (grounded ? CAMERA.travelSpeed : CAMERA.airTravelSpeed);
    this.turnT = against && fast ? this.turnT + dt : 0;
    if (this.turnT > (grounded ? CAMERA.turnCommit : CAMERA.airTurnCommit)) {
      this.dir = -this.dir;
      this.turnT = 0;
    }
    this.lookX += (this.dir * CAMERA.lookAhead - this.lookX) * damp(CAMERA.lookTurnRate, dt);
    const fx = px + this.lookX;
    const half = CAMERA.deadZoneW / 2;
    if (fx > this.wantCX + half) this.wantCX = fx - half;
    else if (fx < this.wantCX - half) this.wantCX = fx + half;
    this.x += (this.wantCX - GAME_W / 2 - this.x) * damp(CAMERA.followRate, dt);

    // --- vertical: re-frame on landing, safe band otherwise ----------------------
    let rate: number = CAMERA.landRate;
    if (this.lockY !== null) this.wantY = this.lockY;
    else {
      if (grounded) this.wantY = this.restY = feetY - CAMERA.groundScreenY;
      if (lookUpY !== null) {
        // lift just enough to show the target, within a small budget
        const base = this.restY;
        const need = Math.max(lookUpY - CAMERA.lookUpMargin, feetY - CAMERA.lookUpFloor, base - CAMERA.lookUpMax);
        if (need < this.wantY) this.wantY = need;
      }
      const chest = feetY - 12;
      const top = this.y + CAMERA.safeTop;
      const bottom = this.y + GAME_H - CAMERA.safeBottom;
      if (chest < top) {
        this.wantY = Math.min(this.wantY, chest - CAMERA.safeTop);
        rate = CAMERA.safeRate;
      } else if (chest > bottom) {
        this.wantY = Math.max(this.wantY, chest - (GAME_H - CAMERA.safeBottom));
        rate = CAMERA.safeRate;
      }
    }
    this.y += (this.wantY - this.y) * damp(rate, dt);
    this.clampPos();

    // shake decays over its duration
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - (dt / this.traumaDur) * this.trauma - dt * 2);
    }
    const mag = this.trauma * this.shakeScale;
    this.shakeX = Math.round(shakeNoise(this.time, 1) * mag);
    this.shakeY = Math.round(shakeNoise(this.time, 2) * mag);
    this.apply();
  }

  private clampPos(): void {
    const maxX = Math.max(0, this.bounds.w - GAME_W);
    const maxY = Math.max(0, this.bounds.h - GAME_H);
    this.x = clamp(this.x, 0, maxX);
    this.y = clamp(this.y, -120, maxY);
    // keep the dead-zone centre consistent with the clamped view at world edges
    this.wantCX = clamp(this.wantCX, GAME_W / 2, maxX + GAME_W / 2);
    this.wantY = clamp(this.wantY, -120, maxY);
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
