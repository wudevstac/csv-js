import type { ParserConfig } from './types';
import type { ParserInternalConfig } from './parserInterface';

export function parse(
  input: ReadableStream<Uint8Array>,
  options?: ParserConfig,
): ReadableStream<string[]> {
  const abortController = new AbortController();
  const signal = abortController.signal;
  return new ReadableStream<string[]>({
    async start(controller) {
      const worker = new Worker(new URL('./parserWorker.worker.ts', import.meta.url), {
        type: 'module',
      });

      signal.addEventListener('abort', () => {
        worker.postMessage('abort');
      });

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

      worker.postMessage({
        options: {
          delimiter: options?.delimiter,
          newline: options?.newline,
          comments: options?.comments,
          limit: options?.limit,
          fast: options?.fast,
          quoteChar: options?.quoteChar,
          escapeChar: options?.escapeChar,
        } as ParserInternalConfig,
        input: input,
        writableStream,
      }, [input, writableStream])
    },
    cancel() {
      abortController.abort();
    }
  });
}
