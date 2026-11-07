import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

// Only the rendered, authorized Statiz game table is retained. No login data.
const root = new URL('../', import.meta.url);
const raw = readFileSync(new URL('sources/ks4.tsv', root), 'utf8');
let checksum = 2166136261;
for (let i = 0; i < raw.length; i++) checksum = Math.imul(checksum ^ raw.charCodeAt(i), 16777619) >>> 0;
assert.equal(checksum, 412251633, 'Must match the checksum of the browser-extracted 86 rows');
const hash = text => createHash('sha256').update(text).digest('hex');
const games = JSON.parse(readFileSync(new URL('data.json', root)));
const previous = games.filter(g => g.id !== 'ks4');
assert.equal(previous.length, 12);
assert.equal(previous.at(-1).id, 'ks3');
const game = {id:'ks4', stage:'KS', number:4,
  source:'https://www.statiz.co.kr/schedule/?m=gamelogs&s_no=20261079',
  sourceType:'web', home:'삼성', away:'KT', date:'2026-11-07',
  score:{away:5,home:10}, innings:9, rows:[]};
let priorWP = .5;
for (const [i, line] of raw.trimEnd().split('\n').entries()) {
  const columns = line.split('\t');
  assert.equal(columns.length, 12);
  const [inning,pitcher,batter,pitches,result,before,after,lev,res,rea,wpe,wpaText] = columns;
  const batting = inning.endsWith('초') ? game.away : game.home;
  const wp = Number(wpe.slice(0,-1))/100, wpa = Number(wpaText);
  const wpaFromWPe = Number(((wp-priorWP)*(batting===game.home?1:-1)).toFixed(3));
  const numericCheck = Math.abs(wpaFromWPe-wpa)<.00151;
  assert.ok(numericCheck && pitcher && batter && Number.isFinite(Number(lev)), `Invalid event ${i+1}`);
  game.rows.push({id:`ks4-${i+1}`,game:'ks4',stage:'KS',number:4,sourceType:'web',sourceEvent:i+1,
    inning,pitcher,batter,pitches,result,before,after,li:Number(lev),wp,wpaText,wpa,wpaFromWPe,numericCheck,
    eventOnly:/주자.*:/.test(result),batting,fielding:batting===game.home?game.away:game.home,
    sourceWPe:wpe,sourceLEV:lev,res:Number(res),rea:Number(rea),
    situationNote:'Statiz 웹 경기로그의 표시 문구와 수치를 직접 읽음. WPe·WPA는 원문 반올림 정밀도를 유지.'});
  priorWP = wp;
}
assert.equal(game.rows.length,86);
assert.equal(game.rows.filter(r=>r.eventOnly).length,2);
assert.equal(game.rows.at(-1).after,'이닝종료 5:10');
assert.equal(game.rows.at(-1).wp,1);
const audit = {source:game.source,sourceType:'web',verifiedAt:'2026-11-07',
  sourceFile:'sources/ks4.tsv',sourceSHA256:hash(raw),browserExtractFNV1a32:checksum,
  prior12GamesCanonicalSHA256:hash(JSON.stringify(previous)),
  sourceTableRows:111,substitutionRowsExcluded:25,rows:86,paEndingRows:84,eventOnlyRows:2,
  inningCounts:Object.fromEntries([...new Set(game.rows.map(r=>r.inning))].map(n=>[n,game.rows.filter(r=>r.inning===n).length])),
  verifiedLEV:game.rows.map(r=>r.li),
  verification:'Authenticated, user-authorized rendered game table; all 86 numerical event rows transferred with matching browser checksum. 25 substitution-only rows have no probability values and are excluded. Signed WPe/WPA transitions pass 0.00151 rounding tolerance; two wild pitches are event-only. Final KT 5, Samsung 10 and ninth-inning completion checked. Prior 12 games preserved unchanged.'};
writeFileSync(new URL('data.json',root),JSON.stringify([...previous,game]));
writeFileSync(new URL('ks4-audit.json',root),JSON.stringify(audit,null,2)+'\n');
console.log(`Added KS4: ${game.rows.length} events, 13 games, 1028 events in total.`);
