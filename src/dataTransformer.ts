import { parseDynamicValue } from './converter';
import type { ParserConfig } from './types';
import { testEmptyLine } from './utils';

export class DataTransformer<T> extends TransformStream {
  private fields: string[] = []; // Fields are from the header row of the input, if there is one
  private dynamicTypingCache: Record<string, boolean> = {};

  constructor(private config: ParserConfig<T>) {
    super({
      transform: (chunk, controller) => {
        const row = this.transform(chunk);
        if (row) {
          controller.enqueue(row);
        }
      },
    });
  }

  shouldApplyDynamicTyping(field: string | number) {
    // Cache function values to avoid calling it for each row
    if (typeof this.config.dynamicTyping === 'function') {
      if (this.dynamicTypingCache[field] === undefined) {
        this.dynamicTypingCache[field] = this.config.dynamicTyping(field);
      }
      return this.dynamicTypingCache[field];
    }

    if (typeof this.config.dynamicTyping === 'boolean') {
      return this.config.dynamicTyping;
    }

    if (typeof this.config.dynamicTyping === 'object') {
      return this.config.dynamicTyping[field];
    }

    return false;
  }

  parseDynamic(field: string | number, value: string) {
    return this.shouldApplyDynamicTyping(field)
      ? parseDynamicValue(value)
      : value;
  }

  private get needsHeaderRow() {
    return this.config.header && this.fields.length === 0;
  }

  private fillHeaderFieldsFromData(data: string[] | string[][]) {
    const addHeader = (header: string, i: number) => {
      this.fields.push(
        typeof this.config.transformHeader === 'function'
          ? this.config.transformHeader(header, i)
          : header,
      );
    };

    if (Array.isArray(data[0])) {
      for (let i = 0; this.needsHeaderRow && i < data.length; i++) {
        (data as string[][])[i].forEach(addHeader);
      }

      data.splice(0, 1);
    }

    // if _results.data[0] is not an array, we are in a step where _results.data is the row.
    else {
      (data as string[]).forEach(addHeader);
    }
  }

  transform(rowSource: string[]): T | undefined {
    if (
      this.config.skipEmptyLines &&
      !testEmptyLine(rowSource, this.config.skipEmptyLines)
    ) {
      return;
    }

    if (this.needsHeaderRow) {
      this.fillHeaderFieldsFromData(rowSource);
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const row: Record<string, any> | string[] = this.config.header ? {} : [];

    for (let j = 0; j < rowSource.length; j++) {
      let field: string | number = j;
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      let value: any = rowSource[j];

      if (this.config.header) {
        field = j >= this.fields.length ? '__parsed_extra' : this.fields[j];
      }

      if (this.config.transform) {
        value = this.config.transform(value, field);
      }

      value = this.parseDynamic(field, value);

      if (field === '__parsed_extra' && !Array.isArray(row)) {
        row[field] = row[field] || [];
        row[field].push(value);
      } else {
        // @ts-ignore
        row[field] = value;
      }
    }

    // if (this.config.header) {
    //   if (rowSource.length > this.fields.length)
    //     // errors.push({
    //     //   type: 'FieldMismatch',
    //     //   code: 'TooManyFields',
    //     //   message: `Too many fields: expected ${this.fields.length} fields but parsed ${rowSource.length}`,
    //     //   row: rowSource.length,
    //     // });
    //   else if (rowSource.length < this.fields.length)
    //     // errors.push({
    //     //   type: 'FieldMismatch',
    //     //   code: 'TooFewFields',
    //     //   message: `Too few fields: expected ${this.fields.length} fields but parsed ${rowSource.length}`,
    //     //   row: rowSource.length,
    //     // });
    // }

    return row as T;
  }
}
