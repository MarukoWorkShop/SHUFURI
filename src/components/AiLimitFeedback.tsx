/**
 * AI 限额反馈墙
 *
 * 触发条件：用户今日 AI 调用次数耗尽（explain 或 lyrics）。
 *
 * UI 包含：
 *   1. 标题 + 当前额度提示（区分划词/词解）
 *   2. 评分（1-100）
 *   3. 反馈文本框（建议/需求，可选）
 *   4. 跳过 / 提交反馈
 *
 * 提交成功后：
 *   - 跳转到"感谢支持，正式版本正在筹备中"页
 *   - 服务端记录到 NoSQL
 *   - 划词额外赠送 50 次，词解额度不变
 */
import { useState, useEffect, useRef } from 'react';
import type { AiUsageState, AiActionType } from '../services/aiUsageLimit';
import {
  grantFeedbackBonus,
  EXPLAIN_FREE_LIMIT,
  LYRICS_FREE_LIMIT,
  FEEDBACK_EXPLAIN_BONUS,
} from '../services/aiUsageLimit';
import {
  submitFeedback,
  trackFeedbackSubmitted,
  trackFeedbackDismissed,
} from '../services/analytics';
import { L } from '../utils/i18n';

interface Props {
  usage: AiUsageState;
  /** 哪个 action 触发了此反馈墙 */
  blockedAction: AiActionType;
  onClose: () => void;
}

const SCORE_PRESETS = [60, 80, 90, 100];

export default function AiLimitFeedback({ usage, blockedAction, onClose }: Props) {
  const [score, setScore] = useState<number>(80);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [visible, setVisible] = useState(false);

  const submittedRef = useRef(false);

  // 入场动画
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleSkip = () => {
    if (submittedRef.current) return;
    trackFeedbackDismissed({ score, hasText: Boolean(text.trim()) });
    handleClose();
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    submittedRef.current = true;
    try {
      const res = await submitFeedback({
        score,
        text: text.trim() || undefined,
        usageCount: usage.explainCount + usage.lyricsCount,
        limit: usage.explainLimit + usage.lyricsLimit,
      });
      trackFeedbackSubmitted({ score, hasText: Boolean(text.trim()), ok: res.ok });
      // 不论服务端是否成功，本地都赠送划词 50 次
      grantFeedbackBonus();
    } catch (err) {
      console.warn('[ai-limit-feedback] submit error', err);
      grantFeedbackBonus();
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  const isExplainBlocked = blockedAction === 'explain';

  return (
    <div className={`ai-limit-overlay${visible ? ' is-in' : ''}`}>
      <div className="ai-limit-card">
        {submitted ? (
          /* ---------------- 已提交：感谢页 ---------------- */
          <div className="ai-limit-done">
            <div className="ai-limit-done__icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  className="ai-limit-done__check"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="ai-limit-done__text">
              {L('感谢支持，正式版本正在筹备中', 'Thanks — the official version is coming soon')}
            </p>
            <p className="ai-limit-done__sub">
              {L(
                `已为您赠送划词 ${FEEDBACK_EXPLAIN_BONUS} 次额度（词解 ${LYRICS_FREE_LIMIT} 次不变），明天会自然重置。`,
                `You've been gifted ${FEEDBACK_EXPLAIN_BONUS} extra explain uses today (lyrics stays at ${LYRICS_FREE_LIMIT}). The limit resets tomorrow.`,
              )}
            </p>
            <button className="ai-limit-btn ai-limit-btn--primary" onClick={handleClose}>
              {L('继续探索', 'Keep Exploring')}
            </button>
          </div>
        ) : (
          /* ---------------- 反馈表单 ---------------- */
          <>
            <h2 className="ai-limit-card__title">
              {L('内测反馈墙', 'Beta Feedback Wall')}
            </h2>

            <p className="ai-limit-card__desc">
              {isExplainBlocked
                ? L(
                    `您的今日 ${EXPLAIN_FREE_LIMIT} 次划词讲解额度已用完。词解与语法生成仍有 ${usage.lyricsRemaining} 次。`,
                    `You've used today's ${EXPLAIN_FREE_LIMIT} word-explanation uses. Lyrics analysis still has ${usage.lyricsRemaining} remaining.`,
                  )
                : L(
                    `您的今日 ${LYRICS_FREE_LIMIT} 次词解与语法生成额度已用完。划词讲解仍有 ${usage.explainRemaining} 次。搜索与打印排版功能仍可无限畅享。`,
                    `You've used today's ${LYRICS_FREE_LIMIT} lyrics-analysis uses. Word explanation still has ${usage.explainRemaining} remaining. Search & print layout remain unlimited.`,
                  )}
            </p>

            <p className="ai-limit-card__hint">
              {L(
                `花 1 分钟填个反馈问卷，我们将为您赠送划词 ${FEEDBACK_EXPLAIN_BONUS} 次额度，反馈框可以提出改进的建议或更多的需求。`,
                `Take 1 minute to share feedback and we'll grant you ${FEEDBACK_EXPLAIN_BONUS} extra explain uses today. Tell us what to improve.`,
              )}
            </p>

            {/* 限额概览条 */}
            <div className="ai-limit-summary">
              <div className="ai-limit-summary__row">
                <span>{L('划词讲解', 'Word Explain')}</span>
                <span className={usage.explainReached ? 'is-exhausted' : ''}>
                  {usage.explainCount}/{usage.explainLimit}
                </span>
              </div>
              <div className="ai-limit-summary__row">
                <span>{L('词解与语法', 'Lyrics Analysis')}</span>
                <span className={usage.lyricsReached ? 'is-exhausted' : ''}>
                  {usage.lyricsCount}/{usage.lyricsLimit}
                </span>
              </div>
            </div>

            {/* 评分 */}
            <div className="ai-limit-rating">
              <div className="ai-limit-rating__label">
                {L('请给当前功能打个分（1-100）', 'Rate the current features (1-100)')}
              </div>
              <div className="ai-limit-rating__presets">
                {SCORE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`ai-limit-rating__chip${score === preset ? ' is-active' : ''}`}
                    onClick={() => setScore(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <div className="ai-limit-rating__slider">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="ai-limit-rating__input"
                />
                <span className="ai-limit-rating__value">{score}</span>
              </div>
            </div>

            {/* 文本反馈 */}
            <textarea
              className="ai-limit-textarea"
              rows={4}
              maxLength={500}
              placeholder={L(
                '在这里写下改进建议或更多需求…',
                'Share improvements or new feature requests…',
              )}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <div className="ai-limit-actions">
              <button
                className="ai-limit-btn ai-limit-btn--secondary"
                onClick={handleSkip}
                disabled={submitting}
              >
                {L('跳过', 'Skip')}
              </button>
              <button
                className="ai-limit-btn ai-limit-btn--primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? L('提交中…', 'Submitting…')
                  : L('提交反馈', 'Submit Feedback')}
              </button>
            </div>

            <p className="ai-limit-footer">
              {L(
                '反馈将匿名存储，用于改进产品。剩余免费功能不受影响。',
                'Feedback is anonymous and used to improve the product. Free features remain available.',
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
