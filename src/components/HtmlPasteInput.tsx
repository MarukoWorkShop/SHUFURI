import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildLyricsStep1Prompt } from '../codec/prompt/buildLyricsStep1Prompt';
import type { EncoderPromptOptions } from '../codec/prompt/encoderCommon';
import { resolveEncoderModelHint } from '../codec/prompt/buildEncoderPrompt';
import type { LyricsLanguage, PedagogicalLevel } from '../services/appSettings';
import type { LanguageMatrixContext } from '../services/languageMatrix/types';
import { postClipboardWrite, openAiApp } from '../utils/nativeBridge';
import type { AiAppInfo } from '../bridge/deepLinkPlugin';
import { useAppToast } from '../context/AppToastContext';
import { L } from '../utils/i18n';
import AiAppActionSheet from './AiAppActionSheet';
import type { ExternalPromptRequest } from '../hooks/useStructuredLyricsClipboardCard';

/** 歌名比对用：去空白、小写，忽略标点差异 */
function normalizeTitleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[^\p{L}\p{N}\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/gu, '');
}

type Props = {
  /** 词解由确认页勾选驱动（Step2）；保留 prop 以免调用方断裂。 */
  includeVocabAndGrammar: boolean;
  pedagogicalLevel: PedagogicalLevel;
  language?: LyricsLanguage;
  matrix: LanguageMatrixContext;
  onLanguageChange?: (lang: LyricsLanguage) => void;
  initialTitle?: string;
  initialArtist?: string;
  ocrDetectedLanguage?: import('../services/ocrTypes').OcrDetectedLanguage;
  ocrContext?: {
    songTitle?: string;
    artist?: string;
    album?: string;
    production?: string;
    firstLyricLine?: string;
    rawTexts?: string[];
  };
  /** 剪贴板含可排版流（完整或学习材料）→「粘贴剪贴板歌词」 */
  pasteLayoutReady?: boolean;
  /** 流内 H 歌名；用于表单偏离时把主暗示切到「生成口令」 */
  clipboardStreamTitle?: string;
  onActivatePasteLayout?: (formMeta: { title?: string; artist?: string }) => void;
  /** 解析粘贴的分享文案，提取歌名/歌手（与粘贴歌词分离） */
  onParseMusicShareText?: (text: string) => void;
  parseMusicShareBusy?: boolean;
  onFormMetaChange?: (meta: { title: string; artist: string }) => void;
  /** 确认页触发的学习材料 / 再试口令，写入剪贴板并弹出 AI 选择 */
  externalPrompt?: ExternalPromptRequest | null;
  onExternalPromptHandled?: () => void;
};

export default function HtmlPasteInput({
  includeVocabAndGrammar: _includeVocabAndGrammar,
  pedagogicalLevel: _pedagogicalLevel,
  language,
  matrix,
  onLanguageChange,
  initialTitle,
  initialArtist,
  ocrDetectedLanguage,
  ocrContext,
  pasteLayoutReady = false,
  clipboardStreamTitle = '',
  onActivatePasteLayout,
  onParseMusicShareText,
  parseMusicShareBusy = false,
  onFormMetaChange,
  externalPrompt,
  onExternalPromptHandled,
}: Props) {
  const showAppToast = useAppToast();
  const [songTitle, setSongTitle] = useState(initialTitle || '');
  const [artist, setArtist] = useState(initialArtist || '');
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState('');
  /** 外部注入口令（学习材料 / 再试）时锁定，打开 AI 不再重建口令 */
  const [promptLocked, setPromptLocked] = useState(false);
  /** Step2 A/B/C 引导区展开/收起状态（默认展开） */
  const [guideExpanded, setGuideExpanded] = useState(true);

  // ---- 粘贴分享链接输入框（pastePrimary useMemo 依赖 pasteValue，故提前声明）----
  const [pasteActive, setPasteActive] = useState(false);
  const [pasteValue, setPasteValue] = useState('');

  /**
   * 主次暗示（同一时间最多一个主按钮）：
   * - 剪贴板可排版 / 用户已在 textarea 中粘贴了内容 且表单歌名未偏离 → 粘贴为主（btn-filled）
   * - 否则若已填标题 → 生成口令为主（btn-filled），粘贴为次（btn-tonal）
   * - 粘贴永不 disabled（浏览器要求在用户手势中读剪贴板）
   * - 仅「缺标题」禁用口令
   */
  const { pastePrimary, genPrimary, canGenerate } = useMemo(() => {
    const formTitle = songTitle.trim();
    const canGen = formTitle.length > 0;
    const streamKey = normalizeTitleKey(clipboardStreamTitle);
    const formKey = normalizeTitleKey(formTitle);
    const diverged =
      pasteLayoutReady &&
      streamKey.length > 0 &&
      formKey.length > 0 &&
      streamKey !== formKey;
    // 自动检测到可排版流，或用户手动在 textarea 中粘贴了内容 → 粘贴按钮优先
    const hasPasteContent = pasteValue.trim().length > 0;
    const pasteIsPrimary = (pasteLayoutReady || hasPasteContent) && !diverged;
    const genIsPrimary = canGen && !pasteIsPrimary;
    return {
      pastePrimary: pasteIsPrimary,
      genPrimary: genIsPrimary,
      canGenerate: canGen,
    };
  }, [songTitle, pasteLayoutReady, clipboardStreamTitle, pasteValue]);

  const [langHelpVisible, setLangHelpVisible] = useState(false);
  const pasteInputRef = useRef<HTMLTextAreaElement>(null);
  const pasteActiveRef = useRef(false);
  pasteActiveRef.current = pasteActive;

  const handlePasteAreaClick = useCallback(async () => {
    // 先展开输入框（保证点击必有可见反馈），但**不**立即聚焦 textarea，
    // 否则 iOS Safari 会因 textarea 获得焦点而弹出系统「粘贴」浮层。
    // busy 只阻止重复读剪贴板，绝不阻止展开，避免「点击毫无反应」。
    setPasteActive(true);
    if (parseMusicShareBusy) return;
    // 在用户手势的同步上下文内先尝试读剪贴板：读成功就直接填入，
    // 此时 textarea 未被聚焦，iOS 不会弹出系统粘贴浮层（浮层完全消除）。
    // 仅当读剪贴板失败/不支持/为空 时，才聚焦 textarea 让用户手动粘贴（浮层作为降级）。
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setPasteValue(text.trim());
          return; // 已成功填入，不聚焦 → 不弹系统浮层
        }
      } catch {
        // 读剪贴板失败（无权限/被拒）→ 降级为手动粘贴
      }
    }
    // 降级：聚焦 textarea，让用户手动粘贴（此时 iOS 弹系统浮层是预期的）
    requestAnimationFrame(() => pasteInputRef.current?.focus());
  }, [parseMusicShareBusy]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData('text/plain');
      if (text) {
        e.preventDefault();
        setPasteValue(text);
      }
    },
    [],
  );

  const submitPaste = useCallback(() => {
    const text = pasteValue.trim();
    if (!text || !onParseMusicShareText) return;
    // 失焦 textarea，避免点击「解析」后 iOS 因 textarea 仍聚焦而弹出系统「粘贴」浮层。
    pasteInputRef.current?.blur();
    onParseMusicShareText(text);
  }, [pasteValue, onParseMusicShareText]);

  const resetPaste = useCallback(() => {
    setPasteActive(false);
    setPasteValue('');
  }, []);

  const handlePasteBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (pasteActiveRef.current) {
        resetPaste();
      }
    });
  }, [resetPaste]);

  const handlePasteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resetPaste();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitPaste();
      }
    },
    [resetPaste, submitPaste],
  );

  // parseMusicShareBusy 结束后自动关闭输入框
  const prevParseBusyRef = useRef(false);
  useEffect(() => {
    if (prevParseBusyRef.current && !parseMusicShareBusy && pasteActiveRef.current) {
      resetPaste();
    }
    prevParseBusyRef.current = parseMusicShareBusy;
  }, [parseMusicShareBusy, resetPaste]);

  // textarea 自动调整高度（单行时保持固定高度，避免点击后外框变高）
  const autoResizeTextarea = useCallback(() => {
    const ta = pasteInputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const next = Math.max(ta.scrollHeight, 30);
    ta.style.height = `${Math.min(next, 120)}px`;
  }, []);

  useEffect(() => {
    if (!pasteActive) return;
    const ta = pasteInputRef.current;
    if (!ta) return;
    autoResizeTextarea();
  }, [pasteActive, pasteValue, autoResizeTextarea]);

  useEffect(() => {
    if (initialTitle) setSongTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialArtist) setArtist(initialArtist);
  }, [initialArtist]);

  useEffect(() => {
    onFormMetaChange?.({ title: songTitle, artist });
  }, [songTitle, artist, onFormMetaChange]);

  const buildPrompt = useCallback(
    (modelHint?: EncoderPromptOptions['modelHint'], retry = false) => {
      const title = songTitle.trim();
      const promptArtist = artist.trim() || '佚名';

      return buildLyricsStep1Prompt({
        artist: promptArtist,
        title,
        language,
        matrix,
        ocrDetectedLanguage,
        ocrContext: ocrContext
          ? {
              songTitle: ocrContext.songTitle,
              artist: ocrContext.artist,
              album: ocrContext.album,
              production: ocrContext.production,
              firstLyricLine: ocrContext.firstLyricLine,
              rawTexts: ocrContext.rawTexts,
              detectedLanguage: ocrDetectedLanguage,
            }
          : undefined,
        modelHint,
        retry,
      });
    },
    [songTitle, artist, language, matrix, ocrDetectedLanguage, ocrContext],
  );

  const writePromptToClipboard = useCallback(
    (prompt: string) =>
      postClipboardWrite
        ? postClipboardWrite(prompt).catch(() => navigator.clipboard.writeText(prompt))
        : navigator.clipboard.writeText(prompt),
    [],
  );

  useEffect(() => {
    if (!externalPrompt?.text) return;
    let cancelled = false;
    void writePromptToClipboard(externalPrompt.text)
      .then(() => {
        if (cancelled) return;
        setCopiedPrompt(externalPrompt.text);
        setPromptLocked(true);
        setActionSheetVisible(true);
        onExternalPromptHandled?.();
      })
      .catch(() => {
        if (!cancelled) onExternalPromptHandled?.();
      });
    return () => {
      cancelled = true;
    };
  }, [externalPrompt?.token, externalPrompt?.text, writePromptToClipboard, onExternalPromptHandled]);

  const handleCopyPrompt = useCallback(() => {
    if (!songTitle.trim()) return;

    const prompt = buildPrompt();

    writePromptToClipboard(prompt)
      .then(() => {
        setCopiedPrompt(prompt);
        setPromptLocked(false);
        setActionSheetVisible(true);
        showAppToast(L('✓ 歌词口令已复制（第一步：仅完整歌词）', '✓ Lyrics prompt copied (Step 1: full lyrics only)'));
      })
      .catch(() => {
        showAppToast(L('⚠ 复制失败，请检查浏览器权限后重试', '⚠ Copy failed. Please check browser permissions and retry.'));
      });
  }, [songTitle, buildPrompt, writePromptToClipboard, showAppToast]);

  const handleOpenAiApp = useCallback(
    async (app: AiAppInfo) => {
      const prompt = promptLocked
        ? copiedPrompt
        : buildPrompt(resolveEncoderModelHint(app.id));
      try {
        await writePromptToClipboard(prompt);
        setCopiedPrompt(prompt);
        await openAiApp(app);
        setActionSheetVisible(false);
      } catch {
        // 静默失败
      }
    },
    [buildPrompt, writePromptToClipboard, copiedPrompt, promptLocked],
  );

  const promptGenerated = copiedPrompt.length > 0;

  return (
    <div className="html-paste ext-pipeline">
      {/* Step 1 · 输入歌曲 */}
      <section className="ext-pipeline__step ext-pipeline__step--input">
        <div className="ext-pipeline__step-head">
          <span className="ext-pipeline__step-badge">1</span>
          <span className="ext-pipeline__step-title">{L('输入歌曲', 'Input song')}</span>
        </div>
        <div className="ext-pipeline__head">
          {/* 三栏横排：TITLE / ARTIST / LANG（Figma 复刻） */}
          <div className="ext-pipeline__fields-row">
            <label className="ext-pipeline__field ext-pipeline__field--title">
              <span className="ext-pipeline__label">{L('歌名', 'TITLE')}</span>
              <input
                type="text"
                className="ext-pipeline__input"
                id="title-input"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder={L('歌曲名称', 'Song Title')}
                required
                aria-required="true"
              />
            </label>

            <label className="ext-pipeline__field ext-pipeline__field--artist">
              <span className="ext-pipeline__label">{L('歌手', 'ARTIST')}</span>
              <input
                type="text"
                className="ext-pipeline__input"
                id="artist-input"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder={L('歌手信息', 'Artist')}
              />
            </label>

            {onLanguageChange && (
              <div className="ext-pipeline__field ext-pipeline__field--lang">
                <div className="ext-pipeline__lang-header">
                  <span className="ext-pipeline__label">{L('语言', 'LANG')}</span>
                  <button
                    type="button"
                    className={`ext-pipeline__lang-help${langHelpVisible ? ' is-active' : ''}`}
                    aria-label={L('语言说明', 'Language help')}
                    onClick={() => setLangHelpVisible((v) => !v)}
                  >
                    ?
                  </button>
                </div>
                {langHelpVisible && (
                  <p className="ext-pipeline__lang-hint">
                    {L(
                      '选择正确的语言类型增加 AI 搜索的准确性',
                      'Choosing the correct language improves the accuracy of AI lookup.',
                    )}
                  </p>
                )}
                <select
                  className="ext-pipeline__select"
                  value={language ?? matrix.activeTarget}
                  onChange={(e) => onLanguageChange(e.target.value as LyricsLanguage)}
                >
                  <option value="jp">日本語</option>
                  <option value="ko">한국어</option>
                  <option value="en">ENG</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            )}
          </div>

          {/* 链接粘贴输入框 */}
          {onParseMusicShareText ? (
              <div className={`ext-pipeline__share-fill ${pasteActive ? 'is-active' : ''}`}>
                {pasteActive ? (
                  <div
                    className="ext-pipeline__share-fill-field"
                    onClick={async () => {
                      // 用户手势内直接读剪贴板填入，避免 iOS 弹出系统粘贴菜单
                      if (parseMusicShareBusy) return;
                      let text = '';
                      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
                        try { text = await navigator.clipboard.readText(); } catch { text = ''; }
                      }
                      if (text && text.trim()) {
                        setPasteValue(text.trim());
                      } else {
                        // 读失败时才聚焦 textarea 让用户手动粘贴
                        pasteInputRef.current?.focus();
                      }
                    }}
                  >
                    <textarea
                      ref={pasteInputRef}
                      className="ext-pipeline__share-fill-input"
                      placeholder={L(
                        '粘贴分享链接，自动解析标题和歌手',
                        "Paste a share link — title & artist will be filled in automatically.",
                      )}
                      rows={1}
                      value={pasteValue}
                      onChange={(e) => setPasteValue(e.target.value)}
                      onPaste={handlePaste}
                      onBlur={handlePasteBlur}
                      onKeyDown={handlePasteKeyDown}
                      disabled={parseMusicShareBusy}
                    />
                    {pasteValue.trim() && !parseMusicShareBusy ? (
                      <button
                        type="button"
                        className="ext-pipeline__share-fill-submit"
                        onClick={submitPaste}
                        onPointerDown={(e) => e.preventDefault()}
                        title={L('解析歌名与歌手', 'Auto-fill Title & Artist')}
                      >
                        {L('解析', 'Analyze')}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ext-pipeline__share-fill-btn"
                    onClick={handlePasteAreaClick}
                    title={L('点击后粘贴 QQ / 网易云分享链接，自动解析歌名与歌手', 'Tap to paste a QQ/NetEase share link — title and artist will be parsed automatically.')}
                  >
                    <span className="ext-pipeline__share-fill-btn-icon">🔗</span>
                    <span className="ext-pipeline__share-fill-btn-text">
                      {parseMusicShareBusy
                        ? L('识别中…', 'Recognizing…')
                        : L('粘贴分享链接，自动解析标题和歌手', 'Paste a share link — auto-parse title & artist')}
                    </span>
                    <span className="ext-pipeline__share-fill-btn-badge">{L('QQ音乐 / 网易云', 'QQ Music / NetEase')}</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
      </section>

      {/* Step 2 · 生成口令 → 粘贴 AI 结果 */}
      <section className="ext-pipeline__step ext-pipeline__step--generate">
        <div className="ext-pipeline__step-head">
          <span className="ext-pipeline__step-badge">2</span>
          <span className="ext-pipeline__step-title">
            {L('生成 Prompt → AI → 粘回', 'Generate Prompt → AI → Paste back')}
          </span>
          <button
            type="button"
            className="ext-pipeline__guide-toggle"
            onClick={() => setGuideExpanded((v) => !v)}
            aria-label={guideExpanded ? L('收起说明', 'Collapse guide') : L('展开说明', 'Expand guide')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: guideExpanded ? '' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>
              <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* A / B / C 三步引导：可展开/收起 */}
        {guideExpanded && (
        <ol className="ext-pipeline__guide">
          <li className="ext-pipeline__guide-item">
            <span className="ext-pipeline__guide-tag">A</span>
            <span className="ext-pipeline__guide-text">
              {L('点左侧「一键生成口令」，Prompt 已复制到剪贴板', 'Tap “Generate Prompt” (left) — the prompt is copied to your clipboard')}
            </span>
          </li>
          <li className="ext-pipeline__guide-item">
            <span className="ext-pipeline__guide-tag">B</span>
            <span className="ext-pipeline__guide-text">
              {L('打开任意 AI（豆包 / ChatGPT / DeepSeek 等）粘贴并发送', 'Open any AI (Doubao / ChatGPT / DeepSeek …) and paste & send it')}
            </span>
          </li>
          <li className="ext-pipeline__guide-item">
            <span className="ext-pipeline__guide-tag">C</span>
            <span className="ext-pipeline__guide-text">
              {L('把 AI 返回的内容粘回右侧，自动排版', 'Paste the AI response into the right box — auto-layout')}
            </span>
          </li>
        </ol>
        )}

        <div className="ext-pipeline__prompt-row">
          <div className="ext-pipeline__action-row">
            <button
              type="button"
              className={`ext-pipeline__action-btn ext-pipeline__gen-btn ${
                !canGenerate
                  ? 'btn-tonal is-dormant'
                  : promptGenerated
                    ? 'btn-success'
                    : genPrimary
                      ? 'btn-filled'
                      : 'btn-tonal'
              }`}
              onClick={handleCopyPrompt}
              disabled={!canGenerate}
            >
              {promptGenerated ? (
                <span>{L('✓ 口令已复制', '✓ Prompt copied')}</span>
              ) : (
                <span>{L('一键生成口令', 'Generate AI Prompt')}</span>
              )}
            </button>
            {onActivatePasteLayout && (
              <button
                type="button"
                className={`ext-pipeline__action-btn ext-pipeline__paste-btn ${
                  pastePrimary ? 'btn-filled' : 'btn-tonal'
                }`}
                title={L('读取剪贴板中的结构化歌词并排版（不是分享链接）', 'Read structured lyrics from the clipboard and format them (not share links).')}
                onClick={() =>
                  onActivatePasteLayout({
                    title: songTitle.trim(),
                    artist: artist.trim(),
                  })
                }
              >
                {L('生成学习材料 →', 'Generate Study Material →')}
              </button>
            )}
          </div>

          {/* 生成口令后的反馈闭环：常驻直到用户进入下一步 */}
          {promptGenerated && (
            <p className="ext-pipeline__copied-feedback">
              <span className="ext-pipeline__copied-check">✓</span>
              {L(
                '口令已复制 → 请打开任意 AI 粘贴发送，再把结果粘回右侧',
                'Prompt copied → open any AI, paste & send, then paste the result back on the right.',
              )}
            </p>
          )}
        </div>
      </section>

      <AiAppActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        copiedText={copiedPrompt}
        onOpenApp={handleOpenAiApp}
      />
    </div>
  );
}
