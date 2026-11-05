import {mkdir, copyFile, cp, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import katex from 'katex';
import {neutralWeight, derive} from './model.mjs';
import {modelStatus, calculateModel} from './models.mjs';
const require = createRequire(import.meta.url);
await mkdir('dist/vendor/katex', {recursive: true});
for (const file of ['index.html', 'app.mjs', 'model.mjs', 'models.mjs', 'fatigue.mjs','postseason-calendar.mjs','strength-home-model.mjs','strength-home-fit.json','fatigue-training-features.json','fitted-model.mjs', 'model-fit.json', 'situation.mjs', 'style.css', 'data.json']) await copyFile(file, 'dist/' + file);
await mkdir('dist/historical',{recursive:true});
for (const file of ['regular.csv','postseason.json','training-features.json','postseason-innings-audit.json','postseason-manifest.json','regular-manifest.json']) await copyFile('estimation/data/'+file,'dist/historical/'+file);
const katexRoot = dirname(require.resolve('katex/package.json'));
await copyFile(join(katexRoot, 'dist/katex.min.css'), 'dist/vendor/katex/katex.min.css');
await copyFile(join(katexRoot, 'LICENSE'), 'dist/vendor/katex/LICENSE');
await cp(join(katexRoot, 'dist/fonts'), 'dist/vendor/katex/fonts', {recursive: true});
const weights = Array.from({length: 4}, (_, n) => `<tr><th>${n}승</th>${Array.from({length: 4}, (_, m) => `<td>${neutralWeight(n,m)}</td>`).join('')}</tr>`).join('');
const games = JSON.parse(await readFile('data.json', 'utf8'));
const data = derive(games), adjusted = calculateModel(games,'kbo-adjusted');
const sample = data.plays.find(r => r.id === 'ks2-77');
const adjSample = adjusted.plays.find(r=>r.id===sample.id), delta=adjSample.cwpa-sample.cwpa;
const example = `<div class="table-wrap"><table><caption>KS 2차전 10회초 디아즈 1루타 · 실제 수록 플레이</caption><thead><tr><th>원문 WPA</th><th>기본 cWPA</th><th>KBO-adjusted cWPA</th><th>보정 − 기본</th></tr></thead><tbody><tr><td>+${sample.wpa.toFixed(3)}</td><td>+${sample.cwpa.toFixed(3)}%p</td><td>+${adjSample.cwpa.toFixed(3)}%p</td><td>${delta>0?'+':''}${delta.toFixed(3)}%p</td></tr></tbody></table></div>`;
const fit=JSON.parse(await readFile('model-fit.json','utf8'));
const labels={strength:'정규시즌 전력 차이',home:'홈 이점',rest3:'3일 상한 휴식',rest7:'7일 상한 휴식',restLog:'로그 휴식',load3:'누적 부담 τ=3일',load7:'누적 부담 τ=7일',games7:'최근 7일 경기 수'};
const metricTable = `<div class="table-wrap"><table><caption>2023–2025 평가 44경기 · 2022년까지의 계수를 고정 · 작은 표본의 탐색적 평가</caption><thead><tr><th>모형</th><th>로그손실 ↓</th><th>Brier 점수 ↓</th><th>승패 적중률</th></tr></thead><tbody>${[['기본',fit.holdout.baseline],['이전 전력·홈 모형',fit.comparisonWithoutFatigue.holdout],['체력 포함 v2',fit.holdout.adjusted]].map(([label,m])=>`<tr><td>${label}</td><td>${m.logLoss.toFixed(6)}</td><td>${m.brier.toFixed(6)}</td><td>${(m.accuracy*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`;
const reportHTML = `<div class="fit-results"><h3>운영 계수와 검증 결과</h3>
  <p>선택된 체력 포함 모형은 <strong>전력 + 홈 + 누적 부담(τ=7일)</strong>, 세 변수의 정규시즌 추정값을 기준으로 하는 ridge(λ=${fit.lambda})다. 동일 전력·동일 부담의 홈 승률은 <strong>${(100/(1+Math.exp(-fit.coefficients.home))).toFixed(2)}%</strong>다. 중립에서는 홈 항을 0으로 둔다.</p>
  <div class="math">p_g=\\operatorname{logit}^{-1}\\!\\left(${fit.coefficients.strength.toFixed(6)}\\,[\\log(W_H/L_H)-\\log(W_A/L_A)]+${fit.coefficients.home.toFixed(6)}\\,H_g+${fit.coefficients.load7.toFixed(6)}\\,(L_A-L_H)\\right).</div>
  <div class="table-wrap"><table><caption>2010–2025 최종 재추정 계수 · 표본 229경기 / 정규시즌 기준 8,130경기</caption><thead><tr><th>변수</th><th>계수</th><th>95% 시즌 재표집 구간</th></tr></thead><tbody>${fit.features.map(f=>`<tr><td>${labels[f]}</td><td>${fit.coefficients[f].toFixed(4)}</td><td>${fit.coefficientIntervals.intervals95[f].map(v=>v.toFixed(4)).join(' ~ ')}</td></tr>`).join('')}</tbody></table></div>
  <div class="table-wrap"><table><caption>체력 정의별 최선 설정 · 2014–2022 시간 순서 검증 126경기</caption><thead><tr><th>전력·홈에 추가한 변수</th><th>로그손실 ↓</th><th>체력 계수</th></tr></thead><tbody><tr><td>없음 · 이전 모형</td><td>${fit.comparisonWithoutFatigue.validation.logLoss.toFixed(6)}</td><td>없음</td></tr>${fit.familyComparison.map(c=>`<tr><td>${labels[c.features.at(-1)]}</td><td>${c.validation.logLoss.toFixed(6)}</td><td>${c.deploymentCoefficients[c.features.at(-1)].toFixed(5)}</td></tr>`).join('')}</tbody></table></div>
  <p><strong>체력 항을 넣은 이유는 예측력 승리 때문이 아니다.</strong> 체력 반영이라는 요청을 모형 조건으로 삼고 그 안에서 선택했다. 선택 구간 로그손실은 이전 모형보다 ${fit.comparisonWithoutFatigue.validationLogLossDifference.toFixed(6)} 커졌다. 체력 항의 95% 구간은 0을 포함하며, 전력과 부담 차이의 표본 상관은 ${fit.diagnostics.strengthFatigueCorrelation.toFixed(3)}이다. 체력의 독립적 인과 효과를 확인한 것으로 해석하면 안 된다.</p>
  ${metricTable}<p>로그손실과 Brier 점수는 작을수록 좋다. 이후 구간에서 체력 모형의 평균 오차가 조금 작았지만, 작은 차이와 44경기만으로 우월성이 확정되지는 않는다. 2023–2025 결과는 이전 개발 과정에서 이미 보았으므로 독립적인 새 검증이라 부르지 않는다. 우승 확률 자체를 별도로 검증한 결과도 아니다.</p>
  <div class="table-wrap"><table><caption>같은 실제 기록에서의 우승 확률 · %</caption><thead><tr><th>시점</th><th>모형</th><th>KT</th><th>삼성</th></tr></thead><tbody>${[['포스트시즌 시작',0],['KS 2차전 종료',-1]].flatMap(([label,i])=>[['기본',data],['이전 전력·홈 모형',calculateModel(games,'strength-home')],['v2 체력 항 끄기',calculateModel(games,'fatigue-off')],['v2 체력 포함',adjusted]].map(([name,d])=>{const r=d.points.at(i);return `<tr><td>${label}</td><td>${name}</td><td>${(r.cp[0]*100).toFixed(2)}</td><td>${(r.cp[1]*100).toFixed(2)}</td></tr>`;})).join('')}</tbody></table></div>
  <div class="table-wrap"><table><caption>실제 수록 경기에서의 체력 효과 · 홈 승률 기준</caption><thead><tr><th>경기</th><th>홈 / 원정 부담</th><th>체력 제외</th><th>체력 포함</th><th>변화 (%p)</th></tr></thead><tbody>${adjusted.summaries.filter(g=>g.stage==='KS'||g.id==='po1').map(g=>{const f=g.fatigue;return `<tr><td>${g.stage} ${g.number}차전 · ${g.home}/${g.away}</td><td>${f.homeLoad.toFixed(2)} / ${f.awayLoad.toFixed(2)}</td><td>${(f.withoutFatigue*100).toFixed(2)}%</td><td>${(f.homePrior*100).toFixed(2)}%</td><td>${f.homeEffectPP.toFixed(2)}</td></tr>`;}).join('')}</tbody></table></div></div>`;
let article = (await readFile('method.template.html', 'utf8')).replace('<!-- WEIGHTS -->', weights).replace('<!-- EXAMPLE -->', example).replace('<!-- FIT REPORT -->',reportHTML);
article = article.replace(/<div class="math">([\s\S]*?)<\/div>/g, (_, tex) => `<div class="math">${katex.renderToString(tex, {displayMode: true, throwOnError: true, output: 'htmlAndMathml', strict: 'error'})}</div>`);
await writeFile('dist/method.html', article);
await writeFile('dist/model-status.json', JSON.stringify(modelStatus, null, 2) + '\n');
await writeFile('dist/.nojekyll', '');
console.log('Built dashboard, methodology article, local math assets and model status.');
