// Hub B — "도윤의 관제실": the transit control room.
import { LevelBuilder, Mat, type LevelData } from '../../LevelData.ts';

export function buildHubB(): LevelData {
  const L = new LevelBuilder('hub-doyun', '도윤의 관제실', 'TRANSIT CONTROL', 56, 22);
  L.setTheme('transit', 'hub');
  L.look('transit', 'none', 0);
  L.data.hub = true;
  L.fill(0, 17, 55, 21, Mat.Steel);
  L.fill(0, 0, 0, 16, Mat.Concrete);
  L.fill(55, 0, 55, 16, Mat.Concrete);
  L.fill(0, 0, 55, 3, Mat.Concrete);
  L.backwall(1, 4, 54, 16);
  L.spawn(4, 16);
  L.checkpoint(3, 16);
  L.trigger(0, 6, 8, 11, 'hub_b');
  L.npc('doyun', '도윤', 20, 16, 'doyun', true, -1);
  L.npc('serin', '세린 (통신)', 31, 16, 'serin_call', true, -1);
  L.npc('cit1', '역무원', 42, 16, 'station', false, -1);
  L.exit(52, 16);
  L.clearText('관제실을 떠나며 — 세 번째 답을 찾았다');
  return L.build();
}
