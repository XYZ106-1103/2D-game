// Hub C — "등불 광장": the old city hall plaza at dusk.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildHubC(): LevelData {
  const L = new LevelBuilder('hub-plaza', '등불 광장', 'LANTERN PLAZA — 19:00', 76, 22);
  L.setTheme('clock', 'hub');
  L.look('clock', 'leaves', 0.5);
  L.data.hub = true;
  L.fill(0, 17, 75, 21, Mat.Steel);
  L.fill(0, 0, 0, 16, Mat.Concrete);
  L.fill(75, 0, 75, 16, Mat.Concrete);
  L.spawn(4, 16);
  L.checkpoint(3, 16);
  L.trigger(0, 6, 8, 11, 'hub_c');
  L.npc('hana', '하나', 13, 16, 'hana2', false, 1);
  L.npc('seo', '서 노인', 20, 16, 'seo2', false, 1);
  L.npc('cit1', '시민', 26, 16, 'crowd', false, 1);
  L.npc('mourner', '시민', 32, 16, 'mourner2', false, -1);
  L.npc('serin', '세린', 40, 16, 'serin_meet', true, -1);
  L.npc('doyun', '도윤', 49, 16, 'doyun2', false, -1);
  L.npc('cit2', '시민', 55, 16, 'crowd', false, -1);
  L.npc('ru', '루', 61, 16, 'ru2', false, -1);
  L.exit(71, 16);
  L.clearText('광장을 떠나며 — 등불이 켜지기 시작했다');
  return L.build();
}
