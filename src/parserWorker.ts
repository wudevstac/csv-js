import type { ParserInternalConfig } from './parserInterface';
import { ParserCore } from './parserCore';

export function parse(
  input: ReadableStream<Uint8Array>,
  options?: ParserInternalConfig,
): ReadableStream<string[]> {
  const abortController = new AbortController();
  const signal = abortController.signal;

  return new ReadableStream<string[]>({
    async start(controller) {
      const writableStream = new WritableStream<string[]>({
        write: (chunk) => {
          controller.enqueue(chunk);
        },
        close: () => {
          controller.close();
        },
        abort: (reason) => {
          controller.error(reason);
        },
      });

      const writer = writableStream.getWriter();

      const decoder = new TextDecoderStream();

      const parserOptions: ParserInternalConfig = {
        delimiter: options?.delimiter,
        newline: options?.newline,
        comments: options?.comments,
        limit: options?.limit,
        fast: options?.fast,
        quoteChar: options?.quoteChar,
        escapeChar: options?.escapeChar,
        stream: writer,
      };

      const parser = new ParserCore(parserOptions);

      input.pipeTo(decoder.writable, { signal });
      for await (const chunk of decoder.readable) {
        parser.parse(chunk, false, signal);
      }
      await writer.close();
    },
    cancel() {
      abortController.abort();
    },
  });
}
