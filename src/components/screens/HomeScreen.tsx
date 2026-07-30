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
import { useLayoutEffect, type RefObject, type Dispatch, type SetStateAction } from 'react';
import type { SavedLyricsProject } from '../../services/savedLyricsStore';
import { ensurePosterFontsLoaded } from '../../utils/shufuriPoster/fonts';
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
  wheelLanguages,
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
  useLayoutEffect(() => {
    let cancelled = false;
    void ensurePosterFontsLoaded().then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (!cancelled) hideAppBootLoader();
      });
    });
    return () => {
      cancelled = true;
    };
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
            : '让旋律暂停，让文字驻足。'}
        </h1>
        <p className="home-hero__subtitle">
          {appSettings.interfaceLanguage === 'en'
            ? 'The smart way to learn and sing foreign songs. Use AI to instantly decode lyrics into structured study materials—complete with pronunciation, vocab, and deep grammar analysis.'
            : '一键免费AI检索获取外语歌词文本，生成注音与解释，像阅读文学作品，在静谧中慢慢学习和体会'}
        </p>
      </div>
      <HtmlPasteInput
        key={inputResetKey}
        includeVocabAndGrammar={appSettings.defaultIncludeVocabAndGrammar}
        pedagogicalLevel={appSettings.defaultPedagogicalLevel}
        language={appSettings.lyricsLanguage}
        wheelLanguages={wheelLanguages}
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
      <div className="home-libraries-grid">
        <SavedLyricsLibrary onOpen={onOpenProject} refreshKey={libraryRefreshKey} />
        <StudyCardsLibrary />
      </div>
      <HomeDailyLyricQuote refreshKey={libraryRefreshKey} onOpenProject={onOpenProject} />
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
