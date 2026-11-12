import type { LevelData } from '../LevelData.ts';
import { buildLevel1 } from './level1.ts';
import { buildLevel2 } from './level2.ts';
import { buildLevel3 } from './level3.ts';
import { buildBossLevel } from './level4.ts';

/** Chapter 1 stage order. */
export const STAGES: (() => LevelData)[] = [buildLevel1, buildLevel2, buildLevel3, buildBossLevel];

export const STAGE_NAMES = ['9구역: 잠긴 옥상', '하층 시장', '레테 타워 외벽', '기록관'];
