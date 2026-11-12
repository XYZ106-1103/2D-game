import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config.ts';
import { BootScene } from './scenes/BootScene.ts';
import { TitleScene } from './scenes/TitleScene.ts';
import { IntroScene } from './scenes/IntroScene.ts';
import { GameScene } from './scenes/GameScene.ts';
import { HudScene } from './scenes/HudScene.ts';
import { PauseScene } from './scenes/PauseScene.ts';

/**
 * Integer scaling in *device* pixels: every game pixel maps to exactly N×N
 * physical pixels, even on fractional devicePixelRatio displays.
 */
function computeZoom(): number {
  const dpr = window.devicePixelRatio || 1;
  const n = Math.max(1, Math.floor(Math.min((window.innerWidth * dpr) / GAME_W, (window.innerHeight * dpr) / GAME_H)));
  return n / dpr;
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#05030a',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  antialiasGL: false,
  disableContextMenu: true,
  powerPreference: 'high-performance',
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: computeZoom(),
    fullscreenTarget: 'game',
  },
  input: { mouse: { preventDefaultWheel: true }, keyboard: { capture: [32, 37, 38, 39, 40] } },
  audio: { noAudio: true },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [BootScene, TitleScene, IntroScene, GameScene, HudScene, PauseScene],
});

const relayout = () => game.scale.setZoom(computeZoom());
window.addEventListener('resize', relayout);
window.matchMedia?.('(resolution: 1dppx)').addEventListener?.('change', relayout);
document.getElementById('boot-msg')?.remove();

// Expose for automated browser tests / debugging.
(window as unknown as { __game: Phaser.Game }).__game = game;
