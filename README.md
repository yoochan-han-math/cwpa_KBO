# 가을의 확률 — 2026 KBO postseason · 두 모형 비교

Static, Korean-language cWPA dashboard built from eleven user-supplied Statiz print PDFs. **Review edition, not an official statistic.** No sample game data is shipped. The original PDFs (which contain account/print metadata and advertisements) are not published.

## Features

- Default selection: **KBO-adjusted cWPA — unestimated**. No adjusted championship probabilities, rankings or differences are fabricated. Baseline comparison columns are explicitly labeled; LI/WPA remain source statistics. Switching models preserves the selected point, stage, role and search.
- Separate long-form Korean methodology article (`method.html`), with locally bundled KaTeX, the 16 neutral seven-game weights, DP derivation, actual KS example, sources and limitations.
- Per-game/per-series team championship probability changes, including non-PA events and changes caused by other teams' games.
- Overall / WC / SPO / PO / KS filters shared across probability chart, LI leaderboard, pivotal plays and player rankings.
- Pointer/touch and keyboard range selection on the championship-probability chart, including five teams, game/inning, event and OCR situation text.
- LI (source `LEV`) leaderboard alongside batter, pitcher, outcome and batting-side WPA. Plate-appearance-ending events are the default; all plays and baserunning events are separately selectable.
- Pivotal plays ranked by absolute cWPA. Signed offensive cWPA is shown in championship percentage points.
- Player rankings currently sum **plate-appearance-ending contributions only**, separated into batting and pitching. They are not complete official all-event player cWPA. Runner events, wild pitches, pickoffs and other non-PA events are excluded, avoiding attribution to the batter merely because their name appears on the row.
- Search, progressive table display, source game links and PDF page references. KS games 1–2 are included; later KS games are not yet included.

## Data and verification

User-provided files: wc1.pdf (79 rows), spo1.pdf (70), spo2.pdf (75), spo3.pdf (87), po1.pdf (69), po2.pdf (75), po3.pdf (83), po4.pdf (73), po5.pdf (72). ks1.pdf (84), ks2.pdf (105). Total: 872 numeric play rows, excluding substitutions. Sources and per-row PDF page locations are in data.json. Source acquisition: November 1–5, 2026, Asia/Seoul. The anonymous Statiz request returned a login response, so data was read from user-provided PDFs rather than bypassing authentication.

Windows Korean OCR was used on locally rendered pages. Probability transitions and absolute displayed WPA agree within 0.0015 on all 872 rows. Display rounding means that WPe differences and WPA are not identical. WPA signs are determined from home WPe changes and batting half-inning; zero-change rows retain the source magnitude. The graph uses each WPe anchor rather than accumulating rounded WPA.

Distinct OCR player-name variants, missing names, numerical anomalies and top 15 LI rows were visually checked against PDF crops. **The previous 683 LEV values and all situation strings have not been independently visually verified. All 189 new KS LEV values were independently transcribed from PDF row images and checked against extraction; see ks-audit.json. KS player-name variants and WPA anomalies were also visually verified.** Situation text deliberately remains labeled OCR review material. Source descriptions can themselves be inconsistent: WC double-steal rows and a late walk/runner sequence are preserved, not blindly deduplicated. Game date metadata should be checked against source headers when revising. These limitations are visible in the interface.

## Baseline probability model

Reference: https://junkstorage.tistory.com/67 . Equal neutral strength, neutral game p=0.5, home p=0.533. Convert neutral home WPe p using `p*0.533 / (p*0.533 + (1-p)*0.467)`.

Recursively compute each team's championship probability conditional on winning or losing the current game, then mix using the adjusted game probability. The change in the batting team's championship probability is the offensive play cWPA. Future observed outcomes are never used for earlier states. Elimination and the pre-KS waiting team are included.

Seeds: KT, Samsung, KIA, LG, Doosan. WC higher seed needs one win and lower seed two; SPO/PO best of five; KS best of seven. Higher-seed home schedules: HH, HHAAH, HHAAH, HHAAAHH. Official 2026 rules: https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=12183 . The actual WC draw advances the fourth seed, but this model assigns **zero probability to future draws** and does not support observed drawn games. Team strength, rest, pitching matchups and future rainouts are not modeled. This is not exact reproduction from unrounded Statiz inputs.

LEV is source game leverage at the listed event, not championship leverage and not necessarily plate-appearance-start pLI. WPA is a probability fraction; cWPA is displayed in percentage points. Pitching PA contribution is the negative of offensive PA contribution and includes fielding outcomes.

## Adjusted model: unestimated, not a validated forecast

`models.mjs` publishes `status: unestimated`, `coefficients: null`, `sampleSize: 0`. It refuses to calculate the adjusted model and never silently substitutes baseline output. The dashboard defaults to this clearly disclosed state; the baseline graph is one click away. Numeric comparison columns are baseline only. Adjusted values and differences remain unavailable.

The proposed game model is logistic(strength difference + home effect + rest effect + fatigue effect). There are **no fitted coefficients or reported empirical performance**. KBO official rankings/results and a real 2025 seeding paper were inspected, but no auditable historical game-level feature table has been assembled. The paper's seed effect was not substituted for a rest coefficient. Strength, rest, fatigue and re-estimated home effects are all disabled. The 11 supplied 2026 games are display data, not training data.

See [estimation/README.md](estimation/README.md) for source URLs, feature definitions and collection requirements. `estimation/fit.mjs` is a separate offline ridge logistic regression utility: validates timestamps/source IDs, excludes 2026 results, chooses regularization by expanding-season validation, leaves the final season untouched for audit, and reports log loss/Brier against the .533 baseline. Training-only scaling prevents validation leakage. At least four seasons are needed to run the split; that minimum is not a claim of statistical sufficiency. Generated files remain `candidate-not-approved` and cannot automatically enable the site model. Test fixtures are synthetic numerical inputs only and are never shipped as baseball records.

Still required: historical data assembly, actual estimation, calibration/uncertainty evaluation, path-aware future schedules and rest/pitcher usage, and validation of within-game WP correction. The DP accepts game-dependent probabilities; its present state is only round/opponent/series score. Fatigue needs richer path state before use. A caller-provided probability function can depend on arbitrary external data, so provenance must be audited rather than inferred from its interface.

## Calculation and units

For each team T, `V_T(s) = p_g V_T(s_W) + (1-p_g) V_T(s_L)` with terminal champion one-hot vectors. Within a game, shift each home WP by `logit(target prior) - logit(source prior)`, preserving 0/1 endpoints. Baseline uses source prior .5 and target .533, matching the original published implementation exactly. This assumes the source prior and constant log-odds shift; it is not a validated refit of Statiz's state model.

`delta cWPA = (q_after-q_before) * (V_T(s_W)-V_T(s_L))`. Display values multiply by 100 for percentage points. Future observed outcomes do not enter earlier DP states. If future pitcher availability changes within a play, the conditional future values also change and need full state recomputation; that feature is not implemented.

## Update actual game data

1. Obtain authorized Statiz logs or user-supplied print PDFs. Record game ID/date/home/away/stage/number and source URL. Keep original PDFs local.
2. Append chronological `data.json` rows with inning, batter/pitcher, result, raw before/after situation, source WPe/LEV/WPA and PDF page. Do not fill missing plays with invented events. Preserve original descriptions and clearly mark non-PA events.
3. Visually check names and numerical anomalies; independently audit LEV as for `ks-audit.json`. Check WP endpoints, chronological continuity, rounding tolerance and final score against source. Current importer is manual/OCR; there is no newly automated full PDF ingestion service.
4. Run tests and update coverage/audit documentation. The current 11-game count and regression fixtures intentionally require review when adding new games. Model-status dates concern estimation review, not the last game date.

Raw ambiguous OCR score/runner text is displayed as “확인 필요”; the parser recognizes clear tokens only. Scores and runner situations have not all been manually repaired. This limitation remains visible in the chart tooltip and data note.

## Run and deploy

Requires Node 22+ and the pinned pnpm version in package.json. KaTeX is a build-time dependency; generated math, CSS and fonts are served locally, with no CDN scripts:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
python -m http.server 4173 --directory dist
```

Production hosting: ChatGPT Sites at https://kbo-cwpa-2026.happycuki0701.chatgpt.site . Keep `.openai/hosting.json` and its existing project identity; publish the built `dist` with the Sites workflow. No private PDFs, training source files or local credentials are included in dist.

Optional GitHub Pages deployment: in repository Settings → Pages choose **GitHub Actions**, then manually run **Publish GitHub Pages (optional)**. It installs pinned dependencies, runs tests/build and deploys dist with the official Pages actions. All asset/navigation URLs are relative, supporting `/cwpa_KBO/`. The workflow is manual-only; this revision does not switch off the existing Sites URL or automatically enable Pages. A configured workflow is not evidence that Pages is live.

19 tests cover all reachable-state conservation, series clinching and terminal champions, all 16 neutral combinatorial weights, per-play formula and every-team telescoping, variable-game-prior DP versus independent enumeration, every original baseline output plus a frozen digest, source transitions/KS audit, future-result invariance, adjusted fail-closed behavior, ambiguous OCR, ridge likelihood optimality, training timestamp rejection and held-out result isolation. They verify numerical/software consistency, not empirical accuracy of an unestimated adjusted model.

## KS update — November 5, 2026

KS1 (November 3, Suwon): Samsung 7–8 KT, 84 play rows. KS2 (November 4, Suwon): Samsung 3–2 KT in 12 innings, 105 play rows. The series is tied 1–1. Existing WC/SPO/PO data is unchanged. The model gives Samsung 51.24% and KT 48.76% after game 2 because the remaining home schedule differs. No later KS results are assumed.
