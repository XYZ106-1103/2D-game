// Stage 11 — "녹턴" (NOCTURNE): the transmitter dish at dawn.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildNocturneLevel(): LevelData {
  const L = new LevelBuilder('nocturne', '녹턴', 'PROJECT NOCTURNE', 40, 24);
  L.setTheme('dawn', 'nocturne', 0);
  L.look('mast', 'petals', 0.35);
  L.data.boss = 'nocturne';
  // dish deck with raised rims
  L.fill(0, 19, 39, 23, Mat.Steel);
  L.fill(0, 0, 0, 18, Mat.Concrete);
  L.fill(39, 0, 39, 18, Mat.Concrete);
  L.fill(1, 17, 2, 18, Mat.Steel);
  L.fill(37, 17, 38, 18, Mat.Steel);
  // relay perches
  L.catwalk(3, 8, 12);
  L.catwalk(31, 36, 12);
  // grapple relays around the dish
  L.anchor(10, 5).anchor(29, 5).anchor(4, 8).anchor(35, 8).anchor(20, 2);
  L.spawn(5, 18);
  L.checkpoint(3, 18);
  L.exit(20, 18);
  L.clearText('녹턴 격파 — 한 시간을 돌려주다');
  return L.build();
}
