import {derive} from './model.mjs';
import {fittedModel} from './fitted-model.mjs';
import {fittedModel as priorModel} from './strength-home-model.mjs';
import {fatigueAdapter} from './fatigue.mjs';
export const modelStatus = Object.freeze({
  ...fittedModel, id: 'kbo-adjusted', label: 'KBO-adjusted cWPA',
  reason: '전력·홈 효과에 과거 경기의 누적 부담과 휴식에 따른 회복을 반영합니다. 체력 항은 요청에 따라 포함한 실험적 대리지표이며, 체력 제외 모형보다 예측력이 개선됐다고 단정하지 않습니다.',
  excluded: ['선발·불펜 투구 수·부상·연장전 추가 가중치: 제외'],
  requirements: ['새 시즌에서 추가 검증', '선수 가용성 자료 확보', '플레이 WP 보정의 추가 검증']
});
export function adjustedPrior(home, away, workloadDifference=0) {
  const h=fittedModel.initialTeams[home], a=fittedModel.initialTeams[away], b=fittedModel.coefficients;
  if (!h || !a || !Number.isFinite(b.strength) || !Number.isFinite(b.home)) throw Error('Missing fitted team parameters');
  if (fittedModel.features.join(',')!=='strength,home,load7') throw Error('Unsupported fitted features');
  return 1/(1+Math.exp(-(b.strength*(h.strength-a.strength)+b.home+b.load7*workloadDifference)));
}
export function calculateModel(games, id) {
  if (id === 'baseline') return derive(games);
  if (id === 'strength-home') return derive(games,{homeProbability:(_s,c)=>{const b=priorModel.coefficients;return 1/(1+Math.exp(-(b.strength*(priorModel.initialTeams[c.home].strength-priorModel.initialTeams[c.away].strength)+b.home)));}});
  if (id === 'kbo-adjusted') {
    if (!fittedModel.available) throw Error('Fitted model unavailable');
    return derive(games,{homeProbability:(_state,c)=>c.fatigue.homePrior,pathAdapter:fatigueAdapter()});
  }
  if (id === 'fatigue-off') return derive(games,{homeProbability:(_state,c)=>c.fatigue.homePrior,pathAdapter:fatigueAdapter({enabled:false})});
  throw Error('Unknown model');
}
