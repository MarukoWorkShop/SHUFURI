import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { InkEditTarget } from '../components/InkFineTunePopover';
import type { ColorTheme, LangCode, LyricsLanguage } from '../services/appSettings';
import type { SavedLyricsProject } from '../services/savedLyricsStore';
import type { AppMode } from '../hooks/usePosterWorkspace';
import type {
  PosterLayoutProfile,
  PosterPageSlice,
  PosterRenderOptions,
  PreviewTypography,
} from '../utils/shufuriPoster/types';

export type PosterWorkspaceInkSession = {
  inkToolboxOpen: boolean;
  setInkToolboxOpen: Dispatch<SetStateAction<boolean>>;
  canUndoInkEdit: boolean;
  inkFocusGroupIndex: number | null;
  inkEditTarget: InkEditTarget | null;
  inkPopoverClosing: boolean;
  inkDraftKanji: string;
  inkDraftKana: string;
  inkDraftZh: string;
  inkDraftTitle: string;
  inkDraftArtist: string;
  setInkDraftKanji: (v: string) => void;
  setInkDraftKana: (v: string) => void;
  setInkDraftZh: (v: string) => void;
  setInkDraftTitle: (v: string) => void;
  setInkDraftArtist: (v: string) => void;
  handleInkUndo: () => void;
  handleInkOpenTarget: (target: InkEditTarget) => void;
  closeInkPopover: () => void;
  handleInkConfirm: () => void;
};

export type PosterDocumentContextValue = {
  mode: AppMode;
  lyrics: string;
  title: string;
  artist: string;
  bodyHtml: string;
  pages: PosterPageSlice[];
  layoutProfile: PosterLayoutProfile;
  savedProjectId: string | null;
  lang: LangCode | undefined;
  titleMarkupHtml: string | undefined;
  lyricsLanguage: LyricsLanguage;
  colorTheme: ColorTheme;

  exporting: boolean;
  saving: boolean;

  editCanvasRef: RefObject<HTMLDivElement | null>;
  exportPagesRef: RefObject<HTMLDivElement | null>;
  editScale: number;
  exportScale: number;
  capturePageRef: (index: number) => (el: HTMLDivElement | null) => void;

  enterExportFlow: () => Promise<void>;
  handleReset: () => void;
  handleBackToEdit: () => void;
  handleLayoutChange: (profile: PosterLayoutProfile) => Promise<void>;
  handleLayoutFromHtml: (
    bodyHtml: string,
    title: string,
    rawPaste: string,
    artist?: string,
    lang?: LangCode,
  ) => Promise<void>;
  openProject: (project: SavedLyricsProject) => Promise<void>;
  handleSave: () => Promise<void>;
  handleExportPdf: () => Promise<void>;
};

export type PosterTypographyContextValue = {
  showRubyAnnotations: boolean;
  previewTypography: PreviewTypography;
  repaginating: boolean;
  rubyToggleSupported: boolean;
  posterRenderOpts: PosterRenderOptions;
  handleShowRubyChange: (next: boolean) => void;
  setPreviewTypography: (typography: PreviewTypography) => void;
  scheduleRebuildExportPages: () => void;
};

export type PosterInkContextValue = PosterWorkspaceInkSession;

/** @deprecated Prefer domain hooks; merged view for legacy consumers. */
export type PosterWorkspaceContextValue = PosterDocumentContextValue &
  PosterTypographyContextValue & {
    ink: PosterWorkspaceInkSession;
  };

export const PosterDocumentContext = createContext<PosterDocumentContextValue | null>(null);
export const PosterTypographyContext = createContext<PosterTypographyContextValue | null>(null);
export const PosterInkContext = createContext<PosterInkContextValue | null>(null);

/** @deprecated Prefer PosterDocumentContext */
export const PosterWorkspaceContext = createContext<PosterWorkspaceContextValue | null>(null);

export function usePosterDocumentContext(): PosterDocumentContextValue {
  const ctx = useContext(PosterDocumentContext);
  if (!ctx) {
    throw new Error('usePosterDocumentContext must be used within PosterWorkspaceProvider');
  }
  return ctx;
}

export function usePosterTypographyContext(): PosterTypographyContextValue {
  const ctx = useContext(PosterTypographyContext);
  if (!ctx) {
    throw new Error('usePosterTypographyContext must be used within PosterWorkspaceProvider');
  }
  return ctx;
}

export function usePosterInkContext(): PosterInkContextValue {
  const ctx = useContext(PosterInkContext);
  if (!ctx) {
    throw new Error('usePosterInkContext must be used within PosterWorkspaceProvider');
  }
  return ctx;
}

export function usePosterWorkspaceContext(): PosterWorkspaceContextValue {
  const document = usePosterDocumentContext();
  const typography = usePosterTypographyContext();
  const ink = usePosterInkContext();
  return { ...document, ...typography, ink };
}
