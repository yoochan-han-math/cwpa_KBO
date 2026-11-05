# Historical estimation — KBO-adjusted v1

Actual fit and results: `../model-fit.json`. Production coefficients: `../fitted-model.mjs`. Primary offline fitter: `fit_historical.py`, NumPy2.3.5. The browser uses only exported parameters and `models.mjs`; it never estimates from current2026PS results.

## Source files

- `data/regular.csv`:11,388 official regular-season games2010–2026,2026 strictly beforeOctober14. Each row's source is KBO GameCenter `/Schedule/GameCenter/Main.aspx?gameDate=YYYYMMDD&gameId=<id>&section=REVIEW`; monthly collection request/hash is in `regular-manifest.json`.
- `data/postseason.json`:231 detailed-audited actual PS games2010–2025, with links, neutral-site venue, suspended completion date, exclusion and stale-status flags.
- `data/training-features.json`:229 fitting rows with exact features, cutoff, calendar rest and game load.
- `data/POSTSEASON-SOURCES.md`:source anomalies, independent2011KS1 corroboration and neutral-site policies.
- `data/postseason-manifest.json`:231 daily/48monthly responses and normalized hashes. Original raw responses remain local; normalized game facts are published.
- `data/planned-2026.json`:official prePS calendar metadata. The chosen production model excludes rest/fatigue, so it does not use future date forecasts.

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

## Variables

| Name | Definition |
|---|---|
| strength | log(home regular W/L)−log(away W/L), measured before PS begins |
| home |1 for actual home advantage,0 at specified neutral sites |
| rest | log(1+home calendar idle days)−log(1+away idle days) |
| games7 | number of previous7-calendar-day games:home−away |

Regular prior strength uses the same log W/L form **as of the previous calendar date**, once both teams have30 decided games. Drawn games are not binary response observations, but count as activity. No same-day doubleheader results enter the second game's strength feature.30 is a disclosed sample restriction, not a learned effect. The transport from noisy in-season records to full-season PS strength is a limitation; the empirical-prior family is compared with zero-centered shrinkage.

Home definitions:2020PO/KS,2021KS neutral Gocheok; historical neutral Jamsil KS games when neither participant isLG/두산. Shared Jamsil LG–두산 retains designated-home advantage, a modeling choice. COVID spectator restrictions and other era effects are not separately modeled.

## Estimation, selection and evaluation

1. Fit unpenalized regular-game logistic regression on strength+home to obtain an empirical center. Fold y uses regular seasons strictly before y.
2. Fit PS ridge logistic regression. RMS scaling comes from the current training fold; penalty center is either0 or empirical regular coefficients (rest/fatigue center0). Final coefficients are unscaled for interpretation.
3. Compare3 feature sets ×2 centers ×5 λ values [.0001,.001,.01,.1,1] by pooled logloss on expanding2014–2022 PS predictions,126 rows. All sets use the same229 eligible games, so no unfair sample advantage for excluding suspended rest cases.
4. Selected strength+home, empirical center, λ1. Rest/fatigue coefficients were actually fitted, but candidate validation loss was slightly worse. Candidate details and family-best coefficients remain in report.
5. Fit through2022 only and freeze for44 games in2023–2025. Report game logloss/Brier, per-year scores, calibration bin counts. Do not claim championship calibration or statistically established superiority.
6. Refit selected setting through2025 for2026 deployment.500 season-cluster bootstrap replicates, seed20261105, refit both regular andPS estimates, with selected specification fixed.

Exploratory disclosure:the empirical-center variant was added after inspecting an earlier zero-centered analysis. The selection objective excludes2023–2025, but those outcomes were viewed during development. This is not preregistered prospective performance. No future2026 outcome enters fitting.2026regular records are solely a known prePS strength snapshot.

## Reproduction

```sh
python -m pip install -r estimation/requirements.txt
python estimation/fit_historical.py --output estimation/reproduced
python -m unittest discover -s estimation -p "test_*.py"
```

The report includes SHA256 of both normalized input files. Raw source hashes authenticate collection snapshots, but official providers may later correct history. Recollection is not guaranteed byte-identical; diagnose differences rather than adjusting values to preserve the fit. Production support intentionally accepts only strength/home. Adding rest/fatigue requires a path-aware DP with future calendar/activity states, not simply adding coefficients to current state keys.
