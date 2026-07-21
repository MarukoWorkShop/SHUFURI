import { escapeHtml } from './escapeHtml';

const RUBY_TOKEN_RE = /\{([^|\\{}]+)\|([^\\{}]+)\}/g;

/** 平假名 / 片假名 / 长音（含半角片假名） */
const KANA_CHAR_RE = /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9Dー]/u;
const KANJI_CHAR_RE = /[\u4e00-\u9fff々〆ヵヶ]/u;

/** 全角花括号 → 半角，便于统一匹配 */
function normalizeRubyBrackets(text: string): string {
  return text.replace(/\uFF5B/g, '{').replace(/\uFF5D/g, '}');
}

/**
 * 修复 AI 常见笔误（缺管道），但绝不把送假名裸括号修成读音：
 * - {過|か}去{こ} → {過|か}{去|こ}（复合词第二字）
 * - 過去{かこ} → {過去|かこ}（≥2 假名读音）
 * - 出{る} / {出|で}{る} 不在此处理 → 交给 stripBareKanaBraces
 */
function repairShorthandRubyMarkup(text: string): string {
  let s = text.replace(
    /\}([\u4e00-\u9fff々〆ヵヶ]+)\{([ぁ-んァ-ンー\uFF66-\uFF9D]+)\}/g,
    '}{$1|$2}',
  );
  s = s.replace(
    /([\u4e00-\u9fff々〆ヵヶ]+)\{([ぁ-んァ-ンー\uFF66-\uFF9D]{2,})\}/g,
    '{$1|$2}',
  );
  return s;
}

/**
 * 去掉仅包假名的裸花括号（无读音）：{アルバム} → アルバム
 * 避免歌词里残留字面量 `{}`。
 */
function stripBareKanaBraces(text: string): string {
  return text.replace(/\{([ぁ-んァ-ンー\uFF66-\uFF9D]+)\}/g, '$1');
}

function normalizeRubyInput(text: string): string {
  return stripBareKanaBraces(repairShorthandRubyMarkup(normalizeRubyBrackets(text)));
}

function hasKanji(text: string): boolean {
  return KANJI_CHAR_RE.test(text);
}

function isKanaChar(ch: string): boolean {
  return KANA_CHAR_RE.test(ch);
}

export type PeeledJpRuby = {
  prefix: string;
  base: string;
  reading: string;
  suffix: string;
};

/**
 * 剥掉基字两端与读音相同的假名；纯假名基字 → base/reading 置空，内容进 prefix。
 */
export function peelJpRubyOkurigana(base: string, reading: string): PeeledJpRuby {
  let b = base;
  let r = reading;
  let prefix = '';
  let suffix = '';

  while (b.length > 0 && r.length > 0) {
    const bc = [...b][0]!;
    const rc = [...r][0]!;
    if (!isKanaChar(bc) || bc !== rc) break;
    prefix += bc;
    b = [...b].slice(1).join('');
    r = [...r].slice(1).join('');
  }

  while (b.length > 0 && r.length > 0) {
    const bChars = [...b];
    const rChars = [...r];
    const bc = bChars[bChars.length - 1]!;
    const rc = rChars[rChars.length - 1]!;
    if (!isKanaChar(bc) || bc !== rc) break;
    suffix = bc + suffix;
    b = bChars.slice(0, -1).join('');
    r = rChars.slice(0, -1).join('');
  }

  if (!hasKanji(b)) {
    return { prefix: prefix + b + suffix, base: '', reading: '', suffix: '' };
  }

  return { prefix, base: b, reading: r, suffix };
}

/**
 * 净化日语 ruby token：
 * 1) 基字全是假名 → 不注音（避免 {の|の}、{て|て}）
 * 2) 两端与读音相同的送假名剥到 ruby 外（{揺れている|ゆれている} → 揺+ている）
 */
function sanitizeJpRubyToken(base: string, reading: string): string {
  const peeled = peelJpRubyOkurigana(base, reading);
  if (!peeled.base) {
    return escapeHtml(peeled.prefix + peeled.suffix);
  }
  if (!peeled.reading.trim()) {
    return escapeHtml(peeled.prefix) + escapeHtml(peeled.base) + escapeHtml(peeled.suffix);
  }
  return (
    escapeHtml(peeled.prefix) +
    `<ruby>${escapeHtml(peeled.base)}<rt>${escapeHtml(peeled.reading)}</rt></ruby>` +
    escapeHtml(peeled.suffix)
  );
}

/** 将 {基字|读音} 转为 <ruby>，其余文本 escape；假名基字与送假名不注音 */
export function applyRubyMarkup(text: string): string {
  const normalized = normalizeRubyInput(text);
  let out = '';
  let last = 0;
  const re = new RegExp(RUBY_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    out += escapeHtml(normalized.slice(last, m.index));
    out += sanitizeJpRubyToken(m[1]!, m[2]!);
    last = m.index + m[0].length;
  }
  out += escapeHtml(normalized.slice(last));
  return out;
}

/**
 * 净化已编译 HTML 中的日语 <ruby>（编辑页旧稿 / 误包假名）。
 * 仅处理 `.jp-line` / `.vocab-ex-ja` / `.grammar-ex-ja` / 词汇·语法日语标题。
 */
export function sanitizeJpRubyInBodyHtml(bodyHtml: string): string {
  if (!bodyHtml.trim() || typeof DOMParser === 'undefined') return bodyHtml;

  // 先去掉文本里的裸假名括号（{る}、{アルバム}），再处理 <ruby>
  const withoutBare = bodyHtml.replace(/\{([ぁ-んァ-ンー\uFF66-\uFF9D]+)\}/g, '$1');
  if (!withoutBare.includes('<ruby')) return withoutBare;

  const doc = new DOMParser().parseFromString(
    `<div id="jp-ruby-sanitize-root">${withoutBare}</div>`,
    'text/html',
  );
  const root = doc.getElementById('jp-ruby-sanitize-root');
  if (!root) return withoutBare;

  const hosts = root.querySelectorAll(
    '.jp-line, .vocab-ex-ja, .grammar-ex-ja, .vocab-word, .grammar-title-ja',
  );
  let changed = withoutBare !== bodyHtml;

  for (const host of hosts) {
    const rubies = Array.from(host.querySelectorAll('ruby'));
    for (const ruby of rubies) {
      // 空注音（编辑漏标）保留，供 ink 编辑
      if (ruby.hasAttribute('data-ink-empty-rt')) continue;

      const rt = ruby.querySelector('rt');
      if (!rt) continue;

      const reading = rt.textContent ?? '';
      const baseParts: string[] = [];
      for (const child of Array.from(ruby.childNodes)) {
        if (child === rt) continue;
        if ((child as Element).tagName === 'RP') continue;
        baseParts.push(child.textContent ?? '');
      }
      const base = baseParts.join('');
      const peeled = peelJpRubyOkurigana(base, reading);

      if (
        peeled.prefix === '' &&
        peeled.suffix === '' &&
        peeled.base === base &&
        peeled.reading === reading
      ) {
        continue;
      }

      changed = true;
      const frag = doc.createDocumentFragment();
      if (peeled.prefix) frag.appendChild(doc.createTextNode(peeled.prefix));
      if (peeled.base && peeled.reading.trim()) {
        const next = doc.createElement('ruby');
        next.appendChild(doc.createTextNode(peeled.base));
        const nextRt = doc.createElement('rt');
        nextRt.textContent = peeled.reading;
        next.appendChild(nextRt);
        frag.appendChild(next);
      } else if (peeled.base) {
        frag.appendChild(doc.createTextNode(peeled.base));
      }
      if (peeled.suffix) frag.appendChild(doc.createTextNode(peeled.suffix));
      ruby.replaceWith(frag);
    }
  }

  return changed ? root.innerHTML : withoutBare;
}

/** @internal 供测试：规范化后的 {Kanji|Kana} 文本 */
export function normalizeRubyMarkupText(text: string): string {
  return normalizeRubyInput(text);
}

/** @internal 供测试：单 token 净化结果（已含 escape / ruby HTML） */
export function sanitizeJpRubyTokenForTest(base: string, reading: string): string {
  return sanitizeJpRubyToken(base, reading);
}
