/**
 * 浏览器端 Kuromoji 分词（@patdx/kuromoji）。
 * 词典：public/dict/kuromoji/*.dat.gz（约 17MB，首次加载后缓存于内存）。
 */

import * as kuromoji from '@patdx/kuromoji';

export type KuromojiToken = {
  surface_form: string;
  basic_form: string;
  reading: string;
  pronunciation: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  conjugated_type: string;
  conjugated_form: string;
};

type Tokenizer = {
  tokenize: (text: string) => KuromojiToken[];
};

const DIC_BASE = '/dict/kuromoji/';

let tokenizerPromise: Promise<Tokenizer> | null = null;
let tokenizerRef: Tokenizer | null = null;

function isGzipBuffer(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf);
  return b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b;
}

async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('需要 DecompressionStream 以解压 Kuromoji 词典');
  }
  const stream = new Response(buf).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

const browserLoader = {
  async loadArrayBuffer(filename: string): Promise<ArrayBufferLike> {
    const file = filename.split('/').pop() || filename;
    const res = await fetch(`${DIC_BASE}${file}`);
    if (!res.ok) {
      throw new Error(`Kuromoji 词典加载失败：${file} (HTTP ${res.status})`);
    }
    const buf = await res.arrayBuffer();
    // Vite 可能已解压 .gz；按魔数判断
    if (isGzipBuffer(buf)) return gunzip(buf);
    return buf;
  },
};

export function isKuromojiReady(): boolean {
  return tokenizerRef != null;
}

/** 预加载分词器（开启划词时调用） */
export function ensureKuromojiLoaded(): Promise<Tokenizer> {
  if (tokenizerRef) return Promise.resolve(tokenizerRef);
  if (!tokenizerPromise) {
    tokenizerPromise = new kuromoji.TokenizerBuilder({ loader: browserLoader })
      .build()
      .then((t) => {
        tokenizerRef = t as Tokenizer;
        return tokenizerRef;
      })
      .catch((err) => {
        tokenizerPromise = null;
        throw err;
      });
  }
  return tokenizerPromise;
}

export async function tokenizeJapanese(text: string): Promise<KuromojiToken[]> {
  const q = text.replace(/\s+/g, '').trim();
  if (!q) return [];
  const tokenizer = await ensureKuromojiLoaded();
  return tokenizer.tokenize(q);
}

const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '形容動詞', '副詞', '感動詞', '連体詞', '接頭詞']);

export function isContentPos(pos: string): boolean {
  return CONTENT_POS.has(pos);
}

export function isSkippablePos(pos: string): boolean {
  return pos === '記号' || pos === '空白';
}
