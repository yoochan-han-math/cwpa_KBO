import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {engine, derive, teams, neutralWeight, adjust} from './model.mjs';
import {derive as legacy} from './legacy-baseline.mjs';
import {calculateModel, modelStatus} from './models.mjs';
import {parseSituation} from './situation.mjs';
import {validateRecords, fitRidge, predict, estimate} from './estimation/fit.mjs';
const games = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`);

test('baseline matches every published probability and play contribution', () => {
  const actual = derive(games), expected = legacy(games);
  assert.deepEqual(actual.points.map(r => r.cp), expected.points.map(r => r.cp));
  assert.deepEqual(actual.plays.map(r => r.cwpa), expected.plays.map(r => r.cwpa));
  const frozen = JSON.parse(readFileSync(new URL('./baseline-regression.json', import.meta.url)));
  assert.equal(actual.points.length, frozen.pointCount);
  assert.equal(createHash('sha256').update(JSON.stringify(actual.points.map(r => ({cp:r.cp.map(x => x.toFixed(12)), cwpa:r.cwpa?.toFixed(12)})))).digest('hex'), frozen.sha256);
});
test('all 16 neutral seven-game states reduce to combinatorial weights', () => {
  const e = engine(.5);
  for (let n = 0; n < 4; n++) for (let m = 0; m < 4; m++) {
    const st = {s:3, low:'삼성', a:n, b:m};
    close(e.probs(e.step(st,'KT'))[0] - e.probs(e.step(st,'삼성'))[0], neutralWeight(n,m));
  }
  assert.equal(neutralWeight(3,3), 1); assert.equal(neutralWeight(0,0), .3125);
});
test('clinching advances the winner and gives eliminated teams zero probability', () => {
  const e = engine();
  for (const st of [{s:0,low:'두산',a:0,b:1},{s:1,low:'LG',a:2,b:2},{s:2,low:'KIA',a:2,b:2},{s:3,low:'삼성',a:3,b:3}]) {
    const c = e.context(st);
    for (const winner of [c.high,c.low]) {
      const next = e.step(st,winner), loser = winner===c.high ? c.low : c.high;
      assert.equal(e.probs(next)[teams.indexOf(loser)], 0);
      if (st.s===3) assert.equal(e.probs(next)[teams.indexOf(winner)],1);
      else {assert.equal(next.s, st.s+1); assert.equal(next.low,winner);}
    }
  }
});
test('per-play delta formula, every-team telescope and interval totals', () => {
  const d = derive(games);
  for (const r of d.plays) close(r.cwpa, (r.qAfter-r.qBefore)*r.championshipWeight*100);
  for (const summary of d.summaries) {
    const rows = d.plays.filter(r => r.game === summary.id);
    for (let j=0;j<teams.length;j++) {
      let previous=summary.start[j], total=0;
      for (const r of rows) {total+=(r.cp[j]-previous)*100; previous=r.cp[j];}
      close(total,summary.change[j]);
    }
    close(summary.change.reduce((a,b)=>a+b,0),0);
  }
});
test('changing future observed KS2 outcome cannot alter earlier vectors', () => {
  const changed=structuredClone(games); changed.at(-1).rows.at(-1).wp=1;
  const a=derive(games),b=derive(changed);
  assert.deepEqual(a.points.slice(0,-1),b.points.slice(0,-1));
});
test('different priors at each game use DP, not constant binomial weights', () => {
  const priors=[.52,.61,.43,.58,.47,.67,.54];
  const provider=(s,c)=>{assert.ok(Object.isFrozen(s)); assert.equal('rows' in s,false); return priors[c.number-1];};
  const e=engine(provider), start={s:3,low:'삼성',a:0,b:0};
  function enumerate(a,b){if(a===4)return 1;if(b===4)return 0;const i=a+b,p='HHAAAHH'[i]==='H'?priors[i]:1-priors[i];return p*enumerate(a+1,b)+(1-p)*enumerate(a,b+1);}
  close(e.probs(start)[0],enumerate(0,0));
  assert.notEqual(e.probs(start)[0],engine(.5).probs(start)[0]);
});
test('odds shift maps arbitrary priors and fixes terminal endpoints', () => {
  close(adjust(.42,.61,.42),.61); assert.equal(adjust(0,.61,.42),0); assert.equal(adjust(1,.61,.42),1);
  assert.throws(()=>adjust(.5,1)); assert.throws(()=>adjust(.5,.533,0));
});
test('actual fitted model is available and differs from baseline without fabricated plays', () => {
  assert.equal(modelStatus.available,true); assert.equal(modelStatus.sampleSize,229);
  const a=calculateModel(games,'kbo-adjusted'),b=calculateModel(games,'baseline');
  assert.notDeepEqual(a.points[0].cp,b.points[0].cp);
  assert.deepEqual(a.plays.map(r=>r.id),b.plays.map(r=>r.id));
  assert.throws(()=>calculateModel(games,'unknown'));
});
test('ambiguous OCR is not converted into invented scores/runners', () => {
  assert.deepEqual(parseSituation('2사 1,2루 1그'),{outs:'2아웃',runners:'1,2루',score:'확인 필요',raw:'2사 1,2루 1그'});
  assert.equal(parseSituation('무사 0:0').score,'0 : 0');
  assert.equal(parseSituation('1사 이0').runners,'확인 필요');
});

// Synthetic numerical fixtures only; never shipped as baseball data.
const training = Array.from({length:24},(_,i)=>{const season=2020+Math.floor(i/4);return {id:'unit-'+i,season,source:'https://example.test/unit',startAt:`${season}-10-10T18:00:00+09:00`,featureAt:`${season}-10-10T17:00:00+09:00`,completedAt:`${season}-10-10T22:00:00+09:00`,homeWin:i%4===0?0:1,features:{home:1}};});
test('ridge optimizer solves the penalized logistic likelihood', () => {
  const fit=fitRidge(training,['home'],.1),b=fit.coefficients.home;
  close(predict(fit,{home:1})-.75+.1*b,0,1e-6);
  assert.ok(b>0);assert.equal(fit.converged,true);
});
test('training rejects future features, 2026 results, duplicates and missing features', () => {
  validateRecords(training,['home']);
  for (const mutate of [r=>r.featureAt=r.startAt,r=>r.completedAt='2026-10-10T22:00:00+09:00',r=>r.features={},r=>r.season=2026]) {
    const bad=structuredClone(training);mutate(bad[0]);assert.throws(()=>validateRecords(bad,['home']));
  }
  assert.throws(()=>validateRecords([...training,training[0]],['home']));
});
test('held-out results cannot change hyperparameter selection or fitted coefficients', () => {
  const a=estimate(training,['home']), changed=structuredClone(training);
  changed.filter(r=>r.season===2025).forEach(r=>r.homeWin=1-r.homeWin);
  const b=estimate(changed,['home']);
  assert.deepEqual(a.coefficients,b.coefficients);assert.equal(a.lambda,b.lambda);
  assert.notDeepEqual(a.heldOut,b.heldOut);assert.equal(a.available,false);
  assert.ok(a.validation.every(c=>c.folds.every(f=>f.trainThrough<f.year&&f.year<2025)));
});
