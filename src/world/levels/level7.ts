// Stage 7 — "중력 코어" (The Gravity Core)
//
// A spherical chamber with no floor, around NOCTURNE's cocoon. Low-gravity
// pockets turn jumps into long floats; gravity wells pull you toward
// hookable cores you can orbit; a zero-g lift carries you to the terminal.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel7(): LevelData {
  const L = new LevelBuilder('gravity-core', '중력 코어', 'THE GRAVITY CORE', 180, 40);
  L.setTheme('core', 'core');
  L.look('core', 'motes', 1);

  // --- A. Entry dock ------------------------------------------------------------------------------
  L.building(0, 24, 30, Mat.Steel);
  L.spawn(4, 29);
  L.checkpoint(3, 29);
  L.trigger(0, 18, 8, 12, 'c_intro');

  // --- B. Zero-g field over the void ------------------------------------------------------------------
  L.zeroG(25, 3, 70, 37, 0.28);
  L.catwalk(31, 35, 27);
  L.catwalk(41, 44, 23);
  L.catwalk(51, 55, 25);
  L.catwalk(61, 65, 21);
  L.log(47, 12, 'log14');
  L.trigger(20, 10, 5, 20, 'c_zerog');

  // --- C. Monolith ledge ------------------------------------------------------------------------------------
  L.building(71, 95, 24);
  L.checkpoint(74, 23);
  L.enemy('drone', 82, 16).enemy('drone', 90, 18);
  L.fill(84, 21, 86, 23, Mat.Concrete);

  // --- D. Gravity wells ------------------------------------------------------------------------------------
  L.trigger(91, 8, 4, 16, 'c_well');
  L.well(101, 18, 7, 760);
  L.well(114, 13, 7, 760);
  L.well(127, 16, 6, 700);

  // --- E. Zero-g lift to the terminal ---------------------------------------------------------------------
  L.building(133, 149, 22, Mat.Concrete);
  L.checkpoint(137, 21);
  L.trigger(137, 6, 4, 16, 'c_voice');
  L.zeroG(146, 3, 161, 21, 0.2);
  L.enemy('mine', 155, 14).enemy('mine', 157, 7);
  L.log(156, 4, 'log15');
  L.fill(162, 8, 179, 11, Mat.Concrete);
  L.trigger(166, 0, 4, 8, 'c_exit');
  L.exit(176, 7);

  L.clearText('중력 코어 돌파');
  return L.build();
}
