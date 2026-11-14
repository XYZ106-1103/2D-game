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
import { buildSunroof } from './ch3/sunroof.ts';
import { buildDrowned } from './ch3/drowned.ts';
import { buildHubA } from './ch3/hubA.ts';
import { buildAvenue } from './ch3/avenue.ts';
import { buildTransit } from './ch3/transit.ts';
import { buildHubB } from './ch3/hubB.ts';
import { buildLab } from './ch3/lab.ts';
import { buildHarbor } from './ch3/harbor.ts';
import { buildHubC } from './ch3/hubC.ts';
import { buildClock } from './ch3/clock.ts';
import { buildVesperLevel } from './ch3/vesper.ts';

/** Stage order: chapter 1 (0-3), chapter 2 (4-10), chapter 3 (11-21, hubs at 13/16/19). */
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
  buildSunroof,
  buildDrowned,
  buildHubA,
  buildAvenue,
  buildTransit,
  buildHubB,
  buildLab,
  buildHarbor,
  buildHubC,
  buildClock,
  buildVesperLevel,
];

export const STAGE_NAMES = [
  '9구역: 잠긴 옥상', '하층 시장', '레테 타워 외벽', '기록관',
  '콜드 아카이브', '기억 정제소', '중력 코어', '침묵의 시간', '공중 정원', '방송탑', '녹턴',
  '첫 햇살 옥상가', '물에 잠긴 하층', '하나의 가게', '소란의 거리', '환승선', '도윤의 관제실', '중계 게이트 연구소', '크레인 항만', '등불 광장', '옛 시계탑', '베스퍼',
];

/** First stage index of each chapter (stage select tabs). */
export const CHAPTER_STARTS = [0, 4, 11];
/** Index of the last stage of chapter 2 (its ending leads into chapter 3). */
export const CHAPTER2_END = 10;

/** Index of the last stage of chapter 1 (the chapter interlude plays after it). */
export const CHAPTER1_END = 3;
