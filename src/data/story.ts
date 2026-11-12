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
  combat: [
    { who: 'MOTH', text: '레테 경비병이에요. 저 방패는 정면 공격을 막아요.' },
    { who: 'MOTH', text: '[우클릭]으로 베기. 등 뒤나 머리 위를 노리거나, 와이어로 걸어 끌려가며 일격을.' },
  ],
  sentry: [{ who: 'MOTH', text: '포탑이 붉은 조준선을 그리면 피하거나, 날아오는 탄을 베어 되돌려요.' }],
  checkpoint: [{ who: 'SYSTEM', text: '메모리 릴레이 동기화 완료.' }],
  // --- Stage 2: lower market -----------------------------------------------------
  m_intro: [
    { who: 'MOTH', text: '하층 시장. 레테의 감시망이 가장 느슨한 곳이에요.' },
    { who: 'ION', text: '기억을 사고판다는 곳이군. …냄새부터 다르네.' },
  ],
  m_mover: [{ who: 'MOTH', text: '움직이는 노드예요. 매달리면 함께 실려 가요. 반대편에서 놓아요.' }],
  m_vent: [{ who: 'MOTH', text: '증기 배출구. 분출할 때 올라타면 높이 떠올라요.' }],
  m_crumble: [{ who: 'MOTH', text: '녹슨 격자는 오래 못 버텨요. 멈추지 말고 건너요.' }],
  m_exit: [
    { who: 'MOTH', text: '저 승강기가 레테 타워 외벽 작업층으로 이어져요.' },
    { who: 'ION', text: '레테가 날 쫓는 이유. 그 탑 꼭대기에 답이 있겠지.' },
  ],
  // --- Stage 3: tower wall -------------------------------------------------------------
  t_intro: [
    { who: 'MOTH', text: '스모그 위로 올라왔어요. 여기서부턴 떨어지면 끝이에요.' },
    { who: 'ION', text: '구름바다라… 도시가 이렇게 조용한 줄은 몰랐어.' },
  ],
  t_glass: [{ who: 'MOTH', text: '외벽 유리 구간. 강철 돌출부와 노드만 믿어요.' }],
  t_gondola: [{ who: 'MOTH', text: '청소용 곤돌라 노드가 오르내려요. 올라가는 순간에 타요.' }],
  t_top: [
    { who: 'SYSTEM', text: '경고: 승인되지 않은 기억 블록 감지. 기록관 프로토콜 가동.' },
    { who: 'MOTH', text: '…기록관. 아카이브를 지키는 집행 유닛이에요. 준비해요.' },
  ],
  // --- Stage 4: boss -----------------------------------------------------------------------
  b_intro: [
    { who: 'SYSTEM', text: '기록관: 운반자 확인. 블록 서명 — 관리자 이온.' },
    { who: 'SYSTEM', text: '기록관: 당신은 스스로를 지웠다. 우리는 그 선택을 완성한다.' },
    { who: 'ION', text: '내가… 나를 지웠다고?' },
  ],
  b_phase2: [{ who: 'MOTH', text: '팔 장갑이 깨졌어요! 남은 팔의 노드를 노려요!' }],
  b_end: [
    { who: 'SYSTEM', text: '기록관: 블록… 회수… 실패. 아카이브 무결성… 손상.' },
    { who: 'MOTH', text: '해냈어요. 저 승강기가 첨탑 중심부로 이어져요.' },
    { who: 'ION', text: '내가 지운 그 한 시간. 이제 되찾으러 가자.' },
  ],
  b_phase3: [
    { who: 'SYSTEM', text: '기록관: 코어 노출. 구역 전체 기억 소거 개시.' },
    { who: 'MOTH', text: '바닥에 전류가 흘러요! 노드에 매달려서 코어에 일격을!' },
  ],
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
  log4: {
    title: '기록 #1290 — 시장 상인 장부',
    body: ['기억 한 시간: 300크레딧. 행복한 기억은 두 배.', '침묵 이후로 아무도 그 밤을 팔러 오지 않는다.'],
  },
  log5: {
    title: '기록 #1544 — 레테 보안 지령',
    body: ["대상 코드명 '테더'. 건틀릿 회수 최우선.", '운반자의 기억은 회수 즉시 아카이브로 이송할 것.'],
  },
  log6: {
    title: '기록 #1777 — 모스 자가 진단',
    body: ['코어 손상률 61%. 원본 기억 블록 일부 확인.', "블록 서명: 아카이브 관리자 권한 — '이온'."],
  },
  log7: {
    title: '기록 #2010 — 프로젝트 녹턴',
    body: ['1단계: 전 시민 동시 기억 덮어쓰기 (00:00–01:00).', '부작용: 해당 한 시간의 공백. 대외 발표는 서버 장애로.'],
  },
  log8: {
    title: '기록 #2048 — 기록관 프로토콜',
    body: ['유출된 원본 블록의 운반자를 발견 시,', '운반자 자체를 아카이브한다. 예외 없음.'],
  },
  log9: {
    title: '기록 #2097 — 이온의 메모',
    body: ["'모스, 내가 나를 잊더라도 너는 기억해.'", "'그 한 시간을, 이 도시에 돌려줘.'"],
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
  kills: '처치',
  bestCombo: '최대 콤보',
  checkpoint: 'CHECKPOINT',
  checkpointSub: '메모리 동기화',
  back: '뒤로',
  master: '전체 볼륨',
  music: '음악',
  sfx: '효과음',
  shake: '화면 흔들림',
  flash: '섬광 효과',
  assist: '조준 보조',
  stageSelect: '스테이지 선택',
  fullscreen: '전체 화면',
  on: '켜기',
  off: '끄기',
  toTitle: '타이틀로 돌아가기',
  credits: 'v1.0 — CHAPTER 1: 9구역에서 첨탑까지',
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
  { keys: ['MOUSE_R'], label: '공격 · 적에게 와이어 = 돌진 일격' },
  { keys: ['ESC'], label: '일시정지' },
];
