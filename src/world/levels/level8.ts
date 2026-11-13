// Stage 8 — "침묵의 시간" (The Silent Hour, 00:00)
//
// Inside the stolen memory: Sector 9 on the night of the Silence, rendered
// in grey with frozen rain. The ground itself is unstable — phase blocks
// swap on a beat — and Echoes of ION's past self replay your own path.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel8(): LevelData {
  const L = new LevelBuilder('silent-hour', '침묵의 시간', '00:00 — THE SILENT HOUR', 190, 34);
  L.setTheme('memory', 'memory');
  L.look('memory', 'frozen', 1);
  L.data.phasePeriod = 1.6;

  // --- A. The rooftop where it began ---------------------------------------------------------------
  L.building(0, 22, 26);
  L.spawn(3, 25);
  L.checkpoint(2, 25);
  L.trigger(0, 14, 8, 12, 's_intro');
  L.trigger(14, 14, 5, 12, 's_phase');
  L.log(16, 22, 'log16');

  // --- B. Beat bridge over the void ----------------------------------------------------------------------
  L.phase(25, 26, 28, 26, 'A');
  L.phase(31, 25, 34, 25, 'B');
  L.phase(37, 24, 40, 24, 'A');
  L.phase(43, 23, 46, 23, 'B');
  L.phase(49, 24, 52, 24, 'A');
  L.phase(55, 25, 58, 25, 'B');

  // --- C. Echo run -------------------------------------------------------------------------------------
  L.building(61, 90, 25);
  L.checkpoint(63, 24);
  L.trigger(66, 13, 4, 12, 's_echo');
  L.enemy('echo', 64, 22);
  L.fill(72, 23, 73, 24, Mat.Concrete);
  L.fill(80, 22, 82, 24, Mat.Concrete);
  L.anchor(95, 15);

  // --- D. Phase stairway with an echo behind you -----------------------------------------------------------
  L.building(101, 106, 26);
  L.checkpoint(103, 25);
  L.enemy('echo', 102, 22);
  L.phase(108, 23, 111, 23, 'A');
  L.phase(113, 20, 116, 20, 'B');
  L.phase(108, 17, 111, 17, 'A');
  L.phase(113, 14, 116, 14, 'B');
  L.phase(119, 12, 122, 12, 'A');
  L.phase(125, 11, 128, 11, 'B');
  L.fill(101, 0, 103, 18, Mat.Glass);

  // --- E. Where the broadcast went out ------------------------------------------------------------------------
  L.building(131, 189, 10);
  L.checkpoint(134, 9);
  L.trigger(140, 0, 4, 10, 's_reveal');
  L.enemy('echo', 160, 7);
  L.log(170, 6, 'log17');
  L.trigger(178, 0, 4, 10, 's_exit');
  L.exit(186, 9);

  L.clearText('원본 기억 복원 — 00:00');
  return L.build();
}
