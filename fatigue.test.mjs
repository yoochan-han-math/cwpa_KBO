import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarLoad,fatigueAdapter} from './fatigue.mjs';
import {engine,teams} from './model.mjs';
import {calculateModel} from './models.mjs';
import {fittedModel} from './fitted-model.mjs';
const games=JSON.parse(readFileSync(new URL('./data.json',import.meta.url)));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const make=()=>engine((_s,c)=>c.fatigue.homePrior,fatigueAdapter());

test('workload decays daily and counts previous games, not current/future activity',()=>{
  close(calendarLoad(['2026-10-10'],'2026-10-11'),1);
  close(calendarLoad(['2026-10-10'],'2026-10-12'),Math.exp(-1/7));
  close(calendarLoad(['2026-10-10','2026-10-11'],'2026-10-12'),1+Math.exp(-1/7));
  assert.throws(()=>calendarLoad(['2026-10-12'],'2026-10-12'));
});
test('path state carries a longer prior series into the final',()=>{
  const e=make();let state=e.initial;
  for(const g of games.slice(0,4)){state=e.observe(state,g);state=e.step(state,g.rows.at(-1).wp===1?g.home:g.away);}
  let sweep=state,full=state;
  for(const w of ['삼성','삼성','삼성'])sweep=e.step(sweep,w);
  for(const w of ['KIA','삼성','삼성','KIA','삼성'])full=e.step(full,w);
  assert.equal(e.context(sweep).stage,'KS');assert.equal(e.context(full).stage,'KS');
  assert.equal(e.context(sweep).date,e.context(full).date);
  assert.ok(full.loads['삼성']>sweep.loads['삼성']);
  assert.ok(e.prior(full)>e.prior(sweep)); // KT is home, benefiting from opponent's extra burden.
});
test('consecutive games retain unequal fatigue even with equal immediate rest',()=>{
  const data=calculateModel(games,'kbo-adjusted'),a=data.summaries.at(-2).fatigue,b=data.summaries.at(-1).fatigue;
  assert.equal(b.homeRestDays,0);assert.equal(b.awayRestDays,0);
  close(b.difference,a.difference*Math.exp(-1/7));assert.ok(b.homeEffectPP>0);
});
test('actual workload matches a direct sum over pregame regular and postseason dates',()=>{
  const d=calculateModel(games,'kbo-adjusted');
  for(let i=0;i<games.length;i++){
    const g=games[i],f=d.summaries[i].fatigue;
    for(const [t,value] of [[g.home,f.homeLoad],[g.away,f.awayLoad]]){
      const dates=[...fittedModel.initialTeams[t].activityDates,...games.slice(0,i).filter(x=>x.home===t||x.away===t).map(x=>x.date)];
      close(value,calendarLoad(dates,g.date));
    }
  }
});
test('rain delay updates are separate from all player contributions and telescope',()=>{
  const d=calculateModel(games,'kbo-adjusted');
  assert.ok(d.summaries.find(g=>g.id==='po1').calendarChange.some(x=>Math.abs(x)>1e-6));
  for(let j=0;j<teams.length;j++){
    const changes=d.summaries.reduce((n,g)=>n+g.change[j]+g.calendarChange[j],0);
    close(changes,100*(d.points.at(-1).cp[j]-d.points[0].cp[j]));
  }
  assert.ok(d.plays.every(p=>!('calendarChange' in p)));
});
test('turning fatigue off removes only that term, not team strength or data',()=>{
  const on=calculateModel(games,'kbo-adjusted'),off=calculateModel(games,'fatigue-off');
  assert.deepEqual(on.plays.map(x=>[x.id,x.wpa,x.li]),off.plays.map(x=>[x.id,x.wpa,x.li]));
  off.summaries.forEach((g,i)=>{close(g.fatigue.homeEffectPP,0);close(g.fatigue.homePrior,on.summaries[i].fatigue.withoutFatigue);});
  assert.notDeepEqual(on.points.at(-1).cp,off.points.at(-1).cp);
});
test('hypothetical path probability agrees with direct enumeration',()=>{
  const e=make();let st=e.initial;
  for(const g of games.slice(0,9)){st=e.observe(st,g);st=e.step(st,g.rows.at(-1).wp===1?g.home:g.away);}
  function brute(s){if(s.champion)return +(s.champion==='KT');const c=e.context(s),p=e.prior(s);return p*brute(e.step(s,c.home))+(1-p)*brute(e.step(s,c.away));}
  close(e.probs(st)[0],brute(st));
});
