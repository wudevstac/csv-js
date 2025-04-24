/** Error structure */
export interface ParseError {
  /** A generalization of the error */
  type: 'Quotes' | 'Delimiter' | 'FieldMismatch';
  /** Standardized error code */
  code:
    | 'MissingQuotes'
    | 'UndetectableDelimiter'
    | 'TooFewFields'
    | 'TooManyFields'
    | 'InvalidQuotes';
  /** Human-readable details */
  message: string;
  /** Row index of parsed data where error is */
  row?: number | undefined;
  /** Index within the row where error is */
  index?: number | undefined;
}
