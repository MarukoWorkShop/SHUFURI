import {
  inferPosterLangFromBodyHtml,
  resolvePosterPipelineLang,
  resolvePosterRubyToggleSupported,
} from '../src/utils/shufuriPoster/inferPosterLang.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  inferPosterLangFromBodyHtml('<p class="cn-line">') === 'zh',
  'cn-line → zh',
);
assert(
  inferPosterLangFromBodyHtml('<div class="lyrics-group--zh">') === 'zh',
  'lyrics-group--zh → zh',
);
assert(
  inferPosterLangFromBodyHtml('<p class="ko-line">') === 'ko',
  'ko-line → ko',
);
assert(
  inferPosterLangFromBodyHtml('<p class="jp-line">Hello world</p>') === 'en',
  'plain jp-line → en',
);
assert(
  inferPosterLangFromBodyHtml('<p class="jp-line"><ruby>紅<rt>べに</rt></ruby>') === 'jp',
  'ruby jp-line → jp',
);

assert(
  resolvePosterPipelineLang('zh', '<p class="jp-line">', 'jp') === 'zh',
  'declared lang wins',
);
assert(
  resolvePosterPipelineLang(undefined, '<p class="cn-line">', 'jp') === 'zh',
  'infer from html',
);
assert(
  resolvePosterPipelineLang(undefined, '<p class="jp-line">x</p>', 'en') === 'en',
  'wheel fallback en',
);

const jpRubyBody = '<p class="jp-line"><ruby>紅<rt>べに</rt></ruby></p>';
assert(
  resolvePosterRubyToggleSupported('en', jpRubyBody, 'jp') === true,
  'declared en + jp wheel + ruby → ruby toggle on',
);
assert(
  resolvePosterRubyToggleSupported('en', jpRubyBody, 'en') === false,
  'declared en + en wheel + ruby → ruby toggle off',
);
assert(
  resolvePosterRubyToggleSupported('jp', jpRubyBody, 'jp') === true,
  'declared jp → ruby toggle on',
);

console.log('testInferPosterLang: OK');
