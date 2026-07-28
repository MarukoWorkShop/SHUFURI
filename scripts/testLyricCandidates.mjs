// 双候选歌词解析回归测试
// 运行: npx tsx scripts/testLyricCandidates.mjs
import { parseLyricCandidates } from '../src/utils/parseLyricCandidates.ts';

function makeStream(opts) {
  const { artist, title, lang, lines } = opts;
  const body = lines.map((t, i) => `L|${i + 1}|${t}`).join('\n');
  return `@0\nH|${artist}|${title}|${lang}\n${body}\n@9`;
}

const cases = [
  {
    name: '双候选：A/B 完整解析',
    in: `@@CANDIDATE_A@@\n${makeStream({
      artist: '周杰伦',
      title: '稻香',
      lang: 'zh',
      lines: ['对这个世界如果你有太多的抱怨', '何必', '小时候的梦又是什么'],
    })}\n@@CANDIDATE_B@@\n${makeStream({
      artist: '周杰倫',
      title: '稻香',
      lang: 'zh',
      lines: ['对这个世界如果你有太多的抱怨', '小时候的梦又是什么'],
    })}`,
    assert(r) {
      if (r.status !== 'ok') throw new Error(`期望 ok，得到 ${r.status}`);
      if (r.candidates.length !== 2) throw new Error('期望 2 个候选');
      if (!r.candidates[0].label.includes('首选')) throw new Error('A 应为首选');
      if (!r.candidates[1].label.includes('备选')) throw new Error('B 应为备选');
      if (r.candidates[0].lineCount !== 3) throw new Error('A 行数应为 3');
      if (r.candidates[1].lineCount !== 2) throw new Error('B 行数应为 2');
    },
  },
  {
    name: '无匹配：@@NO_MATCH@@',
    in: '@@NO_MATCH@@\nreason: 未检索到该曲的权威歌词',
    assert(r) {
      if (r.status !== 'no_match') throw new Error(`期望 no_match，得到 ${r.status}`);
      if (!r.message.includes('未检索到')) throw new Error('message 应含未检索到');
    },
  },
  {
    name: '单候选：无分隔符（整段作为 A）',
    in: makeStream({ artist: 'Aimer', title: '残響', lang: 'jp', lines: ['君がくれた', 'あの日のこと'] }),
    assert(r) {
      if (r.status !== 'single') throw new Error(`期望 single，得到 ${r.status}`);
      if (r.candidate.lineCount !== 2) throw new Error('行数应为 2');
    },
  },
  {
    name: '单候选：B 段无效（仅一行噪声）',
    in: `@@CANDIDATE_A@@\n${makeStream({
      artist: 'YOASOBI',
      title: '夜に駆ける',
      lang: 'jp',
      lines: ['一体全体', 'どうやって'],
    })}\n@@CANDIDATE_B@@\n（这是无效内容，没有记录流）`,
    assert(r) {
      if (r.status !== 'single') throw new Error(`期望 single，得到 ${r.status}`);
    },
  },
  {
    name: '降级：A/B 内容相同 → single',
    in: `@@CANDIDATE_A@@\n${makeStream({
      artist: 'X',
      title: 'T',
      lang: 'en',
      lines: ['line one', 'line two'],
    })}\n@@CANDIDATE_B@@\n${makeStream({
      artist: 'X',
      title: 'T',
      lang: 'en',
      lines: ['line one', 'line two'],
    })}`,
    assert(r) {
      if (r.status !== 'single') throw new Error(`期望 single（相同降级），得到 ${r.status}`);
    },
  },
  {
    name: '错误：完全无法解析',
    in: '这根本不是歌词流，也没有分隔符',
    assert(r) {
      if (r.status !== 'error') throw new Error(`期望 error，得到 ${r.status}`);
      if (!r.retryable) throw new Error('error 应可重试');
    },
  },
  {
    name: 'B 段带 META 来源标注',
    in: `@@CANDIDATE_A@@\n${makeStream({
      artist: 'A',
      title: 'B',
      lang: 'en',
      lines: ['hello world'],
    })}\n@@CANDIDATE_B@@\nMETA|source=Genius|variant=tv_size\n${makeStream({
      artist: 'A',
      title: 'B',
      lang: 'en',
      lines: ['hello world', 'tv edit'],
    })}`,
    assert(r) {
      if (r.status !== 'ok') throw new Error(`期望 ok，得到 ${r.status}`);
      if (r.candidates[1].source !== 'Genius') throw new Error('B 来源应为 Genius');
      if (r.candidates[1].variant !== 'tv_size') throw new Error('B variant 应为 tv_size');
      if (!r.candidates[1].label.includes('TV Size')) throw new Error('B 标签应含 TV Size');
    },
  },
];

let pass = 0;
for (const c of cases) {
  try {
    c.assert(parseLyricCandidates(c.in, { title: 'default', artist: 'default' }));
    console.log(`✓ ${c.name}`);
    pass++;
  } catch (e) {
    console.error(`✗ ${c.name}\n  ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${pass}/${cases.length} 通过`);
