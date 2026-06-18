import {
  inferPosterLangFromBodyHtml,
  resolvePosterPipelineLang,
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
  inferPosterLangFromBodyHtml('<p class="jp-line"><ruby>') === undefined,
  'ruby jp-line not en',
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

console.log('testInferPosterLang: OK');
