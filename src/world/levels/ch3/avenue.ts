// Stage 15 — "소란의 거리" (The Restless Avenue). New rule: searchlights and the alarm.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildAvenue(): LevelData {
  const L = new LevelBuilder('avenue', '소란의 거리', 'THE RESTLESS AVENUE — 12:00', 190, 34);
  L.setTheme('avenue', 'avenue');
  L.look('avenue', 'dust', 0.6);
  L.building(0, 189, 28, Mat.Steel);
  L.backwall(0, 8, 189, 27);

  // A. side street
  L.spawn(3, 27);
  L.checkpoint(2, 27);
  L.trigger(0, 16, 8, 12, 'v_intro');
  L.trigger(24, 16, 4, 12, 'v_light');

  // B. first light: the awnings cast shade; cross the gap when the beam swings away
  L.light(46, 14, 35, 145, 5, 260, 26, 0);
  L.fill(33, 21, 45, 21, Mat.Steel);
  L.fill(48, 21, 60, 21, Mat.Steel);
  L.fill(39, 27, 39, 27, Mat.Concrete);
  L.fill(55, 27, 55, 27, Mat.Concrete);
  L.fill(65, 0, 67, 21, Mat.Concrete);
  L.shutter(65, 22, 67, 27);

  // C. watcher drone lane, a kiosk roof with a log, second gate
  L.checkpoint(71, 27);
  L.enemy('watcher', 84, 20);
  L.enemy('watcher', 99, 20);
  L.fill(79, 27, 79, 27, Mat.Concrete);
  L.catwalk(89, 92, 25);
  L.log(90, 23, 'log26');
  L.fill(95, 27, 95, 27, Mat.Concrete);
  L.fill(107, 0, 109, 21, Mat.Concrete);
  L.shutter(107, 22, 109, 27);

  // D. two crossing lights and a watcher in the shade
  L.checkpoint(113, 27);
  L.trigger(112, 16, 4, 12, 'v_serin');
  L.light(124, 14, 35, 145, 4.2, 260, 26, 0);
  L.light(140, 14, 35, 145, 4.2, 260, 26, 0.5);
  L.fill(115, 21, 122, 21, Mat.Steel);
  L.fill(126, 21, 138, 21, Mat.Steel);
  L.fill(142, 21, 150, 21, Mat.Steel);
  L.fill(119, 27, 119, 27, Mat.Concrete);
  L.fill(146, 27, 146, 27, Mat.Concrete);
  L.enemy('watcher', 132, 24);
  L.log(135, 26, 'log27');
  L.fill(151, 0, 153, 21, Mat.Concrete);
  L.shutter(151, 22, 153, 27);

  // E. relay plaza
  L.checkpoint(157, 27);
  L.trigger(176, 16, 4, 12, 'v_exit');
  L.exit(185, 27);

  L.clearText('등불 중계기 3 — 거리 재가동');
  return L.build();
}
