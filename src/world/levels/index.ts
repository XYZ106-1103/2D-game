import type { LevelData } from '../LevelData.ts';
import { buildLevel1 } from './level1.ts';
import { buildLevel2 } from './level2.ts';
import { buildLevel3 } from './level3.ts';
import { buildBossLevel } from './level4.ts';
import { buildLevel5 } from './level5.ts';
import { buildLevel6 } from './level6.ts';
import { buildLevel7 } from './level7.ts';
import { buildLevel8 } from './level8.ts';
import { buildLevel9 } from './level9.ts';
import { buildLevel10 } from './level10.ts';
import { buildNocturneLevel } from './level11.ts';

/** Stage order: chapter 1 (0-3), chapter 2 (4-10). */
export const STAGES: (() => LevelData)[] = [
  buildLevel1,
  buildLevel2,
  buildLevel3,
  buildBossLevel,
  buildLevel5,
  buildLevel6,
  buildLevel7,
  buildLevel8,
  buildLevel9,
  buildLevel10,
  buildNocturneLevel,
];

export const STAGE_NAMES = ['9구역: 잠긴 옥상', '하층 시장', '레테 타워 외벽', '기록관', '콜드 아카이브', '기억 정제소', '중력 코어', '침묵의 시간', '공중 정원', '방송탑', '녹턴'];

/** Index of the last stage of chapter 1 (the chapter interlude plays after it). */
export const CHAPTER1_END = 3;
