// Stage 4 — "기록관" (The Archivist): boss arena on the spire's crown.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildBossLevel(): LevelData {
  const L = new LevelBuilder('archivist', '기록관', 'EXECUTOR UNIT LT-0 "ARCHIVIST"', 40, 24);
  L.setTheme('tower', 'boss', 0.5);
  L.data.boss = 'archivist';
  L.clearText('기록관 격파 — 첨탑 중심부 개방');
  // crown helipad
  L.fill(0, 19, 39, 23, Mat.Steel);
  L.fill(0, 0, 0, 18, Mat.Steel);
  L.fill(39, 0, 39, 18, Mat.Steel);
  // side ledges (safe ground during floor electrification)
  L.catwalk(2, 7, 13);
  L.catwalk(32, 37, 13);
  // grapple nodes ringing the arena
  L.anchor(9, 5).anchor(20, 3).anchor(30, 5).anchor(4, 9).anchor(35, 9);
  L.spawn(5, 18);
  L.checkpoint(3, 18);
  L.exit(20, 18); // revealed after the fight
  return L.build();
}
