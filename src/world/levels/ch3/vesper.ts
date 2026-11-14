// Stage 22 — "베스퍼" (VESPER, the Consensus): the clock tower crown at nightfall.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildVesperLevel(): LevelData {
  const L = new LevelBuilder('vesper', '베스퍼', 'VESPER — THE CONSENSUS', 48, 26);
  L.setTheme('vesper', 'vesper', 0);
  L.look('clock', 'none', 0);
  L.data.boss = 'vesper';
  L.fill(0, 21, 47, 25, Mat.Steel);
  L.fill(0, 0, 0, 20, Mat.Concrete);
  L.fill(47, 0, 47, 20, Mat.Concrete);
  L.catwalk(3, 9, 15);
  L.catwalk(38, 44, 15);
  L.catwalk(19, 28, 11);
  // every node sits inside the locked boss camera (world y >= 136)
  L.anchor(6, 9).anchor(41, 9).anchor(24, 8);
  L.spawn(6, 20);
  L.checkpoint(4, 20);
  L.exit(24, 20);
  L.clearText('합의 코어 개방');
  return L.build();
}
