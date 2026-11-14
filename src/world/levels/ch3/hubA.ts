// Hub A — "하나의 가게": a memory broker's shop turned shelter.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildHubA(): LevelData {
  const L = new LevelBuilder('hub-hana', '하나의 가게', "HANA'S SHELTER", 60, 24);
  L.setTheme('avenue', 'hub');
  L.look('avenue', 'dust', 0.5);
  L.data.hub = true;
  L.fill(0, 19, 59, 23, Mat.Steel);
  L.fill(0, 0, 0, 18, Mat.Concrete);
  L.fill(59, 0, 59, 18, Mat.Concrete);
  L.fill(0, 0, 59, 4, Mat.Concrete);
  L.backwall(1, 5, 58, 18);
  L.catwalk(22, 30, 14); // shelf
  L.spawn(4, 18);
  L.checkpoint(3, 18);
  L.trigger(0, 8, 8, 11, 'hub_a');
  L.npc('hana', '하나', 16, 18, 'hana', true, 1);
  L.npc('seo', '서 노인', 27, 18, 'seo', true, -1);
  L.npc('mourner', '시민', 38, 18, 'mourner', false, -1);
  L.npc('ru', '루', 47, 18, 'ru', false, -1);
  L.exit(56, 18);
  L.clearText('쉼터를 떠나며 — 사람들의 이야기를 들었다');
  return L.build();
}
