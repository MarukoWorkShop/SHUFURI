import { useCallback, useEffect, useState } from 'react';
import { buildEncoderPrompt, resolveEncoderModelHint } from '../codec/prompt/buildEncoderPrompt';
import type { EncoderPromptOptions } from '../codec/prompt/buildEncoderPrompt';
import type { LyricsLanguage } from '../services/appSettings';
import type { LanguageMatrixContext } from '../services/languageMatrix/types';
import { postClipboardWrite, openAiApp } from '../utils/nativeBridge';
import type { AiAppInfo } from '../bridge/deepLinkPlugin';
import { useAppToast } from '../context/AppToastContext';
import ArrowRightIcon from './icons/ArrowRightIcon';
import AiAppActionSheet from './AiAppActionSheet';
import LanguageWheel from './LanguageWheel';

type Props = {
  includeVocabAndGrammar: boolean;
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
  pasteLayoutReady?: boolean;
  onActivatePasteLayout?: (formMeta: { title?: string; artist?: string }) => void;
  onFormMetaChange?: (meta: { title: string; artist: string }) => void;
};

export default function HtmlPasteInput({
  includeVocabAndGrammar,
  language,
  wheelLanguages,
  matrix,
  onLanguageChange,
  initialTitle,
  initialArtist,
  ocrDetectedLanguage,
  ocrContext,
  pasteLayoutReady = false,
  onActivatePasteLayout,
  onFormMetaChange,
}: Props) {
  const showAppToast = useAppToast();
  const [songTitle, setSongTitle] = useState(initialTitle || '');
  const [artist, setArtist] = useState(initialArtist || '');
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState('');

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
    (modelHint?: EncoderPromptOptions['modelHint']) => {
      const title = songTitle.trim();
      const promptArtist = artist.trim() || '佚名';

      const effectiveTarget: LyricsLanguage =
        language ??
        (ocrDetectedLanguage === 'ko'
          ? 'ko'
          : ocrDetectedLanguage === 'jp'
            ? 'jp'
            : ocrDetectedLanguage === 'zh'
              ? 'zh'
              : matrix.activeTarget);

      return buildEncoderPrompt(promptArtist, title, {
        includeVocabAndGrammar,
        matrix: { ...matrix, activeTarget: effectiveTarget },
        modelHint,
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
          : ocrDetectedLanguage
            ? { detectedLanguage: ocrDetectedLanguage }
            : undefined,
      });
    },
    [
      songTitle,
      artist,
      includeVocabAndGrammar,
      language,
      matrix,
      ocrDetectedLanguage,
      ocrContext,
    ],
  );

  const writePromptToClipboard = useCallback(
    (prompt: string) =>
      postClipboardWrite
        ? postClipboardWrite(prompt).catch(() => navigator.clipboard.writeText(prompt))
        : navigator.clipboard.writeText(prompt),
    [],
  );

  const handleCopyPrompt = useCallback(() => {
    if (!songTitle.trim()) return;

    const prompt = buildPrompt();

    writePromptToClipboard(prompt)
      .then(() => {
        setCopiedPrompt(prompt);
        setActionSheetVisible(true);
        showAppToast('✓ 指令已复制到剪贴板');
      })
      .catch(() => {
        // 静默失败
      });
  }, [songTitle, buildPrompt, writePromptToClipboard, showAppToast]);

  const handleOpenAiApp = useCallback(
    async (app: AiAppInfo) => {
      const prompt = buildPrompt(resolveEncoderModelHint(app.id));
      try {
        await writePromptToClipboard(prompt);
        setCopiedPrompt(prompt);
        await openAiApp(app.scheme);
        setActionSheetVisible(false);
      } catch {
        // 静默失败
      }
    },
    [buildPrompt, writePromptToClipboard],
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
                className={`btn-tonal ext-pipeline__action-btn ext-pipeline__paste-btn${!pasteLayoutReady ? ' is-dormant' : ''}`}
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
              className="btn-filled ext-pipeline__action-btn ext-pipeline__gen-btn"
              onClick={handleCopyPrompt}
              disabled={!songTitle.trim()}
            >
              <ArrowRightIcon size={16} />
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
