import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildLyricsStep1Prompt } from '../codec/prompt/buildLyricsStep1Prompt';
import type { EncoderPromptOptions } from '../codec/prompt/encoderCommon';
import type { LyricsLanguage, PedagogicalLevel } from '../services/appSettings';
import type { LanguageMatrixContext } from '../services/languageMatrix/types';
import { postClipboardWrite } from '../utils/nativeBridge';
import { useAppToast } from '../context/AppToastContext';
import { L } from '../utils/i18n';
import type { ExternalPromptRequest } from '../hooks/useStructuredLyricsClipboardCard';
import { MorphingWidget } from './MorphingWidget';
import { Music, X } from 'lucide-react';

/** 语言代码 → 展示文案（与 select option 保持一致，随界面语言仍是单一语言显示） */
const LANG_LABELS: Record<string, string> = {
  jp: '日本語',
  ko: '한국어',
  en: 'ENG',
  zh: '中文',
};

/** 音乐分享链接域名白名单（剪贴板自动读取时过滤非音乐链接） */
const MUSIC_LINK_PATTERN =
  /https?:\/\/(?:[a-z]\d\.)?y\.qq\.com|163cn\.tv|music\.163\.com|kugou\.com|kuwo\.cn|migu\.cn|music\.apple\.com/i;

/** AI 口令指纹：复制「去生成AI口令」后，剪贴板里是一段带固定头的指令文本，
 *  不应被当作音乐分享链接填入粘贴框。命中则静默忽略（方案 2：代码杜绝）。 */
const AI_PROMPT_RE = /^\s*\[Role:\s*Sequence_Encoder\]/i;

/** 剪贴板内容是否应被静默忽略（既非音乐链接也非 AI 口令之外的有效输入） */
function isSilentIgnoreText(text: string): boolean {
  const t = text.trim();
  if (!t) return true; // 空串忽略
  if (AI_PROMPT_RE.test(t)) return true; // AI 口令指纹命中
  return false; // 其余（含音乐链接）由调用方按各自规则处理
}

/** 歌名比对用：去空白、小写，忽略标点差异 */

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
  /** 外部注入口令（学习材料 / 再试）时锁定，打开 AI 不再重建口令 */
  const [, setPromptLocked] = useState(false);
  /** 复制口令后，上部输入区折叠为极简信息条 */
  const [collapsed, setCollapsed] = useState(false);
  /** 重新编辑时递增，强制重挂 MorphingWidget 回到模式 A */
  const [widgetResetKey, setWidgetResetKey] = useState(0);


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
  const { canGenerate } = useMemo(() => {
    return {
      canGenerate: songTitle.trim().length > 0,
    };
  }, [songTitle]);

  /** 折叠条展示用的语言文案 */
  const langLabel = LANG_LABELS[language ?? matrix.activeTarget] ?? '';


  const pasteInputRef = useRef<HTMLInputElement>(null);
  const pasteActiveRef = useRef(false);
  const pasteValueRef = useRef('');
  const pendingFocusPasteRef = useRef(false);
  pasteActiveRef.current = pasteActive;
  pasteValueRef.current = pasteValue;

  /** 是否像可解析的音乐分享文案（含 QQ/网易云域名或分享尾巴） */
  const isLikelyMusicShare = useCallback((raw: string): boolean => {
    const t = raw.trim();
    if (!t || AI_PROMPT_RE.test(t)) return false;
    if (MUSIC_LINK_PATTERN.test(t)) return true;
    if (/https?:\/\//i.test(t) && /@QQ音乐|网易云|QQ音乐|Kugou|酷狗|酷我|咪咕|Apple Music/i.test(t)) {
      return true;
    }
    return false;
  }, []);

  const ingestShareText = useCallback(
    (raw: string, autoSubmit: boolean): boolean => {
      const trimmed = raw.trim();
      if (!isLikelyMusicShare(trimmed)) return false;
      setPasteValue(trimmed);
      if (autoSubmit && onParseMusicShareText) {
        onParseMusicShareText(trimmed);
      }
      return true;
    },
    [isLikelyMusicShare, onParseMusicShareText],
  );

  /** 展开后聚焦输入框；inputMode=none 多数机型不弹键盘，仍可长按系统粘贴 */
  const focusPasteFieldWithoutKeyboard = useCallback(() => {
    pendingFocusPasteRef.current = true;
    queueMicrotask(() => {
      if (!pendingFocusPasteRef.current) return;
      const el = pasteInputRef.current;
      if (!el) return; // 尚未展开挂载 → 交给下方 pasteActive effect
      el.focus({ preventScroll: true });
      pendingFocusPasteRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!pasteActive || !pendingFocusPasteRef.current) return;
    pendingFocusPasteRef.current = false;
    pasteInputRef.current?.focus({ preventScroll: true });
  }, [pasteActive]);

  const handlePasteAreaClick = useCallback(async () => {
    setPasteActive(true);
    if (parseMusicShareBusy) return;

    // 1) 用户手势内尝试读剪贴板（HTTPS + 手势时 iOS/Android 通常可用）
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          if (isSilentIgnoreText(text)) {
            // AI 口令等：静默忽略，不挡后续手势
            return;
          }
          if (ingestShareText(text, true)) return;
          showAppToast(
            L(
              '剪贴板不是音乐分享链接，请先在 QQ/网易云复制分享文案',
              'Clipboard is not a music share link. Copy a share text from QQ/NetEase first.',
            ),
          );
          focusPasteFieldWithoutKeyboard();
          return;
        }
      } catch {
        /* 权限不足 → 降级长按粘贴 */
      }
    }

    // 2) 读不到：展开后引导长按粘贴（不弹全键盘）
    showAppToast(
      L('请长按输入框，选择「粘贴」', 'Long-press the field and choose Paste.'),
    );
    focusPasteFieldWithoutKeyboard();
  }, [
    parseMusicShareBusy,
    ingestShareText,
    showAppToast,
    focusPasteFieldWithoutKeyboard,
  ]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      const trimmed = text.trim();
      if (AI_PROMPT_RE.test(trimmed)) {
        e.preventDefault();
        return;
      }
      if (!isLikelyMusicShare(trimmed)) {
        e.preventDefault();
        showAppToast(
          L(
            '请粘贴 QQ/网易云等音乐 App 的分享链接',
            'Please paste a share link from QQ Music / NetEase / similar apps.',
          ),
        );
        return;
      }
      e.preventDefault();
      setPasteValue(trimmed);
      if (onParseMusicShareText) {
        onParseMusicShareText(trimmed);
      }
    },
    [isLikelyMusicShare, onParseMusicShareText, showAppToast],
  );

  const submitPaste = useCallback(() => {
    const text = pasteValue.trim();
    if (!text || !onParseMusicShareText) return;
    pasteInputRef.current?.blur();
    onParseMusicShareText(text);
  }, [pasteValue, onParseMusicShareText]);

  const resetPaste = useCallback(() => {
    setPasteActive(false);
    setPasteValue('');
  }, []);

  const handlePasteBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const capsule = e.currentTarget.closest('.ext-pipeline__capsule');
      const next = e.relatedTarget as Node | null;
      if (capsule && next && capsule.contains(next)) return;
      // 延迟关闭：给系统「粘贴」菜单留时间，避免刚 focus 就塌缩
      window.setTimeout(() => {
        if (!pasteActiveRef.current) return;
        if (pasteValueRef.current.trim()) return;
        const active = document.activeElement;
        if (active && capsule?.contains(active)) return;
        resetPaste();
      }, 400);
    },
    [resetPaste],
  );

  const handlePasteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        setPromptLocked(true);
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
        setPromptLocked(false);
        setCollapsed(true);
      })
      .catch(() => {
        showAppToast(L('⚠ 复制失败，请检查浏览器权限后重试', '⚠ Copy failed. Please check browser permissions and retry.'));
      });
  }, [songTitle, buildPrompt, writePromptToClipboard, showAppToast]);



  return (
    <div className="html-paste ext-pipeline">
      {/* ===== 输入歌曲区域 ===== */}
      <section className="ext-pipeline__step ext-pipeline__step--input">
            <div className="ext-pipeline__step-head">
              <span className="ext-pipeline__step-badge">1</span>
              <span className="ext-pipeline__step-title">{L('帮我找歌', 'Find a song')}</span>
            </div>

            {/* 桌面端左右两栏：左侧输入区 / 右侧口令按钮；手机端上下堆叠 */}
            <div className="ext-pipeline__input-layout">
              {/* ===== 左侧：歌曲信息输入区（展开 ↔ 折叠） ===== */}
              <div className="ext-pipeline__head">
                <AnimatePresence mode="wait" initial={false}>
                  {!collapsed ? (
                    <motion.div
                      key="expanded"
                      className="ext-pipeline__input-body"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
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
                  <span className="ext-pipeline__label">{L('语言', 'Language')}</span>
                </div>
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

          {/* 分割线 + "或者" / "or" */}
          <div className="ext-pipeline__divider">
            <span className="ext-pipeline__divider-line" />
            <span className="ext-pipeline__divider-text">{L('或者', 'or')}</span>
            <span className="ext-pipeline__divider-line" />
          </div>

          {/* 链接粘贴输入框 */}
          {onParseMusicShareText ? (
              <div className={`ext-pipeline__share-fill ${pasteActive ? 'is-active' : ''}`}>
                <motion.div
                  layout
                  className="ext-pipeline__capsule"
                  transition={{ layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
                >
                  {!pasteActive ? (
                    <button
                      type="button"
                      className="ext-pipeline__capsule-collapsed"
                      onClick={handlePasteAreaClick}
                      title={L('点击后粘贴 QQ / 网易云分享链接，自动解析歌名与歌手', 'Tap to paste a QQ/NetEase share link — title and artist will be parsed automatically.')}
                    >
                      <Music size={15} strokeWidth={1.8} className="ext-pipeline__capsule-icon" />
                      <span className="ext-pipeline__capsule-label">
                        {parseMusicShareBusy
                          ? L('识别中…', 'Recognizing…')
                          : L('从音乐软件分享', 'Share from music app')}
                      </span>
                      <span className="ext-pipeline__share-fill-btn-badge">{L('QQ音乐 / 网易云', 'QQ Music / NetEase')}</span>
                    </button>
                  ) : (
                    <div className="ext-pipeline__capsule-expanded">
                      <input
                        ref={pasteInputRef}
                        className="ext-pipeline__share-fill-input"
                        placeholder={L('长按此处粘贴分享链接…', 'Long-press to paste share link…')}
                        value={pasteValue}
                        inputMode="none"
                        enterKeyHint="done"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        onChange={(e) => setPasteValue(e.target.value)}
                        onPaste={handlePaste}
                        onBlur={handlePasteBlur}
                        onKeyDown={handlePasteKeyDown}
                        disabled={parseMusicShareBusy}
                      />
                      <AnimatePresence initial={false}>
                        {pasteValue.trim() && !parseMusicShareBusy ? (
                          <>
                            <motion.button
                              key="clear"
                              type="button"
                              layout
                              initial={{ opacity: 0, scale: 0.5, width: 0, marginLeft: 0 }}
                              animate={{ opacity: 1, scale: 1, width: 28, marginLeft: 6 }}
                              exit={{ opacity: 0, scale: 0.5, width: 0, marginLeft: 0 }}
                              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                              className="ext-pipeline__share-fill-clear"
                              onClick={() => setPasteValue('')}
                              onPointerDown={(e) => e.preventDefault()}
                              title={L('清空', 'Clear')}
                              aria-label={L('清空', 'Clear')}
                            >
                              <X size={14} strokeWidth={2} />
                            </motion.button>
                            <motion.button
                              key="submit"
                              type="button"
                              layout
                              initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                              animate={{ opacity: 1, width: 'auto', marginLeft: 8 }}
                              exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                              className="ext-pipeline__share-fill-submit"
                              onClick={submitPaste}
                              onPointerDown={(e) => e.preventDefault()}
                              title={L('解析歌名与歌手', 'Auto-fill Title & Artist')}
                            >
                              {L('解析', 'Analyze')}
                            </motion.button>
                          </>
                        ) : (
                          <motion.button
                            key="cancel"
                            type="button"
                            layout
                            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                            animate={{ opacity: 1, width: 'auto', marginLeft: 8 }}
                            exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                            className="ext-pipeline__share-fill-clear"
                            onClick={resetPaste}
                            onPointerDown={(e) => e.preventDefault()}
                            title={L('取消', 'Cancel')}
                            aria-label={L('取消', 'Cancel')}
                          >
                            <X size={14} strokeWidth={2} />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              </div>
            ) : null}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="collapsed"
                      className="ext-pipeline__collapsed"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="ext-pipeline__collapsed-bar">
                        <span className="ext-pipeline__collapsed-line" />
                        <div className="ext-pipeline__collapsed-info">
                          <span className="ext-pipeline__collapsed-title">{songTitle.trim() || L('未命名歌曲', 'Untitled')}</span>
                          {artist.trim() || langLabel ? (
                            <span className="ext-pipeline__collapsed-meta">
                              {[artist.trim(), langLabel].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="ext-pipeline__collapsed-edit"
                          onClick={() => {
                            setCollapsed(false);
                            setWidgetResetKey((k) => k + 1);
                          }}
                        >
                          {L('重新编辑', 'Edit')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ===== 链接区下方：居中形变微件（复制口令 ↔ 粘贴结果）===== */}
                <div className="ext-pipeline__gen-sidebar">
                  <MorphingWidget
                    key={widgetResetKey}
                    onCopyPrompt={handleCopyPrompt}
                    onPasteResult={() =>
                      onActivatePasteLayout?.({
                        title: songTitle.trim(),
                        artist: artist.trim(),
                      })
                    }
                    disabled={!canGenerate}
                  />
                </div>
          </div>
      </div>
      </section>
    </div>
  );
}
