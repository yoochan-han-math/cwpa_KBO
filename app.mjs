import {teams, stages} from './model.mjs';
import {calculateModel, modelStatus} from './models.mjs';
import {parseSituation} from './situation.mjs';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = ['#e6ca77', '#62a8ff', '#f38585', '#d98dcd', '#a8d6c0'];
const signed = (x, d = 3) => `${x > 0 ? '+' : ''}${x.toFixed(d)}`;
const num = x => x == null ? '<span class="unestimated">— <small>미추정</small></span>' : `<span class="${x >= 0 ? 'positive' : 'negative'}">${signed(x)}</span>`;
const percent = x => x == null ? '미추정' : (x * 100).toFixed(2) + '%';
let stage = 'ALL', model = 'kbo-adjusted', limit = 30, current = [], selectedId = null;
try {
  const res = await fetch('data.json');
  if (!res.ok) throw Error('데이터 파일을 불러오지 못했습니다.');
  const games = await res.json(), baseline = calculateModel(games, 'baseline');
  const selectedValue = x => model === 'baseline' ? x : null;
  $('game-count').textContent = String(games.length).padStart(2, '0');
  $('play-count').textContent = baseline.plays.length;
  $('legend').innerHTML = teams.map((t, i) => `<span><i class="dot" style="background:${colors[i]}"></i>${t}</span>`).join('');

  function point(i) {
    const r = current[i]; if (!r) return;
    selectedId = r.id; $('scrubber').value = i;
    const x = 50 + i / Math.max(1, current.length - 1) * 930;
    $('cursor')?.setAttribute('x1', x); $('cursor')?.setAttribute('x2', x);
    const situation = parseSituation(r.after), start = r.inning === '경기 시작';
    $('tooltip').innerHTML = `<strong>${esc(r.stage)} ${r.number}차전 · ${esc(r.inning)} · ${esc(r.result)}</strong>
      <div>타자 ${esc(r.batter || '—')} · 투수 ${esc(r.pitcher || '—')}</div>
      <div>플레이 후 점수 (원정 ${esc(r.away)} : 홈 ${esc(r.home)}) ${start ? '0 : 0' : esc(situation.score)} · 아웃 ${start ? '0아웃' : esc(situation.outs)} · 주자 ${start ? '없음' : esc(situation.runners)}</div>
      ${r.before ? `<div class="muted">원문 상황: ${esc(r.before)} → ${esc(r.after)} (OCR 검토 중)</div>` : ''}
      <div class="muted">${model === 'baseline' ? '기본 모형 · 플레이 후 우승 확률' : 'KBO-adjusted · 우승 확률 미추정'}</div>
      <div class="probabilities">${teams.map((t, j) => `<span style="color:${colors[j]}">${t} <b>${percent(selectedValue(r.cp[j]))}</b></span>`).join('')}</div>`;
  }
  function chart() {
    current = baseline.points.filter(r => stage === 'ALL' || r.stage === stage);
    const filtered = games.filter(g => stage === 'ALL' || g.stage === stage), last = filtered.at(-1);
    $('coverage').textContent = last ? `${filtered.length}경기 · ${last.stage} ${last.number}차전까지 · ${last.date}` : '자료 없음';
    $('scrubber').disabled = !current.length; $('scrubber').max = Math.max(0, current.length - 1);
    $('chart-empty').hidden = model === 'baseline'; $('chartWrap').hidden = model !== 'baseline';
    if (!current.length) { $('chart').innerHTML = ''; $('tooltip').textContent = '실제 자료가 확보되면 반영합니다.'; return; }
    let svg = '';
    if (model === 'baseline') {
      for (let v = 0; v <= 100; v += 25) {const y = 300 - v * 2.7; svg += `<line x1="50" y1="${y}" x2="980" y2="${y}" stroke="#344b3c"/><text x="0" y="${y+4}" fill="#99ad9e" font-size="12">${v}%</text>`;}
      teams.forEach((t, j) => {const ps = current.map((r, i) => `${50 + i / Math.max(1, current.length - 1) * 930},${300 - r.cp[j] * 270}`).join(' '); svg += `<polyline points="${ps}" fill="none" stroke="${colors[j]}" stroke-width="2.2"/>`;});
      svg += '<line id="cursor" x1="50" x2="50" y1="30" y2="300" stroke="#fff" stroke-dasharray="4 4"/>';
    }
    $('chart').innerHTML = svg;
    point(Math.max(0, current.findIndex(r => r.id === selectedId)));
  }
  function filteredPlays() {
    return baseline.plays.filter(r => (stage === 'ALL' || r.stage === stage)
      && ($('event').value === 'all' || ($('event').value === 'event' ? r.eventOnly : !r.eventOnly))
      && `${r.batter} ${r.pitcher} ${r.result}`.includes($('search').value.trim()));
  }
  function table() {
    const li = $('mode').value === 'li';
    const rows = filteredPlays().sort((a, b) => li ? b.li - a.li : Math.abs(b.cwpa) - Math.abs(a.cwpa));
    $('play-order').textContent = li ? '원문 LI 내림차순 · 모형과 무관한 순위' : model === 'baseline' ? '기본 모형 |cWPA| 내림차순' : '기본 모형 비교 순위입니다. KBO-adjusted 순위·수치·모형 간 차이는 미산출입니다.';
    $('plays').innerHTML = rows.slice(0, limit).map((r, i) => `<tr><td>${i+1}</td><td><button class="jump" data-point="${esc(r.id)}" aria-label="${esc(r.stage)} ${r.number}차전 ${esc(r.inning)} 그래프 보기">${esc(r.stage)} ${r.number}차전<small>${esc(r.inning)}</small></button></td><td>${esc(r.batter)}<small>vs ${esc(r.pitcher || '미확인')}</small></td><td>${esc(r.result)}${r.eventOnly ? '<small>주루·기타 / 타자 열은 당시 타석 선수</small>' : ''}</td><td><b>${r.li.toFixed(2)}</b></td><td>${num(r.wpa)}</td><td>${num(selectedValue(r.cwpa))}</td><td>${num(r.cwpa)}</td><td><a href="${esc(r.source)}" target="_blank" rel="noopener">Statiz ↗</a><small>PDF ${r.page}쪽</small></td></tr>`).join('') || '<tr><td colspan="9" class="empty">해당 조건의 기록이 없습니다.</td></tr>';
    $('more').hidden = limit >= rows.length;
  }
  function players() {
    const role = $('role').value, map = new Map();
    for (const r of baseline.plays) {
      if (r.eventOnly || (stage !== 'ALL' && stage !== r.stage) || !r[role]) continue;
      const name = r[role], team = role === 'batter' ? r.batting : r.fielding, key = team + name, sign = role === 'batter' ? 1 : -1;
      const v = map.get(key) || {name, team, n: 0, wpa: 0, cwpa: 0};
      v.n++; v.wpa += sign * r.wpa; v.cwpa += sign * r.cwpa; map.set(key, v);
    }
    $('player-order').textContent = model === 'baseline' ? '기본 모형 cWPA 내림차순 · 타석 종료분' : '기본 모형 비교 순위입니다. KBO-adjusted 선수 순위·차이는 미산출입니다.';
    $('players').innerHTML = [...map.values()].sort((a, b) => b.cwpa - a.cwpa).map((r, i) => `<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${esc(r.team)}</td><td>${r.n}</td><td>${num(r.wpa)}</td><td>${num(selectedValue(r.cwpa))}</td><td>${num(r.cwpa)}</td></tr>`).join('');
  }
  function summaries() {
    let rows = baseline.summaries.filter(r => stage === 'ALL' || r.stage === stage);
    if ($('summary-unit').value === 'series') rows = stages.flatMap(s => {
      const subset = rows.filter(r => r.stage === s);
      return subset.length ? [{stage: s, number: null, start: subset[0].start, end: subset.at(-1).end,
        change: subset[0].start.map((v, i) => (subset.at(-1).end[i] - v) * 100)}] : [];
    });
    const j = teams.indexOf($('summary-team').value);
    $('summaries').innerHTML = rows.map(r => `<tr><td>${r.stage} ${r.number ? r.number + '차전' : '수록 구간'}</td><td>${teams[j]}</td><td>${percent(selectedValue(r.start[j]))}</td><td>${percent(selectedValue(r.end[j]))}</td><td>${num(selectedValue(r.change[j]))}</td><td>${num(r.change[j])}</td></tr>`).join('');
  }
  function render() {
    $('model-status').textContent = model === 'baseline' ? '기본 모형 사용 중 · 중립 50%, 홈 53.3%. 전력·휴식·피로 차이는 반영하지 않습니다.' : '미추정 · ' + modelStatus.reason + ' 아래 기본 모형 비교값은 보정 결과가 아닙니다.';
    document.querySelectorAll('.model-caption').forEach(el => el.textContent = model === 'baseline' ? '기본 cWPA · 이후 모든 라운드 포함' : 'KBO-adjusted cWPA · 계산 미제공');
    document.querySelectorAll('.selected-heading').forEach(el => el.textContent = model === 'baseline' ? '기본 모형 (%p)' : 'KBO-adjusted (%p)');
    document.querySelectorAll('[data-model]').forEach(b => b.setAttribute('aria-pressed', b.dataset.model === model));
    chart(); table(); players(); summaries();
  }
  document.querySelectorAll('[data-model]').forEach(b => b.onclick = () => {model = b.dataset.model; render();});
  $('show-baseline').onclick = () => {model = 'baseline'; render();};
  document.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => {stage = b.dataset.stage; limit = 30; document.querySelectorAll('[data-stage]').forEach(x => x.setAttribute('aria-pressed', x === b)); render();});
  $('chart').onpointermove = ev => {const rect = $('chart').getBoundingClientRect(), x = (ev.clientX - rect.left) / rect.width * 1000; point(Math.max(0, Math.min(current.length - 1, Math.round((x - 50) / 930 * (current.length - 1)))));};
  $('scrubber').oninput = () => point(+$('scrubber').value);
  $('plays').onclick = ev => {const b = ev.target.closest('[data-point]'); if (b) {point(current.findIndex(r => r.id === b.dataset.point)); $('tooltip').scrollIntoView({behavior: 'smooth', block: 'center'});}};
  for (const id of ['mode', 'event', 'search']) $(id).addEventListener('input', () => {limit = 30; table();});
  $('role').onchange = players; $('summary-team').onchange = summaries; $('summary-unit').onchange = summaries;
  $('more').onclick = () => {limit += 50; table();}; render();
} catch (e) { $('tooltip').textContent = '불러오기 실패: ' + e.message; console.error(e); }
