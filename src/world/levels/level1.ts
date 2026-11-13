// Stage 1 — "9구역: 잠긴 옥상" (District 9: The Locked Rooftops)
//
// Teaching order: run/jump → first grapple over the abyss → reel in to climb
// → glass can't be hooked, swing from steel beams → vertical climb
// → dash gaps & a long momentum swing → exit lift.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel1(): LevelData {
  const L = new LevelBuilder('d9-rooftops', '9구역: 잠긴 옥상', 'DISTRICT 9 — THE LOCKED ROOFTOPS', 200, 50);

  // --- A. Wake-up rooftop ------------------------------------------------------
  L.building(0, 17, 30).building(21, 33, 30).fill(26, 28, 29, 29, Mat.Concrete);
  L.spawn(4, 29);
  L.trigger(0, 18, 8, 12, 'intro');
  L.trigger(9, 18, 4, 12, 'move');
  L.log(13, 27, 'log1');
  L.checkpoint(31, 29);
  L.trigger(28, 16, 5, 14, 'grapple');
  L.prop('ac', 6, 30).prop('antenna', 2, 30).prop('tank', 15, 30).prop('dish', 9, 30);
  L.prop('crate', 22, 30).prop('barrel', 24, 30).prop('lamp', 27, 28).prop('vending', 33, 30, { dx: -4 });
  L.prop('sign:bar', 17, 31, { dx: 6, dy: 12, front: true });

  // --- B. The first abyss: two tether nodes -------------------------------------
  L.anchor(39, 21).anchor(47, 20);

  // --- C. Billboard roof & reel-up to the tall block ----------------------------
  L.building(55, 70, 29);
  L.building(71, 84, 20);
  L.anchor(66, 18);
  L.trigger(60, 14, 5, 15, 'reel');
  L.prop('billboard', 59, 29).prop('ac', 64, 29).prop('crate', 69, 29).prop('crate', 69, 28, { dy: 2 });
  L.prop('sign:lethe', 77, 26, { front: true });
  L.prop('sign:hotel', 71, 24, { dx: -12, front: true });
  L.trigger(55, 18, 3, 11, 'combat');
  L.enemy('trooper', 64, 28);

  // --- D. Tall roof, checkpoint 2 ----------------------------------------------------
  L.checkpoint(79, 19);
  L.prop('antenna', 73, 20).prop('ac', 82, 20).prop('lamp', 76, 20);
  L.enemy('drone', 82, 15);

  // --- E. Glass district: hook the steel beam, not the glass ---------------------
  L.building(85, 124, 41);
  L.rail(86, 121, 40);
  L.fill(92, 25, 95, 39, Mat.Glass);
  L.fill(104, 21, 107, 39, Mat.Glass);
  L.fill(116, 24, 119, 39, Mat.Glass);
  L.fill(88, 7, 122, 8, Mat.Steel);
  L.anchor(99, 15).anchor(111, 13);
  L.log(105, 17, 'log2');
  L.trigger(83, 8, 3, 12, 'glass');
  L.prop('sign:danger', 99, 36, { front: true });
  L.prop('sign:bar', 112, 30, { front: true });
  L.trigger(86, 8, 3, 12, 'sentry');
  L.enemy('sentry', 106, 20).enemy('drone', 98, 20).enemy('drone', 114, 17);

  // --- F. Tower climb: steel ledges + nodes, reel and chain ------------------------
  L.building(122, 134, 26);
  L.checkpoint(127, 25);
  L.building(137, 146, 7);
  L.fill(134, 21, 136, 21, Mat.Steel);
  L.fill(134, 14, 136, 14, Mat.Steel);
  L.anchor(130, 17).anchor(131, 9).anchor(136, 1);
  L.trigger(125, 14, 4, 12, 'climb');
  L.prop('ac', 130, 26).prop('barrel', 126, 26).prop('sign:ramen', 140, 18, { front: true });
  L.backwall(135, 8, 136, 25);
  L.enemy('trooper', 132, 25).enemy('drone', 131, 13);

  // --- G. High rooftops: dash gap + long momentum swing ------------------------------
  L.checkpoint(143, 6);
  L.trigger(138, 0, 6, 7, 'dash');
  L.building(155, 162, 8);
  L.anchor(170, 1);
  L.log(172, 7, 'log3');
  L.prop('antenna', 139, 7).prop('dish', 145, 7).prop('tank', 158, 8).prop('lamp', 161, 8);
  L.prop('sign:pharm', 155, 13, { dx: -10, front: true });
  L.enemy('sentry', 145, 6).enemy('trooper', 160, 7);

  // --- H. Exit lift -------------------------------------------------------------------
  L.building(179, 199, 9);
  L.trigger(176, 0, 6, 9, 'exit');
  L.exit(195, 8);
  L.prop('billboard', 186, 9).prop('ac', 181, 9).prop('crate', 191, 9).prop('lamp', 183, 9);
  L.prop('sign:open', 179, 13, { dx: -8, front: true });
  L.enemy('trooper', 189, 8).enemy('drone', 185, 4);

  L.clearText('9구역 봉쇄선 돌파');
  return L.build();
}
