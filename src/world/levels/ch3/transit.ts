// Stage 16 — "환승선" (The Transit Line). New rule: ride high-speed trains.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildTransit(): LevelData {
  const L = new LevelBuilder('transit', '환승선', 'THE TRANSIT LINE — 15:00', 232, 30);
  L.setTheme('transit', 'transit');
  L.look('transit', 'dust', 0.5);

  // A. departure station (solid), tunnel mouth beside it
  L.building(0, 20, 18);
  L.fill(21, 18, 23, 29, Mat.Concrete); // tunnel portal under the platform
  L.spawn(4, 17);
  L.checkpoint(3, 17);
  L.trigger(0, 6, 8, 12, 't3_intro');
  L.catwalk(24, 30, 18);
  // trains: wheels on rail row 22, emerging at x 24, vanishing into the far portal at x 209
  // two trains share the line, one every 7.5 s
  L.train(22, 24, 209, 250, 4, 15, 0);
  L.train(22, 24, 209, 250, 4, 15, 0.5);
  // signal boxes hang at head height over the roofs: jump them
  L.signal(62, 22);
  L.signal(132, 22);
  L.signal(190, 22);

  // B. mid station platforms hang above the line
  L.catwalk(86, 104, 18);
  L.checkpoint(92, 17);
  L.trigger(88, 6, 4, 12, 't3_mid');
  L.log(100, 15, 'log28');
  L.catwalk(150, 168, 18);
  L.checkpoint(156, 17);
  L.log(164, 15, 'log29');

  // D. terminus
  L.fill(209, 18, 211, 29, Mat.Concrete); // terminus portal: get off before it
  L.catwalk(200, 208, 18);
  L.building(212, 231, 18);
  L.trigger(214, 6, 4, 12, 't3_exit');
  L.exit(226, 17);

  L.clearText('등불 중계기 4 — 환승선 재가동');
  return L.build();
}
