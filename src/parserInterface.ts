import type { ParseError } from './errors';

export interface ParserInternalConfig {
  delimiter?: string;
  newline?: '\r' | '\n' | '\r\n';
  comments?: string | false;
  stream?: WritableStreamDefaultWriter<string[]>;
  limit?: number;
  fast?: boolean;
  quoteChar?: string;
  escapeChar?: string;
}

export interface ParserInternalResult {
  data?: string[][];
  errors: ParseError[];
  meta: {
    truncated: boolean;
  };
}
