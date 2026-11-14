// Stage 19 — "크레인 항만" (The Crane Harbor). New rule: drag cargo with the tether.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildHarbor(): LevelData {
  const L = new LevelBuilder('harbor', '크레인 항만', 'THE CRANE HARBOR — 18:00', 200, 34);
  L.setTheme('harbor', 'harbor');
  L.look('harbor', 'gulls', 1);

  // A. first dock: drag the crate under the container stack
  L.building(0, 40, 26, Mat.Steel);
  L.spawn(3, 25);
  L.checkpoint(2, 25);
  L.trigger(0, 14, 8, 12, 'h_intro');
  L.trigger(9, 14, 4, 12, 'h_crate');
  L.crate(14, 26);
  L.fill(30, 22, 40, 25, Mat.Concrete); // container stack: too tall to jump

  // B. the sea under a crane hook
  L.pool(41, 28, 62, 33);
  L.fill(41, 33, 62, 33, Mat.Concrete);
  L.mover(43, 14, 59, 14, 5.5);

  // C. second dock: pull the crate off the ledge to plug the steam jet
  L.building(63, 104, 26, Mat.Steel);
  L.checkpoint(65, 25);
  L.fill(77, 22, 86, 25, Mat.Concrete);
  L.crate(78, 22);
  // the jet slams you into the live rail under the overhang — plug it with the crate
  L.vent(75, 25, 8, 1.4, 0.4);
  L.fill(73, 13, 77, 16, Mat.Concrete);
  L.rail(73, 77, 17);
  L.fill(70, 0, 104, 12, Mat.Concrete);
  L.enemy('trooper', 96, 25);
  L.trigger(88, 14, 4, 12, 'h_mid');
  L.log(84, 19, 'log32');

  // D. long sea crossing under two crane hooks
  L.pool(105, 28, 140, 33);
  L.fill(105, 33, 140, 33, Mat.Concrete);
  L.mover(108, 14, 122, 14, 5, 0);
  L.mover(124, 13, 138, 13, 5, 0.5);
  L.fill(121, 27, 123, 33, Mat.Concrete); // a mooring post to rest on mid-basin

  // E. last dock and the relay
  L.building(141, 199, 26, Mat.Steel);
  L.checkpoint(143, 25);
  L.enemy('trooper', 160, 25).enemy('drone', 170, 18);
  L.crate(152, 26);
  L.fill(162, 22, 168, 25, Mat.Concrete);
  L.log(166, 19, 'log33');
  L.trigger(180, 14, 4, 12, 'h_exit');
  L.exit(195, 25);

  L.clearText('등불 중계기 6 — 항만 재가동');
  return L.build();
}
