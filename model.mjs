export const teams = ['KT', '삼성', 'KIA', 'LG', '두산'];
export const stages = ['WC', 'SPO', 'PO', 'KS'];
const highSeeds = ['LG', 'KIA', '삼성', 'KT'];
const needs = [1, 3, 3, 4];
const schedules = ['HH', 'HHAAH', 'HHAAH', 'HHAAAHH'];

function probability(p, open = false) {
  if (!Number.isFinite(p) || p < 0 || p > 1 || (open && (p === 0 || p === 1))) throw Error('Invalid probability');
  return p;
}

// Constant log-odds shift; source WP is assumed to have a neutral 0.5 prior.
// This is an approximation, not a refit of Statiz's state model.
export function adjust(p, targetPrior = .533, sourcePrior = .5) {
  probability(p); probability(targetPrior, true); probability(sourcePrior, true);
  if (sourcePrior === .5) return p * targetPrior / (p * targetPrior + (1 - p) * (1 - targetPrior));
  if (p === 0 || p === 1) return p;
  const odds = p / (1 - p) * targetPrior / (1 - targetPrior) / (sourcePrior / (1 - sourcePrior));
  return odds / (1 + odds);
}

// The provider sees hypothetical bracket states, never future observed results.
// Optional adapters carry calendar/workload through every hypothetical path.
export function engine(homeProbability = .533, pathAdapter = null) {
  const memo = new Map();
  const baseInitial = {s: 0, low: '두산', a: 0, b: 0};
  const initial = pathAdapter ? pathAdapter.initial(baseInitial) : baseInitial;
  function context(st) {
    if (st.champion || !schedules[st.s]?.[st.a + st.b]) throw Error('Invalid bracket state');
    const high = highSeeds[st.s], low = st.low;
    const home = schedules[st.s][st.a + st.b] === 'H' ? high : low;
    const c = {high, low, home, away: home === high ? low : high, stage: stages[st.s], number: st.a + st.b + 1};
    return pathAdapter ? pathAdapter.context(st,c) : c;
  }
  function prior(st) {
    const p = typeof homeProbability === 'function'
      ? homeProbability(Object.freeze({...st}), Object.freeze(context(st))) : homeProbability;
    return probability(p, true);
  }
  function step(st, winner) {
    const c = context(st);
    if (![c.high, c.low].includes(winner)) throw Error('Invalid winner');
    const a = st.a + (winner === c.high), b = st.b + (winner === c.low);
    const next = a >= needs[st.s] || b >= (st.s === 0 ? 2 : needs[st.s])
      ? (st.s === 3 ? {champion: winner} : {s: st.s + 1, low: winner, a: 0, b: 0})
      : {...st, a, b};
    return pathAdapter ? pathAdapter.advance(st,next,c) : next;
  }
  function probs(st) {
    if (st.champion) {
      if (!teams.includes(st.champion)) throw Error('Invalid champion');
      return teams.map(t => +(t === st.champion));
    }
    const key = JSON.stringify(st);
    if (memo.has(key)) return memo.get(key);
    const c = context(st), h = prior(st), q = c.home === c.high ? h : 1 - h;
    const win = probs(step(st, c.high)), loss = probs(step(st, c.low));
    const value = win.map((p, i) => q * p + (1 - q) * loss[i]);
    memo.set(key, value);
    return value;
  }
  return {initial, context, prior, step, probs, observe: (st,g) => pathAdapter ? pathAdapter.observe(st,g) : st};
}

export function derive(games, {homeProbability = .533, sourcePrior = .5, pathAdapter = null} = {}) {
  const e = engine(homeProbability,pathAdapter);
  let st = e.initial;
  const points = [], plays = [], summaries = [];
  for (const g of games) {
    const forecastBeforeUpdate = e.probs(st);
    st = e.observe(st,g);
    const c = e.context(st);
    if (c.home !== g.home || c.away !== g.away || c.stage !== g.stage || c.number !== g.number) throw Error('Bracket mismatch ' + g.id);
    if (!g.rows.length || ![0, 1].includes(g.rows.at(-1).wp)) throw Error('Incomplete/drawn game ' + g.id);
    const prior = e.prior(st), wh = e.probs(e.step(st, g.home)), wa = e.probs(e.step(st, g.away));
    const mix = q => wh.map((v, i) => q * v + (1 - q) * wa[i]);
    let qBefore = adjust(sourcePrior, prior, sourcePrior), prev = mix(qBefore);
    const start = prev;
    const calendarChange = pathAdapter ? start.map((p,i)=>(p-forecastBeforeUpdate[i])*100) : undefined;
    const extra = pathAdapter ? {fatigue:c.fatigue, calendarChange} : {};
    points.push({...g, rows: undefined, inning: '경기 시작', result: '경기 시작', cp: prev, prior, ...extra});
    for (const r of g.rows) {
      const bi = teams.indexOf(r.batting), qAfter = adjust(r.wp, prior, sourcePrior);
      if (bi < 0 || ![g.home, g.away].includes(r.batting)) throw Error('Invalid batting team ' + r.id);
      const cp = mix(qAfter);
      const play = {...r, source: g.source, home: g.home, away: g.away, cp, prior, qBefore, qAfter, ...(pathAdapter?{fatigue:c.fatigue}:{}),
        championshipWeight: wh[bi] - wa[bi], cwpa: (cp[bi] - prev[bi]) * 100};
      points.push(play); plays.push(play); prev = cp; qBefore = qAfter;
    }
    summaries.push({id: g.id, stage: g.stage, number: g.number, home: g.home, away: g.away, start, end: prev,
      change: prev.map((v, i) => (v - start[i]) * 100), ...(pathAdapter?{calendarChange,fatigue:c.fatigue}: {})});
    st = e.step(st, g.rows.at(-1).wp === 1 ? g.home : g.away);
  }
  return {points, plays, summaries};
}

export function neutralWeight(n, m) {
  if (![n, m].every(x => Number.isInteger(x) && x >= 0 && x <= 3)) throw Error('Invalid series score');
  const N = 6 - n - m, k = 3 - n;
  let choose = 1;
  for (let i = 1; i <= k; i++) choose = choose * (N - i + 1) / i;
  return choose / 2 ** N;
}
