import {mkdir, copyFile, cp, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import katex from 'katex';
import {neutralWeight, derive} from './model.mjs';
import {modelStatus, calculateModel} from './models.mjs';
const require = createRequire(import.meta.url);
await mkdir('dist/vendor/katex', {recursive: true});
for (const file of ['index.html', 'app.mjs', 'model.mjs', 'models.mjs', 'fitted-model.mjs', 'model-fit.json', 'situation.mjs', 'style.css', 'data.json']) await copyFile(file, 'dist/' + file);
await mkdir('dist/historical',{recursive:true});
for (const file of ['regular.csv','postseason.json','training-features.json','postseason-manifest.json','regular-manifest.json']) await copyFile('estimation/data/'+file,'dist/historical/'+file);
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
const labels={strength:'정규시즌 전력 차이',home:'홈 이점',rest:'로그 휴식일 차이',games7:'최근 7일 경기 수 차이'};
const metricTable = `<div class="table-wrap"><table><caption>2023–2025 평가 44경기 · 2022년까지의 계수를 고정 · 작은 표본의 탐색적 평가</caption><thead><tr><th>모형</th><th>로그손실 ↓</th><th>Brier 점수 ↓</th><th>승패 적중률</th></tr></thead><tbody>${[['기본',fit.holdout.baseline],['보정',fit.holdout.adjusted]].map(([label,m])=>`<tr><td>${label}</td><td>${m.logLoss.toFixed(4)}</td><td>${m.brier.toFixed(4)}</td><td>${(m.accuracy*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`;
const reportHTML = `<div class="fit-results"><h3>운영 계수와 검증 결과</h3>
  <p>선택된 모형은 <strong>전력 + 홈 효과</strong>, 정규시즌 추정값을 기준으로 하는 ridge(λ=${fit.lambda})다. 동일 전력의 홈 승률은 <strong>${(100/(1+Math.exp(-fit.coefficients.home))).toFixed(2)}%</strong>다. 중립에서는 50%가 되며, 상대 전력이 다르면 중립 승률도 달라진다.</p>
  <div class="math">p_g=\\operatorname{logit}^{-1}\\!\\left(${fit.coefficients.strength.toFixed(6)}\\,[\\log(W_H/L_H)-\\log(W_A/L_A)]+${fit.coefficients.home.toFixed(6)}\\,H_g\\right).</div>
  <div class="table-wrap"><table><caption>2010–2025 최종 재추정 계수 · 표본 229경기 / 정규시즌 기준 8,130경기</caption><thead><tr><th>변수</th><th>계수</th><th>95% 시즌 재표집 구간</th></tr></thead><tbody>${fit.features.map(f=>`<tr><td>${labels[f]}</td><td>${fit.coefficients[f].toFixed(4)}</td><td>${fit.coefficientIntervals.intervals95[f].map(v=>v.toFixed(4)).join(' ~ ')}</td></tr>`).join('')}</tbody></table></div>
  <div class="table-wrap"><table><caption>변수 조합별 최선 설정 · 2014–2022 시간 순서 검증 126경기</caption><thead><tr><th>후보</th><th>로그손실 ↓</th><th>추가 변수의 최종 추정 계수</th></tr></thead><tbody>${fit.familyComparison.map(c=>`<tr><td>${c.features.map(f=>labels[f]).join(' + ')}</td><td>${c.validation.logLoss.toFixed(6)}</td><td>${c.features.filter(f=>!['strength','home'].includes(f)).map(f=>`${labels[f]} ${c.deploymentCoefficients[f].toFixed(5)}`).join(' / ')||'선택된 운영 모형'}</td></tr>`).join('')}</tbody></table></div>
  ${metricTable}<p>로그손실과 Brier 점수는 작을수록 좋다. 이 표에서 보정 모형의 평균 오차가 작았지만, 작은 차이와 44경기만으로 우월성이 확정되지는 않는다. 우승 확률 자체를 별도로 검증한 결과도 아니다.</p>
  <div class="table-wrap"><table><caption>같은 실제 기록에서의 우승 확률 · %</caption><thead><tr><th>시점</th><th>모형</th><th>KT</th><th>삼성</th></tr></thead><tbody>${[['포스트시즌 시작',0],['KS 2차전 종료',-1]].flatMap(([label,i])=>[['기본',data],['보정',adjusted]].map(([name,d])=>{const r=d.points.at(i);return `<tr><td>${label}</td><td>${name}</td><td>${(r.cp[0]*100).toFixed(2)}</td><td>${(r.cp[1]*100).toFixed(2)}</td></tr>`;})).join('')}</tbody></table></div></div>`;
let article = (await readFile('method.template.html', 'utf8')).replace('<!-- WEIGHTS -->', weights).replace('<!-- EXAMPLE -->', example).replace('<!-- FIT REPORT -->',reportHTML);
article = article.replace(/<div class="math">([\s\S]*?)<\/div>/g, (_, tex) => `<div class="math">${katex.renderToString(tex, {displayMode: true, throwOnError: true, output: 'htmlAndMathml', strict: 'error'})}</div>`);
await writeFile('dist/method.html', article);
await writeFile('dist/model-status.json', JSON.stringify(modelStatus, null, 2) + '\n');
await writeFile('dist/.nojekyll', '');
console.log('Built dashboard, methodology article, local math assets and model status.');
