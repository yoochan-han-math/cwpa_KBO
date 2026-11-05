import {derive} from './model.mjs';
export const modelStatus = Object.freeze({
  id: 'kbo-adjusted', label: 'KBO-adjusted cWPA', status: 'unestimated', available: false,
  checkedAt: '2026-11-05', trainingPeriod: null, sampleSize: 0, coefficients: null,
  reason: '과거 경기별 전력·휴식·투수 소모 자료를 시점 기준으로 결합한 학습 자료와 시간 순서 검증이 아직 없습니다.',
  excluded: ['기본 전력 차이', 'KBO 홈 효과 재추정', '경기별 휴식', '누적 경기·불펜 소모·선발 휴식'],
  requirements: ['출처와 관측 시점이 있는 과거 경기 자료', '2026년 이전 학습·시간 순서 검증', '가상 대진 경로별 일정·휴식 예측', '플레이 WP 보정의 적합성 검토']
});
export function calculateModel(games, id) {
  if (id === 'baseline') return derive(games);
  if (id === 'kbo-adjusted') throw Error('KBO-adjusted cWPA는 미추정입니다. 기본 모형으로 자동 대체하지 않습니다.');
  throw Error('Unknown model');
}
