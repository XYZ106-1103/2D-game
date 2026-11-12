// Global tuning. All distances in pixels, times in seconds.

export const GAME_W = 480;
export const GAME_H = 270;
export const TILE = 16;

/** Fixed simulation step (120 Hz) — rope constraints stay stable at high speed. */
export const STEP = 1 / 120;
export const MAX_STEPS_PER_FRAME = 8;

export const PLAYER = {
  w: 10,
  h: 24,
  hp: 5,
  invuln: 1.2,
  // ground
  runSpeed: 142,
  groundAccel: 1500,
  groundDecel: 1900,
  turnAccel: 2800,
  // air
  airAccel: 980,
  airDecel: 260,
  overspeedDrag: 220,
  gravity: 1000,
  fallGravityMul: 1.22,
  apexGravityMul: 0.55,
  apexThreshold: 45,
  maxFall: 460,
  jumpVel: 338,
  jumpCut: 0.45,
  coyote: 0.1,
  jumpBuffer: 0.13,
  // dash
  dashSpeed: 410,
  dashTime: 0.14,
  dashCooldown: 0.22,
  dashKeep: 0.6,
  // landing
  hardLandVy: 250,
  // attack
  attackTime: 0.3,
  comboWindow: 0.32,
} as const;

export const HOOK = {
  speed: 1050,
  maxLen: 196,
  minLen: 16,
  reelSpeed: 175,
  wheelStep: 14,
  pumpAccel: 560,
  slackPumpMul: 0.25,
  swingMaxSpeed: 580,
  releaseBoost: 48,
  jumpReleaseVy: 230,
  assistAngleDeg: 13,
  assistRadius: 22,
  anchorRadius: 7,
  retractSpeed: 1500,
  cooldown: 0.08,
  maxWraps: 10,
} as const;

export const CAMERA = {
  lookAheadX: 0.32,
  lookAheadY: 0.18,
  maxLookX: 70,
  maxLookY: 40,
  aimInfluence: 0.12,
  stiffness: 7.5,
  verticalStiffness: 5.5,
} as const;

export const DEPTH = {
  sky: 0,
  spire: 1,
  far: 2,
  carsFar: 3,
  mid: 4,
  carsMid: 5,
  near: 6,
  fogBack: 7,
  backwall: 8,
  decorBack: 9,
  rainBack: 10,
  tiles: 20,
  decorFront: 22,
  objects: 25,
  afterimage: 28,
  scarf: 29,
  player: 30,
  rope: 31,
  fx: 35,
  rainFront: 40,
  fogFront: 41,
  cursor: 60,
} as const;
