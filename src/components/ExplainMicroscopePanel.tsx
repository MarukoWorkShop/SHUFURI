import { useCallback, useEffect, useId } from 'react';
import type { UseExplainSessionResult } from '../hooks/useExplainSession';
import {
  langCodeToMicroscopeLanguage,
  parseAiExplainParts,
  type AiGrammarCapsule,
} from '../codec/prompt/buildMicroscopePrompt';
import { applyRubyMarkup } from '../utils/rubyMarkup';
import './ExplainMicroscopePanel.css';

type Props = {
  session: UseExplainSessionResult;
  /** sheet：移动底抽屉；embedded：桌面笔记本内嵌（无遮罩） */
  variant?: 'sheet' | 'embedded';
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

function GrammarFormulaView({
  tokens,
  fallback,
}: {
  tokens: { surface: string; label: string }[];
  fallback: string;
}) {
  if (tokens.length === 0) {
    if (!fallback) return null;
    return <p className="microscope-formula__fallback">{fallback}</p>;
  }
  return (
    <div className="microscope-formula" role="group" aria-label="语法分子式">
      {tokens.map((tok, i) => (
        <span key={`${tok.surface}-${i}`} className="microscope-formula__chip-wrap">
          {i > 0 ? <span className="microscope-formula__plus" aria-hidden>+</span> : null}
          <span className="microscope-formula__chip">
            <span className="microscope-formula__surface">{tok.surface}</span>
            {tok.label ? <span className="microscope-formula__label">{tok.label}</span> : null}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function ExplainMicroscopePanel({ session, variant = 'sheet' }: Props) {
  const titleId = useId();
  const embedded = variant === 'embedded';
  const {
    panelOpen,
    closePanel,
    targetPhrase,
    surroundingLine,
    lang,
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
    requestGrammarExamples,
    clearGrammarExamples,
    activeGrammarCapsule,
    grammarLesson,
    grammarExamplesLoading,
    grammarExamplesError,
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

  const onCapsuleClick = useCallback(
    (capsule: AiGrammarCapsule) => {
      if (
        activeGrammarCapsule?.term === capsule.term &&
        activeGrammarCapsule?.title === capsule.title &&
        (grammarLesson || grammarExamplesLoading)
      ) {
        clearGrammarExamples();
        return;
      }
      requestGrammarExamples(capsule);
    },
    [
      activeGrammarCapsule,
      clearGrammarExamples,
      grammarLesson,
      grammarExamplesLoading,
      requestGrammarExamples,
    ],
  );

  if (!panelOpen) return null;

  const sentence = surroundingLine || targetPhrase;
  const parts = highlightFocusInSentence(sentence, targetPhrase);
  const micro = result?.micro_analysis;
  const busy = loading || deepDiveLoading;
  const canAi = !loading && !deepDiveLoading && Boolean(targetPhrase);
  const aiParts = aiExplain
    ? parseAiExplainParts(aiExplain, { language: langCodeToMicroscopeLanguage(lang) })
    : null;
  const showStructuredAi =
    !deepDiveLoading &&
    aiParts &&
    (aiParts.sentenceBreakdown.length > 0 ||
      aiParts.contextSense ||
      aiParts.loanwords.length > 0 ||
      aiParts.loanwordsRaw ||
      aiParts.grammar ||
      aiParts.mood ||
      aiParts.slang ||
      aiParts.formula.length > 0 ||
      aiParts.formulaRaw ||
      aiParts.capsules.length > 0);

  return (
    <div
      className={`microscope-root${embedded ? ' microscope-root--embedded' : ''}`}
      role="presentation"
    >
      {embedded ? null : (
        <div className="microscope-overlay" onClick={handleOverlayClick} aria-hidden />
      )}
      <aside
        className="microscope-panel"
        role="dialog"
        aria-modal={embedded ? undefined : true}
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
                {aiParts.sentenceBreakdown.length > 0 ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">逐句解析</p>
                    <ol className="microscope-sentences">
                      {aiParts.sentenceBreakdown.map((s, i) => (
                        <li key={i} className="microscope-sentences__item">
                          <span
                            className="microscope-sentences__original"
                            dangerouslySetInnerHTML={{ __html: applyRubyMarkup(s.original) }}
                          />
                          <span className="microscope-sentences__gloss">{s.gloss}</span>
                          {s.note && s.note !== '—' ? (
                            <span className="microscope-sentences__note">{s.note}</span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {aiParts.contextSense ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">语境释义</p>
                    <p className="microscope-ai-card__body">{aiParts.contextSense}</p>
                  </div>
                ) : null}
                {aiParts.loanwords.length > 0 || aiParts.loanwordsRaw ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">外来语原词</p>
                    {aiParts.loanwords.length > 0 ? (
                      <ul className="microscope-loanwords">
                        {aiParts.loanwords.map((lw) => (
                          <li key={lw.raw} className="microscope-loanwords__item">
                            <span className="microscope-loanwords__surface">{lw.surface}</span>
                            <span className="microscope-loanwords__arrow" aria-hidden>
                              ←
                            </span>
                            <span className="microscope-loanwords__src">
                              {lw.sourceLang} {lw.original}
                            </span>
                            <span className="microscope-loanwords__arrow" aria-hidden>
                              →
                            </span>
                            <span className="microscope-loanwords__gloss">{lw.gloss}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="microscope-ai-card__body">{aiParts.loanwordsRaw}</p>
                    )}
                  </div>
                ) : null}
                {aiParts.formula.length > 0 || aiParts.formulaRaw ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">语法分子式</p>
                    <GrammarFormulaView tokens={aiParts.formula} fallback={aiParts.formulaRaw} />
                  </div>
                ) : null}
                {aiParts.grammar ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">语法拆解</p>
                    <p className="microscope-ai-card__body">{aiParts.grammar}</p>
                  </div>
                ) : null}
                {aiParts.capsules.length > 0 ? (
                  <div className="microscope-ai-card__row microscope-ai-card__row--capsules">
                    <p className="microscope-ai-card__label">核心语法点</p>
                    <div className="microscope-capsules">
                      {aiParts.capsules.map((cap) => {
                        const active =
                          activeGrammarCapsule?.term === cap.term &&
                          activeGrammarCapsule?.title === cap.title;
                        return (
                          <button
                            key={`${cap.exam}|${cap.term}|${cap.title}`}
                            type="button"
                            className={
                              active
                                ? 'microscope-capsule is-active'
                                : 'microscope-capsule'
                            }
                            disabled={grammarExamplesLoading && !active}
                            onClick={() => onCapsuleClick(cap)}
                          >
                            <span className="microscope-capsule__exam">{cap.exam}</span>
                            <span className="microscope-capsule__text">
                              点击查看：
                              <span
                                dangerouslySetInnerHTML={{ __html: applyRubyMarkup(cap.title) }}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {aiParts.mood ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">歌词意境</p>
                    <p className="microscope-ai-card__body">{aiParts.mood}</p>
                  </div>
                ) : null}
                {aiParts.slang ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">歌词黑话</p>
                    <p className="microscope-ai-card__body">{aiParts.slang}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {(grammarExamplesLoading || grammarLesson || grammarExamplesError) &&
            activeGrammarCapsule ? (
              <div className="microscope-examples" aria-live="polite">
                <div className="microscope-examples__head">
                  <p className="microscope-examples__title">
                    「{activeGrammarCapsule.term}」用法讲解
                  </p>
                  <button
                    type="button"
                    className="microscope-examples__close"
                    onClick={clearGrammarExamples}
                  >
                    收起
                  </button>
                </div>
                {grammarExamplesLoading ? (
                  <p className="microscope-panel__follow-hint">正在生成讲解…</p>
                ) : null}
                {grammarExamplesError ? (
                  <p className="microscope-examples__error">{grammarExamplesError}</p>
                ) : null}
                {grammarLesson ? (
                  <div className="microscope-lesson">
                    {grammarLesson.meaning ? (
                      <div className="microscope-lesson__row">
                        <p className="microscope-lesson__label">通常含义</p>
                        <p
                          className="microscope-lesson__body"
                          dangerouslySetInnerHTML={{ __html: applyRubyMarkup(grammarLesson.meaning) }}
                        />
                      </div>
                    ) : null}
                    {grammarLesson.usage ? (
                      <div className="microscope-lesson__row">
                        <p className="microscope-lesson__label">如何使用</p>
                        <p
                          className="microscope-lesson__body"
                          dangerouslySetInnerHTML={{ __html: applyRubyMarkup(grammarLesson.usage) }}
                        />
                      </div>
                    ) : null}
                    {grammarLesson.emotion ? (
                      <div className="microscope-lesson__row">
                        <p className="microscope-lesson__label">情感语气</p>
                        <p
                          className="microscope-lesson__body"
                          dangerouslySetInnerHTML={{ __html: applyRubyMarkup(grammarLesson.emotion) }}
                        />
                      </div>
                    ) : null}
                    {grammarLesson.example ? (
                      <div className="microscope-lesson__row">
                        <p className="microscope-lesson__label">例句</p>
                        <p className="microscope-examples__source">
                          {grammarLesson.example.source}
                          <span className="microscope-examples__via">
                            {grammarLesson.example.via === 'local'
                              ? '学习卡'
                              : grammarLesson.example.via === 'crafted'
                                ? '造句'
                                : 'AI'}
                          </span>
                        </p>
                        <p
                          className="microscope-examples__text"
                          dangerouslySetInnerHTML={{
                            __html: applyRubyMarkup(grammarLesson.example.text),
                          }}
                        />
                        {grammarLesson.example.zh ? (
                          <p className="microscope-examples__zh">{grammarLesson.example.zh}</p>
                        ) : null}
                      </div>
                    ) : null}
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
