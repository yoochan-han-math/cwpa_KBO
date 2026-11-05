# 가을의 확률 — 2026 KBO cWPA

Public dashboard: https://kbo-cwpa-2026.happycuki0701.chatgpt.site

Three comparable championship-probability settings, real Statiz play records, and an auditable historical KBO estimation pipeline. **Unofficial, retrospective experimental model; PDF extraction remains a review edition.**

## Models

**KBO-adjusted v2 (default)** includes relative regular-season strength, home advantage and decaying calendar workload:

```text
L_team(d) = sum(exp(-(d - pastGameDate - 1)/7))
F = L_away - L_home
p(home win) = logistic(0.6490535368 * strengthDifference + 0.1078602764 * homeField + 0.0285782676 * F)
```

Each previous game adds one workload unit, which decays over time (tau7 days, half-life4.85 days). Actual physiological fatigue, pitches, starters, injuries and extra innings are not measured. Coefficients are fitted without a sign constraint; the workload95% interval is [-.012977,.077311], including zero. This is a **user-requested fatigue-inclusive experimental specification**, not a claim that including fatigue improves forecasting. All48 candidates and the better earlier-validation score of the old fatigue-free model remain public.

**Fatigue off** uses the SAME v2 strength/home coefficients but zeroes only the workload term. It isolates that term's numerical impact; it is not the old v1 fit. `strength-home-model.mjs` / `strength-home-fit.json` preserve v1 for reproducible comparisons.

**Baseline** is unchanged: equal neutral strength, home .533 / away .467, no rest or fatigue. Reference https://junkstorage.tistory.com/67 . Tests match all original probabilities/cWPA to `legacy-baseline.mjs` and a frozen digest.

Strength uses the regular season before2026-10-14 and remains fixed. Current2026PS outcomes do not fit any coefficient. Workload uses only past activity; hypothetical winners carry their own workload through different possible series lengths. No coefficient sliders or manually enlarged bonuses.

## Historical data and estimation

- Official KBO public schedule: 2010–2025 regular season **10,668 games**, plus **720 pre-postseason 2026 games** for current strength and prePS activity only. Total normalized regular records11,388.
- Official postseason schedule and GameCenter: **231 games** across2010–2025, all matched to detailed records.14 old schedule label/team/status problems documented. The stale2011KS1 status is explicitly corroborated by contemporary original reporting.
- Common PS regression sample **229 games**, excluding2024 suspendedKS1 and same-day resumedKS2 to avoid ambiguous rest in candidate comparisons. All outcomes remain in history.
- Regular-season empirical prior: **8,130 decisive games** where both teams had at least30 prior decided games. Features use information through the previous calendar date, including doubleheaders.
- v2 selection:6 fatigue definitions ×2 prior centers ×4 ridge strengths; expanding2014–2022 evaluation,126 predictions. Best fatigue-inclusive setting:strength+home+exponential workload(tau7), regular-season center for ALL3 coefficients, lambda1.
- Earlier-validation logloss: **v2 .687052 versus v1 without fatigue .686755** (slightly worse). Fatigue inclusion is an explicit product constraint.
- Frozen pre2023 fit on44 games in2023–2025: logloss **v2 .683495 / v1 .684127 / baseline .692326**; Brier .245199/.245515/.249589. Tiny retrospective differences, not proven superiority.
- Production refits through2025.500 season-cluster bootstrap replicates refit regular and PS estimates. These are conditional coefficient intervals, not championship probability intervals.
- Workload and strength correlate .741 in the PS sample; unobserved pitcher availability and seed confounding prevent causal interpretation.

The evaluation outcomes were already seen in earlier development. Candidate selection excludes2023–2025, but this is **exploratory, not a new independent or preregistered test**. Game-level evaluation does not establish championship calibration.

See `model-fit.json` (all48 candidates, frozen/final coefficients, intervals, comparisons and hashes), `fatigue-training-features.json` (229 real PS rows), and [estimation/README.md](estimation/README.md). The original v1 fitter/reports remain separately reproducible. No fictional game records are deployed.

## Dashboard

- Overall/WC/SPO/PO/KS filters apply to the chart, player rankings, pivotal plays, LI and contribution summaries.
- Model switching preserves selected play, series, role and search. Rankings use the selected model; adjacent columns show baseline and difference in championship percentage points.
- Chart tooltip shows game/inning, batter/pitcher/result, raw/parsed situation, all five championship probabilities and baseline comparison. Keyboard range selection and table-to-chart links work on mobile.
- LI is original LEV, the event's game leverage, not championship leverage or necessarily PA-start pLI. Original batting-side WPA remains unchanged across models.
- Workload table shows each team's idle days, residual load, home probability with/without fatigue and the effect in percentage points. Filters apply here too.
- Per-game/per-series summaries include schedule-information revisions in total changes but show them separately. These revisions never enter player cWPA.
- Long Korean methodology page with locally rendered KaTeX:neutral seven-game16-state weights, DP derivation, actual baseline/adjusted example, exact estimation process, limitations and bibliography.

## Play data and attribution

User-supplied Statiz print PDFs: WC79 rows; SPO70/75/87; PO69/75/83/73/72; KS84/105. Total **11 games,872 plays** throughKS2(November4). KS3 onward are not included. Original PDFs contain print/account metadata and are not published. Login responses were not bypassed.

All WPe transitions agree with source WPA magnitudes within0.0015 rounding tolerance. WPe is printed at0.1%p, WPA at0.001. The graph uses each WPe anchor, not cumulative rounded WPA. KS189 LEV values were independently visually transcribed (`ks-audit.json`); previous683 LEV values were checked for anomalies/top records, not fully audited. Player-name anomalies were checked. **Situation text still contains OCR errors**; only clear score/out/runner tokens are parsed, otherwise “확인 필요” is displayed. Uncertain scores are not invented.

Player rankings sum **PA-ending events only**. Running, wild pitch, pickoff and other non-PA events are excluded rather than falsely attributed to the current batter. Missing pitcher names are excluded from pitching sums. Pitching contribution is negative batting contribution and includes fielding outcomes; adding the two tables double-counts events. These are not complete official all-event player totals or pure talent measures.

## Mathematics

At every bracket state, each team's championship probability obeys `V(s)=p_g V(s_W)+(1-p_g)V(s_L)`; terminal champion vectors are one-hot. Each hypothetical opponent/home pairing gets its own p_g in the adjusted model. Future actual outcomes never enter earlier state calculations.

Within-game WP is shifted by `logit(target game prior)−logit(source prior)`, assuming source prior .5 and preserving0/1 endpoints. `delta cWPA=(q_after−q_before)×(V(s_W)−V(s_L))`, displayed ×100 as%p. The constant log-odds shift approximates a different prior; it is not a newly learned Statiz state model.

WC:high seed needs1 win, low2. SPO/PO:3 wins. KS:4 wins. High-seed home schedules HH/HHAAH/HHAAH/HHAAAHH. [KBO2026 rules](https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=12183). Future draw probability is0 and observed draws are unsupported. The actual WC draw-advancement rule differs from this probability assumption. Strength is fixed. `fatigue.mjs` carries date, decayed loads, last activity and observed delay in every hypothetical path. `postseason-calendar.mjs` reproduces the official prePS notice. Future dates use planned dates plus delays observed so far, with at least one travel/rest day between rounds. Early finishes do not automatically advance the next round. This is a declared schedule scenario, not knowledge of later actual dates. Each actual date is applied only when that game begins. New date information creates a separately reported calendar update, not player cWPA. Within-game pitches/extra innings do not update workload; every completed game contributes one unit.

## Reproduce and test

Node22+, pinned pnpm version in package.json:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
python -m http.server 4173 --directory dist
```

Python3.11+ for historical estimation:

```sh
python -m pip install -r estimation/requirements.txt
python -m unittest discover -s estimation -p "test_*.py"
python estimation/fit_fatigue.py --output estimation/reproduced
```

The final command reproduces the fit in a separate ignored directory. Compare `model-fit.json`; coefficients and seeded bootstrap output are deterministic with the pinned numerical environment. Do not overwrite approved production parameters without reviewing data, candidate scores, held-out metrics and model feature compatibility. `fit.mjs` is the older generic regression prototype; production uses `fit_fatigue.py`, sharing numerical helpers from `fit_historical.py`. Run the latter separately to reproduce v1; do not overwrite v2 exports with it.

Tests verify probability conservation/terminal advancement, neutral combinatorial reduction, original baseline identity, all settings' delta/telescope consistency, calendar revisions, path-dependent carryover, direct workload sums and no future-result leakage, source counts/hashes/exclusions, actual fitted parameters, temporal regular-game features, held-out separation and empirical-prior optimization. They do not prove real-world forecasting accuracy.

## Update data and publish

Append only authorized real chronological plays to `data.json` with source URL/PDF page, inning, batter/pitcher, result, WP/LEV/WPA and raw situation. Audit names/numerical anomalies and validate final result. Current fixed11-game and baseline regression tests intentionally require review on coverage changes. Historical collection is documented separately; do not train on the displayed2026PS outcomes.

Production is the existing **ChatGPT Sites** project in `.openai/hosting.json`; keep its identity and publish built `dist` via the Sites workflow. KaTeX CSS/fonts and rendered math are bundled locally; no CDN runtime dependency. Sources, PDFs, raw archives and credentials are not in dist; only normalized public facts and reports are included.

Optional GitHub Pages:Settings→Pages→GitHub Actions, then manually run **Publish GitHub Pages (optional)**. The workflow tests/builds and deploys relative-path assets from dist. It is not triggered by pushes and has not replaced the live Sites address.
