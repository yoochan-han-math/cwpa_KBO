# 가을의 확률 — 2026 KBO postseason

Static, Korean-language cWPA dashboard built from nine user-supplied Statiz print PDFs. **Review edition, not an official statistic.** No sample game data is shipped. The original PDFs (which contain account/print metadata and advertisements) are not published.

## Features

- Overall / WC / SPO / PO / KS filters shared across probability chart, LI leaderboard, pivotal plays and player rankings.
- Pointer/touch and keyboard range selection on the championship-probability chart, including five teams, game/inning, event and OCR situation text.
- LI (source `LEV`) leaderboard alongside batter, pitcher, outcome and batting-side WPA. Plate-appearance-ending events are the default; all plays and baserunning events are separately selectable.
- Pivotal plays ranked by absolute cWPA. Signed offensive cWPA is shown in championship percentage points.
- Player rankings currently sum **plate-appearance-ending contributions only**, separated into batting and pitching. They are not complete official all-event player cWPA. Runner events, wild pitches, pickoffs and other non-PA events are excluded, avoiding attribution to the batter merely because their name appears on the row.
- Search, progressive table display, source game links and PDF page references. KS is explicitly empty.

## Data and verification

User-provided files: wc1.pdf (79 rows), spo1.pdf (70), spo2.pdf (75), spo3.pdf (87), po1.pdf (69), po2.pdf (75), po3.pdf (83), po4.pdf (73), po5.pdf (72). Total: 683 numeric play rows, excluding substitutions. Sources and per-row PDF page locations are in data.json. Source acquisition: November 1–2, 2026, Asia/Seoul. The anonymous Statiz request returned a login response, so data was read from user-provided PDFs rather than bypassing authentication.

Windows Korean OCR was used on locally rendered pages. Probability transitions and absolute displayed WPA agree within 0.0015 on all 683 rows. Display rounding means that WPe differences and WPA are not identical. WPA signs are determined from home WPe changes and batting half-inning; zero-change rows retain the source magnitude. The graph uses each WPe anchor rather than accumulating rounded WPA.

Distinct OCR player-name variants, missing names, numerical anomalies and top 15 LI rows were visually checked against PDF crops. **All 683 LEV values and situation strings have not been independently visually verified.** Situation text deliberately remains labeled OCR review material. Source descriptions can themselves be inconsistent: WC double-steal rows and a late walk/runner sequence are preserved, not blindly deduplicated. Game date metadata should be checked against source headers when revising. These limitations are visible in the interface.

## Probability model

Reference: https://junkstorage.tistory.com/67 . Equal neutral strength, neutral game p=0.5, home p=0.533. Convert neutral home WPe p using `p*0.533 / (p*0.533 + (1-p)*0.467)`.

Recursively compute each team's championship probability conditional on winning or losing the current game, then mix using the adjusted game probability. The change in the batting team's championship probability is the offensive play cWPA. Future observed outcomes are never used for earlier states. Elimination and the pre-KS waiting team are included.

Seeds: KT, Samsung, KIA, LG, Doosan. WC higher seed needs one win and lower seed two; SPO/PO best of five; KS best of seven. Higher-seed home schedules: HH, HHAAH, HHAAH, HHAAAHH. Official 2026 rules: https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=12183 . The actual WC draw advances the fourth seed, but this model assigns **zero probability to future draws** and does not support observed drawn games. Team strength, rest, pitching matchups and future rainouts are not modeled. This is not exact reproduction from unrounded Statiz inputs.

LEV is source game leverage at the listed event, not championship leverage and not necessarily plate-appearance-start pLI. WPA is a probability fraction; cWPA is displayed in percentage points. Pitching PA contribution is the negative of offensive PA contribution and includes fielding outcomes.

## Run and deploy

Requires Node 22+, no packages or installation:

```sh
node --test
node build.mjs
python -m http.server 4173 --directory dist
```

GitHub Pages workflow validates and deploys `dist`. In repository Settings → Pages, select **GitHub Actions** as the source if Pages is not yet enabled. Expected URL after successful deployment: https://yoochan-han-math.github.io/cwpa_KBO/ . A configured workflow alone does not establish that the site is live.

Five tests cover odds boundaries, neutral bracket shares, conservation at every reachable state, all source numerical transitions and historical probability invariance when future games are omitted.

