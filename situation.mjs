// OCR substitutions are never turned into guessed scores.
export function parseSituation(raw = '') {
  const text = raw.trim();
  const outs = /^무사/.test(text) ? '0아웃' : /^[12]사/.test(text) ? text[0] + '아웃' : /^이닝\s*종료/.test(text) ? '이닝 종료' : '확인 필요';
  const runner = text.match(/(?:무사|[12]사)\s*(만루|[123](?:\s*,\s*[123])*루)/);
  const score = text.match(/(?:^|\s)(\d{1,2})\s*:\s*(\d{1,2})\s*$/);
  return {outs, runners: runner ? runner[1] : '확인 필요', score: score ? `${score[1]} : ${score[2]}` : '확인 필요', raw};
}
