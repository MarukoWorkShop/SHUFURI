import { useCallback, useEffect, useId } from 'react';
import type { UseExplainSessionResult } from '../hooks/useExplainSession';
import { parseAiExplainParts } from '../codec/prompt/buildMicroscopePrompt';
import './ExplainMicroscopePanel.css';

type Props = {
  session: UseExplainSessionResult;
};

function highlightFocusInSentence(sentence: string, focus: string): { before: string; focus: string; after: string } {
  const idx = sentence.indexOf(focus);
  if (idx < 0) {
    return { before: '', focus: focus || sentence, after: '' };
  }
  return {
    before: sentence.slice(0, idx),
    focus: sentence.slice(idx, idx + focus.length),
    after: sentence.slice(idx + focus.length),
  };
}

export default function ExplainMicroscopePanel({ session }: Props) {
  const titleId = useId();
  const {
    panelOpen,
    closePanel,
    targetPhrase,
    surroundingLine,
    result,
    resultSource,
    aiExplain,
    lastModel,
    loading,
    deepDiveLoading,
    aiStreamReady,
    error,
    dictMetaLabel,
    retryAnalyze,
    requestAiDeepDive,
    addToLyricsNote,
  } = session;

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closePanel]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) closePanel();
    },
    [closePanel],
  );

  if (!panelOpen) return null;

  const sentence = surroundingLine || targetPhrase;
  const parts = highlightFocusInSentence(sentence, targetPhrase);
  const micro = result?.micro_analysis;
  const busy = loading || deepDiveLoading;
  const canAi = !loading && !deepDiveLoading && Boolean(targetPhrase);
  const aiParts = aiExplain ? parseAiExplainParts(aiExplain) : null;
  const showStructuredAi =
    !deepDiveLoading &&
    aiParts &&
    (aiParts.contextSense || aiParts.grammar || aiParts.mood);

  return (
    <div className="microscope-root" role="presentation">
      <div className="microscope-overlay" onClick={handleOverlayClick} aria-hidden />
      <aside
        className="microscope-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="microscope-panel__handle" aria-hidden />

        <header className="microscope-panel__header">
          <div className="microscope-panel__title-row">
            <span className="microscope-panel__icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            <h2 id={titleId} className="microscope-panel__title">
              划词
            </h2>
            <button
              type="button"
              className="microscope-panel__close"
              aria-label="关闭"
              onClick={closePanel}
            >
              ×
            </button>
          </div>

          <p className="microscope-panel__sentence" lang="ja">
            <span className="microscope-panel__sentence-dim">{parts.before}</span>
            <mark className="microscope-panel__focus">{parts.focus}</mark>
            <span className="microscope-panel__sentence-dim">{parts.after}</span>
          </p>
          <div className="microscope-panel__meta-row">
            {micro?.part_of_speech ? (
              <span className="microscope-panel__badge">{micro.part_of_speech}</span>
            ) : null}
            {resultSource === 'local' ? (
              <span
                className="microscope-panel__badge microscope-panel__badge--local"
                title={dictMetaLabel ?? undefined}
              >
                本地词典
              </span>
            ) : null}
            {aiExplain && lastModel ? (
              <span className="microscope-panel__badge microscope-panel__badge--ai" title={lastModel}>
                AI讲解
              </span>
            ) : null}
          </div>
          {resultSource === 'local' && dictMetaLabel ? (
            <p className="microscope-panel__model">{dictMetaLabel}</p>
          ) : null}
        </header>

        <div className="microscope-panel__scroll">
          {loading && !result && (
            <div className="microscope-panel__skeleton" aria-busy="true">
              <div className="microscope-skel" />
              <div className="microscope-skel microscope-skel--short" />
              <div className="microscope-skel microscope-skel--card" />
            </div>
          )}

          {error && !busy && (
            <div className="microscope-panel__error">
              <p>{error}</p>
              <div className="microscope-panel__error-actions">
                <button type="button" className="btn-tonal" onClick={retryAnalyze}>
                  重试本地
                </button>
                <button
                  type="button"
                  className="btn-tonal microscope-deep-dive-inline"
                  disabled={!canAi}
                  onClick={requestAiDeepDive}
                >
                  AI讲解
                </button>
              </div>
            </div>
          )}

          {result && micro && (
            <section className="microscope-section microscope-section--micro">
              <h3 className="microscope-section__label">词典释义</h3>
              <dl className="microscope-dict">
                <div className="microscope-dict__row">
                  <dt>词典形</dt>
                  <dd>{micro.dictionary_form}</dd>
                </div>
                <div className="microscope-dict__row">
                  <dt>发音</dt>
                  <dd>{micro.pronunciation}</dd>
                </div>
                <div className="microscope-dict__row">
                  <dt>
                    {micro.direct_meaning.includes('本地无整词') ||
                    micro.direct_meaning.startsWith('局部参考')
                      ? '释义'
                      : '英译'}
                  </dt>
                  <dd>{micro.direct_meaning}</dd>
                </div>
              </dl>
            </section>
          )}

          <section className="microscope-section microscope-section--ai">
            <h3 className="microscope-section__label">AI讲解</h3>
            {deepDiveLoading && !aiExplain && (
              <p className="microscope-panel__follow-hint">
                {aiStreamReady ? '模型生成中…' : '正在连接模型…'}
              </p>
            )}
            {deepDiveLoading && aiExplain ? (
              <p className="microscope-ai-body is-streaming">
                {aiExplain}
                <span className="microscope-ai-caret" aria-hidden />
              </p>
            ) : null}
            {showStructuredAi && aiParts ? (
              <div className="microscope-ai-card">
                {aiParts.contextSense ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">语境释义</p>
                    <p className="microscope-ai-card__body">{aiParts.contextSense}</p>
                  </div>
                ) : null}
                {aiParts.grammar ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">语法拆解</p>
                    <p className="microscope-ai-card__body">{aiParts.grammar}</p>
                  </div>
                ) : null}
                {aiParts.mood ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">歌词意境</p>
                    <p className="microscope-ai-card__body">{aiParts.mood}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!deepDiveLoading && !aiExplain && (
              <button
                type="button"
                className="microscope-deep-dive"
                disabled={!canAi}
                onClick={requestAiDeepDive}
              >
                结合上下文 AI讲解
              </button>
            )}
            {!deepDiveLoading && aiExplain ? (
              <div className="microscope-ai-actions">
                <button
                  type="button"
                  className="microscope-deep-dive microscope-deep-dive--ghost"
                  disabled={!canAi}
                  onClick={requestAiDeepDive}
                >
                  重新讲解
                </button>
                <button
                  type="button"
                  className="microscope-deep-dive"
                  disabled={!showStructuredAi || busy}
                  onClick={addToLyricsNote}
                >
                  添加到笔记
                </button>
              </div>
            ) : null}
            {lastModel && aiExplain && !deepDiveLoading ? (
              <p className="microscope-panel__model">model: {lastModel}</p>
            ) : null}
          </section>
        </div>
      </aside>
    </div>
  );
}
