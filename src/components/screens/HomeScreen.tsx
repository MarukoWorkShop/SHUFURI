import type { AppSettings, LyricsLanguage } from '../../services/appSettings';
import type { LanguageMatrixContext } from '../../services/languageMatrix/types';
import type { StructuredLyricsCardFallbacks } from '../../utils/clipboardStructuredLyrics';
import { useClipboardDetection } from '../../hooks/useClipboardDetection';
import { useDesktopMusicShareDetection } from '../../hooks/useDesktopMusicShareDetection';
import { useFillMusicShareFromClipboard } from '../../hooks/useFillMusicShareFromClipboard';
import HtmlPasteInput from '../HtmlPasteInput';
import SavedLyricsLibrary from '../SavedLyricsLibrary';
import StudyCardsLibrary from '../StudyCardsLibrary';
import HomeDailyLyricQuote from '../HomeDailyLyricQuote';
import HowItWorks from '../HowItWorks';
import HomeFaqSection from '../HomeFaqSection';
import { useLayoutEffect, useState, type RefObject, type Dispatch, type SetStateAction } from 'react';
import type { SavedLyricsProject } from '../../services/savedLyricsStore';
import { hideAppBootLoader } from '../../utils/hideAppBootLoader';
import type { ExternalPromptRequest } from '../../hooks/useStructuredLyricsClipboardCard';
import type { ShareOcrData } from '../../context/HomeSessionContext';
import { shareOcrToEncoderContext } from '../../utils/shareOcrToEncoderContext';
import { useAppToast } from '../../context/AppToastContext';
import { L } from '../../utils/i18n';

type Props = {
  inputResetKey: number;
  appSettings: AppSettings;
  wheelLanguages: LyricsLanguage[];
  languageMatrixContext: LanguageMatrixContext;
  shareOcrData: ShareOcrData | null;
  pasteLayoutReady: boolean;
  clipboardStreamTitle?: string;
  libraryRefreshKey: number;
  onLanguageChange: (lang: LyricsLanguage) => void;
  onActivatePasteLayout: (formMeta?: StructuredLyricsCardFallbacks) => void;
  onFormMetaChange: (meta: { title: string; artist: string }) => void;
  onOpenProject: (project: SavedLyricsProject) => void;
  setShareOcrData: Dispatch<SetStateAction<ShareOcrData | null>>;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  onMusicShareStored: (data: ShareOcrData) => void;
  onStructuredLyrics: (text: string, opts?: { streaming?: boolean }) => boolean;
  consumedClipboardRef: RefObject<Set<string>>;
  prevClipboardHashRef: RefObject<string>;
  externalPrompt?: ExternalPromptRequest | null;
  onExternalPromptHandled?: () => void;
};

export default function HomeScreen({
  inputResetKey,
  appSettings,
  languageMatrixContext,
  shareOcrData,
  pasteLayoutReady,
  clipboardStreamTitle,
  libraryRefreshKey,
  onLanguageChange,
  onActivatePasteLayout,
  onFormMetaChange,
  onOpenProject,
  setShareOcrData,
  setAppSettings,
  onMusicShareStored,
  onStructuredLyrics,
  consumedClipboardRef,
  prevClipboardHashRef,
  externalPrompt,
  onExternalPromptHandled,
}: Props) {
  const [faqOpen, setFaqOpen] = useState(false);

  useLayoutEffect(() => {
    // 首页 UI 只用系统字体（PingFang / Hiragino），不等待海报专用字体
    // （KozMin / HCRBatang / SourceHanSerif 共 ~54MB，仅海报排版/导出时才按需加载）。
    // 直接淡出 boot loader，避免首屏被字体请求阻塞。
    requestAnimationFrame(() => hideAppBootLoader());
  }, []);

  useClipboardDetection({
    setShareOcrData,
    setAppSettings,
    onMusicShareStored,
    onStructuredLyrics,
    consumedClipboardRef,
    prevClipboardHashRef,
  });

  const showToast = useAppToast();
  useDesktopMusicShareDetection({
    setShareOcrData,
    setAppSettings,
    onMusicShareStored,
    prevClipboardHashRef,
    consumedClipboardRef,
    showToast,
  });

  const { parseShareText, parsing: parseMusicShareBusy } = useFillMusicShareFromClipboard({
    setShareOcrData,
    setAppSettings,
    onMusicShareStored,
  });

  return (
    <div className="home-body">
      <div className="home-hero">
        <h1 className="home-hero__headline">
          {appSettings.interfaceLanguage === 'en'
            ? 'Pause the melody, dive into the words.'
            : '让旋律暂停，让文字浮现'}
        </h1>
        <p
          className="home-hero__subtitle"
          lang={appSettings.interfaceLanguage === 'en' ? 'en' : 'zh'}
        >
          {appSettings.interfaceLanguage === 'en'
            ? 'Turn your favorite songs into study cards with readings and grammar notes'
            : '把喜欢的歌，变成带注音与语法解析的学习材料'}
        </p>
      </div>
      <HowItWorks />
      <div className="home-form-card">
        <HtmlPasteInput
        key={inputResetKey}
        includeVocabAndGrammar={appSettings.defaultIncludeVocabAndGrammar}
        pedagogicalLevel={appSettings.defaultPedagogicalLevel}
        language={appSettings.lyricsLanguage}
        matrix={languageMatrixContext}
        onLanguageChange={onLanguageChange}
        initialTitle={shareOcrData?.title}
        initialArtist={shareOcrData?.artist}
        ocrDetectedLanguage={shareOcrData?.detectedLanguage}
        ocrContext={shareOcrToEncoderContext(shareOcrData)}
        pasteLayoutReady={pasteLayoutReady}
        clipboardStreamTitle={clipboardStreamTitle}
        onActivatePasteLayout={onActivatePasteLayout}
        onParseMusicShareText={parseShareText}
        parseMusicShareBusy={parseMusicShareBusy}
        onFormMetaChange={onFormMetaChange}
        externalPrompt={externalPrompt}
        onExternalPromptHandled={onExternalPromptHandled}
      />
      </div>
      <div className="home-libraries-grid">
        <SavedLyricsLibrary onOpen={onOpenProject} refreshKey={libraryRefreshKey} />
        <StudyCardsLibrary />
      </div>
      <HomeDailyLyricQuote refreshKey={libraryRefreshKey} onOpenProject={onOpenProject} />
      <div className="home-faq__pill-wrapper">
        {faqOpen ? (
          <div className="home-faq__pill-row">
            <span className="home-faq__pill home-faq__pill--label">SHUFURI · Q&A</span>
            <button
              type="button"
              className="home-faq__toggle"
              onClick={() => setFaqOpen(false)}
              aria-expanded={true}
              aria-label="收起常见答疑"
              title="收起"
            >
              <svg className="home-faq__toggle-icon" viewBox="0 0 24 24" aria-hidden>
                <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="home-faq__pill"
            onClick={() => setFaqOpen(true)}
            aria-expanded={false}
            title="展开常见答疑"
          >
            Q&A
          </button>
        )}
      </div>
      {faqOpen && <HomeFaqSection />}
      <footer className="home-footer">
        <div className="home-footer__left">
          <span className="home-footer__copy">
            Copyright © 2020 – 2026 Wanderful Studio
          </span>
        </div>
        <div className="home-footer__right">
          <a className="home-footer__link" href="/terms">{L('服务协议', 'Terms of Service')}</a>
          <span className="home-footer__sep" aria-hidden="true">|</span>
          <a className="home-footer__link" href="/privacy">{L('隐私政策', 'Privacy Policy')}</a>
          <span className="home-footer__sep" aria-hidden="true">|</span>
          <span className="home-footer__meta">粤B2-XXXXXXXX</span>
          <span className="home-footer__sep" aria-hidden="true">|</span>
          <span className="home-footer__meta">粤公网安备 XXXXXXXXXXXX号</span>
        </div>
      </footer>
    </div>
  );
}
