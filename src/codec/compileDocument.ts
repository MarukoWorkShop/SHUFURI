import { compileStreamDocument } from './roleCompiler';
import { parseStream } from './parseStream';
import type { CompileOptions, ParsedStreamLyrics } from './types';

export function compileDocument(raw: string, opts?: CompileOptions): ParsedStreamLyrics {
  const document = parseStream(raw);
  const bodyHtml = compileStreamDocument(document, opts);
  return {
    bodyHtml,
    title: document.header.title,
    artist: document.header.artist,
    lang: document.header.lang,
    document,
  };
}

export function normalizeStreamText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}
