import { useEffect, useMemo, useRef } from 'react';
import { groupCardsBySong } from '../studyCards/mapCardsToLayoutProps';
import type { StudyCard } from '../studyCards/types';
import { lyricLineToDisplayHtml } from '../studyCards/ankiFuriganaDisplay';
import { L } from '../utils/i18n';
import './StudyCardsPrintBook.css';

type Props = {
  /** 原始卡片数组（内部按歌名分组）。 */
  cards: StudyCard[];
  /** 触发 window.print() 后由父组件卸载（或自动隐藏）。 */
  onPrinted?: () => void;
  /** 是否真正调用 window.print()（默认 true）。 */
  doPrint?: boolean;
};

/**
 * 专属单词书打印视图 — 不对称双栏镜像排版（按歌名分组，组内不可跨页截断）。
 *
 * 布局：
 *   左栏 (≈35%)：仅 front（词条/单词，大号）
 *   右栏 (≈65%)：「释义」标签 + meaning（大字）
 *                  出典歌词（斜体）+ 极小灰色歌名
 *                  「译文」标签 + notes（例句轨迹）
 *                  频次 Badge
 *
 * - 屏幕态 `display:none`，仅 `@media print` 可见。
 * - 约束 P：打印态强制 `print-color-adjust: exact`，底色铺满纸张。
 * - 约束 L：每种语言另起一页（`.lang-section + .lang-section { page-break-before: always }`），
 *   页首横线 + 该语言标识（日本語 / 한국어 / ENGLISH / 中文）。
 * - 约束 G：单条条目 `break-inside: avoid`，不可跨页截断。
 */
/**
 * 对日语/中文文本应用振假名/拼音（{漢|かな} / Anki[かな] → <ruby>），
 * 其他语言原样返回。与 extractStudyCards.ts 的 useRuby 规则一致（jp / zh）。
 */
function renderFurigana(text: string, lang: StudyCard['lang']): string {
  if ((lang !== 'jp' && lang !== 'zh') || !text.trim()) return text;
  return lyricLineToDisplayHtml(text);
}

export default function StudyCardsPrintBook({ cards, onPrinted, doPrint = true }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // 每次卡片引用变化时重新分组（纯函数，无副作用）
  const layout = useMemo(() => groupCardsBySong(cards), [cards]);

  useEffect(() => {
    if (!doPrint) return;
    console.error('[StudyCardsPrintBook] mounted, groups =', layout.groups.length, ', total entries =', layout.groups.reduce((s, g) => s + g.entries.length, 0));

    // 双 rAF + 延迟确保大量条目（222+）的 DOM 完全渲染后再触发打印。
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        setTimeout(() => {
          window.print();
          onPrinted?.();
        }, 80);
      });
      return () => cancelAnimationFrame(id2);
    });

    return () => cancelAnimationFrame(id1);
  }, [doPrint, onPrinted, layout]);

  // 按语言归类（保持歌名分组在 cards 中的原始顺序），每种语言另起一页。
  const langOrder: StudyCard['lang'][] = [];
  const groupsByLang = new Map<StudyCard['lang'], typeof layout.groups>();
  for (const group of layout.groups) {
    for (const entry of group.entries) {
      let bucket = groupsByLang.get(entry.lang);
      if (!bucket) {
        bucket = [];
        groupsByLang.set(entry.lang, bucket);
        langOrder.push(entry.lang);
      }
      bucket.push(group);
      break; // 同组同语言，仅记录一次归属
    }
  }

  const langLabel: Record<StudyCard['lang'], string> = {
    jp: '日本語',
    ko: '한국어',
    en: 'ENGLISH',
    zh: '中文',
  };

  return (
    <div className="study-cards-print-book" aria-hidden ref={rootRef}>
      <div className="study-cards-print-book__inner">
        {langOrder.map((lang) => {
          const groups = groupsByLang.get(lang) ?? [];
          return (
            <div
              className="study-cards-print-book__lang-section"
              key={lang}
              data-lang={lang}
            >
              {/* 每种语言页首横线 + 语言标识（第一个 section 紧贴顶端） */}
              <div className="study-cards-print-book__header">
                <span className="study-cards-print-book__lang-tag" data-lang={lang}>
                  {langLabel[lang] ?? lang}
                </span>
              </div>

              <div className="study-cards-print-book__body">
                {groups.map((group) => (
                  <>
                    {group.entries.map((entry) => (
                      <section className="study-cards-print-book__entry" key={entry.id} data-lang={entry.lang}>
                        {/* 左栏：仅单词/词条（35%，日语带振假名） */}
                        <div className="study-cards-print-book__col-left">
                          <span
                            className="study-cards-print-book__front"
                            data-lang={entry.lang}
                            dangerouslySetInnerHTML={{ __html: renderFurigana(entry.front, entry.lang) }}
                          />
                        </div>

                        {/* 右栏：释义 / 出典+译文+歌名 / 例句轨迹（65%） */}
                        <div className="study-cards-print-book__col-right">
                          {entry.meaning?.trim() && (
                            <>
                              <span className="study-cards-print-book__label">{L('释义', 'Definition')}</span>
                              <p className="study-cards-print-book__def">{entry.meaning}</p>
                            </>
                          )}

                          {entry.lyricQuote?.trim() && (
                            <div className="study-cards-print-book__source">
                              <span
                                className="study-cards-print-book__source-lyric"
                                dangerouslySetInnerHTML={{ __html: renderFurigana(entry.lyricQuote, entry.lang) }}
                              />
                              {entry.lyricQuoteZh?.trim() && (
                                <span className="study-cards-print-book__source-zh">{entry.lyricQuoteZh}</span>
                              )}
                              {/* 歌名：右下角极小灰色字 */}
                              {entry.sourceSongLabel && (
                                <span className="study-cards-print-book__source-song">{entry.sourceSongLabel}</span>
                              )}
                            </div>
                          )}

                          {entry.translationLines.length > 0 && (
                            <>
                              <span className="study-cards-print-book__label">{L('译文', 'Translation')}</span>
                              <div className="study-cards-print-book__notes">
                                {entry.translationLines.map((line, i) => (
                                  <p className="study-cards-print-book__note" key={i}>
                                    {line}
                                  </p>
                                ))}
                              </div>
                            </>
                          )}

                          {entry.encounterCount > 1 && (
                            <span className="study-cards-print-book__freq">×{entry.encounterCount}</span>
                          )}
                        </div>
                      </section>
                    ))}
                  </>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
