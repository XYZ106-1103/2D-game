// Stage 5 — "콜드 아카이브" (The Cold Archive)
//
// Inside the spire: frozen server halls. New rules, one at a time:
// timed security beams → a ceiling you can hook (except the frosted cryo
// glass) over a spiked pit → a cold-air updraft → a tailwind gap → a
// floor-level sweep beam that sends you up onto the cable trays.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel5(): LevelData {
  const L = new LevelBuilder('cold-archive', '콜드 아카이브', 'THE COLD ARCHIVE', 200, 34);
  L.setTheme('archive', 'archive');
  L.look('archive', 'frost', 1);
  L.backwall(0, 6, 199, 27);

  // --- A. Intake hall ------------------------------------------------------------------------
  L.building(0, 66, 28);
  L.fill(0, 0, 29, 16, Mat.Concrete);
  L.spawn(4, 27);
  L.checkpoint(3, 27);
  L.trigger(0, 17, 8, 11, 'a_intro');
  L.fill(14, 25, 17, 27, Mat.Concrete);
  L.log(22, 24, 'log10');

  // --- B. Laser gallery (wave of vertical beams) -------------------------------------------------
  L.fill(30, 0, 62, 20, Mat.Concrete);
  for (let i = 0; i < 4; i++) L.laser(36 + i * 8, 21, 7, 'v', 1.0, 1.4, i * 0.18);
  L.trigger(24, 17, 6, 11, 'a_laser');

  // --- C. Ceiling-swing hall over cryo spikes ---------------------------------------------------
  L.fill(63, 0, 104, 16, Mat.Concrete);
  L.fill(77, 15, 82, 16, Mat.Glass); // frosted cryo glass: no hook
  L.clear(67, 28, 100, 33);
  L.rail(67, 100, 33); // spikes far below: a fall here is final
  L.trigger(60, 16, 6, 12, 'a_ceiling');
  L.trigger(82, 16, 4, 16, 'a_voices');
  L.log(84, 21, 'log11');
  L.enemy('drone', 74, 22).enemy('drone', 92, 21);

  // --- D. Landing + cold-air updraft shaft ------------------------------------------------------
  L.building(101, 112, 28);
  L.checkpoint(103, 27);
  L.fill(105, 0, 199, 5, Mat.Concrete); // upper ceiling
  L.fan(106, 7, 111, 27, 0, -2300);
  L.trigger(100, 16, 4, 12, 'a_fan');

  // --- E. Upper corridor with a tailwind gap -------------------------------------------------------
  L.building(113, 127, 12);
  L.rail(128, 138, 33);
  L.building(139, 160, 12);
  L.fan(124, 6, 140, 11, 1100, 0);
  L.checkpoint(146, 11);
  L.enemy('sentry', 157, 11);
  L.enemy('trooper', 120, 11);

  // --- F. Vault: floor sweep beam, cable trays, exit lift ------------------------------------------
  L.building(161, 199, 28);
  L.fill(161, 12, 162, 27, Mat.Concrete);
  L.catwalk(165, 174, 25);
  L.catwalk(177, 187, 22);
  L.catwalk(168, 176, 19);
  L.laser(163, 26, 36, 'h', 1.0, 3.3, 0);
  L.trigger(160, 6, 4, 6, 'a_floor');
  L.enemy('trooper', 184, 27).enemy('drone', 176, 12);
  L.trigger(186, 6, 6, 22, 'a_exit');
  L.exit(195, 27);

  L.clearText('아카이브 냉각 구역 통과');
  return L.build();
}
