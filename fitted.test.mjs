import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {calculateModel,adjustedPrior} from './models.mjs';
import {fittedModel} from './fitted-model.mjs';
import {engine,teams} from './model.mjs';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url)));
const games=read('./data.json'),report=read('./model-fit.json'),training=read('./estimation/data/training-features.json');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('published coefficients, reports and normalized source hashes agree',()=>{
  assert.deepEqual(fittedModel.coefficients,report.coefficients);
  assert.deepEqual(fittedModel.holdout,report.holdout);
  assert.equal(training.length,229);assert.equal(report.regularPrior.eligibleGames,8130);
  for(const [file,hash] of Object.entries(report.inputHashes)) assert.equal(createHash('sha256').update(readFileSync(new URL('./estimation/data/'+file,import.meta.url))).digest('hex'),hash);
  assert.ok(training.every(r=>r.season<=2025 && r.strengthLatestDate<r.date));
  assert.ok(training.every(r=>!r.restFitExclude));
  assert.equal(read('./estimation/data/postseason.json').length,231);
});
test('adjusted all reachable states conserve probability and terminate correctly',()=>{
  const e=engine((_s,c)=>adjustedPrior(c.home,c.away)),seen=new Set();
  function walk(s){const k=JSON.stringify(s);if(seen.has(k))return;seen.add(k);const p=e.probs(s);close(p.reduce((a,b)=>a+b,0),1);assert.ok(p.every(x=>x>=0&&x<=1));if(s.champion)assert.equal(p[teams.indexOf(s.champion)],1);else{const c=e.context(s);walk(e.step(s,c.high));walk(e.step(s,c.low));}}
  walk(e.initial);
});
test('adjusted current game prior includes relative strength and actual home pairing',()=>{
  const p=adjustedPrior('KT','삼성'),opposite=adjustedPrior('삼성','KT');
  assert.ok(p>.55&&p<.6);assert.ok(opposite<.5);
  const homeOnly=1/(1+Math.exp(-fittedModel.coefficients.home));
  close(adjustedPrior('삼성','삼성'),homeOnly);
  assert.notEqual(p,.533);
});
test('adjusted source WP shifts, per-play formula and all-game telescope agree',()=>{
  const data=calculateModel(games,'kbo-adjusted');
  for(const r of data.plays)close(r.cwpa,100*(r.qAfter-r.qBefore)*r.championshipWeight);
  for(const g of data.summaries){
    const rows=data.plays.filter(r=>r.game===g.id);let previous=g.start;
    const sums=teams.map(()=>0);
    for(const r of rows){r.cp.forEach((v,i)=>sums[i]+=100*(v-previous[i]));previous=r.cp;}
    sums.forEach((v,i)=>close(v,g.change[i]));
  }
  for(let i=1;i<data.summaries.length;i++)data.summaries[i].start.forEach((v,j)=>close(v,data.summaries[i-1].end[j]));
});
test('adjusted forecasts do not use subsequent observed games or dates',()=>{
  const full=calculateModel(games,'kbo-adjusted'),prefix=calculateModel(games.slice(0,9),'kbo-adjusted');
  assert.deepEqual(full.points.slice(0,prefix.points.length),prefix.points);
  const changed=structuredClone(games);changed.at(-1).date='2026-11-10';changed.at(-1).rows.at(-1).wp=1;
  const after=calculateModel(changed,'kbo-adjusted');
  assert.deepEqual(full.points.slice(0,prefix.points.length),after.points.slice(0,prefix.points.length));
});
test('2026 inputs are pre-postseason observations; current outcomes cannot refit strength',()=>{
  const teams2026=report.initialTeams;
  assert.equal(teams2026.KT.w,90);assert.equal(teams2026.KT.l,49);
  assert.equal(teams2026['삼성'].w,83);assert.equal(teams2026['삼성'].l,58);
  for(const s of Object.values(teams2026)){assert.ok(s.lastDate<'2026-10-14');close(s.strength,Math.log(s.w/s.l));}
  assert.ok(report.selection.candidates.every(c=>c.folds.every(f=>f.year<=2022&&f.trainThrough<f.year)));
  assert.equal(report.holdout.trainedThrough,2022);assert.equal(report.holdout.adjusted.n,44);
});
test('rest/fatigue were estimated and rejected by published earlier-season criterion',()=>{
  const best=report.selection.candidates[0];assert.deepEqual(best.features,['strength','home']);
  for(const family of report.familyComparison){
    assert.ok(family.validation.logLoss>=best.validation.logLoss);
    for(const f of family.features)assert.ok(Number.isFinite(family.deploymentCoefficients[f]));
  }
});
