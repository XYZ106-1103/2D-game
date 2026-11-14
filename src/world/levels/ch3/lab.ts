// Stage 18 — "중계 게이트 연구소" (The Relay Lab). New rule: momentum portals.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildLab(): LevelData {
  const L = new LevelBuilder('relay-lab', '중계 게이트 연구소', 'THE RELAY LAB — 16:30', 170, 40);
  L.setTheme('lab', 'lab');
  L.look('lab', 'none', 0);
  L.fill(0, 0, 169, 5, Mat.Concrete);
  L.backwall(0, 6, 169, 33);

  // A. entry hall: climb the shelves, drop into the floor gate
  L.building(0, 30, 33);
  L.spawn(3, 32);
  L.checkpoint(2, 32);
  L.trigger(0, 20, 8, 13, 'l_intro');
  L.trigger(9, 20, 4, 13, 'l_portal');
  L.catwalk(9, 14, 30);
  L.catwalk(12, 17, 27);
  L.catwalk(15, 20, 24);
  L.catwalk(18, 22, 21);
  L.fill(25, 33, 27, 34, Mat.Empty); // a shallow pit with the gate at its floor
  L.portal(26, 34, 'U', 31, 18, 'R');
  L.fill(29, 6, 30, 32, Mat.Concrete); // wall holding the exit gate
  L.fill(31, 6, 31, 17, Mat.Concrete);
  L.fill(31, 19, 31, 32, Mat.Concrete);

  // B. the gate throws you across the gap — the higher the drop, the longer the throw
  L.rail(32, 37, 39);
  L.building(38, 54, 30);
  L.checkpoint(42, 29);
  L.building(55, 58, 27);
  L.building(59, 76, 24);
  L.log(70, 20, 'log30');

  // C. second pair: drop down the shaft, shoot up the far column and hop out
  L.building(77, 79, 34);
  L.portal(78, 33, 'U', 86, 33, 'U');
  L.fill(80, 6, 84, 39, Mat.Concrete);
  L.building(85, 87, 34);
  L.fill(88, 28, 88, 34, Mat.Concrete);
  L.building(89, 104, 28);
  L.checkpoint(92, 27);
  L.trigger(94, 16, 4, 12, 'l_mid');

  // D. third pair: jump into the wall gate, drop out of the ceiling gate onto the gallery
  L.building(105, 124, 30);
  L.portal(124, 27, 'L', 128, 6, 'D');
  L.fill(125, 6, 125, 33, Mat.Concrete);
  L.rail(126, 140, 39);
  L.catwalk(126, 140, 20);
  L.log(133, 17, 'log31');
  L.enemy('watcher', 115, 24);

  // E. relay chamber
  L.building(141, 169, 26);
  L.checkpoint(144, 25);
  L.trigger(156, 14, 4, 12, 'l_exit');
  L.exit(165, 25);

  L.clearText('등불 중계기 5 — 연구소 재가동');
  return L.build();
}
