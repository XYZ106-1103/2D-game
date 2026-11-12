// All narrative text. Every character here is baked into the bitmap fonts.

export const PROLOGUE: string[] = [
  '베스퍼 시티, 2097년.',
  "'침묵'이 있던 밤, 천백만 명이 같은 한 시간을 잊었다.",
  '레테 다이내믹스는 그것을 서버 장애라고 불렀다.',
  '그리고 당신은 이름도 없이, 빗속에서 깨어났다.',
];

export interface DialogLine {
  who: 'MOTH' | 'ION' | 'SYSTEM';
  text: string;
}

export const DIALOGS: Record<string, DialogLine[]> = {
  intro: [
    { who: 'MOTH', text: '…신호 확인. 일어나요, 배달부.' },
    { who: 'MOTH', text: '나는 모스. 당신 팔의 건틀릿 안에 살고 있어요.' },
    { who: 'ION', text: '…여긴 어디지. 아무것도 기억나지 않아.' },
  ],
  move: [{ who: 'MOTH', text: '[A]/[D]로 이동, [Space]로 점프. 몸은 기억하고 있을 거예요.' }],
  grapple: [
    { who: 'MOTH', text: '저 비행 노드가 보여요? [좌클릭]을 누르고 있으면 와이어가 걸려요.' },
    { who: 'MOTH', text: '매달린 채 [A]/[D]로 흔들고, 버튼을 놓는 순간 날아가요.' },
  ],
  reel: [{ who: 'MOTH', text: '높은 곳은 [W]로 와이어를 감아 올라가요. [S]는 풀기.' }],
  glass: [
    { who: 'MOTH', text: '유리 외벽엔 와이어가 미끄러져요. 위쪽 철골을 노려요.' },
    { who: 'MOTH', text: '아래 레일엔 전류가 흘러요. 떨어지지 마세요.' },
  ],
  climb: [{ who: 'MOTH', text: '노드에서 노드로. 와이어는 끊지 않고 이어 거는 거예요.' }],
  dash: [
    { who: 'MOTH', text: '[Shift]로 대시. 공중에선 한 번, 와이어를 걸면 다시 충전돼요.' },
    { who: 'ION', text: '레테의 탑이 보이는군. 저기서 무언가 나를 부르고 있어.' },
  ],
  exit: [{ who: 'MOTH', text: '저 승강기면 9구역 봉쇄선을 넘을 수 있어요. 서둘러요.' }],
  checkpoint: [{ who: 'SYSTEM', text: '메모리 릴레이 동기화 완료.' }],
};

export interface LogEntry {
  title: string;
  body: string[];
}

export const LOGS: Record<string, LogEntry> = {
  log1: {
    title: '기록 #0417 — 배달 전표',
    body: ['수신인: 미상.  화물: 기억 단편 1개.', '메모: 절대 아카이브를 거치지 말 것.', '서명: I.'],
  },
  log2: {
    title: '기록 #0872 — 레테 내부 공지',
    body: ['9구역 재개발 승인. 주민 기억 일괄 정리 예정.', '민원 발생 시, 해당 민원의 기억도 정리할 것.'],
  },
  log3: {
    title: '기록 #1103 — 음성 메모',
    body: ["'이온, 이걸 듣고 있다면 나는 이미 잊혀졌을 거야.'", "'테더를 믿어. 그건 기억하지 않아. 그래서 잊지도 않아.'"],
  },
};

export const UI_TEXT = {
  pressAny: 'PRESS ANY KEY',
  newGame: '새 게임',
  continue: '이어하기',
  controls: '조작법',
  options: '설정',
  quit: '타이틀로',
  resume: '계속하기',
  restart: '체크포인트에서 재시작',
  paused: '일시정지',
  signalLost: 'SIGNAL LOST',
  signalLostSub: '메모리 릴레이에서 재구성 중…',
  stageClear: 'STAGE CLEAR',
  stageClearSub: '9구역 봉쇄선 돌파',
  time: '시간',
  deaths: '재구성',
  logs: '기록',
  checkpoint: 'CHECKPOINT',
  checkpointSub: '메모리 동기화',
  back: '뒤로',
  master: '전체 볼륨',
  music: '음악',
  sfx: '효과음',
  shake: '화면 흔들림',
  flash: '섬광 효과',
  fullscreen: '전체 화면',
  on: '켜기',
  off: '끄기',
  toTitle: '타이틀로 돌아가기',
  credits: 'v0.1 — 첫 번째 플레이어블 빌드',
  skip: '[Space] 건너뛰기',
  logPickup: '기록 획득',
  continuePrompt: '[Space] 계속',
};

export const CONTROLS: { keys: string[]; label: string }[] = [
  { keys: ['A', 'D'], label: '이동 / 스윙 가속' },
  { keys: ['SPACE'], label: '점프 · 와이어 중 점프 해제' },
  { keys: ['MOUSE_L'], label: '와이어 발사 (누르고 유지)' },
  { keys: ['W', 'S'], label: '와이어 감기 / 풀기 (휠)' },
  { keys: ['SHIFT'], label: '대시 (방향키로 8방향)' },
  { keys: ['MOUSE_R'], label: '공격 (J)' },
  { keys: ['ESC'], label: '일시정지' },
];
