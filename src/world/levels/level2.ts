// Stage 2 — "하층 시장" (The Lower Market)
//
// New ideas, one at a time: riding a moving tether node over the canal →
// steam vents lift you through stacked catwalks → a crumbling bridge under
// sentry fire → vent chimney up to the rooftop bazaar → a mixed fight → lift.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel2(): LevelData {
  const L = new LevelBuilder('lower-market', '하층 시장', 'THE LOWER MARKET', 210, 40);
  L.setTheme('market', 'market', 0.55);

  // --- A. Market street -----------------------------------------------------------------
  L.building(0, 33, 32);
  L.catwalk(11, 20, 26);
  L.spawn(4, 31);
  L.checkpoint(3, 31);
  L.trigger(0, 20, 8, 12, 'm_intro');
  L.log(15, 24, 'log4');
  L.prop('vending', 8, 32).prop('crate', 22, 32).prop('crate', 23, 32).prop('barrel', 26, 32).prop('lamp', 18, 32);
  L.prop('sign:ramen', 12, 30, { front: true, dy: -40 }).prop('sign:open', 28, 30, { front: true, dy: -30 });
  L.enemy('drone', 24, 22);

  // --- B. The canal: ride the moving node ------------------------------------------------
  L.fill(34, 37, 55, 37, Mat.Rail);
  L.fill(34, 38, 55, 39, Mat.Concrete);
  L.mover(36, 22, 55, 22, 6);
  L.anchor(45, 15);
  L.trigger(28, 18, 5, 14, 'm_mover');
  L.prop('sign:danger', 45, 35, { front: true });

  // --- C. Covered stalls: vent lift through stacked catwalks ------------------------------
  L.building(56, 95, 32);
  L.fill(60, 0, 95, 9, Mat.Concrete);
  L.checkpoint(58, 31);
  L.catwalk(62, 80, 26);
  L.catwalk(66, 90, 20);
  L.catwalk(74, 95, 14);
  L.vent(64, 31, 11);
  L.trigger(59, 20, 4, 12, 'm_vent');
  L.enemy('trooper', 72, 31).enemy('trooper', 82, 19);
  L.prop('ac', 86, 32).prop('crate', 90, 32).prop('vending', 92, 32).prop('lamp', 76, 32);
  L.backwall(60, 10, 95, 31);

  // --- D. Crumbling bridge under fire -------------------------------------------------------
  L.building(96, 99, 14);
  L.checkpoint(97, 13);
  L.crumble(100, 124, 14);
  L.anchor(106, 7).anchor(118, 6);
  L.trigger(96, 4, 3, 10, 'm_crumble');
  L.log(112, 9, 'log5');
  L.enemy('drone', 112, 10);

  // --- E. Vent chimney to the rooftops ---------------------------------------------------------
  L.building(125, 140, 14);
  L.enemy('sentry', 128, 13);
  L.vent(137, 13, 11, 1.8, 1.0);
  L.catwalk(141, 150, 5);
  L.log(137, 2, 'log6');
  L.building(151, 160, 9);
  L.enemy('trooper', 156, 8);
  L.mover(161, 3, 169, 3, 4);
  L.prop('antenna', 152, 9).prop('tank', 158, 9);

  // --- F. Rooftop bazaar fight + lift ----------------------------------------------------------
  L.building(170, 209, 12);
  L.checkpoint(172, 11);
  L.trigger(170, 0, 4, 12, 'm_exit');
  L.enemy('trooper', 183, 11).enemy('trooper', 195, 11).enemy('drone', 189, 6).enemy('sentry', 200, 11);
  L.prop('billboard', 186, 12).prop('ac', 178, 12).prop('crate', 191, 12).prop('lamp', 197, 12);
  L.exit(205, 11);

  L.clearText('하층 시장 통과 — 타워 작업층 진입');
  return L.build();
}
