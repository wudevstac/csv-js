import { DELIMITER_TO_GUESS, RECORD_SEP, UNIT_SEP } from './constants';
import { ParserCore } from './parserCore';

/** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions */
export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function guessLineEndings(input: string, quoteChar: string) {
  // Replace all the text inside quotes
  const re = new RegExp(
    `${escapeRegExp(quoteChar)}([^]*?)${escapeRegExp(quoteChar)}`,
    'gm',
  );
  const inputView = input.slice(0, 1024 * 1024).replace(re, ''); // max length 1 MB

  const r = inputView.split('\r');
  const n = inputView.split('\n');
  const nAppearsFirst = n.length > 1 && n[0].length < r[0].length;

  if (r.length === 1 || nAppearsFirst) return '\n';

  let numWithN = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i][0] === '\n') numWithN++;
  }

  return numWithN >= r.length / 2 ? '\r\n' : '\r';
}

export function testEmptyLine(
  s: string[],
  skipEmptyLines: boolean | 'greedy' = false,
) {
  return skipEmptyLines === 'greedy'
    ? s.join('').trim() === ''
    : s.length === 1 && s[0].length === 0;
}

export function guessDelimiter(
  input: string,
  newline: '\r' | '\n' | '\r\n',
  skipEmptyLines: boolean | 'greedy',
  comments: string | false,
  delimitersToGuess: string[] = DELIMITER_TO_GUESS,
) {
  let bestDelim: string | undefined;
  let bestDelta: number | undefined;
  let fieldCountPrevRow: number | undefined;
  let maxFieldCount: number | undefined;

  for (let i = 0; i < delimitersToGuess.length; i++) {
    const delim = delimitersToGuess[i];
    let delta = 0;
    let avgFieldCount = 0;
    let emptyLinesCount = 0;
    fieldCountPrevRow = undefined;

    const preview = new ParserCore({
      comments: comments,
      delimiter: delim,
      newline: newline,
      limit: 10,
    }).parse(input);

    const data = preview.data;
    if (data === undefined) {
      // The data is not there only when the streaming is used.
      // This really should not happen.
      // TODO: make better typing so this check is not necessary
      throw new Error(
        `Unexpected behavior of the parser. The data is undefined for delimiter "${delim}".`,
      );
    }

    for (let j = 0; j < data.length; j++) {
      if (skipEmptyLines && testEmptyLine(data[j], skipEmptyLines)) {
        emptyLinesCount++;
        continue;
      }
      const fieldCount = data[j].length;
      avgFieldCount += fieldCount;

      if (fieldCountPrevRow === undefined) {
        fieldCountPrevRow = fieldCount;
      } else if (fieldCount > 0) {
        delta += Math.abs(fieldCount - fieldCountPrevRow);
        fieldCountPrevRow = fieldCount;
      }
    }

    if (data.length > 0) avgFieldCount /= data.length - emptyLinesCount;

    if (
      (bestDelta === undefined || delta <= bestDelta) &&
      (maxFieldCount === undefined || avgFieldCount > maxFieldCount) &&
      avgFieldCount > 1.99
    ) {
      bestDelta = delta;
      bestDelim = delim;
      maxFieldCount = avgFieldCount;
    }
  }

  // _config.delimiter = bestDelim;

  return {
    successful: !!bestDelim,
    bestDelimiter: bestDelim,
  };
}
