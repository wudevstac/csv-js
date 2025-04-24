export const RECORD_SEP = '\x1E';
export const UNIT_SEP = '\x1F';
export const BYTE_ORDER_MARK = '\ufeff';
export const BAD_DELIMITERS = ['\r', '\n', '"', BYTE_ORDER_MARK];
export const NODE_STREAM_INPUT = 1;
export const MAX_FLOAT = 2 ** 53;
export const MIN_FLOAT = -MAX_FLOAT;
export const FLOAT = /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/;
export const ISO_DATE =
  /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/;

// Those are intended to be edited by the user......
// I don't like this.
export const LocalChunkSize = 1024 * 1024 * 10; // 10 MB
export const RemoteChunkSize = 1024 * 1024 * 5; // 5 MB
export const DefaultDelimiter = ','; // Used if not specified and detection fails
export const DELIMITER_TO_GUESS = [',', '\t', '|', ';', RECORD_SEP, UNIT_SEP];
