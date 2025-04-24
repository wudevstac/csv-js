import { ParserCore } from './parserCore';
import type { ParserInternalConfig } from './parserInterface';

const abortController = new globalThis.AbortController();
const signal = abortController.signal;

globalThis.onmessage = async (event) => {
  const { data } = event;
  if (data === 'abort') {
    abortController.abort();
    return;
  }

  const { input, options, writableStream } = data as {
    input: ReadableStream<Uint8Array>;
    options: ParserInternalConfig;
    writableStream: WritableStream<string[]>;
  };
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
};
