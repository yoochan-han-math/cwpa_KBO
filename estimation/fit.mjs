// Offline research utility. It never enables the public model automatically.
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const sigmoid = z => z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
const softplus = z => Math.max(z, 0) + Math.log1p(Math.exp(-Math.abs(z)));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

export function validateRecords(rows, features, cutoff = '2026-01-01T00:00:00+09:00') {
  if (!rows.length || !features.length || new Set(features).size !== features.length) throw Error('Missing records/features');
  const seen = new Set(), cutoffTime = Date.parse(cutoff);
  if (!Number.isFinite(cutoffTime)) throw Error('Invalid cutoff');
  for (const r of rows) {
    const start = Date.parse(r.startAt), featureAt = Date.parse(r.featureAt), end = Date.parse(r.completedAt);
    if (!r.id || seen.has(r.id)) throw Error('Duplicate/missing game ID');
    seen.add(r.id);
    if (![start, featureAt, end].every(Number.isFinite) || featureAt >= start || end < start || end >= cutoffTime) throw Error('Temporal leakage: ' + r.id);
    if (!Number.isInteger(r.season) || r.season !== new Date(start + 9 * 3600000).getUTCFullYear() || r.season >= 2026) throw Error('Invalid training season');
    if (![0, 1].includes(r.homeWin) || !/^https:\/\//.test(r.source || '') || features.some(f => !Number.isFinite(r.features?.[f]))) throw Error('Invalid record: ' + r.id);
  }
}

// Ridge logistic regression, scaling estimated from the training partition only.
export function fitRidge(rows, features, lambda) {
  if (!rows.length || !Number.isFinite(lambda) || lambda <= 0) throw Error('Invalid fitting input');
  const scales = features.map(f => Math.sqrt(rows.reduce((s, r) => s + r.features[f] ** 2, 0) / rows.length) || 1);
  const X = rows.map(r => features.map((f, i) => r.features[f] / scales[i]));
  let weights = features.map(() => 0), converged = false;
  const objective = w => X.reduce((s, x, i) => {const z = dot(w, x); return s + softplus(z) - rows[i].homeWin * z;}, 0) / rows.length + lambda * dot(w, w) / 2;
  for (let iteration = 0; iteration < 20000; iteration++) {
    const gradient = weights.map(w => lambda * w);
    X.forEach((x, i) => {const residual = sigmoid(dot(weights, x)) - rows[i].homeWin; x.forEach((v, j) => gradient[j] += v * residual / rows.length);});
    const norm = dot(gradient, gradient);
    if (norm < 1e-14) {converged = true; break;}
    let rate = 1, next;
    const old = objective(weights);
    do {next = weights.map((w, j) => w - rate * gradient[j]); if (objective(next) <= old - .0001 * rate * norm) break; rate /= 2;} while (rate > 1e-12);
    if (rate <= 1e-12) throw Error('Optimizer stalled');
    weights = next;
  }
  if (!converged) throw Error('Optimizer did not converge');
  const coefficients = Object.fromEntries(features.map((f, i) => [f, weights[i] / scales[i]]));
  return {coefficients, scales, converged};
}

export function predict(fit, features) {
  if (Object.keys(fit.coefficients).some(f => !Number.isFinite(features[f]))) throw Error('Missing prediction feature');
  return sigmoid(Object.entries(fit.coefficients).reduce((s, [f, v]) => s + v * features[f], 0));
}
function score(rows, probabilities) {
  return {n: rows.length,
    logLoss: rows.reduce((s, r, i) => s - Math.log(Math.max(1e-15, r.homeWin ? probabilities[i] : 1 - probabilities[i])), 0) / rows.length,
    brier: rows.reduce((s, r, i) => s + (probabilities[i] - r.homeWin) ** 2, 0) / rows.length};
}

export function estimate(rows, features, cutoff) {
  validateRecords(rows, features, cutoff);
  const seasons = [...new Set(rows.map(r => r.season))].sort();
  if (seasons.length < 4) throw Error('Need at least four seasons for development, validation and held-out audit');
  const heldOutSeason = seasons.at(-1), development = rows.filter(r => r.season < heldOutSeason);
  const candidates = [.001, .01, .1, 1, 10].map(lambda => {
    const folds = seasons.slice(1, -1).map(year => {
      const train = development.filter(r => r.season < year), validation = development.filter(r => r.season === year);
      const fit = fitRidge(train, features, lambda);
      return {year, trainThrough: year - 1, ...score(validation, validation.map(r => predict(fit, r.features)))};
    });
    return {lambda, folds, logLoss: folds.reduce((s, f) => s + f.n * f.logLoss, 0) / folds.reduce((s, f) => s + f.n, 0)};
  }).sort((a, b) => a.logLoss - b.logLoss);
  const selected = candidates[0], fit = fitRidge(development, features, selected.lambda);
  const heldOut = rows.filter(r => r.season === heldOutSeason);
  return {status: 'candidate-not-approved', available: false, cutoff: cutoff || '2026-01-01T00:00:00+09:00',
    features, trainingSeasons: seasons.slice(0, -1), sampleSize: development.length, ...fit,
    lambda: selected.lambda, validation: candidates, heldOutSeason,
    heldOut: score(heldOut, heldOut.map(r => predict(fit, r.features))),
    baselineHeldOut: score(heldOut, heldOut.map(() => .533)),
    limitations: ['Predictive association, not causal rest effects', 'No uncertainty intervals yet', 'Path-aware future schedule/rest forecast not implemented', 'Review calibration and source provenance before use']};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error('Usage: node estimation/fit.mjs input.json candidate.json');
  const {records, features, cutoff} = JSON.parse(await readFile(input, 'utf8'));
  await writeFile(output, JSON.stringify(estimate(records, features, cutoff), null, 2) + '\n');
}
