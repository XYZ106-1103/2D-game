// Stage 12 — "첫 햇살 옥상가" (Sunlit Roofs). New rule: zip-line cables.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildSunroof(): LevelData {
  const L = new LevelBuilder('sunlit-roofs', '첫 햇살 옥상가', 'SUNLIT ROOFS — 07:00', 180, 36);
  L.setTheme('sunroof', 'sunroof');
  L.look('sunroof', 'dust', 1);

  // A. home roof + water tower holding the first cable
  L.building(0, 20, 26);
  L.spawn(3, 25);
  L.checkpoint(2, 25);
  L.trigger(0, 14, 8, 12, 'w_intro');
  L.trigger(9, 14, 4, 12, 'w_cable');
  L.log(12, 22, 'log22');
  L.cable(15, 19, 44, 24);

  // B. solar roof
  L.building(42, 62, 28);
  L.fill(42, 28, 62, 28, Mat.Steel);
  L.enemy('drone', 54, 21);

  // C. climb to the antenna roof (swing) and the long cable
  L.anchor(64, 15);
  L.building(68, 84, 24);
  L.checkpoint(70, 23);
  L.cable(83, 16, 112, 24);
  L.trigger(70, 8, 4, 16, 'w_news');

  // D. long roof with a laundry yard
  L.building(110, 132, 28);
  L.catwalk(114, 120, 25);
  L.catwalk(122, 128, 22);
  L.enemy('drone', 126, 15);

  // E. plank ladder up to the last cable
  L.building(131, 141, 24);
  L.catwalk(134, 140, 21);
  L.catwalk(139, 146, 18);
  L.log(141, 15, 'log23');
  L.cable(146, 12, 168, 22);
  L.trigger(134, 8, 4, 16, 'w_moth');

  // F. relay roof
  L.building(166, 179, 26);
  L.checkpoint(168, 25);
  L.trigger(170, 14, 4, 12, 'w_exit');
  L.exit(176, 25);

  L.clearText('등불 중계기 1 — 옥상가 재가동');
  return L.build();
}
