// Stage 21 — "옛 시계탑" (The Old Clock Tower). New rule: rotating gears and pendulums.
// Rhythm: a gear lifts you, a pendulum carries you across, repeat to the crown.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildClock(): LevelData {
  const L = new LevelBuilder('clock-tower', '옛 시계탑', 'THE OLD CLOCK TOWER — 19:30', 52, 76);
  L.setTheme('clock', 'clock');
  L.look('clock', 'leaves', 0.6);
  L.fill(0, 0, 1, 75, Mat.Concrete);
  L.fill(50, 0, 51, 75, Mat.Concrete);
  L.fill(0, 0, 51, 3, Mat.Concrete);
  L.fill(50, 44, 51, 54, Mat.Glass); // clock faces set in the walls
  L.fill(0, 30, 1, 38, Mat.Glass);
  L.backwall(2, 4, 49, 69);

  // ground floor
  L.building(2, 49, 70);
  L.spawn(5, 69);
  L.checkpoint(5, 69);
  L.trigger(2, 58, 8, 12, 'k_intro');
  L.trigger(9, 58, 4, 12, 'k_rotor');

  // R1: the gear's left side rises — ride to the top, hop onto the left ledge
  L.rotor(14, 63, 4, 3, 0.7, 3);
  L.fill(2, 57, 11, 57, Mat.Steel);
  // P1: hook the pendulum weight and swing across to the right ledge
  L.pendulum(21, 38, 12, 35, 3.6, 0);
  L.fill(30, 58, 49, 58, Mat.Steel);
  L.checkpoint(40, 57);
  L.log(47, 55, 'log34');
  // R2: this gear turns the other way — its right side rises
  L.rotor(29, 52, 5, 3, -0.7, 3);
  L.fill(2, 45, 26, 45, Mat.Steel);
  L.checkpoint(6, 44);
  // P2 across, then R3 up to the crown
  L.pendulum(36, 26, 12, 35, 3.6, 0.5);
  L.fill(43, 46, 49, 46, Mat.Steel);
  L.rotor(42, 40, 5, 3, -0.7, 3);
  L.fill(2, 33, 39, 33, Mat.Steel);
  L.log(30, 30, 'log35');
  L.trigger(14, 21, 8, 12, 'k_voice');
  L.trigger(8, 21, 4, 12, 'k_exit');
  L.exit(4, 32);

  L.clearText('시계탑 등반 완료 — 코어 앞');
  return L.build();
}
