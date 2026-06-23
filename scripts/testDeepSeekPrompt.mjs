/**
 * DeepSeek 口令友好度：路由、结构、典型输出模式修复
 * 运行: npx tsx scripts/testDeepSeekPrompt.mjs
 * 可选真机 API: DEEPSEEK_API_KEY=... npx tsx scripts/testDeepSeekPrompt.mjs --live
 */
import { readFileSync } from 'fs';
import { buildEncoderPrompt, resolveEncoderModelHint } from '../src/codec/prompt/buildEncoderPrompt.ts';
import { compileDocument } from '../src/codec/compileDocument.ts';
import { parseStream } from '../src/codec/parseStream.ts';
import { normalizeStreamInput } from '../src/codec/repairStreamEnvelope.ts';

const matrixZh = {
  interfaceLanguage: 'zh',
  learningTargetLanguages: ['jp', 'ko', 'en', 'zh'],
  activeTarget: 'zh',
};

const live = process.argv.includes('--live');

console.log('=== 1. DeepSeek modelHint 路由 ===');
assert(resolveEncoderModelHint('deepseek') === 'deepseek', 'deepseek uses deepseek hint');
assert(resolveEncoderModelHint('tongyi') === 'qwen', 'tongyi still qwen');

console.log('\n=== 2. 口令结构健康度 ===');
for (const lang of ['jp', 'zh']) {
  const prompt = buildEncoderPrompt('周杰伦', '威廉古堡', {
    includeVocabAndGrammar: true,
    matrix: { ...matrixZh, activeTarget: lang },
    modelHint: resolveEncoderModelHint('deepseek'),
  });
  assert(prompt.includes('@0') && prompt.includes('@9'), `${lang} envelope`);
  assert(prompt.includes('[Self_Check'), `${lang} self check`);
  assert(prompt.includes('[Stream_Close'), `${lang} stream close`);
  assert(!prompt.includes('Tongyi/Qwen'), `${lang} no qwen-only hint`);
  assert(prompt.includes('DeepSeek:'), `${lang} deepseek hint injected`);
  assert(prompt.includes('search official lyrics'), `${lang} deepseek search hint`);
  assert(prompt.length < 12000, `${lang} length budget (${prompt.length})`);
  lintDuplicateLines(prompt, lang);
  console.log(`  ${lang}: ${prompt.length} chars, blocks OK`);
}

console.log('\n=== 3. DeepSeek 典型输出模式 → normalize + compile ===');
const baseGood = `@0
H|周杰伦|威廉古堡|zh
L|1|{藤:téng}{蔓:màn}|藤蔓植物
@1
V|1|{藤:téng}{蔓:màn}|藤蔓|1|院子里爬满藤蔓|院子里藤蔓很多
@9`;

const patterns = [
  {
    name: 'markdown fence',
    raw: `以下是密文记录流：\n\`\`\`text\n${baseGood}\n\`\`\`\n希望对你有帮助`,
  },
  {
    name: 'preamble text',
    raw: `好的，我来为你生成威廉古堡的密文：\n${baseGood}`,
  },
  {
    name: 'epilogue after @9',
    raw: `${baseGood}\n\n以上是该歌曲的完整密文，请查收。`,
  },
  {
    name: 'thinking preamble',
    raw: `首先分析歌曲结构，然后输出密文。\n${baseGood}`,
  },
  {
    name: 'missing @9 (auto repair)',
    raw: `@0\nH|周杰伦|威廉古堡|zh\nL|1|{藤:téng}{蔓:màn}|藤蔓\n@1\nV|1|{藤:téng}{蔓:màn}|藤蔓|1|院子里爬满藤蔓|院子里藤蔓很多`,
  },
  {
    name: 'enc fixture + markdown fence',
    raw: (() => {
      const enc = readFileSync(new URL('./fixtures/akizakura-enc.txt', import.meta.url), 'utf8');
      return `好的，以下是密文：\n\`\`\`text\n${enc.trim()}\n\`\`\``;
    })(),
  },
];

for (const { name, raw } of patterns) {
  const normalized = normalizeStreamInput(raw);
  const doc = parseStream(normalized);
  const compiled = compileDocument(normalized, { interfaceLanguage: 'zh' });
  assert(doc.lyrics.length >= 1, `${name}: has lyrics`);
  assert(compiled.bodyHtml.length > 50, `${name}: compiles html`);
  assert(/@9\s*$/.test(normalized.trim()) || normalized.includes('@9'), `${name}: ends with @9`);
  console.log(`  ${name}: L=${doc.lyrics.length} V=${doc.vocab.length} closed=${doc.closed}`);
}

if (live) {
  console.log('\n=== 4. DeepSeek API 真机采样 ===');
  await runLiveDeepSeekSample();
} else {
  console.log('\n=== 4. DeepSeek API（跳过，加 --live 且设置 DEEPSEEK_API_KEY）===');
}

console.log('\nOK — DeepSeek 口令与粘贴修复路径可用');

function lintDuplicateLines(prompt, label) {
  const counts = new Map();
  for (const raw of prompt.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim().toLowerCase();
    if (line.length < 24) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const dupes = [...counts.entries()].filter(([, n]) => n > 2);
  if (dupes.length > 0) {
    throw new Error(`${label} duplicate lines: ${dupes[0][0]}`);
  }
}

async function runLiveDeepSeekSample() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    console.log('  SKIP: DEEPSEEK_API_KEY not set');
    return;
  }

  const prompt = buildEncoderPrompt('周杰伦', '威廉古堡', {
    includeVocabAndGrammar: true,
    matrix: { ...matrixZh, activeTarget: 'zh' },
    modelHint: 'deepseek',
  });

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.3,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    console.log('  API error:', res.status, await res.text().then((t) => t.slice(0, 200)));
    return;
  }

  const data = await res.json();
  const output = data.choices?.[0]?.message?.content ?? '';
  console.log('  output chars:', output.length);
  console.log('  has markdown fence:', /^```/m.test(output));
  console.log('  has preamble before @0:', output.indexOf('@0') > 0);
  console.log('  has text after @9:', (() => {
    const i = output.lastIndexOf('@9');
    return i >= 0 && output.slice(i + 2).trim().length > 0;
  })());

  const normalized = normalizeStreamInput(output);
  const doc = parseStream(normalized);
  const compiled = compileDocument(normalized, { interfaceLanguage: 'zh' });

  console.log('  normalized closed:', doc.closed);
  console.log('  L lines:', doc.lyrics.length, 'V:', doc.vocab.length, 'G:', doc.grammar.length);
  console.log('  html bytes:', compiled.bodyHtml.length);

  assert(doc.lyrics.length >= 5, 'live: at least 5 lyric lines');
  assert(doc.closed, 'live: stream closed with @9');
  assert(compiled.bodyHtml.includes('cn-line') || compiled.bodyHtml.includes('lyrics-group'), 'live: html structure');

  // zh ruby quality checks
  const badHanziRuby = [...doc.vocab, ...doc.grammar].some((r) =>
    /\{[^:}]+:[\u4e00-\u9fff]\}/.test(r.label || r.term || r.pedagogicalExample),
  );
  if (badHanziRuby) {
    console.warn('  WARN: found Hanzi-as-reading ruby in V/G');
  }

  const bareBetween = doc.lyrics.some((l) => {
    const stripped = l.primary.replace(/\{[^:}]+:[^}]+\}/g, '');
    return /[\u4e00-\u9fff]/.test(stripped);
  });
  if (bareBetween) {
    console.warn('  WARN: bare CJK between zh ruby tokens in L col3');
  }

  console.log('  LIVE sample passed compile pipeline');
}

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
