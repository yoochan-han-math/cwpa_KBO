import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateModel} from './models.mjs';
import {engine} from './model.mjs';
import {parseSituation} from './situation.mjs';
// Keep the published KS3 snapshot as a regression boundary.
const games=JSON.parse(readFileSync(new URL('./data.json',import.meta.url))).slice(0,12);
const audit=JSON.parse(readFileSync(new URL('./ks3-audit.json',import.meta.url)));
const g=games.find(g=>g.id==='ks3');
test('KS3 source completeness, independently transcribed LEV and numeric checks',()=>{
  assert.equal(games.length,12);assert.equal(g.rows.length,70);
  assert.equal(g.date,'2026-11-06');assert.equal(g.home,'삼성');assert.equal(g.away,'KT');
  assert.deepEqual(g.score,{away:1,home:5});
  assert.deepEqual(g.rows.map(r=>r.li),audit.verifiedLEV);
  const counts={};let previous=.5;
  for(const r of g.rows){
    counts[r.page]=(counts[r.page]??0)+1;
    assert.ok(r.batter&&r.pitcher&&r.numericCheck);
    assert.ok(Math.abs((r.wp-previous)*(r.batting===g.home?1:-1)-r.wpa)<.00151,r.id);
    assert.notEqual(parseSituation(r.before).score,'확인 필요');
    previous=r.wp;
  }
  assert.deepEqual(counts,audit.pageCounts);
  assert.equal(g.rows.at(-1).id,'ks3-70');assert.equal(g.rows.at(-1).wp,1);
  assert.equal(g.rows.at(-1).batter,'오윤석');assert.equal(g.rows.at(-1).inning,'9회초');
});
test('adding KS3 does not change any previously published point in any model',()=>{
  for(const id of ['baseline','kbo-adjusted','fatigue-off','strength-home']){
    const old=calculateModel(games.slice(0,11),id),now=calculateModel(games,id);
    assert.deepEqual(now.points.slice(0,old.points.length),old.points,id);
    assert.equal(now.plays.length,942);
    for(const p of now.points) assert.ok(Math.abs(p.cp.reduce((a,b)=>a+b,0)-1)<1e-10);
  }
});
test('KS3 advances Samsung to 2 wins and KT to 1, with correct pivotal play',()=>{
  const d=calculateModel(games,'baseline');
  assert.deepEqual(d.points.at(-1).cp,engine().probs({s:3,low:'삼성',a:1,b:2}));
  const plays=d.plays.filter(r=>r.game==='ks3');
  assert.equal([...plays].sort((a,b)=>Math.abs(b.cwpa)-Math.abs(a.cwpa))[0].id,'ks3-21');
  const topLI=[...plays].sort((a,b)=>b.li-a.li)[0];
  assert.equal(topLI.id,'ks3-20');assert.equal(topLI.li,2.6);
  assert.equal(topLI.batter,'김성윤');assert.equal(topLI.wpa,.006);
});
