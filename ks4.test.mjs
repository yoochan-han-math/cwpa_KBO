import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {calculateModel} from './models.mjs';
import {engine} from './model.mjs';
import {parseSituation} from './situation.mjs';
const games=JSON.parse(readFileSync(new URL('./data.json',import.meta.url)));
const audit=JSON.parse(readFileSync(new URL('./ks4-audit.json',import.meta.url)));
const g=games.find(g=>g.id==='ks4');
const hash=s=>createHash('sha256').update(s).digest('hex');

test('KS4 has every web event, correct innings and final score, with unchanged prior games',()=>{
  assert.equal(games.length,13);assert.equal(g.rows.length,86);
  assert.equal(hash(JSON.stringify(games.slice(0,12))),audit.prior12GamesCanonicalSHA256);
  assert.equal(hash(readFileSync(new URL('./sources/ks4.tsv',import.meta.url))),audit.sourceSHA256);
  assert.equal(g.source,audit.source);assert.equal(g.sourceType,'web');
  assert.equal(g.date,'2026-11-07');assert.equal(g.home,'삼성');assert.equal(g.away,'KT');
  assert.deepEqual(g.score,{away:5,home:10});
  assert.deepEqual(g.rows.map(r=>r.li),audit.verifiedLEV);
  assert.equal(g.rows.filter(r=>!r.eventOnly).length,84);
  assert.deepEqual(g.rows.filter(r=>r.eventOnly).map(r=>r.id),['ks4-30','ks4-44']);
  assert.equal(g.rows.at(-1).id,'ks4-86');assert.equal(g.rows.at(-1).inning,'9회초');
  assert.equal(g.rows.at(-1).batter,'장진혁');assert.equal(g.rows.at(-1).wp,1);
  let previousWP=.5,previousScore='0 : 0';
  for(const r of g.rows){
    assert.ok(r.pitcher&&r.batter&&r.numericCheck);
    assert.equal(r.page,undefined);
    assert.equal(parseSituation(r.before).score,previousScore,r.id);
    previousScore=parseSituation(r.after).score;
    assert.notEqual(previousScore,'확인 필요');
    assert.ok(Math.abs((r.wp-previousWP)*(r.batting===g.home?1:-1)-r.wpa)<.00151,r.id);
    previousWP=r.wp;
  }
  assert.equal(previousScore,'5 : 10');
  assert.equal(g.rows.filter(r=>r.after.startsWith('이닝종료')).length,17);
});
test('KS4 appends all model series without changing earlier points and contributions',()=>{
  for(const id of ['baseline','kbo-adjusted','fatigue-off','strength-home']){
    const old=calculateModel(games.slice(0,12),id),now=calculateModel(games,id);
    assert.deepEqual(now.points.slice(0,old.points.length),old.points,id);
    assert.deepEqual(now.plays.slice(0,old.plays.length),old.plays,id);
    assert.equal(now.plays.length,1028);
    const summary=now.summaries.at(-1),rows=now.plays.filter(r=>r.game==='ks4');
    const total=rows.reduce((s,r)=>s+r.cwpa*(r.batting==='삼성'?1:-1),0);
    assert.ok(Math.abs(total-summary.change[1])<1e-10,id);
    for(const p of now.points)assert.ok(Math.abs(p.cp.reduce((a,b)=>a+b,0)-1)<1e-10);
    assert.equal([...rows].sort((a,b)=>Math.abs(b.cwpa)-Math.abs(a.cwpa))[0].id,'ks4-14');
  }
});
test('KS4 ends with Samsung 3 wins, KT 1, and the correct peak leverage',()=>{
  const d=calculateModel(games,'baseline');
  assert.deepEqual(d.points.at(-1).cp,engine().probs({s:3,low:'삼성',a:1,b:3}));
  const top=[...g.rows].sort((a,b)=>b.li-a.li)[0];
  assert.equal(top.id,'ks4-50');assert.equal(top.pitcher,'이재희');
  assert.equal(top.batter,'김상수');assert.equal(top.li,3.21);
});
