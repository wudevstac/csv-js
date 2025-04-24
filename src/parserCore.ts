import { BAD_DELIMITERS } from './constants';
import { escapeRegExp } from './utils';
import type { ParseError } from './errors';
import type {
  ParserInternalConfig,
  ParserInternalResult,
} from './parserInterface';

/** The core parser implements speedy and correct CSV parsing */
export class ParserCore {
  private delim: string;
  private newline: '\r' | '\n' | '\r\n';
  private comments: string | false;
  private stream?: WritableStreamDefaultWriter<string[]>;
  private limit?: number;
  private fast?: boolean;
  private quoteChar: string;
  private escapeChar: string;
  private quoteCharRegex: RegExp;

  constructor(config?: ParserInternalConfig) {
    // Unpack the config object

    this.delim = typeof config?.delimiter === 'string' ? config.delimiter : ',';
    this.newline = config?.newline ?? '\n';
    this.comments = config?.comments ?? false;
    this.stream = config?.stream;
    this.limit = config?.limit;
    this.fast = config?.fast;
    // this.renamedHeaders = null;
    // this.headerParsed = false;
    this.quoteChar = config?.quoteChar ?? '"';
    this.escapeChar = config?.escapeChar ?? this.quoteChar;

    // Delimiter must be valid
    if (BAD_DELIMITERS.indexOf(this.delim) > -1) {
      this.delim = ',';
    }

    // Comment character must be valid
    if (this.comments === this.delim) {
      throw new Error('Comment character same as delimiter');
    }

    if (this.comments && BAD_DELIMITERS.indexOf(this.comments) > -1) {
      this.comments = false;
    }

    this.quoteCharRegex = new RegExp(
      escapeRegExp(this.escapeChar) + escapeRegExp(this.quoteChar),
      'g',
    );
  }

  parse(
    input: string,
    ignoreLastRow?: boolean,
    signal?: AbortSignal,
  ): ParserInternalResult {
    // For some reason, in Chrome, this speeds things up (!?)
    if (typeof input !== 'string') throw new Error('Input must be a string');

    // We don't need to compute some of these every time parse() is called,
    // but having them in a more local scope seems to perform better
    const inputLen = input.length;
    const delimLen = this.delim.length;
    const newlineLen = this.newline?.length;
    const commentsLen = this.comments ? this.comments.length : 0;

    // Establish starting state
    let cursor = 0;
    const data: string[][] = [];
    let rowCounter = 0;
    const errors: ParseError[] = [];
    let row: string[] = [];

    const returnable = (truncated = false): ParserInternalResult => {
      if (this.stream !== undefined) {
        return {
          errors,
          meta: {
            truncated,
          },
        };
      }
      return {
        data,
        errors,
        meta: {
          truncated,
        },
      };
    };

    const pushRow = (row: string[]) => {
      if (this.stream !== undefined) {
        this.stream.write(row);
        rowCounter++;
      } else {
        data.push(row);
      }
    };

    /**
     * Appends the remaining input from cursor to the end into
     * row, saves the row, calls step, and returns the results.
     */
    const finish = (value?: string) => {
      if (ignoreLastRow) return returnable();
      row.push(value === undefined ? input.substring(cursor) : value);
      cursor = inputLen; // important in case parsing is paused
      pushRow(row);
      return returnable();
    };

    /**
     * Appends the current row to the results. It sets the cursor
     * to newCursor and finds the nextNewline. The caller should
     * take care to execute user's step function and check for
     * preview and end parsing if necessary.
     */
    const saveRow = (newCursor: number) => {
      cursor = newCursor;
      pushRow(row);
      row = [];
      nextNewline = input.indexOf(this.newline, cursor);
    };

    if (!input) {
      return returnable();
    }

    if (
      this.fast === true ||
      (this.fast !== false && input.indexOf(this.quoteChar) === -1)
    ) {
      const rows = input.split(this.newline || '\n');
      for (let i = 0; i < rows.length; i++) {
        // If the user has aborted, we return the results
        if (signal?.aborted) {
          return returnable();
        }

        const row = rows[i];
        cursor += row.length;

        if (i !== rows.length - 1) {
          cursor += this.newline.length;
        } else if (ignoreLastRow) {
          return returnable();
        }

        if (this.comments && row.substring(0, commentsLen) === this.comments) {
          continue;
        }

        pushRow(row.split(this.delim));

        if (this.limit && data.length >= this.limit) {
          return returnable(true);
        }
      }
      return returnable();
    }

    let nextDelim = input.indexOf(this.delim, cursor);
    let nextNewline = input.indexOf(this.newline, cursor);
    let quoteSearch = input.indexOf(this.quoteChar, cursor);

    // Parser loop
    while (true) {
      if (signal?.aborted) {
        return returnable();
      }

      // Field has opening quote
      if (input[cursor] === this.quoteChar) {
        // Start our search for the closing quote where the cursor is
        quoteSearch = cursor;

        // Skip the opening quote
        cursor++;

        while (true) {
          if (signal?.aborted) {
            return returnable();
          }

          // Find closing quote
          quoteSearch = input.indexOf(this.quoteChar, quoteSearch + 1);

          if (quoteSearch === -1) {
            //No other quotes are found - no other delimiters
            if (!ignoreLastRow) {
              // No closing quote... what a pity
              errors.push({
                type: 'Quotes',
                code: 'MissingQuotes',
                message: 'Quoted field unterminated',
                row: data.length, // row has yet to be inserted
                index: cursor,
              });
            }
            return finish();
          }

          // Closing quote at EOF
          if (quoteSearch === inputLen - 1) {
            const value = input
              .substring(cursor, quoteSearch)
              .replace(this.quoteCharRegex, this.quoteChar);
            return finish(value);
          }

          if (
            this.quoteChar === this.escapeChar &&
            input[quoteSearch + 1] === this.escapeChar
          ) {
            // If this quote is escaped, it's part of the data; skip it
            // If the quote character is the escape character, then check if the next character is the escape character
            quoteSearch++;
            continue;
          }

          if (
            this.quoteChar !== this.escapeChar &&
            quoteSearch !== 0 &&
            input[quoteSearch - 1] === this.escapeChar
          ) {
            // If the quote character is not the escape character, then check if the previous character was the escape character
            continue;
          }

          if (nextDelim !== -1 && nextDelim < quoteSearch + 1) {
            nextDelim = input.indexOf(this.delim, quoteSearch + 1);
          }
          if (nextNewline !== -1 && nextNewline < quoteSearch + 1) {
            nextNewline = input.indexOf(this.newline, quoteSearch + 1);
          }
          // Check up to nextDelim or nextNewline, whichever is closest
          const checkUpTo =
            nextNewline === -1 ? nextDelim : Math.min(nextDelim, nextNewline);
          const spacesBetweenQuoteAndDelimiter = extraSpaces(checkUpTo);

          if (
            input.substring(
              quoteSearch + 1 + spacesBetweenQuoteAndDelimiter,
              quoteSearch + 1 + spacesBetweenQuoteAndDelimiter + delimLen,
            ) === this.delim
          ) {
            // Closing quote followed by delimiter or 'unnecessary spaces + delimiter'
            row.push(
              input
                .substring(cursor, quoteSearch)
                .replace(this.quoteCharRegex, this.quoteChar),
            );
            cursor =
              quoteSearch + 1 + spacesBetweenQuoteAndDelimiter + delimLen;

            // If char after following delimiter is not quoteChar, we find next quote char position
            if (
              input[
                quoteSearch + 1 + spacesBetweenQuoteAndDelimiter + delimLen
              ] !== this.quoteChar
            ) {
              quoteSearch = input.indexOf(this.quoteChar, cursor);
            }
            nextDelim = input.indexOf(this.delim, cursor);
            nextNewline = input.indexOf(this.newline, cursor);
            break;
          }

          const spacesBetweenQuoteAndNewLine = extraSpaces(nextNewline);

          if (
            input.substring(
              quoteSearch + 1 + spacesBetweenQuoteAndNewLine,
              quoteSearch + 1 + spacesBetweenQuoteAndNewLine + newlineLen,
            ) === this.newline
          ) {
            // Closing quote followed by newline or 'unnecessary spaces + newLine'
            row.push(
              input
                .substring(cursor, quoteSearch)
                .replace(this.quoteCharRegex, this.quoteChar),
            );

            saveRow(
              quoteSearch + 1 + spacesBetweenQuoteAndNewLine + newlineLen,
            );

            nextDelim = input.indexOf(this.delim, cursor); // because we may have skipped the nextDelim in the quoted field
            quoteSearch = input.indexOf(this.quoteChar, cursor); // we search for first quote in next line

            if (this.limit && data.length >= this.limit)
              return returnable(true);

            break;
          }

          // Checks for valid closing quotes are complete (escaped quotes or quote followed by EOF/delimiter/newline) -- assume these quotes are part of an invalid text string
          errors.push({
            type: 'Quotes',
            code: 'InvalidQuotes',
            message: 'Trailing quote on quoted field is malformed',
            row: data.length, // row has yet to be inserted
            index: cursor,
          });

          quoteSearch++;
        }

        continue;
      }

      // Comment found at start of new line
      if (
        this.comments &&
        row.length === 0 &&
        input.substring(cursor, cursor + commentsLen) === this.comments
      ) {
        if (nextNewline === -1)
          // Comment ends at EOF
          return returnable();
        cursor = nextNewline + newlineLen;
        nextNewline = input.indexOf(this.newline, cursor);
        nextDelim = input.indexOf(this.delim, cursor);
        continue;
      }

      // Next delimiter comes before next newline, so we've reached end of field
      if (nextDelim !== -1 && (nextDelim < nextNewline || nextNewline === -1)) {
        row.push(input.substring(cursor, nextDelim));
        cursor = nextDelim + delimLen;
        // we look for next delimiter char
        nextDelim = input.indexOf(this.delim, cursor);
        continue;
      }

      // End of row
      if (nextNewline !== -1) {
        row.push(input.substring(cursor, nextNewline));
        saveRow(nextNewline + newlineLen);

        if (this.limit && data.length >= this.limit) return returnable(true);

        continue;
      }

      break;
    }

    return finish();

    /**
     * checks if there are extra spaces after closing quote and given index without any text
     * if Yes, returns the number of spaces
     */
    function extraSpaces(index: number) {
      let spaceLength = 0;
      if (index !== -1) {
        const textBetweenClosingQuoteAndIndex = input.substring(
          quoteSearch + 1,
          index,
        );
        if (
          textBetweenClosingQuoteAndIndex &&
          textBetweenClosingQuoteAndIndex.trim() === ''
        ) {
          spaceLength = textBetweenClosingQuoteAndIndex.length;
        }
      }
      return spaceLength;
    }
  }
}
