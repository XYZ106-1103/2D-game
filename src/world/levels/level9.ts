// Stage 9 — "공중 정원" (The Board's Sky Garden)
//
// White marble terraces under a glass dome. Glowing blooms launch you up the
// terraces; gold switches light hard-light bridges for a few seconds when
// you hook them; the board's elite guards hold the hall.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel9(): LevelData {
  const L = new LevelBuilder('sky-garden', '공중 정원', "THE BOARD'S SKY GARDEN", 200, 44);
  L.setTheme('garden', 'garden');
  L.look('garden', 'petals', 1);

  // --- A. Garden gate -----------------------------------------------------------------------------
  L.building(0, 33, 38);
  L.backwall(0, 26, 33, 37);
  L.spawn(3, 37);
  L.checkpoint(2, 37);
  L.trigger(0, 26, 8, 12, 'g_intro');
  L.log(20, 34, 'log18');

  // --- B. Bloom terraces ---------------------------------------------------------------------------
  L.trigger(24, 26, 4, 12, 'g_bloom');
  L.bouncer(30, 38);
  L.building(34, 45, 30);
  L.bouncer(42, 30);
  L.building(46, 60, 22);
  L.enemy('drone', 52, 14);

  // --- C. Switch bridges over the open sky -------------------------------------------------------------
  L.trigger(55, 10, 4, 12, 'g_switch');
  L.switchNode(64, 14, 1, 6);
  L.bridge(61, 78, 22, 1);
  L.switchNode(81, 13, 2, 6);
  L.bridge(82, 96, 22, 2);

  // --- D. The board's hall ------------------------------------------------------------------------------
  L.building(97, 140, 22);
  L.backwall(97, 8, 140, 21);
  L.checkpoint(99, 21);
  L.enemy('trooper', 110, 21).enemy('trooper', 124, 21).enemy('sentry', 136, 21);
  L.trigger(116, 8, 4, 14, 'g_alarm');
  L.bouncer(128, 22);
  L.catwalk(125, 134, 14);
  L.log(131, 12, 'log19');

  // --- E. Up to the dome's edge -----------------------------------------------------------------------------
  L.bouncer(144, 22, 620);
  L.building(141, 146, 22);
  L.fill(148, 12, 156, 13, Mat.Steel);
  L.switchNode(160, 5, 3, 6);
  L.bridge(157, 176, 12, 3);
  L.building(177, 199, 12);
  L.checkpoint(179, 11);
  L.enemy('drone', 166, 6).enemy('trooper', 190, 11);
  L.trigger(184, 0, 4, 12, 'g_exit');
  L.exit(196, 11);

  L.clearText('공중 정원 통과');
  return L.build();
}
