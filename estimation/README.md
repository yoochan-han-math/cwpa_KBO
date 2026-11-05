# Historical estimation — KBO-adjusted v2 with calendar workload

Actual fit and results: `../model-fit.json`. Production coefficients: `../fitted-model.mjs`. Primary offline fitter: `fit_fatigue.py` (shared numerical helpers in `fit_historical.py`), NumPy2.3.5. The browser uses only exported parameters and `models.mjs`; it never estimates from current2026PS results.

## Source files

- `data/regular.csv`:11,388 official regular-season games2010–2026,2026 strictly beforeOctober14. Each row's source is KBO GameCenter `/Schedule/GameCenter/Main.aspx?gameDate=YYYYMMDD&gameId=<id>&section=REVIEW`; monthly collection request/hash is in `regular-manifest.json`.
- `data/postseason.json`:231 detailed-audited actual PS games2010–2025, with links, neutral-site venue, suspended completion date, exclusion and stale-status flags.
- `../fatigue-training-features.json`:229 v2 fitting rows with exact candidate features, cutoff, source and decayed loads.
- `data/training-features.json`:preserved v1 feature audit; `../strength-home-fit.json` and `../strength-home-model.mjs` preserve v1 output.
- `data/postseason-innings-audit.json`:231 source-linked inning audits;203 known/28 missing. Not used as a regression feature or to fill missing values.
- `data/POSTSEASON-SOURCES.md`:source anomalies, independent2011KS1 corroboration and neutral-site policies.
- `data/postseason-manifest.json`:231 daily/48monthly responses and normalized hashes. Original raw responses remain local; normalized game facts are published.
- `data/planned-2026.json`:official prePS calendar metadata. Copied verbatim into `postseason-calendar.mjs`; production uses this planned calendar plus delays observed by each game start, never future actual dates.

Official endpoints (ordinary public form requests, no login/key):

```
POST https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList
leId=1&srIdList=0&seasonId=YYYY&gameMonth=MM&teamId=
```

For postseason, `srIdList=3,4,5,7`. Details:

```
POST https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList
leId=1&srId=0,1,3,4,5,6,7,9&date=YYYYMMDD
```

Content-Type `application/x-www-form-urlencoded; charset=UTF-8`, standard KBO page Referer and X-Requested-With header. PowerShell collectors preserve raw responses and avoid re-fetching cached files. No auth bypass. These endpoints can change; an empty/error response must not be treated as zero games.

## Recollect / normalize

From repository root on Windows:

```powershell
./estimation/collect-regular.ps1
./estimation/collect-postseason.ps1
./estimation/audit-postseason.ps1
python estimation/prepare_sources.py
```

Raw output defaults to ignored `estimation/collection/`; optional `-OutputDirectory` changes it consistently. Review coverage and source discrepancies before replacing the committed snapshots. `prepare_sources.py` intentionally checks the current11,388/231 coverage. No fabricated rows fill missing IDs. The2011KS1 stale-status override is explicitly bounded to the independently verified score/stage.

Calendar activity additionally includes two official tiebreaks:2021-10-31 KT1–0삼성 and2024-10-01 SSG3–4KT. Their API SR_ID is6 despite a generic API category label; the dated tiebreak context is verified. They affect rest history only, not regular W/L. [2024 KBO preview](https://www.koreabaseball.com/MediaNews/News/Preview/View.aspx?bdSe=58164).2024KS1 completion dateOctober23 and same-dayKS2 are excluded from common candidate fitting but retained as activity before later games.

## Variables and explicit inclusion policy

The user requested fatigue be included. We therefore select **within fatigue-inclusive specifications**, retaining the old fatigue-free model as a comparison rather than pretending it lost validation.

All candidates retain strength=log(home regularW/L)-log(awayW/L) and homeField=1/0(actualhome/neutral). PS strength is fixed before PS. Six alternative fatigue definitions:

| Feature | Definition |
|---|---|
| rest3 | min(home idle days,3)-min(away idle days,3) |
| rest7 | same, cap7 |
| restLog | log1p(home idle days)-log1p(away idle days) |
| load3 | away minus home sum(exp(-(days since game-1)/3)) |
| load7 | same with tau7; selected |
| games7 | away minus home number of games in preceding7 dates |

Fatigue sign is oriented so positive means less home burden. The v1 raw `games7` feature used the opposite sign; v2 overwrites it consistently in its separate feature audit. All past regular and PS games count as one unit, including draws as activity. No same-day game activity enters regular doubleheader features. Suspended2024KS1/KS2 are excluded as response rows and each counts as one activity on completionOctober23, an explicit simplification.

Regular prior strength uses previous-calendar-date records, once both teams have30 decided games. Fit unpenalized logistic regression on all3 candidate features; each fold uses earlier seasons only. In-season strength is noisier than final-season strength, so transport into PS is imperfect.

Home:2020PO/KS and2021KS neutral Gocheok; historical neutral JamsilKS when neither team isLG/두산. SharedJamsilLG–두산 retains designatedhome, a modelling choice.

## Estimation and disclosure

1. Six definitions ×zero/regular-season prior ×lambda[.001,.01,.1,1] =48 candidates. All229 PS response rows are common. Ridge RMS scaling is learned within each training fold.
2. Expanding2014–2022 PS validation yields126 predictions. Select minimum pooled logloss within those48 settings. Best:strength/home/load7, empirical center,lambda1.
3. Final coeffs:S .6490535368,H .1078602764,F .0285782676. Regular center:S .4421586586,H .1009837166,F .0144177294. No imposed positive sign/minimum effect.
4. Validation logloss v2 .687052 is slightly WORSE than oldv1 .686755. Frozen<=2022 fit on44 games2023–25: v2 .683495 vs oldv1 .684127. Do not imply established improvement. This period was seen in earlier development, so evaluation is retrospective exploratory.
5. Refit through2025 for deployment.500 season-cluster resamples (seed20261105), refitting both priors and PS, with selected definition/lambda fixed. Fatigue interval[-.012977,.077311] crosses zero. S/F sample correlation.741 indicates severe confounding; this is not a causal physiological estimate.
6. tau7 has half-life7*log(2)=4.85days; it is a candidate decay scale, NOT a measured recovery constant. Published examples isolate F by zeroing it while holding v2 S/H fixed.

## Path-aware deployment

Initial workloads use actual2026 regular activity beforeOctober14. Each hypothetical game adds one unit to both participants, and all loads decay to the next planned game date. Winners carry their own workload into later rounds; a five-game path can differ from a sweep even at the same KS score. Team strength remains fixed.

Official preseason planned dates are the forecasting starting point. Apply only the current observed date when the game begins; carry the largest observed schedule delay forward, with at least one idle/travel day between rounds. Future weather/actual dates/innings never enter previous points. If actual date information changes championship probability, expose `calendarChange` at game start and in summary totals, exclude it from all player contributions. The schedule scenario may differ from later official rescheduling.

Actual extra-innings coverage was audited:203/231 PS games have lastinning (all2012–25),20 exceeded9; earlier28 are missing. We do not invent missing innings or claim pitcher-level fatigue. No extra-inning weight is deployed.

## Reproduction

```sh
python -m pip install -r estimation/requirements.txt
python estimation/fit_fatigue.py --output estimation/reproduced
python -m unittest discover -s estimation -p "test_*.py"
```

The report includes SHA256 of both normalized input files. Raw source hashes authenticate collection snapshots, but official providers may later correct history. Recollection is not guaranteed byte-identical; diagnose differences rather than adjusting values to preserve the fit. Production support intentionally accepts strength/home/load7; a changed selected definition must trigger review of the path adapter. `fit_historical.py --output estimation/reproduced` reproduces the preserved v1 instead; it is not the current production exporter.
