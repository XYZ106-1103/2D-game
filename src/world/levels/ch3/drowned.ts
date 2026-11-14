// Stage 13 — "물에 잠긴 하층" (The Drowned Undercity). New rule: water.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildDrowned(): LevelData {
  const L = new LevelBuilder('drowned', '물에 잠긴 하층', 'THE DROWNED UNDERCITY', 170, 40);
  L.setTheme('drowned', 'drowned');
  L.look('drowned', 'dust', 0.6);

  // A. dry ledge
  L.building(0, 16, 24);
  L.spawn(3, 23);
  L.checkpoint(2, 23);
  L.trigger(0, 12, 8, 12, 'd_intro');
  L.trigger(12, 12, 4, 12, 'd_water');

  // B. flooded street; swim under the building through a passage
  L.fill(17, 39, 100, 39, Mat.Concrete);
  L.pool(17, 26, 100, 38);
  L.fill(24, 29, 30, 38, Mat.Concrete); // drowned kiosk
  L.catwalk(33, 37, 25); // floating pallet
  L.fill(40, 0, 44, 33, Mat.Concrete); // the building — swim under it
  L.rail(40, 44, 38);
  L.fill(40, 38, 44, 38, Mat.Empty);
  L.trigger(30, 20, 6, 18, 'd_shop');
  L.enemy('drone', 34, 19);

  // C. current channel pushing east, a dry stand with a checkpoint
  L.pool(45, 26, 100, 38, 260, 0);
  L.building(70, 78, 22);
  L.checkpoint(73, 21);
  L.anchor(65, 16);
  L.rail(84, 86, 38);
  L.fill(88, 30, 90, 38, Mat.Concrete);

  // D. shop roof, then the flooded upwelling shaft
  L.anchor(96, 14);
  L.building(101, 120, 20);
  L.log(110, 17, 'log24');
  L.fill(121, 39, 133, 39, Mat.Concrete);
  L.pool(121, 24, 133, 38);
  L.fill(126, 31, 129, 38, Mat.Concrete);
  L.log(127, 29, 'log25');
  L.fill(134, 13, 134, 39, Mat.Concrete);
  L.fill(139, 13, 139, 39, Mat.Concrete);
  L.fill(134, 39, 139, 39, Mat.Concrete);
  L.pool(135, 12, 138, 38, 0, -700);
  L.fill(134, 34, 134, 36, Mat.Empty); // door into the shaft from the pool
  L.fill(122, 36, 133, 38, Mat.Empty);

  // E. dry terrace to the relay
  L.building(140, 169, 12);
  L.checkpoint(143, 11);
  L.trigger(158, 0, 4, 12, 'd_exit');
  L.exit(165, 11);

  L.clearText('등불 중계기 2 — 하층 재가동');
  return L.build();
}
