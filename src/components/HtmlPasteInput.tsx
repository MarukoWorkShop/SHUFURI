import { useCallback, useEffect, useState } from 'react';
import { buildExternalAiPrompt } from '../services/externalPromptTemplate';
import { postClipboardWrite } from '../utils/nativeBridge';
import ArrowRightIcon from './icons/ArrowRightIcon';
import AiAppActionSheet from './AiAppActionSheet';

type Props = {
  /** 设置中的「附词解与语法品读」总开关 */
  includeVocabAndGrammar: boolean;
  /** 歌词语言模式：jp（日语，默认）或 ko（韩语） */
  language?: 'jp' | 'ko';
  /** 语言切换回调 */
  onLanguageChange?: (lang: 'jp' | 'ko') => void;
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
};

export default function HtmlPasteInput({ includeVocabAndGrammar, language, onLanguageChange, initialTitle, initialArtist, ocrDetectedLanguage, ocrContext }: Props) {
  const [songTitle, setSongTitle] = useState(initialTitle || '');
  const [artist, setArtist] = useState(initialArtist || '');
  const [copyHint, setCopyHint] = useState('');
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState('');

  // 同步外部 props 到内部 state（QQ音乐链接检测触发后 initialTitle/initialArtist 更新）
  useEffect(() => {
    if (initialTitle) setSongTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialArtist) setArtist(initialArtist);
  }, [initialArtist]);

  // ---- 一键生成口令：复制 Prompt 到剪贴板 + 弹出 AI App 选择 ----
  const handleCopyPrompt = useCallback(() => {
    const title = songTitle.trim();
    if (!title) return;

    const promptArtist = artist.trim() || '佚名';

    // OCR 检测到韩文 → 自动路由到 KO 管线
    const effectiveLanguage = ocrDetectedLanguage === 'ko'
      ? 'ko'
      : ocrDetectedLanguage === 'jp'
        ? 'jp'
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
        setCopyHint('✓ 指令已复制到剪贴板');
        setTimeout(() => setCopyHint(''), 3000);
      })
      .catch(() => {
        // 静默失败，按钮本身已有视觉反馈
      });
  }, [songTitle, artist, includeVocabAndGrammar, language, ocrDetectedLanguage, ocrContext]);

  return (
    <div className="html-paste ext-pipeline">
      <div className="ext-pipeline__head">
        <div className="ext-pipeline__meta">
          <label className="ext-pipeline__field ext-pipeline__field--title">
            <span className="ext-pipeline__label">
              歌名
              <span className="ext-pipeline__label-meta ext-pipeline__label-meta--required">必填</span>
            </span>
            <input
              type="text"
              className="ext-pipeline__input"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              required
              aria-required="true"
            />
          </label>
          <label className="ext-pipeline__field ext-pipeline__field--artist">
            <span className="ext-pipeline__label">
              歌手
              <span className="ext-pipeline__label-meta">选填</span>
            </span>
            <input
              type="text"
              className="ext-pipeline__input"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </label>
        </div>

        {onLanguageChange && (
          <div className="ext-pipeline__lang-row">
            <div className="ext-pipeline__lang-icons">
              <button
                type="button"
                className={`ext-pipeline__lang-icon${language === 'jp' ? ' is-active' : ''}${ocrDetectedLanguage === 'jp' ? ' is-detected' : ''}`}
                onClick={() => onLanguageChange('jp')}
                title="日文模式"
                aria-label="切换日文"
              >
                <span className="ext-pipeline__lang-flag">🇯🇵</span>
                {ocrDetectedLanguage === 'jp' && <span className="ext-pipeline__lang-auto">auto</span>}
              </button>
              <button
                type="button"
                className={`ext-pipeline__lang-icon${language === 'ko' ? ' is-active' : ''}${ocrDetectedLanguage === 'ko' ? ' is-detected' : ''}`}
                onClick={() => onLanguageChange('ko')}
                title="韩文模式"
                aria-label="切换韩文"
              >
                <span className="ext-pipeline__lang-flag">🇰🇷</span>
                {ocrDetectedLanguage === 'ko' && <span className="ext-pipeline__lang-auto">auto</span>}
              </button>
            </div>
            {ocrDetectedLanguage && (
              <span className="ext-pipeline__lang-detected">
                {ocrDetectedLanguage === 'jp' ? '检测到日文' :
                 ocrDetectedLanguage === 'ko' ? '检测到韩文' :
                 '已检测'}
              </span>
            )}
          </div>
        )}

        <div className="ext-pipeline__prompt-row">
          {copyHint && (
            <span className="ext-pipeline__hint">{copyHint}</span>
          )}
          <button
            type="button"
            className="btn-filled ext-pipeline__gen-btn"
            onClick={handleCopyPrompt}
            disabled={!songTitle.trim()}
          >
            <ArrowRightIcon size={16} />
            <span>一键生成口令</span>
          </button>
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
