export const fittedModel = {
  "id": "kbo-adjusted-v1",
  "status": "estimated-experimental",
  "available": true,
  "checkedAt": "2026-11-05",
  "trainingPeriod": "2010–2025",
  "sampleSize": 229,
  "coefficients": {
    "strength": 0.6860342481998694,
    "home": 0.10922659486963733
  },
  "features": [
    "strength",
    "home"
  ],
  "lambda": 1.0,
  "priorType": "regular-season",
  "regularPrior": {
    "eligibleGames": 8130,
    "coefficients": {
      "strength": 0.44246760205433244,
      "home": 0.10088017581157983
    },
    "minimumPriorDecisions": 30,
    "fit": "unpenalized logistic; prior-calendar-date features only"
  },
  "initialTeams": {
    "KT": {
      "w": 90,
      "l": 49,
      "d": 5,
      "runs": 825,
      "allowed": 649,
      "strength": 0.6079893722196384,
      "lastDate": "2026-10-12",
      "recentDates": [
        "2026-10-07",
        "2026-10-11",
        "2026-10-12"
      ]
    },
    "삼성": {
      "w": 83,
      "l": 58,
      "d": 3,
      "runs": 806,
      "allowed": 669,
      "strength": 0.35839759725017867,
      "lastDate": "2026-10-12",
      "recentDates": [
        "2026-10-07",
        "2026-10-09",
        "2026-10-11",
        "2026-10-12"
      ]
    },
    "KIA": {
      "w": 79,
      "l": 63,
      "d": 2,
      "runs": 769,
      "allowed": 664,
      "strength": 0.22631312607548879,
      "lastDate": "2026-10-12",
      "recentDates": [
        "2026-10-07",
        "2026-10-09",
        "2026-10-10",
        "2026-10-11",
        "2026-10-12"
      ]
    },
    "LG": {
      "w": 78,
      "l": 65,
      "d": 1,
      "runs": 723,
      "allowed": 726,
      "strength": 0.1823215567939546,
      "lastDate": "2026-10-12",
      "recentDates": [
        "2026-10-07",
        "2026-10-09",
        "2026-10-10",
        "2026-10-12"
      ]
    },
    "두산": {
      "w": 73,
      "l": 66,
      "d": 5,
      "runs": 688,
      "allowed": 630,
      "strength": 0.1008046991219655,
      "lastDate": "2026-10-12",
      "recentDates": [
        "2026-10-07",
        "2026-10-12"
      ]
    }
  },
  "holdout": {
    "period": "2023–2025",
    "trainedThrough": 2022,
    "coefficients": {
      "strength": 0.6808512448712205,
      "home": 0.12439424028593299
    },
    "adjusted": {
      "n": 44,
      "logLoss": 0.6841273197985793,
      "brier": 0.2455146973981705,
      "accuracy": 0.5681818181818182,
      "meanPrediction": 0.5335019635876447,
      "observedHomeWin": 0.5227272727272727
    },
    "baseline": {
      "n": 44,
      "logLoss": 0.692325570644381,
      "brier": 0.24958899999999995,
      "accuracy": 0.5227272727272727,
      "meanPrediction": 0.5330000000000001,
      "observedHomeWin": 0.5227272727272727
    },
    "yearly": [
      {
        "season": 2023,
        "adjusted": {
          "n": 14,
          "logLoss": 0.7002494768064571,
          "brier": 0.25354417926630873,
          "accuracy": 0.5,
          "meanPrediction": 0.5356858314293281,
          "observedHomeWin": 0.35714285714285715
        },
        "baseline": {
          "n": 14,
          "logLoss": 0.7142145332786157,
          "brier": 0.2605175714285714,
          "accuracy": 0.35714285714285715,
          "meanPrediction": 0.5330000000000001,
          "observedHomeWin": 0.35714285714285715
        }
      },
      {
        "season": 2024,
        "adjusted": {
          "n": 14,
          "logLoss": 0.67822132829852,
          "brier": 0.24258086624850234,
          "accuracy": 0.5714285714285714,
          "meanPrediction": 0.5305679426491038,
          "observedHomeWin": 0.5714285714285714
        },
        "baseline": {
          "n": 14,
          "logLoss": 0.6858876404578412,
          "brier": 0.24637471428571425,
          "accuracy": 0.5714285714285714,
          "meanPrediction": 0.5330000000000001,
          "observedHomeWin": 0.5714285714285714
        }
      },
      {
        "season": 2025,
        "adjusted": {
          "n": 16,
          "logLoss": 0.6751881749792379,
          "brier": 0.24105600301950908,
          "accuracy": 0.625,
          "meanPrediction": 0.5341583475473949,
          "observedHomeWin": 0.625
        },
        "baseline": {
          "n": 16,
          "logLoss": 0.6788059172526477,
          "brier": 0.242839,
          "accuracy": 0.625,
          "meanPrediction": 0.533,
          "observedHomeWin": 0.625
        }
      }
    ],
    "calibration": [
      {
        "low": 0.4,
        "high": 0.6,
        "n": 44,
        "logLoss": 0.6841273197985793,
        "brier": 0.2455146973981705,
        "accuracy": 0.5681818181818182,
        "meanPrediction": 0.5335019635876447,
        "observedHomeWin": 0.5227272727272727
      }
    ]
  },
  "coefficientIntervals": {
    "method": "season-cluster percentile bootstrap, selected specification fixed",
    "replicates": 500,
    "seed": 20261105,
    "intervals95": {
      "strength": [
        0.45353788740433176,
        0.9655740063631957
      ],
      "home": [
        0.05856769797402774,
        0.15575941453499229
      ]
    }
  },
  "limitations": [
    "Small postseason sample; predictive associations, not causal rest effects",
    "Retrospective exploratory comparison, not a preregistered prospective forecast",
    "Held-out evaluation uses a frozen pre-2023 fit; deployment refits through 2025",
    "Bootstrap intervals condition on selected features and regularization",
    "No individual starters, bullpen pitch counts or injury adjustments",
    "Rest and recent-game fatigue were estimated as candidates but excluded by earlier-season validation",
    "Strength is held fixed at the pre-postseason regular-season snapshot",
    "Constant log-odds WP correction remains an approximation"
  ],
  "sources": {
    "schedule": "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList",
    "gameAudit": "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList",
    "calendar": "https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=12183"
  }
};
