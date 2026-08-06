import { splitStreamColumns } from './splitStreamColumns';
import type { DetectedLyricsLanguage } from './detectLyricsLanguage';

const RE_HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;
const RE_HANZI = /[\u4e00-\u9fff]/;
const RE_KANA = /[\u3040-\u309f\u30a0-\u30ff]/;

/** 匹配 V 头词上的中文拼音注音：{汉|pin} / {汉:pin} / {汉pin} */
const PINYIN_RUBY_CHUNK =
  /\{[\u4e00-\u9fff]+(?:[|:][a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ0-9]+|[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ0-9]+)\}/i;

/**
 * 从 Step2 原始流抽前几条 V 头词（col3）。
 * 先保护 `{…}` 内的 `|`，避免 ruby 管道被当成字段分隔。
 */
export function sampleVocabHeadwords(rawStream: string, limit = 5): string[] {
  const out: string[] = [];
  for (const rawLine of rawStream.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line.startsWith('V|')) continue;
    const protectedLine = line.replace(/\{[^}]*\}/g, (m) => m.replace(/\|/g, '\u0001'));
    const cols = splitStreamColumns(protectedLine).map((c) => c.replace(/\u0001/g, '|'));
    const head = (cols[2] ?? '').trim();
    if (head) out.push(head);
    if (out.length >= limit) break;
  }
  return out;
}

function isPinyinishHead(head: string): boolean {
  return PINYIN_RUBY_CHUNK.test(head);
}

/** 韩语源：头词几乎全是汉字、几乎无 Hangul → 从译文挖词 */
function isChineseHeadForKo(head: string): boolean {
  if (RE_HANGUL.test(head)) return false;
  if (isPinyinishHead(head)) return true;
  return RE_HANZI.test(head) && !RE_KANA.test(head);
}

/**
 * 源语为 ko/jp/en 时，词头却大量中文（含拼音注音）→ 误挖译文 / 误走 zh 口令。
 * 拼音词解只合法于源语=zh。
 */
export function isZhPinyinVocabPoison(
  rawStream: string,
  sourceLanguage: DetectedLyricsLanguage | string,
): boolean {
  if (sourceLanguage === 'zh') return false;
  const heads = sampleVocabHeadwords(rawStream, 6);
  if (heads.length < 2) return false;

  if (sourceLanguage === 'ko') {
    const bad = heads.filter(isChineseHeadForKo).length;
    return bad >= Math.ceil(heads.length * 0.5);
  }

  const pinyinish = heads.filter(isPinyinishHead).length;
  return pinyinish >= Math.ceil(heads.length * 0.5);
}
