# Official KBO postseason collection / audit

Collected 2010–2025 seasons, September–November, 231 completed postseason games. No 2026 postseason outcomes requested. All calls use publicly accessible KBO page endpoints, without login or API keys.

## Ready-to-use data

- `postseason-audited.json`: normalized games, authoritative GameCenter teams/codes/scores, stage and actual game number, date, venue, source links. **Use this file**, not the initial schedule parse.
- `postseason-discrepancies.json`: 14 rows where the schedule label/team assignment/status disagreed with the audited result.
- `postseason-manifest.json`: source endpoints, collection metadata, per-season counts, raw and normalized SHA256 hashes.
- `postseason-YYYY-MM.json`: all 48 monthly raw responses.
- `gamelist-YYYYMMDD.json`: 231 raw GameCenter day responses.
- `collect-postseason.ps1` and `audit-postseason.ps1`: reproducible collectors with local response caching.

## Official request contracts

POST `https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList`

Form: `leId=1&srIdList=3%2C4%2C5%2C7&seasonId=2015&gameMonth=10&teamId=`.

Content-Type: `application/x-www-form-urlencoded; charset=UTF-8`; Referer: `https://www.koreabaseball.com/Schedule/Schedule.aspx`; X-Requested-With: `XMLHttpRequest`. Session is an ordinary anonymous page visit. Initial PowerShell request with implicit encoding returned a generic KBO error page; explicit form encoding and standard page headers succeeded.

Response: `rows[].row[]`, each cell's `Text` plus `Class`. A `relay` cell with `section=REVIEW` identifies a completed game's GameCenter link. Empty, movement-day, cancelled and future-unplayed rows are excluded. `play` contains away name, away score, vs, home score, home name. The schedule's final cell has a stage label, but some older labels are wrong.

Every completed row was rechecked via POST `https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList`.

Form: `leId=1&srId=0%2C1%2C3%2C4%2C5%2C7%2C9&date=20151007`, same Content-Type and X-Requested-With, Referer GameCenter/Main.aspx. Exact match on `game[].G_ID` required; `GAME_STATE_SC=3` and integer scores required, except one explicitly audited stale source-status override below.

Authoritative fields: `AWAY_ID/HOME_ID`, `AWAY_NM/HOME_NM`, `T_SCORE_CN/B_SCORE_CN`, `S_NM`, `GAME_SC_NM`, `VS_GAME_CN`. No inning-level or pitcher-use records collected here. Scheduled start times are retained as source strings and are **not** asserted to be actual historical start/completion timestamps.

## Important corrections

2010 KS games 1–2 were labeled PO6/PO7 in the schedule. Several 2011–2012 labels counted rainouts or otherwise shifted game numbers. The 2012 KS5 and KS6 schedule display swapped the team names while leaving scores in actual away/home order. GameCenter resolved all of these; raw discrepancies are retained. No 2015–2025 schedule discrepancy was found.

2011 KS1 (October25, ID20111025SKSS7) is still incorrectly marked as a preview with missing scores in the schedule. GameCenter reports SK0–Samsung2 and KS1, but has stale pregame state1. Actual completion is independently confirmed by original contemporary reports: https://www.osen.co.kr/article/G1109311151 and https://www.donga.com/news/List/article/all/20111025/41391584/1 . This record is included with `statusOverride=true` and its supporting source URL. The score is read from GameCenter; no guessed game outcome is added. Source innings is null and remains null. With this correction every season/stage has a consecutive sequence of actual game numbers beginning at1.

## Rest and home-field caveats

- 2020 PO and KS were neutral-site Gocheok series: https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=7875
- 2021 KS was neutral-site Gocheok: https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=8180
- Earlier neutral Jamsil games where neither participant is LG/Doosan appear in 2011 KS5, 2012 KS5–6, 2014 KS5–6. Venue is supplied explicitly. Neutral designation should be modeled separately from nominal batting home/away; score/WP home perspective still follows official home team.
- 2024 KS1 began October 21 and completed October 23. `completionDate` is explicitly corrected to October23. Official postponement notice: https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=10270 . KBO-hosted final-game report confirming actual October23 completion: https://www.koreabaseball.com/medianews/news/breakingnews/View.aspx?bdSe=58226 . KS2 was played later the same day.
- `restFitExclude=true` marks both 2024 KS1 and KS2: game1's pregame rest alone does not represent its split contest; game2 follows the resumed game in the same day. For subsequent games use October23 as the previous activity date, not October21. Both retained for outcomes/history but recommended excluded from rest-regression fitting.
- Rest features should use calendar dates only, clearly labeled. Exact actual end times were not collected. Regular-season last-game dates are needed to construct each team's first-PS rest.

Counts: 2010 14, 2011 14, 2012 15, 2013 16, 2014 14, 2015 15, 2016 14, 2017 15, 2018 16, 2019 12, 2020 13, 2021 11, 2022 16, 2023 14, 2024 16, 2025 16. All231 rows have decisive results; excluding flagged2024 games leaves229 candidates before any further quality exclusions.
