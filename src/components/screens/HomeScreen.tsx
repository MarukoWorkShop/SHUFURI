import type { OcrDetectedLanguage } from '../../services/ocrTypes';
import type { AppSettings, LyricsLanguage } from '../../services/appSettings';
import type { LanguageMatrixContext } from '../../services/languageMatrix/types';
import type { StructuredLyricsCardFallbacks } from '../../utils/clipboardStructuredLyrics';
import { useClipboardDetection } from '../../hooks/useClipboardDetection';
import HtmlPasteInput from '../HtmlPasteInput';
import SavedLyricsLibrary from '../SavedLyricsLibrary';
import StudyCardsLibrary from '../StudyCardsLibrary';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { SavedLyricsProject } from '../../services/savedLyricsStore';

type ShareOcrData = {
  title: string;
  artist: string;
  detectedLanguage?: OcrDetectedLanguage;
};

type Props = {
  inputResetKey: number;
  appSettings: AppSettings;
  wheelLanguages: LyricsLanguage[];
  languageMatrixContext: LanguageMatrixContext;
  shareOcrData: ShareOcrData | null;
  pasteLayoutReady: boolean;
  libraryRefreshKey: number;
  onLanguageChange: (lang: LyricsLanguage) => void;
  onActivatePasteLayout: (formMeta?: StructuredLyricsCardFallbacks) => void;
  onFormMetaChange: (meta: { title: string; artist: string }) => void;
  onOpenProject: (project: SavedLyricsProject) => void;
  setShareOcrData: Dispatch<SetStateAction<ShareOcrData | null>>;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  onMusicShareStored: (data: ShareOcrData) => void;
  onStructuredLyrics: (text: string) => boolean;
  consumedClipboardRef: RefObject<Set<string>>;
  prevClipboardHashRef: RefObject<string>;
};

export default function HomeScreen({
  inputResetKey,
  appSettings,
  wheelLanguages,
  languageMatrixContext,
  shareOcrData,
  pasteLayoutReady,
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
}: Props) {
  useClipboardDetection({
    setShareOcrData,
    setAppSettings,
    onMusicShareStored,
    onStructuredLyrics,
    consumedClipboardRef,
    prevClipboardHashRef,
  });

  return (
    <div className="home-body">
      <HtmlPasteInput
        key={inputResetKey}
        includeVocabAndGrammar={appSettings.defaultIncludeVocabAndGrammar}
        language={appSettings.lyricsLanguage}
        wheelLanguages={wheelLanguages}
        matrix={languageMatrixContext}
        onLanguageChange={onLanguageChange}
        initialTitle={shareOcrData?.title}
        initialArtist={shareOcrData?.artist}
        ocrDetectedLanguage={shareOcrData?.detectedLanguage}
        pasteLayoutReady={pasteLayoutReady}
        onActivatePasteLayout={onActivatePasteLayout}
        onFormMetaChange={onFormMetaChange}
      />
      <SavedLyricsLibrary onOpen={onOpenProject} refreshKey={libraryRefreshKey} />
      <StudyCardsLibrary />
    </div>
  );
}
