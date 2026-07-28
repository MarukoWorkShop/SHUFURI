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
        <p className="home-hero__tagline">多语歌词发音标注·排版打印·AI学习助手</p>
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
        <div className="home-footer__line">
          <span className="home-footer__copy">
            Copyright © 2020 – 2026 Wanderful Studio. All Rights Reserved. Wanderful Studio 版权所有
          </span>
          <span className="home-footer__divider" aria-hidden="true">|</span>
          <a className="home-footer__link" href="/terms">服务协议</a>
          <span className="home-footer__divider" aria-hidden="true">|</span>
          <a className="home-footer__link" href="/privacy">隐私政策</a>
          <span className="home-footer__divider" aria-hidden="true">|</span>
          <span className="home-footer__meta">粤B2-XXXXXXXX</span>
          <span className="home-footer__divider" aria-hidden="true">|</span>
          <span className="home-footer__meta">粤公网安备 XXXXXXXXXXXX号</span>
        </div>
      </footer>
    </div>
  );
}
