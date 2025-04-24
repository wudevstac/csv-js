import type { ParseError } from './errors';

export interface ParserConfig<T = string[]> {
  /**
   * Whether or not to use a worker thread.
   * Using a worker will keep your page reactive, but may be slightly slower.
   * @default false
   */
  worker?: boolean | undefined;

  /**
   * The delimiting character.
   * Leave blank to auto-detect from a list of most common delimiters, or any values passed in through `delimitersToGuess`.
   * It can be a string or a function.
   * If a string, it can be of any length (so multi-character delimiters are supported).
   * If a function, it must accept the input as first parameter and it must return a string which will be used as delimiter.
   * In both cases it cannot be found in `Papa.BAD_DELIMITERS`.
   * @default // auto-detect
   */
  delimiter?: string | ((input: string) => string);

  /**
   * The newline sequence. Leave blank to auto-detect. Must be one of `\r`, `\n`, or `\r\n`.
   * @default // auto-detect
   */
  newline?: '\r' | '\n' | '\r\n';

  /**
   * A string that indicates a comment (for example, "#" or "//").
   * When Papa encounters a line starting with this string, it will skip the line.
   * @default false
   */
  comments?: string | false;

  /** If > 0, only that many rows will be parsed. */
  limit?: number;

  /**
   * Fast mode speeds up parsing significantly for large inputs.
   * However, it only works when the input has no quoted fields.
   * Fast mode will automatically be enabled if no " characters appear in the input.
   * You can force fast mode either way by setting it to true or false.
   */
  fast?: boolean;

  /**
   * The character used to quote fields. The quoting of all fields is not mandatory. Any field which is not quoted will correctly read.
   * @default '"'
   */
  quoteChar?: string;

  /**
   * The character used to escape the quote character within a field.
   * If not set, this option will default to the value of `quoteChar`,
   * meaning that the default escaping of quote character within a quoted field is using the quote character two times.
   * (e.g. `"column with ""quotes"" in text"`)
   * @default '"'
   */
  escapeChar?: string;

  /**
   * If `true`, the first row of parsed data will be interpreted as field names.
   * An array of field names will be returned in meta, and each row of data will be an object of values keyed by field name instead of a simple array.
   * Rows with a different number of fields from the header row will produce an error.
   * Warning: Duplicate field names will overwrite values in previous fields having the same name.
   * @default false
   */
  header?: boolean;

  /**
   * If `true`, lines that are completely empty (those which evaluate to an empty string) will be skipped.
   * If set to `'greedy'`, lines that don't have any content (those which have only whitespace after parsing) will also be skipped.
   * @default false
   */
  skipEmptyLines?: boolean | 'greedy';

  /**
   * An array of delimiters to guess from if the delimiter option is not set.
   * @default [',', '\t', '|', ';', RECORD_SEP, UNIT_SEP]
   */
  delimitersToGuess?: string[] | undefined;

  /**
   * A function to apply on each header. Requires header to be true. The function receives the header as its first argument and the index as second.
   */
  transformHeader?(header: string, index: number): string;

  /**
   * If `true`, numeric and boolean data will be converted to their type instead of remaining strings.
   * Numeric data must conform to the definition of a decimal literal.
   * Numerical values greater than 2^53 or less than -2^53 will not be converted to numbers to preserve precision.
   * European-formatted numbers must have commas and dots swapped.
   * If also accepts an object or a function.
   * If object it's values should be a boolean to indicate if dynamic typing should be applied for each column number (or header name if using headers).
   * If it's a function, it should return a boolean value for each field number (or name if using headers) which will be passed as first argument.
   * @default false
   */
  dynamicTyping?:
    | boolean
    | { [headerName: string]: boolean; [columnNumber: number]: boolean }
    | ((field: string | number) => boolean);

  /**
   * A function to apply on each value.
   * The function receives the value as its first argument and the column number or header name when enabled as its second argument.
   * The return value of the function will replace the value it received.
   * The transform function is applied before `dynamicTyping`.
   */
  transform?(value: string, field: string | number): unknown;
}

export interface ParserResult<T> {
  data: T[];
  errors: ParseError[];
  meta: {
    truncated: boolean;
    fields: string[];
  };
}
