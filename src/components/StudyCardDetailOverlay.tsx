import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StudyCard } from '../studyCards/types';
import { ankiFuriganaToRubyHtml, lyricLineToDisplayHtml } from '../studyCards/ankiFuriganaDisplay';
import { resolveStudyCardDetail } from '../studyCards/studyCardDetail';
import { studyCardMeaningUsesSongti } from '../studyCards/studyCardFonts';
import './StudyCardDetailOverlay.css';

type Props = {
  cards: StudyCard[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

function kindLabel(kind: StudyCard['kind']): string {
  return kind === 'vocab' ? '词汇' : '语法';
}

export default function StudyCardDetailOverlay({ cards, index, onIndexChange, onClose }: Props) {
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  const detail = card ? resolveStudyCardDetail(card) : null;

  useEffect(() => {
    setFlipped(false);
  }, [index, card?.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (e.key === 'ArrowRight' && index < cards.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cards.length, index, onClose, onIndexChange]);

  const toggleFlip = useCallback(() => {
    setFlipped((v) => !v);
  }, []);

  if (!card || !detail) return null;

  const frontHtml = ankiFuriganaToRubyHtml(card.front.trim());
  const isGrammar = card.kind === 'grammar';
  const sourceLyricRaw = detail.lyricJaRaw || detail.lyricZh;
  const sourceLyricHtml = sourceLyricRaw ? lyricLineToDisplayHtml(sourceLyricRaw) : '';
  const showTranslation = Boolean(detail.lyricJaRaw && detail.lyricZh);
  const meaningIsHan = studyCardMeaningUsesSongti(detail.meaning);

  return createPortal(
    <div className="study-card-detail" role="dialog" aria-modal="true" aria-label="学习卡详情">
      <button type="button" className="study-card-detail__backdrop" onClick={onClose} aria-label="返回列表" />

      <div className="study-card-detail__stage">
        <div className="study-card-scene">
          <div
            className={`study-card-flip${flipped ? ' is-flipped' : ''}`}
            data-lang={card.lang}
            onClick={toggleFlip}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFlip();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={flipped ? '点击卡片翻回正面' : '点击卡片查看反面'}
          >
            <article className="study-card-face study-card-face--front">
              <div className="study-card-face__inner">
                <span className="study-card-face__kind">{kindLabel(card.kind)}</span>
                <div
                  className="study-card-face__headline"
                  dangerouslySetInnerHTML={{ __html: frontHtml }}
                />
                {detail.gloss && <p className="study-card-face__gloss">{detail.gloss}</p>}
              </div>
            </article>

            <article className="study-card-face study-card-face--back">
              <div className="study-card-face__inner study-card-face__inner--back">
                <p className="study-card-back__label">{card.kind === 'vocab' ? '释义' : '详解'}</p>
                <p
                  className={`study-card-back__meaning${meaningIsHan ? ' study-card-back__meaning--han' : ''}`}
                >
                  {detail.meaning}
                </p>

                <p className="study-card-back__label">{isGrammar ? '例句' : '出典'}</p>
                {sourceLyricHtml ? (
                  <p
                    className="study-card-back__source-lyric"
                    dangerouslySetInnerHTML={{ __html: sourceLyricHtml }}
                  />
                ) : null}

                {showTranslation && (
                  <>
                    <p className="study-card-back__label">译文</p>
                    <p className="study-card-back__lyric study-card-back__lyric--zh">{detail.lyricZh}</p>
                  </>
                )}

                {!isGrammar && (
                  <p className="study-card-back__source-meta">
                    <span className="study-card-back__source-sep">—— </span>
                    <span className="study-card-back__source-song">{detail.sourceLabel}</span>
                  </p>
                )}
              </div>
            </article>
          </div>
        </div>

        <p className="study-card-detail__hint">[ 点击卡片翻转 ]</p>

        <div className="study-card-detail__nav">
          <button
            type="button"
            className="study-card-detail__nav-btn"
            disabled={index <= 0}
            onClick={() => onIndexChange(index - 1)}
          >
            上一个
          </button>
          <button type="button" className="study-card-detail__nav-btn study-card-detail__nav-btn--close" onClick={onClose}>
            返回列表
          </button>
          <button
            type="button"
            className="study-card-detail__nav-btn"
            disabled={index >= cards.length - 1}
            onClick={() => onIndexChange(index + 1)}
          >
            下一个
          </button>
        </div>

        <p className="study-card-detail__counter">
          {index + 1} / {cards.length}
        </p>
      </div>
    </div>,
    document.body,
  );
}
