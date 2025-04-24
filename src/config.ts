import { DefaultDelimiter, DELIMITER_TO_GUESS } from './constants';
import type { ParserInternalConfig } from './parserInterface';
import type { ParserConfig } from './types';
import { guessDelimiter, guessLineEndings } from './utils';

export function guessConfig(
  snippet: string,
  config: ParserConfig = {},
): ParserInternalConfig {
  const parserConfig: ParserInternalConfig = {
    ...config,
  } as ParserInternalConfig;

  const quoteChar = config.quoteChar ?? '"';
  parserConfig.newline ??= guessLineEndings(snippet, quoteChar);

  if (!config.delimiter) {
    const delimGuess = guessDelimiter(
      snippet,
      parserConfig.newline,
      config.skipEmptyLines ?? false,
      config.comments ?? false,
      config.delimitersToGuess ?? DELIMITER_TO_GUESS,
    );
    if (delimGuess.successful) {
      parserConfig.delimiter = delimGuess.bestDelimiter;
    } else {
      parserConfig.delimiter = DefaultDelimiter;
    }
    // this.results.meta.delimiter = this.config.delimiter;
  } else if (typeof config.delimiter === 'function') {
    parserConfig.delimiter = config.delimiter(snippet);
    // this.results.meta.delimiter = this.config.delimiter;
  }

  if (config.limit && config.header) {
    parserConfig.limit = config.limit + 1; // to compensate for header row
  }

  return parserConfig;
}
