export const teams=['KT','삼성','KIA','LG','두산'];
const hs=['LG','KIA','삼성','KT'], needs=[1,3,3,4], schedules=['HH','HHAAH','HHAAH','HHAAAHH'];
export function adjust(p,h=.533){if(!Number.isFinite(p)||p<0||p>1)throw Error('Invalid probability');return p*h/(p*h+(1-p)*(1-h));}
export function engine(h=.533){
 const memo=new Map();
 const initial={s:0,low:'두산',a:0,b:0};
 function context(st){return {high:hs[st.s],low:st.low,home:schedules[st.s][st.a+st.b]==='H'?hs[st.s]:st.low};}
 function step(st,winner){const c=context(st);if(![c.high,c.low].includes(winner))throw Error('Invalid winner');let a=st.a+(winner===c.high),b=st.b+(winner===c.low);if(a>=needs[st.s]||b>=(st.s===0?2:needs[st.s]))return st.s===3?{champion:winner}:{s:st.s+1,low:winner,a:0,b:0};return {...st,a,b};}
 function probs(st){if(st.champion)return teams.map(t=>+(t===st.champion));const key=JSON.stringify(st);if(memo.has(key))return memo.get(key);let c=context(st),q=c.home===c.high?h:1-h;let win=probs(step(st,c.high)),loss=probs(step(st,c.low));let v=win.map((p,i)=>q*p+(1-q)*loss[i]);memo.set(key,v);return v;}
 return {initial,context,step,probs};
}
export function derive(games){const e=engine();let st=e.initial,points=[],plays=[];
 for(const g of games){let c=e.context(st);if(c.home!==g.home||![c.high,c.low].includes(g.away))throw Error('Bracket mismatch '+g.id);const wh=e.probs(e.step(st,g.home)),wa=e.probs(e.step(st,g.away));const mix=q=>wh.map((v,i)=>adjust(q)*v+(1-adjust(q))*wa[i]);let prev=mix(.5);points.push({...g,rows:undefined,inning:'경기 시작',result:'경기 시작',cp:prev});
 for(const r of g.rows){const cp=mix(r.wp),bi=teams.indexOf(r.batting);const play={...r,source:g.source,cp,cwpa:(cp[bi]-prev[bi])*100};points.push(play);plays.push(play);prev=cp;}
 st=e.step(st,g.rows.at(-1).wp===1?g.home:g.away);
 }return {points,plays};}

