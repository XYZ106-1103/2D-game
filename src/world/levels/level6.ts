// Stage 6 — "기억 정제소" (The Memory Refinery)
//
// Industrial and hot. Crusher corridor (read the shake) → crumbling grates
// over lethe pools with floating mines → a guarded floor → and a vertical
// shaft that floods with raw lethe the moment you enter it.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel6(): LevelData {
  const L = new LevelBuilder('refinery', '기억 정제소', 'THE MEMORY REFINERY', 170, 60);
  L.setTheme('refinery', 'refinery');
  L.look('refinery', 'embers', 1);
  L.backwall(0, 37, 110, 51);
  L.backwall(111, 2, 141, 51);

  // --- A. Intake ------------------------------------------------------------------------------
  L.building(0, 110, 52);
  L.fill(0, 0, 110, 36, Mat.Concrete);
  L.spawn(3, 51);
  L.checkpoint(2, 51);
  L.trigger(0, 40, 8, 12, 'r_intro');
  L.log(18, 48, 'log12');
  L.fill(10, 49, 12, 51, Mat.Steel);

  // --- B. Crusher corridor ------------------------------------------------------------------------
  L.fill(25, 37, 60, 40, Mat.Concrete);
  for (let i = 0; i < 4; i++) L.crusher(30 + i * 8, 40, 52, 2, 2.4, i * 0.22);
  L.trigger(20, 41, 5, 11, 'r_crusher');

  // --- C. Lethe pools, crumbling grates, mines ---------------------------------------------------
  L.clear(64, 52, 86, 52);
  L.rail(64, 86, 52);
  L.crumble(66, 73, 50);
  L.crumble(77, 84, 50);
  L.enemy('mine', 70, 45).enemy('mine', 81, 44);
  L.trigger(58, 37, 5, 15, 'r_mine');

  // --- D. Refinery floor + vent to the side ledge ----------------------------------------------
  L.checkpoint(90, 51);
  L.fill(94, 49, 98, 51, Mat.Steel);
  L.enemy('trooper', 100, 51).enemy('trooper', 106, 51);
  L.vent(104, 51, 10, 1.6, 1.2);
  L.catwalk(104, 110, 40);
  L.log(108, 38, 'log13');

  // --- E. The flood shaft -------------------------------------------------------------------------------
  L.fill(111, 0, 111, 44, Mat.Concrete); // left wall (entrance below)
  L.fill(111, 0, 169, 1, Mat.Concrete); // ceiling
  L.building(111, 141, 52);
  L.fill(142, 6, 169, 59, Mat.Concrete); // right block; exit floor on row 6
  L.checkpoint(113, 51);
  L.flood(54, 4, 32, 113, 40, 28, 12);
  L.trigger(113, 40, 28, 12, 'r_flood');
  L.catwalk(114, 120, 49);
  L.catwalk(124, 130, 46);
  L.catwalk(133, 141, 43);
  L.catwalk(124, 131, 40);
  L.catwalk(113, 120, 37);
  L.vent(116, 36, 10, 1.4, 0.8);
  L.catwalk(119, 128, 27);
  L.crumble(131, 138, 25);
  L.catwalk(133, 141, 22);
  L.catwalk(123, 130, 19);
  L.catwalk(113, 120, 16);
  L.catwalk(122, 129, 13);
  L.catwalk(131, 137, 10);
  L.catwalk(138, 141, 7);
  L.enemy('mine', 129, 34).enemy('mine', 125, 9);

  // --- F. Exit ---------------------------------------------------------------------------------------
  L.trigger(146, 0, 6, 6, 'r_exit');
  L.exit(165, 5);

  L.clearText('정제소 탈출 — 녹턴의 0.03%');
  return L.build();
}
