import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildLyricsStep1Prompt } from '../codec/prompt/buildLyricsStep1Prompt';
import type { EncoderPromptOptions } from '../codec/prompt/encoderCommon';
import { resolveEncoderModelHint } from '../codec/prompt/buildEncoderPrompt';
import type { LyricsLanguage, PedagogicalLevel } from '../services/appSettings';
import type { LanguageMatrixContext } from '../services/languageMatrix/types';
import { postClipboardWrite, openAiApp } from '../utils/nativeBridge';
import type { AiAppInfo } from '../bridge/deepLinkPlugin';
import { useAppToast } from '../context/AppToastContext';
import ArrowRightIcon from './icons/ArrowRightIcon';
import AiAppActionSheet from './AiAppActionSheet';
import LanguageWheel from './LanguageWheel';
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
  /** Step1 始终仅歌词；保留 prop 以免调用方断裂。词解由确认页勾选驱动。 */
  includeVocabAndGrammar: boolean;
  pedagogicalLevel: PedagogicalLevel;
  language?: LyricsLanguage;
  wheelLanguages?: LyricsLanguage[];
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
  /** 剪贴板含可排版流（完整或学习材料） */
  pasteLayoutReady?: boolean;
  /** 流内 H 歌名；用于表单偏离时把主暗示切到「生成口令」 */
  clipboardStreamTitle?: string;
  onActivatePasteLayout?: (formMeta: { title?: string; artist?: string }) => void;
  onFormMetaChange?: (meta: { title: string; artist: string }) => void;
  /** 确认页触发的学习材料 / 再试口令，写入剪贴板并弹出 AI 选择 */
  externalPrompt?: ExternalPromptRequest | null;
  onExternalPromptHandled?: () => void;
};

export default function HtmlPasteInput({
  includeVocabAndGrammar: _includeVocabAndGrammar,
  pedagogicalLevel: _pedagogicalLevel,
  language,
  wheelLanguages,
  matrix,
  onLanguageChange,
  initialTitle,
  initialArtist,
  ocrDetectedLanguage,
  ocrContext,
  pasteLayoutReady = false,
  clipboardStreamTitle = '',
  onActivatePasteLayout,
  onFormMetaChange,
  externalPrompt,
  onExternalPromptHandled,
}: Props) {
  const showAppToast = useAppToast();
  const [songTitle, setSongTitle] = useState(initialTitle || '');
  const [artist, setArtist] = useState(initialArtist || '');
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState('');
  /** 外部注入口令（学习材料 / 再试）时锁定，打开 AI 不再重建 Step1 */
  const [promptLocked, setPromptLocked] = useState(false);

  /**
   * 主次暗示（互不 disabled）：
   * - 剪贴板可排版且表单歌名未偏离流内歌名 → 粘贴为主
   * - 否则有标题 → 生成口令为主
   * 仅「缺标题」禁用口令；仅「剪贴板无可排版流」禁用粘贴。
   */
  const { pastePrimary, generatePrimary, canGenerate } = useMemo(() => {
    const formTitle = songTitle.trim();
    const canGen = formTitle.length > 0;
    const streamKey = normalizeTitleKey(clipboardStreamTitle);
    const formKey = normalizeTitleKey(formTitle);
    const diverged =
      pasteLayoutReady &&
      streamKey.length > 0 &&
      formKey.length > 0 &&
      streamKey !== formKey;
    const pasteIsPrimary = pasteLayoutReady && !diverged;
    return {
      pastePrimary: pasteIsPrimary,
      generatePrimary: canGen && !pasteIsPrimary,
      canGenerate: canGen,
    };
  }, [songTitle, pasteLayoutReady, clipboardStreamTitle]);

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
        showAppToast('✓ 歌词口令已复制（第一步：仅完整歌词）');
      })
      .catch(() => {
        // 静默失败
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
        await openAiApp(app.scheme);
        setActionSheetVisible(false);
      } catch {
        // 静默失败
      }
    },
    [buildPrompt, writePromptToClipboard, copiedPrompt, promptLocked],
  );

  return (
    <div className="html-paste ext-pipeline">
      <div className="ext-pipeline__head">
        <div className="ext-pipeline__meta">
          <label className="ext-pipeline__field ext-pipeline__field--title">
            <span className="ext-pipeline__label">TITLE</span>
            <input
              type="text"
              className="ext-pipeline__input"
              id="title-input"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="歌曲名称"
              required
              aria-required="true"
            />
          </label>
          <label className="ext-pipeline__field ext-pipeline__field--artist">
            <span className="ext-pipeline__label">ARTIST</span>
            <input
              type="text"
              className="ext-pipeline__input"
              id="artist-input"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="歌手信息"
            />
          </label>
        </div>

        {onLanguageChange && (
          <LanguageWheel
            value={language ?? matrix.activeTarget}
            languages={wheelLanguages}
            onChange={onLanguageChange}
          />
        )}

        <div className="ext-pipeline__prompt-row">
          <div className="ext-pipeline__action-row">
            {onActivatePasteLayout && (
              <button
                type="button"
                className={`ext-pipeline__action-btn ext-pipeline__paste-btn ${
                  pastePrimary ? 'btn-filled' : 'btn-tonal is-dormant'
                }`}
                disabled={!pasteLayoutReady}
                onClick={() =>
                  onActivatePasteLayout({
                    title: songTitle.trim(),
                    artist: artist.trim(),
                  })
                }
              >
                粘贴并排版
              </button>
            )}
            <button
              type="button"
              className={`ext-pipeline__action-btn ext-pipeline__gen-btn ${
                generatePrimary ? 'btn-filled' : 'btn-tonal is-dormant'
              }`}
              onClick={handleCopyPrompt}
              disabled={!canGenerate}
            >
              {generatePrimary && <ArrowRightIcon size={16} />}
              <span>一键生成口令</span>
            </button>
          </div>
        </div>
      </div>

      <AiAppActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        copiedText={copiedPrompt}
        onOpenApp={handleOpenAiApp}
      />
    </div>
  );
}
