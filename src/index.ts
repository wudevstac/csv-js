import { guessConfig } from './config';
import type { ParserConfig } from './types';
import { parse } from './parser';
import { parse as parseWorker } from './parserWorker';
import { DataTransformer } from './dataTransformer';

export { DataTransformer } from './dataTransformer';

export async function parseBlobStream<T>(
  input: Blob,
  options?: ParserConfig<T>,
): Promise<ReadableStream<T>> {
  const snippet = input.slice(0, 1024 * 1024);
  const parserConfig = guessConfig(await snippet.text(), options);
  const inputStream = input.stream();
  const parserStream = options?.worker
    ? parseWorker(inputStream, parserConfig)
    : parse(inputStream, parserConfig);
  const transformer = new DataTransformer(options ?? {});

  return parserStream.pipeThrough<T>(transformer);
}
