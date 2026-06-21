/**
 * 语法词条（studyTerm）与单词词条同字号
 * 运行: npx tsx scripts/testGrammarStudyTermCss.mjs
 */
import { compileDocument } from '../src/codec/compileDocument.ts';
import { buildShufuriPosterInnerCss } from '../src/utils/shufuriPoster/shufuriPosterShared.ts';
import { buildEncoderPrompt } from '../src/codec/prompt/buildEncoderPrompt.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

for (const lang of ['jp', 'ko', 'en']) {
  const raw = `@0
H|T|Song|${lang}
L|1|term|释义
@1
V|1|word|释义|1|
@2
G|1|grammar label|详解|1|译
@9`;

  const { bodyHtml } = compileDocument(raw, { interfaceLanguage: 'zh' });
  assert(bodyHtml.includes('grammar-title-ja') || bodyHtml.includes('grammar-title-ko'), `${lang} grammar title span`);
  assert(bodyHtml.includes('grammar-ex-'), `${lang} grammar example class`);

  const css = buildShufuriPosterInnerCss('mobilePoster', { lang, spacingScale: 1 });
  assert(css.includes('font-size: unset !important'), `${lang} h3 shell unset`);
  assert(
    css.includes('h3.grammar-point-title .grammar-title-ja') ||
      css.includes('h3.grammar-point-title .grammar-title-ko'),
    `${lang} grammar studyTerm selector`,
  );
  assert(css.includes('.vocab-line1 .vocab-word'), `${lang} vocab studyTerm selector`);

  const mainPxMatch = css.match(/h3\.grammar-point-title \.grammar-title-(?:ja|ko)[\s\S]*?font-size: (\d+)px !important/);
  const vocabMatch = css.match(/\.vocab-line1 \.vocab-word[\s\S]*?font-size: (\d+)px !important/);
  assert(mainPxMatch && vocabMatch, `${lang} font-size rules present`);
  assert(mainPxMatch[1] === vocabMatch[1], `${lang} grammar term fs = vocab fs (${mainPxMatch[1]})`);
}

const enPrompt = buildEncoderPrompt('A', 'B', {
  includeVocabAndGrammar: true,
  matrix: {
    interfaceLanguage: 'zh',
    learningTargetLanguages: ['en'],
    activeTarget: 'en',
  },
});
assert(enPrompt.includes('G column 3 label format'), 'en prompt grammar label format');
assert(/\nG\|1\|/.test(enPrompt), 'en prompt G sample row');

console.log('testGrammarStudyTermCss: OK');
