/**
 * Encoder Prompt 矩阵组合 smoke 测试
 * 运行: npx tsx scripts/testEncoderPromptMatrix.mjs
 */
import { buildEncoderPrompt } from '../src/codec/prompt/buildEncoderPrompt.ts';

const targets = ['jp', 'ko', 'en', 'zh'];
const interfaces = ['zh', 'en'];
const includeFlags = [true, false];

for (const activeTarget of targets) {
  for (const interfaceLanguage of interfaces) {
    for (const includeVocabAndGrammar of includeFlags) {
      const label = `${activeTarget}/${interfaceLanguage}/vocab=${includeVocabAndGrammar}`;
      const prompt = buildEncoderPrompt('测试歌手', '测试歌名', {
        includeVocabAndGrammar,
        matrix: {
          interfaceLanguage,
          learningTargetLanguages: targets,
          activeTarget,
        },
      });
      assert(prompt.includes('@0'), `${label} has @0`);
      assert(prompt.includes('@9'), `${label} has @9`);
      assert(prompt.includes('[Wire_Schema]'), `${label} wire schema`);
      if (activeTarget === 'zh') {
        assert(prompt.includes('[Zh_ruby'), `${label} zh ruby`);
        assert(prompt.includes('[Zh_grammar'), `${label} zh grammar`);
      } else {
        assert(!prompt.includes('[Zh_grammar'), `${label} no zh grammar`);
      }
      if (!includeVocabAndGrammar) {
        assert(!prompt.includes('[Pedagogical_example'), `${label} no pedagogical block`);
      } else {
        assert(prompt.includes('[Pedagogical_example'), `${label} pedagogical block`);
      }
    }
  }
}

console.log('OK');

function assert(cond, label) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
}
