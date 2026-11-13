// Stage 10 — "방송탑" (The Broadcast Mast)
//
// A storm-lashed climb up the transmitter mast: short hops between grating
// platforms, four tether swings across the open sections, lightning rods
// that charge and strike everything inside their marked radius, and
// broadcast emitters whose rings shove you off your footing.
import { LevelBuilder, Mat, type LevelData } from '../LevelData.ts';

export function buildLevel10(): LevelData {
  const L = new LevelBuilder('broadcast-mast', '방송탑', 'THE BROADCAST MAST', 56, 110);
  L.setTheme('mast', 'mast', 0.9);
  L.look('mast', 'rain', 0.9);

  // a guyed lattice on the left, the mast itself on the right
  L.fill(0, 6, 1, 109, Mat.Concrete);
  L.fill(42, 13, 55, 109, Mat.Concrete);
  L.fill(42, 70, 43, 86, Mat.Glass); // radome panels
  L.fill(42, 30, 43, 46, Mat.Glass);
  L.backwall(2, 12, 41, 103);
  const deck = (x0: number, x1: number, row: number) => L.catwalk(x0, x1, row);

  // --- base -----------------------------------------------------------------------------------------
  L.building(2, 41, 104, Mat.Steel);
  L.spawn(5, 103);
  L.checkpoint(5, 103);
  L.trigger(2, 92, 8, 12, 'mast_intro');
  L.rod(33, 99, 104, 4.5, 0.2, 30);
  L.trigger(24, 92, 6, 12, 'mast_rod');

  // --- lower mast ---------------------------------------------------------------------------------------
  deck(14, 22, 101);
  deck(24, 32, 98);
  deck(34, 41, 95);
  deck(22, 30, 92);
  deck(10, 18, 89);
  L.anchor(16, 76); // swing 1
  deck(22, 30, 81);
  L.rod(28, 76, 81, 4, 0.5, 26);
  deck(32, 40, 78);
  deck(20, 28, 75);
  deck(8, 16, 72);
  L.checkpoint(11, 71);
  L.log(9, 69, 'log20');
  L.enemy('drone', 24, 66);

  // --- middle: the launch pads ------------------------------------------------------------------------------
  L.anchor(16, 59); // swing 2
  deck(20, 30, 64);
  deck(32, 40, 61);
  deck(22, 30, 58);
  deck(10, 18, 55);
  L.pulse(14, 54, 2.6, 0, 64, 360); // launch pad: jump as the ring fires
  L.trigger(8, 48, 4, 8, 'mast_pulse');
  L.enemy('mine', 27, 51);
  deck(6, 20, 47);
  L.checkpoint(8, 46);
  L.rod(19, 42, 47, 4, 0.25, 22);
  deck(22, 30, 44);
  deck(32, 40, 41);
  deck(22, 30, 38);
  deck(10, 18, 35);

  // --- upper mast + crown -------------------------------------------------------------------------------------
  L.anchor(16, 22); // swing 3
  deck(22, 30, 27);
  L.enemy('sentry', 29, 26);
  deck(32, 40, 24);
  deck(20, 28, 21);
  deck(8, 16, 18);
  L.pulse(12, 17, 2.8, 0.4, 64, 360); // pad up to the crown
  L.catwalk(4, 41, 12); // crown deck (grating: launch up through it)
  L.rod(30, 7, 12, 3.6, 0.1, 24);
  L.log(40, 9, 'log21');
  L.trigger(20, 1, 6, 11, 'mast_top');
  L.exit(38, 11);

  L.clearText('방송탑 정상 도달');
  return L.build();
}
