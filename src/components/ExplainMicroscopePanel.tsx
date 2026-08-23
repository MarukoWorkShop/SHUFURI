import { useCallback, useEffect, useId } from 'react';
import type { UseExplainSessionResult } from '../hooks/useExplainSession';
import {
  langCodeToMicroscopeLanguage,
  parseAiExplainParts,
  type AiGrammarCapsule,
} from '../codec/prompt/buildMicroscopePrompt';
import { getAppSettings } from '../services/appSettings';
import { applyRubyMarkup } from '../utils/rubyMarkup';
import { AiLoadingOverlay } from './AiLoadingOverlay';
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

/** 中文语法标签 → 英文标签映射（English UI 下 Grammar Formula 使用） */
const POS_LABEL_MAP_EN: Record<string, string> = {
  // 词性
  '名词': 'noun',
  '动词': 'verb',
  '形容词': 'adj',
  '副词': 'adv',
  '连词': 'conj',
  '代词': 'pron',
  '助词': 'particle',
  '介词': 'prep',
  '冠词': 'article',
  '感叹词': 'interj',
  // 日语特有
  '連体詞': 'adnominal',
  '動詞詞干': 'stem',
  'て形': 'te-form',
  'た形': 'ta-form',
  'ない形': 'nai-form',
  '連用形': 'ren\'yōkei',
  '終止形': 'shūshikei',
  '連体形': 'rentaikei',
  '仮定形': 'kateikei',
  '命令形': 'meireikei',
  '未然形': 'mizenkei',
  '已然形': 'izenkei',
  '活用': 'conjugation',
  '完了': 'perfective',
  '縮略': 'contraction',
  '補語': 'complement',
  '定语': 'attributive',
  '补语': 'complement',
  '情态': 'modal',
  '能': 'ability',
  '程度': 'degree',
  '时态': 'tense',
  '语态': 'voice',
  '体': 'aspect',
  '否定': 'negative',
  '过去': 'past',
  '被动': 'passive',
  '使役': 'causative',
  '可能': 'potential',
  '敬语': 'honorific',
  '敬体': 'polite',
  '简体': 'plain',
  '辞书形': 'dict form',
  '词典形': 'dict form',
  '无特殊变形': 'no change',
};

function translatePosLabel(label: string, ifaceLang: string): string {
  if (ifaceLang !== 'en') return label;
  return POS_LABEL_MAP_EN[label] ?? label;
}

function GrammarFormulaView({
  tokens,
  fallback,
  ifaceLang,
}: {
  tokens: { surface: string; label: string }[];
  fallback: string;
  ifaceLang: string;
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
            {tok.label ? <span className="microscope-formula__label">{translatePosLabel(tok.label, ifaceLang)}</span> : null}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function ExplainMicroscopePanel({ session, variant = 'sheet' }: Props) {
  const titleId = useId();
  const embedded = variant === 'embedded';
  // 界面语言（P1 散点切换）
  const iface = getAppSettings().interfaceLanguage;
  const L = (zh: string, en: string) => (iface === 'en' ? en : zh);
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
    addGrammarLessonToNote,
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
              {L('划词', 'Text Selection')}
            </h2>
            <button
              type="button"
              className="microscope-panel__close"
              aria-label={L('关闭', 'Close')}
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
                {L('本地词典', 'Local Dictionary')}
              </span>
            ) : null}
            {aiExplain && lastModel ? (
              <span className="microscope-panel__badge microscope-panel__badge--ai" title={lastModel}>
                {L('AI讲解', 'AI Explain')}
              </span>
            ) : null}
          </div>
          {resultSource === 'local' && dictMetaLabel ? (
            <p className="microscope-panel__model">{dictMetaLabel}</p>
          ) : null}
        </header>

        {/* AI 讲解首字到达前的等待：手绘咖啡杯 + 进度条 + 随机文案 */}
        {deepDiveLoading && !aiExplain && <AiLoadingOverlay visible lang={iface} />}

        <div className="microscope-panel__scroll">
          {loading && !result && !deepDiveLoading && (
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
                  {L('重试本地', 'Retry Local')}
                </button>
                <button
                  type="button"
                  className="btn-tonal microscope-deep-dive-inline"
                  disabled={!canAi}
                  onClick={requestAiDeepDive}
                >
                  {L('AI讲解', 'AI Explain')}
                </button>
              </div>
            </div>
          )}

          {result && micro && (
            <section className="microscope-section microscope-section--micro">
              <h3 className="microscope-section__label">{L('词典释义', 'Dictionary Definition')}</h3>
              <dl className="microscope-dict">
                <div className="microscope-dict__row">
                  <dt>{L('词典形', 'Dictionary Form')}</dt>
                  <dd>{micro.dictionary_form}</dd>
                </div>
                <div className="microscope-dict__row">
                  <dt>{L('发音', 'Pronunciation')}</dt>
                  <dd>{micro.pronunciation}</dd>
                </div>
                <div className="microscope-dict__row">
                  <dt>
                    {micro.direct_meaning.includes('本地无整词') ||
                    micro.direct_meaning.startsWith('局部参考')
                      ? L('释义', 'Meaning')
                      : L('英译', 'English Translation')}
                  </dt>
                  <dd>
                    {micro.direct_meaning.replace(/^局部参考[：:]\s*/, '')}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <section className="microscope-section microscope-section--ai">
            <h3 className="microscope-section__label">{L('AI讲解', 'AI Explain')}</h3>
            {deepDiveLoading && !aiExplain && (
              <p className="microscope-panel__follow-hint">
                {aiStreamReady ? L('模型生成中…', 'Model generating…') : L('正在连接模型…', 'Connecting to model…')}
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
                    <p className="microscope-ai-card__label">{L('逐句解析', 'Line-by-Line Analysis')}</p>
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
                    <p className="microscope-ai-card__label">{L('语境释义', 'Contextual Meaning')}</p>
                    <p className="microscope-ai-card__body">{aiParts.contextSense}</p>
                  </div>
                ) : null}
                {aiParts.loanwords.length > 0 || aiParts.loanwordsRaw ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">{L('外来语原词', 'Etymology')}</p>
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
                    <p className="microscope-ai-card__label">{L('语法分子式', 'Grammar Formula')}</p>
                    <GrammarFormulaView tokens={aiParts.formula} fallback={aiParts.formulaRaw} ifaceLang={iface} />
                  </div>
                ) : null}
                {aiParts.grammar ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">{L('语法拆解', 'Grammar Breakdown')}</p>
                    <p className="microscope-ai-card__body">{aiParts.grammar}</p>
                  </div>
                ) : null}
                {aiParts.capsules.length > 0 ? (
                  <div className="microscope-ai-card__row microscope-ai-card__row--capsules">
                    <p className="microscope-ai-card__label">{L('核心语法点', 'Core Grammar')}</p>
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
                              {L('点击查看：', 'Click to view:')}
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
                    <p className="microscope-ai-card__label">{L('歌词意境', 'Lyrical Mood')}</p>
                    <p className="microscope-ai-card__body">{aiParts.mood}</p>
                  </div>
                ) : null}
                {aiParts.slang ? (
                  <div className="microscope-ai-card__row">
                    <p className="microscope-ai-card__label">{L('歌词黑话', 'Slang')}</p>
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
                    {L('「', '"')}{activeGrammarCapsule.term}{L('」用法讲解', '" usage')}
                  </p>
                  <button
                    type="button"
                    className="microscope-examples__close"
                    onClick={clearGrammarExamples}
                  >
                    {L('收起', 'Collapse')}
                  </button>
                </div>
                {grammarExamplesLoading ? (
                  <p className="microscope-panel__follow-hint">{L('正在生成讲解…', 'Generating explanation…')}</p>
                ) : null}
                {grammarExamplesError ? (
                  <p className="microscope-examples__error">{grammarExamplesError}</p>
                ) : null}
                {grammarLesson ? (
                  <div className="microscope-lesson">
                    {grammarLesson.meaning ? (
                      <div className="microscope-lesson__row">
                        <p className="microscope-lesson__label">{L('通常含义', 'Common Meaning')}</p>
                        <p
                          className="microscope-lesson__body"
                          dangerouslySetInnerHTML={{ __html: applyRubyMarkup(grammarLesson.meaning) }}
                        />
                      </div>
                    ) : null}
                    {grammarLesson.usage ? (
                      <div className="microscope-lesson__row">
                        <p className="microscope-lesson__label">{L('如何使用', 'How to Use')}</p>
                        <p
                          className="microscope-lesson__body"
                          dangerouslySetInnerHTML={{ __html: applyRubyMarkup(grammarLesson.usage) }}
                        />
                      </div>
                    ) : null}
                    {grammarLesson.emotion ? (
                      <div className="microscope-lesson__row">
                        <p className="microscope-lesson__label">{L('情感语气', 'Emotion & Tone')}</p>
                        <p
                          className="microscope-lesson__body"
                          dangerouslySetInnerHTML={{ __html: applyRubyMarkup(grammarLesson.emotion) }}
                        />
                      </div>
                    ) : null}
                    {grammarLesson.example ? (
                      <div className="microscope-lesson__row">
                        <p className="microscope-lesson__label">{L('例句', 'Example')}</p>
                        <p className="microscope-examples__source">
                          {grammarLesson.example.source}
                          <span className="microscope-examples__via">
                            {grammarLesson.example.via === 'local'
                              ? L('学习卡', 'Study card')
                              : grammarLesson.example.via === 'crafted'
                                ? L('造句', 'Example Sentence')
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
                    <div className="microscope-lesson__actions">
                      <button
                        type="button"
                        className="microscope-lesson__add"
                        onClick={addGrammarLessonToNote}
                        title={L(
                          '将本考点单独写入重点语法笔记，无需「添加到笔记」',
                          'Save this grammar point as a note (independent of Add to notes)',
                        )}
                      >
                        <span className="microscope-lesson__add-icon" aria-hidden>
                          +
                        </span>
                        <span className="microscope-lesson__add-label">
                          {L('写入语法笔记', 'Save grammar note')}
                        </span>
                      </button>
                      <p className="microscope-lesson__add-hint">
                        {L(
                          '仅保存本考点讲解，与「添加到笔记」互不影响',
                          'Saves this lesson only — separate from “Add to notes”',
                        )}
                      </p>
                    </div>
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
                {L('结合上下文 AI讲解', 'AI Explain with Context')}
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
                  {L('重新讲解', 'Regenerate Explanation')}
                </button>
                <button
                  type="button"
                  className="microscope-deep-dive"
                  disabled={!showStructuredAi || busy}
                  onClick={addToLyricsNote}
                >
                  {L('添加到笔记', 'Add to notes')}
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
