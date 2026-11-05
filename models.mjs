import {derive} from './model.mjs';
import {fittedModel} from './fitted-model.mjs';
export const modelStatus = Object.freeze({
  ...fittedModel, id: 'kbo-adjusted', label: 'KBO-adjusted cWPA',
  reason: '2010–2025년 자료로 전력·홈 효과를 추정했습니다. 휴식·최근 경기 수는 후보 모형에서 추정했으나 시간 순서 검증에서 선택되지 않았습니다.',
  excluded: ['휴식·최근 7일 경기 수: 추정 후 검증 기준으로 제외', '선발·불펜 투구 수·부상: 자료 미확보'],
  requirements: ['새 시즌에서 추가 검증', '선수 가용성 자료 확보', '플레이 WP 보정의 추가 검증']
});
export function adjustedPrior(home, away) {
  const h=fittedModel.initialTeams[home], a=fittedModel.initialTeams[away], b=fittedModel.coefficients;
  if (!h || !a || !Number.isFinite(b.strength) || !Number.isFinite(b.home)) throw Error('Missing fitted team parameters');
  if (fittedModel.features.join(',')!=='strength,home') throw Error('Unsupported fitted features; implement path state before enabling');
  return 1/(1+Math.exp(-(b.strength*(h.strength-a.strength)+b.home)));
}
export function calculateModel(games, id) {
  if (id === 'baseline') return derive(games);
  if (id === 'kbo-adjusted') {
    if (!fittedModel.available) throw Error('Fitted model unavailable');
    return derive(games,{homeProbability:(_state,context)=>adjustedPrior(context.home,context.away)});
  }
  throw Error('Unknown model');
}
