import { useCallback, useEffect, useState } from 'react';
import { buildExternalAiPrompt } from '../services/externalPromptTemplate';
import { postClipboardWrite } from '../utils/nativeBridge';
import { useAppToast } from '../context/AppToastContext';
import ArrowRightIcon from './icons/ArrowRightIcon';
import AiAppActionSheet from './AiAppActionSheet';
import LanguageWheel from './LanguageWheel';

type Props = {
  /** 设置中的「附词解与语法品读」总开关 */
  includeVocabAndGrammar: boolean;
  /** 歌词语言模式：auto（自动，默认）/ jp（日语）/ ko（韩语）/ en（英语） */
  language?: 'auto' | 'jp' | 'ko' | 'en';
  /** 语言切换回调 */
  onLanguageChange?: (lang: 'auto' | 'jp' | 'ko' | 'en') => void;
  /** 截屏 OCR 预填歌名（可选） */
  initialTitle?: string;
  /** 截屏 OCR 预填歌手（可选） */
  initialArtist?: string;
  /** 截屏 OCR 检测到的语言，自动路由 JP/KO 管线 */
  ocrDetectedLanguage?: import('../services/ocrTypes').OcrDetectedLanguage;
  /** 截屏 OCR 完整上下文（专辑/制作/原始文本），注入搜索 Prompt 以提升准确率 */
  ocrContext?: {
    songTitle?: string;
    artist?: string;
    album?: string;
    production?: string;
    firstLyricLine?: string;
    rawTexts?: string[];
  };
  /** 剪贴板含结构化歌词时可点 */
  pasteLayoutReady?: boolean;
  /** 手动激活粘贴并排版（弹出确认卡片） */
  onActivatePasteLayout?: (formMeta: { title?: string; artist?: string }) => void;
  /** 首页表单歌名/歌手变化（供剪贴板弹窗兜底） */
  onFormMetaChange?: (meta: { title: string; artist: string }) => void;
};

export default function HtmlPasteInput({
  includeVocabAndGrammar,
  language,
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

  // 同步外部 props 到内部 state（QQ音乐链接检测触发后 initialTitle/initialArtist 更新）
  useEffect(() => {
    if (initialTitle) setSongTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialArtist) setArtist(initialArtist);
  }, [initialArtist]);

  useEffect(() => {
    onFormMetaChange?.({ title: songTitle, artist });
  }, [songTitle, artist, onFormMetaChange]);

  // ---- 一键生成口令：复制 Prompt 到剪贴板 + 弹出 AI App 选择 ----
  const handleCopyPrompt = useCallback(() => {
    const title = songTitle.trim();
    if (!title) return;

    const promptArtist = artist.trim() || '佚名';

    // 波轮为 AUTO 时，才用 OCR 检测语言辅助 Prompt；用户手动选 JAP/KOR/ENG 时以波轮为准
    const effectiveLanguage =
      language === 'auto' || !language
        ? (ocrDetectedLanguage === 'ko'
          ? 'ko'
          : ocrDetectedLanguage === 'jp'
            ? 'jp'
            : 'auto')
        : language;

    // 注入完整 OCR 上下文（歌名/歌手/专辑/制作/原始文本），显著提升 AI 搜索准确率
    const prompt = buildExternalAiPrompt(promptArtist, title, {
      includeVocabAndGrammar,
      language: effectiveLanguage,
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

    // 使用 Capacitor 原生剪贴板（优先）或 Web API
    const writeClipboard = postClipboardWrite
      ? postClipboardWrite(prompt).catch(() => navigator.clipboard.writeText(prompt))
      : navigator.clipboard.writeText(prompt);

    writeClipboard
      .then(() => {
        setCopiedPrompt(prompt);
        setActionSheetVisible(true);
        showAppToast('✓ 指令已复制到剪贴板');
      })
      .catch(() => {
        // 静默失败，按钮本身已有视觉反馈
      });
  }, [songTitle, artist, includeVocabAndGrammar, language, ocrDetectedLanguage, ocrContext, showAppToast]);

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
              placeholder="秋樱"
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
              placeholder="山口百惠"
            />
          </label>
        </div>

        {onLanguageChange && (
          <LanguageWheel
            value={language ?? 'auto'}
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
      />
    </div>
  );
}
