import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import './App.css';
import { normalizeLyricsBodyHtml } from './services/lyricsHtml';
import { resolveExportTitle } from './utils/shufuriPoster/posterTitle';
import { buildPosterPagesFromBody, posterPageHtmls } from './utils/shufuriPoster/buildPosterPages';
import { exportPosterPdf } from './utils/exportPosterPdf';
import { exportPosterPdfFromPageHtmls, exportPosterPngFromPageHtmls, posterPdfExportFilename } from './utils/pdfExport';
import InkFineTuneEditor from './components/InkFineTuneEditor';
import InkToolbox from './components/InkToolbox';
import type { InkEditTarget } from './components/InkFineTunePopover';
import ShufuriPosterEditCanvas from './components/ShufuriPosterEditCanvas';
import ExportPreviewPanel from './components/ExportPreviewPanel';
import SavedLyricsLibrary from './components/SavedLyricsLibrary';
import StudyCardsLibrary from './components/StudyCardsLibrary';
import HtmlPasteInput from './components/HtmlPasteInput';
import ClipboardDetectCard from './components/ClipboardDetectCard';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import { usePosterPreviewFitScale } from './hooks/usePosterPreviewFitScale';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { hapticSuccess, hapticError } from './hooks/useHaptics';
import { useGlobalButtonFeedback } from './hooks/useGlobalButtonFeedback';
import { ensurePosterFontsLoaded } from './utils/shufuriPoster/fonts';
import { resetPosterPageRefs } from './utils/posterPageRefs';
import { saveLyricsProject, type SavedLyricsProject } from './services/savedLyricsStore';
import { annotateInkEditTargets } from './utils/inkFineTune/annotateInkEditTargets';
import { stripLegacyInkHighlightsFromHtml } from './utils/inkFineTune/stripInkHighlights';
import { applyRubyEdit, applyZhLineEdit } from './utils/inkFineTune/applyInkEdit';
import { saveInkFineTuneDraft } from './utils/inkFineTune/inkFineTuneDraft';
import { playPencilScratchSound } from './utils/inkFineTune/pencilScratchSound';
import {
  type InkEditSnapshot,
  inkEditSnapshotsEqual,
  INK_EDIT_UNDO_LIMIT,
} from './utils/inkFineTune/inkEditHistory';
import {
  DEFAULT_PREVIEW_TYPOGRAPHY,
  buildPosterRenderOptions,
  type PosterLayoutProfile,
  type PosterPageSlice,
  type PreviewTypography,
} from './utils/shufuriPoster/types';
import { resolvePosterPipelineLang } from './utils/shufuriPoster/inferPosterLang';
import SettingsPanel from './components/SettingsPanel';
import SettingsMenuIcon from './components/icons/SettingsMenuIcon';
import LinkChainIcon from './components/icons/LinkChainIcon';
import { getAppSettings, saveAppSettings, type AppSettings, type LangCode, type LyricsLanguage } from './services/appSettings';
import { buildLanguageMatrixContext, getWheelLanguages } from './services/languageMatrix';
import type { OcrDetectedLanguage } from './services/ocrTypes';
import { applyColorTheme } from './utils/applyColorTheme';
import {
  initNativeBridge,
  postToNative,
  type BridgeCommand,
} from './bridge/nativeBridge';
import {
  onAppBecameActive,
  isNativeWebView,
  postClipboardRead,
  isQQMusicShare,
  parseQQMusicShare,
  isNetEaseMusicShare,
  parseNetEaseMusicShare,
} from './utils/nativeBridge';
import { readClipboardText } from './utils/clipboard';
import {
  clipboardContentHash,
  getStructuredLyricsCardMeta,
  isStructuredLyricsClipboardText,
  type StructuredLyricsCardFallbacks,
} from './utils/clipboardStructuredLyrics';
import { useClipboardStructuredLyrics } from './hooks/useClipboardHasContent';
import { useTimedMessage } from './hooks/useTimedMessage';
import { AppToastContext } from './context/AppToastContext';
import AppToast from './components/AppToast';
import {
  createStudyCardsBundleId,
  scheduleStudyCardsSync,
  tryMigrateStudyCardsBundle,
} from './studyCards/syncStudyCards';

type Mode = 'input' | 'edit' | 'export';

const EDIT_LAYOUT: PosterLayoutProfile = 'mobilePoster';
/** 导出操作总超时（毫秒），超过则强制恢复按钮 */
const EXPORT_DEADLINE_MS = 180_000;
const INK_POPOVER_CLOSE_MS = 220;

function prepareBodyHtmlForPreview(rawBodyHtml: string): string {
  return annotateInkEditTargets(
    normalizeLyricsBodyHtml(stripLegacyInkHighlightsFromHtml(rawBodyHtml)),
  );
}

function prepareTitleMarkupHtml(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  return stripLegacyInkHighlightsFromHtml(raw);
}

/** 桥接用：解析 rawText → bodyHtml */
async function prepareBridgedRawText(rawText: string): Promise<string> {
  const { preparePasteForLayout } = await import('./services/lyricsHtml');
  const parsed = preparePasteForLayout(rawText);
  return annotateInkEditTargets(normalizeLyricsBodyHtml(parsed.bodyHtml));
}

function ocrLangToLyricsLanguage(lang: OcrDetectedLanguage): LyricsLanguage | undefined {
  if (lang === 'jp') return 'jp';
  if (lang === 'ko') return 'ko';
  if (lang === 'zh') return 'zh';
  return undefined;
}

const CHAIN_TOOLTIP_MAX_W = 260;
const CHAIN_TOOLTIP_SCREEN_PAD = 16;

function ChainLinkTooltip({ anchorRect }: { anchorRect: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const btnCenterX = anchorRect.left + anchorRect.width / 2;
    let tooltipLeft = btnCenterX - CHAIN_TOOLTIP_MAX_W / 2;
    if (tooltipLeft < CHAIN_TOOLTIP_SCREEN_PAD) {
      tooltipLeft = CHAIN_TOOLTIP_SCREEN_PAD;
    }
    const rightEdge = tooltipLeft + CHAIN_TOOLTIP_MAX_W;
    if (rightEdge > window.innerWidth - CHAIN_TOOLTIP_SCREEN_PAD) {
      tooltipLeft = window.innerWidth - CHAIN_TOOLTIP_SCREEN_PAD - CHAIN_TOOLTIP_MAX_W;
    }
    const arrowOffset = btnCenterX - tooltipLeft;

    el.style.setProperty('--tooltip-top', `${anchorRect.bottom + 10}px`);
    el.style.setProperty('--tooltip-left', `${tooltipLeft}px`);
    el.style.setProperty('--tooltip-max-width', `${CHAIN_TOOLTIP_MAX_W}px`);
    el.style.setProperty('--tooltip-arrow-left', `${arrowOffset}px`);
  }, [anchorRect]);

  return (
    <div ref={ref} className="app-chain-tooltip">
      <span className="app-chain-tooltip__text">
        暂无音乐链接，去音乐软件复制分享链接，或手动填入歌曲信息生成搜索口令
      </span>
    </div>
  );
}

export default function App() {
  // ---- State 声明（必须在 hooks 使用之前） ----
  const [mode, setMode] = useState<Mode>('input');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [pages, setPages] = useState<PosterPageSlice[]>([]);
  const [layoutProfile, setLayoutProfile] = useState<PosterLayoutProfile>(() => EDIT_LAYOUT);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [studyCardsRefreshKey, setStudyCardsRefreshKey] = useState(0);
  const studyCardsBundleIdRef = useRef(createStudyCardsBundleId());
  const bumpStudyCardsRefresh = useCallback(() => {
    setStudyCardsRefreshKey((k) => k + 1);
  }, []);

  const [inputResetKey, setInputResetKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getAppSettings());

  const syncStudyCardsFromRaw = useCallback(
    (
      rawLyrics: string,
      bundleId: string,
      meta: {
        title?: string;
        artist?: string;
        lang?: LangCode;
        includeVocabAndGrammar?: boolean;
      },
    ) => {
      scheduleStudyCardsSync(
        {
          rawLyrics,
          bundleId,
          title: meta.title,
          artist: meta.artist,
          lang: meta.lang,
          includeVocabAndGrammar:
            meta.includeVocabAndGrammar ?? appSettings.defaultIncludeVocabAndGrammar,
        },
        bumpStudyCardsRefresh,
      );
    },
    [appSettings.defaultIncludeVocabAndGrammar, bumpStudyCardsRefresh],
  );

  const lyricsLanguage = appSettings.lyricsLanguage;

  const wheelLanguages = useMemo(
    () => getWheelLanguages(appSettings.learningTargetLanguages),
    [appSettings.learningTargetLanguages],
  );

  const languageMatrixContext = useMemo(
    () => buildLanguageMatrixContext(appSettings),
    [appSettings],
  );

  useEffect(() => {
    const settings = getAppSettings();
    setAppSettings(settings);
    applyColorTheme(settings.colorTheme);
  }, []);
  /** 排版管线语言（大模型声明 / 自动检测，与波轮解耦） */
  const [lang, setLang] = useState<LangCode | undefined>(undefined);
  /** 链条 icon tooltip 显示 */
  const [chainTipVisible, setChainTipVisible] = useState(false);
  /** 链条按钮 ref，用于计算 tooltip position */
  const chainBtnRef = useRef<HTMLButtonElement>(null);

  // 链条 tooltip：点击外部关闭
  useEffect(() => {
    if (!chainTipVisible) return;
    const handleClick = () => {
      // 延迟关闭，让 click 事件先触发按钮的 toggle
      setTimeout(() => setChainTipVisible(false), 10);
    };
    document.addEventListener('click', handleClick, { capture: true });
    // 5 秒自动消失
    const timer = setTimeout(() => setChainTipVisible(false), 5000);
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      clearTimeout(timer);
    };
  }, [chainTipVisible]);

  // ---- 剪贴板检测卡片（AI App 返回结构化歌词时弹出） ----
  const [clipboardCardVisible, setClipboardCardVisible] = useState(false);
  const [clipboardDetectedSong, setClipboardDetectedSong] = useState('');
  const [clipboardDetectedArtist, setClipboardDetectedArtist] = useState('');
  const [clipboardDetectedLang, setClipboardDetectedLang] = useState<LangCode | undefined>(undefined);
  const pasteLayoutReady = useClipboardStructuredLyrics();
  const appToast = useTimedMessage(3000);
  /** 已消费的剪贴板内容哈希集合（用户点过「取消」后不再重复弹窗） */
  const consumedClipboardRef = useRef<Set<string>>(new Set());
  const prevClipboardHashRef = useRef('');
  const homeFormMetaRef = useRef({ title: '', artist: '' });
  // ---- 剪贴板/链接解析结果（预填歌名+歌手） ----
  const [shareOcrData, setShareOcrData] = useState<{
    title: string;
    artist: string;
    detectedLanguage?: 'jp' | 'ko' | 'zh' | 'mixed' | 'unknown';
  } | null>(null);
  /** 剪贴板中是否有音乐链接（QQ/网易云检测到的分享链接） */
  const hasMusicLink = shareOcrData !== null && (shareOcrData.title !== '' || shareOcrData.artist !== '');
  /** 存储最近一次成功检测的原始剪贴板文本 + 解析结果，用于恢复粘贴 */
  const lastDetectedShareRef = useRef<{ title: string; artist: string; detectedLanguage?: 'jp' | 'ko' | 'zh' | 'mixed' | 'unknown' } | null>(null);

  const network = useNetworkStatus();

  // ---- 首页 ----

  useGlobalButtonFeedback();

  const activateClipboardDetectCardFromText = useCallback((
    text: string,
    formMeta?: StructuredLyricsCardFallbacks,
  ): boolean => {
    const meta = getStructuredLyricsCardMeta(text, {
      title: formMeta?.title || shareOcrData?.title || homeFormMetaRef.current.title,
      artist: formMeta?.artist || shareOcrData?.artist || homeFormMetaRef.current.artist,
    });
    if (!meta) {
      return false;
    }
    setClipboardDetectedSong(meta.title);
    setClipboardDetectedArtist(meta.artist);
    setClipboardDetectedLang(meta.lang);
    setClipboardCardVisible(true);
    hapticSuccess();
    return true;
  }, [shareOcrData]);

  const handleActivatePasteLayout = useCallback(async (formMeta?: StructuredLyricsCardFallbacks) => {
    try {
      const text = await readClipboardText();
      const trimmed = text.trim();
      if (!trimmed) {
        appToast.show('剪贴板为空');
        return;
      }
      if (activateClipboardDetectCardFromText(trimmed, formMeta)) {
        prevClipboardHashRef.current = clipboardContentHash(trimmed);
        return;
      }
      appToast.show('未检测到结构化歌词');
    } catch {
      appToast.show('无法读取剪贴板');
    }
  }, [activateClipboardDetectCardFromText, appToast.show]);

  const activateCardRef = useRef(activateClipboardDetectCardFromText);
  activateCardRef.current = activateClipboardDetectCardFromText;

  const handleSettingsChange = useCallback((next: AppSettings) => {
    setAppSettings(next);
    applyColorTheme(next.colorTheme);
  }, []);
  const [inkEditTarget, setInkEditTarget] = useState<InkEditTarget | null>(null);
  const [inkPopoverClosing, setInkPopoverClosing] = useState(false);
  const [inkToolboxOpen, setInkToolboxOpen] = useState(false);
  const [showRubyAnnotations, setShowRubyAnnotations] = useState(true);
  const [previewTypography, setPreviewTypography] = useState<PreviewTypography>(
    DEFAULT_PREVIEW_TYPOGRAPHY,
  );
  const [repaginating, setRepaginating] = useState(false);
  const repaginateDebounceRef = useRef<number | null>(null);
  const [titleMarkupHtml, setTitleMarkupHtml] = useState<string | undefined>(undefined);
  const [canUndoInkEdit, setCanUndoInkEdit] = useState(false);
  const [inkDraftKanji, setInkDraftKanji] = useState('');
  const [inkDraftKana, setInkDraftKana] = useState('');
  const [inkDraftZh, setInkDraftZh] = useState('');
  const [inkDraftTitle, setInkDraftTitle] = useState('');
  const [inkDraftArtist, setInkDraftArtist] = useState('');
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const editCanvasRef = useRef<HTMLDivElement>(null);
  const exportPagesRef = useRef<HTMLDivElement>(null);
  const exportingRef = useRef(false);
  const undoStackRef = useRef<InkEditSnapshot[]>([]);
  const titleMarkupHtmlRef = useRef<string | undefined>(undefined);
  const showRubyRef = useRef(showRubyAnnotations);
  const previewTypographyRef = useRef(previewTypography);

  // ---- 用 refs 保持 bridge 回调中的最新状态 ----
  const bodyHtmlRef = useRef('');
  const titleRef = useRef('');
  const artistRef = useRef('');
  const pagesRef = useRef<PosterPageSlice[]>([]);
  const layoutProfileRef = useRef<PosterLayoutProfile>(EDIT_LAYOUT);
  const bridgeReadyRef = useRef(false);
  const nativeExportingRef = useRef(false);

  // 同步 state 到 refs
  useEffect(() => { bodyHtmlRef.current = bodyHtml; }, [bodyHtml]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { artistRef.current = artist; }, [artist]);
  useEffect(() => { layoutProfileRef.current = layoutProfile; }, [layoutProfile]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { titleMarkupHtmlRef.current = titleMarkupHtml; }, [titleMarkupHtml]);
  useEffect(() => { showRubyRef.current = showRubyAnnotations; }, [showRubyAnnotations]);
  useEffect(() => { previewTypographyRef.current = previewTypography; }, [previewTypography]);

  const posterPipelineLang = useMemo(
    () => resolvePosterPipelineLang(lang, bodyHtml, lyricsLanguage),
    [lang, bodyHtml, lyricsLanguage],
  );
  const rubyToggleSupported = posterPipelineLang === 'jp' || posterPipelineLang === 'zh';
  const posterRenderOpts = useMemo(
    () => buildPosterRenderOptions(showRubyAnnotations, previewTypography),
    [showRubyAnnotations, previewTypography],
  );

  const rebuildExportPages = useCallback(async () => {
    if (!bodyHtml.trim()) {
      setPages([]);
      resetPosterPageRefs(pageRefs, 0);
      return;
    }
    setRepaginating(true);
    try {
      await ensurePosterFontsLoaded();
      const pageHtmls = buildPosterPagesFromBody(
        bodyHtml,
        title,
        layoutProfile,
        artist,
        lyricsLanguage,
        lang,
        titleMarkupHtml,
        buildPosterRenderOptions(showRubyAnnotations, previewTypography),
      );
      setPages(pageHtmls);
      resetPosterPageRefs(pageRefs, pageHtmls.length);
    } finally {
      setRepaginating(false);
    }
  }, [
    bodyHtml,
    title,
    layoutProfile,
    artist,
    lyricsLanguage,
    lang,
    titleMarkupHtml,
    showRubyAnnotations,
    previewTypography,
  ]);

  const scheduleRebuildExportPages = useCallback(() => {
    if (repaginateDebounceRef.current != null) {
      window.clearTimeout(repaginateDebounceRef.current);
    }
    repaginateDebounceRef.current = window.setTimeout(() => {
      repaginateDebounceRef.current = null;
      void rebuildExportPages();
    }, 300);
  }, [rebuildExportPages]);

  const handleShowRubyChange = useCallback(
    (next: boolean) => {
      setShowRubyAnnotations(next);
      if (mode === 'export') {
        void rebuildExportPages();
      }
    },
    [mode, rebuildExportPages],
  );

  useEffect(() => {
    return () => {
      if (repaginateDebounceRef.current != null) {
        window.clearTimeout(repaginateDebounceRef.current);
      }
    };
  }, []);

  // ---- Native 导出处理器（通过 ref 读取最新状态） ----
  const handleNativeExport = useCallback(async (exportType: string) => {
    if (nativeExportingRef.current) return;
    nativeExportingRef.current = true;
    setExporting(true);

    const currentBodyHtml = bodyHtmlRef.current;
    const currentTitle = titleRef.current;
    const currentArtist = artistRef.current;
    const currentProfile = layoutProfileRef.current;

    if (!currentBodyHtml.trim()) {
      postToNative({ event: 'error', data: { message: '没有可导出的内容' } });
      nativeExportingRef.current = false;
      setExporting(false);
      return;
    }

    try {
      await ensurePosterFontsLoaded();
      const currentPages = buildPosterPagesFromBody(
        currentBodyHtml,
        currentTitle,
        currentProfile,
        currentArtist,
        lyricsLanguage,
        lang,
        titleMarkupHtmlRef.current,
        buildPosterRenderOptions(showRubyRef.current, previewTypographyRef.current),
      );
      pagesRef.current = currentPages;
      setPages(currentPages);

      if (currentPages.length === 0) {
        postToNative({ event: 'error', data: { message: '分页结果为空' } });
        return;
      }

      const baseFilename = posterPdfExportFilename(resolveExportTitle(currentTitle), currentProfile);

      if (exportType === 'export_pdf') {
        await exportPosterPdfFromPageHtmls(
          currentPages,
          currentTitle,
          currentProfile,
          baseFilename,
          currentArtist,
          lyricsLanguage,
          lang,
          buildPosterRenderOptions(showRubyRef.current, previewTypographyRef.current),
        );
      } else {
        await exportPosterPngFromPageHtmls(
          currentPages,
          currentTitle,
          currentProfile,
          baseFilename,
          currentArtist,
          lyricsLanguage,
          lang,
          buildPosterRenderOptions(showRubyRef.current, previewTypographyRef.current),
        );
      }

      postToNative({
        event: 'export_complete',
        data: {
          type: exportType === 'export_pdf' ? 'pdf' : 'png',
          dataBase64: '',
          filename: baseFilename,
          requestId: '',
        },
      });
    } catch (e) {
      console.error('[native-export]', e);
      postToNative({
        event: 'error',
        data: { message: e instanceof Error ? e.message : '导出失败' },
      });
    } finally {
      nativeExportingRef.current = false;
      setExporting(false);
    }
  }, []);

  // ---- bridge 命令处理（电容模式下仅保留基础能力） ----
  const handleBridgeCommand = useCallback(
    (cmd: BridgeCommand) => {
      switch (cmd.type) {
        case 'detect_native':
          postToNative({ event: 'ready' });
          break;

        case 'set_content': {
          const { bodyHtml: bh, rawText: rt, title: t, layoutProfile: lp } = cmd.payload;
          void (async () => {
            await ensurePosterFontsLoaded();

            let finalBodyHtml: string;
            if (rt) {
              finalBodyHtml = await prepareBridgedRawText(rt);
            } else if (bh) {
              finalBodyHtml = prepareBodyHtmlForPreview(bh);
            } else {
              postToNative({ event: 'error', data: { message: 'set_content 缺少 bodyHtml 或 rawText' } });
              return;
            }

            setTitle(t);
            setBodyHtml(finalBodyHtml);
            setLayoutProfile(lp);
            bodyHtmlRef.current = finalBodyHtml;
            titleRef.current = t;
            layoutProfileRef.current = lp;
            setPages([]);
            setMode('edit');
            resetPosterPageRefs(pageRefs, 0);
          })();
          break;
        }

        case 'export_pdf':
        case 'export_png': {
          void handleNativeExport(cmd.type);
          break;
        }

        case 'export_png_all':
          void handleNativeExport('export_png');
          break;

        case 'reset':
          setMode('input');
          setBodyHtml('');
          setTitle('');
          bodyHtmlRef.current = '';
          titleRef.current = '';
          setPages([]);
          break;
      }
    },
    [handleNativeExport],
  );

  // 初始化 Capacitor 原生桥接
  useEffect(() => {
    if (!bridgeReadyRef.current) {
      bridgeReadyRef.current = true;
      initNativeBridge(handleBridgeCommand);
    }
  }, [handleBridgeCommand]);

  // ---- 剪贴板检测：App 回到前台时读取剪贴板 ----
  useEffect(() => {
    if (!isNativeWebView()) return;

    /**
     * 生成内容的完整哈希（前 200 字符），用于去重。
     * 覆盖歌词头部 + 第一对 PAIR 块，足够辨别不同歌曲。
     */
    const contentHash = clipboardContentHash;

    /**
     * 阶段式读取剪贴板（应对 UIPasteboard 同步延迟）。
     *
     * 延迟策略：
     * - 0ms:   立即读取（快设备上通常已就绪）
     * - 600ms: 第一次重试（常规 iOS 剪贴板同步窗口）
     * - 1400ms:第二次重试（慢设备 / 后台任务阻塞兜底）
     *
     * 任一阶段检测到有效内容 → 停止后续重试。
     * 内容与上次相同（基于完整哈希）→ 跳过。
     * 内容已被「取消」消费过 → 跳过。
     */
    const tryReadClipboard = async (attempt: number): Promise<void> => {
      try {
        const text = await postClipboardRead();
        if (!text) {
          if (attempt < 2) {
            const delays = [600, 1400];
            setTimeout(() => { void tryReadClipboard(attempt + 1); }, delays[attempt]!);
          }
          return;
        }

        const trimmed = text.trim();
        const hash = contentHash(trimmed);

        // 去重：与上次成功检测的哈希比较
        if (hash === prevClipboardHashRef.current) return;

        // 排除已消费内容（用户点过「取消」且剪贴板未变化）
        if (consumedClipboardRef.current.has(hash)) return;

        // ---- QQ 音乐分享链接：直接提取歌名/歌手，预填输入框 ----
        if (isQQMusicShare(trimmed)) {
          const parsed = parseQQMusicShare(trimmed);
          if (parsed.title) {
            console.log('[Clipboard] 检测到 QQ 音乐分享链接:', parsed.title, parsed.artist);
            prevClipboardHashRef.current = hash;
            const detectedLang = (() => {
              const hasKana = /[\u3040-\u309f\u30a0-\u30ff]/.test(parsed.title || '');
              const hasHangul = /[\uAC00-\uD7AF]/.test(parsed.title || '');
              if (hasKana) return 'jp' as const;
              if (hasHangul) return 'ko' as const;
              return undefined;
            })();
            const shareData = {
              title: parsed.title || '',
              artist: parsed.artist || '',
              detectedLanguage: detectedLang,
            };
            lastDetectedShareRef.current = shareData;
            setShareOcrData((prev) => ({ ...prev, ...shareData }));
            // 自动同步语言到波轮（直接 setState + 持久化，避免 handleSettingsChange 的 applyColorTheme 干扰）
            if (detectedLang) {
              setAppSettings((prev) => ({ ...prev, lyricsLanguage: detectedLang }));
              saveAppSettings({ lyricsLanguage: detectedLang });
            }
            hapticSuccess();
            return;
          }
        }

        // ---- 网易云音乐分享链接：直接提取歌名/歌手，预填输入框 ----
        if (isNetEaseMusicShare(trimmed)) {
          const parsed = parseNetEaseMusicShare(trimmed);
          if (parsed.title) {
            console.log('[Clipboard] 检测到网易云音乐分享链接:', parsed.title, parsed.artist);
            prevClipboardHashRef.current = hash;
            const detectedLang = (() => {
              const hasKana = /[\u3040-\u309f\u30a0-\u30ff]/.test(parsed.title || '');
              const hasHangul = /[\uAC00-\uD7AF]/.test(parsed.title || '');
              if (hasKana) return 'jp' as const;
              if (hasHangul) return 'ko' as const;
              return undefined;
            })();
            const shareData = {
              title: parsed.title || '',
              artist: parsed.artist || '',
              detectedLanguage: detectedLang,
            };
            lastDetectedShareRef.current = shareData;
            setShareOcrData((prev) => ({ ...prev, ...shareData }));
            // 自动同步语言到波轮
            if (detectedLang) {
              setAppSettings((prev) => ({ ...prev, lyricsLanguage: detectedLang }));
              saveAppSettings({ lyricsLanguage: detectedLang });
            }
            hapticSuccess();
            return;
          }
        }

        if (!isStructuredLyricsClipboardText(trimmed)) return;

        prevClipboardHashRef.current = hash;

        if (activateCardRef.current(trimmed)) {
          console.log('[Clipboard] 弹窗已触发 (attempt:', attempt, ')');
        }
      } catch (err) {
        console.warn('[Clipboard] 读取失败 (attempt:', attempt, '):', err);
        // 读取失败也重试（权限弹窗关闭后可能恢复）
        if (attempt < 2) {
          const delays = [600, 1400];
          setTimeout(() => { void tryReadClipboard(attempt + 1); }, delays[attempt]!);
        }
      }
    };

    const removeListener = onAppBecameActive(() => {
      void tryReadClipboard(0);
    });

    return removeListener;
  }, []);

  const editScale = usePosterPreviewFitScale(
    EDIT_LAYOUT,
    editCanvasRef,
    mode === 'edit',
    `${savedProjectId ?? 'new'}:edit`,
  );

  const exportScale = usePosterPreviewFitScale(
    layoutProfile,
    exportPagesRef,
    mode === 'export',
    `${pages.length}:${savedProjectId ?? 'new'}:${layoutProfile}`,
  );

  const enterEditWithLayout = useCallback(
    async (
      nextBodyHtml: string,
      nextTitle: string,
      nextLyrics: string,
      exportProfile: PosterLayoutProfile,
      projectId: string | null,
      nextArtist?: string,
      nextLang?: LangCode,
      nextTitleMarkupHtml?: string,
    ) => {
      await ensurePosterFontsLoaded();
      const normalized = prepareBodyHtmlForPreview(nextBodyHtml);
      setTitle(nextTitle.trim());
      setArtist(nextArtist?.trim() || '');
      setBodyHtml(normalized);
      setLyrics(nextLyrics);
      setLayoutProfile(exportProfile);
      setPages([]);
      setMode('edit');
      setSavedProjectId(projectId);
      setLang(nextLang);
      setTitleMarkupHtml(prepareTitleMarkupHtml(nextTitleMarkupHtml));
      setInkToolboxOpen(false);
      setShowRubyAnnotations(true);
      setPreviewTypography(DEFAULT_PREVIEW_TYPOGRAPHY);
      setInkEditTarget(null);
      undoStackRef.current = [];
      setCanUndoInkEdit(false);
      resetPosterPageRefs(pageRefs, 0);
    },
    [],
  );

  const enterExportFlow = useCallback(async () => {
    if (!bodyHtml.trim()) {
      return;
    }
    await ensurePosterFontsLoaded();
    const exportProfile = EDIT_LAYOUT;
    const pageHtmls = buildPosterPagesFromBody(
      bodyHtml,
      title,
      exportProfile,
      artist,
      lyricsLanguage,
      lang,
      titleMarkupHtml,
      posterRenderOpts,
    );
    setLayoutProfile(exportProfile);
    setPages(pageHtmls);
    setMode('export');
    resetPosterPageRefs(pageRefs, pageHtmls.length);
  }, [bodyHtml, title, artist, lyricsLanguage, lang, titleMarkupHtml, posterRenderOpts]);

  const openProject = useCallback(
    async (project: SavedLyricsProject) => {
      const profile = project.layoutProfile ?? EDIT_LAYOUT;
      studyCardsBundleIdRef.current = project.id;
      syncStudyCardsFromRaw(project.rawLyrics, project.id, {
        title: project.title,
        artist: project.artist,
        lang: project.lang,
        includeVocabAndGrammar: project.includeVocabAndGrammar,
      });
      await enterEditWithLayout(
        project.bodyHtml,
        project.title,
        project.rawLyrics,
        profile,
        project.id,
        project.artist,
        project.lang,
        project.titleMarkupHtml,
      );
    },
    [enterEditWithLayout, syncStudyCardsFromRaw],
  );

  const handleLayoutFromHtml = useCallback(
    async (nextBodyHtml: string, nextTitle: string, rawPaste: string, nextArtist?: string, nextLang?: LangCode) => {
      studyCardsBundleIdRef.current = createStudyCardsBundleId();
      const bundleId = studyCardsBundleIdRef.current;
      await enterEditWithLayout(
        nextBodyHtml,
        nextTitle,
        rawPaste,
        EDIT_LAYOUT,
        null,
        nextArtist,
        nextLang,
      );
      syncStudyCardsFromRaw(rawPaste, bundleId, {
        title: nextTitle,
        artist: nextArtist,
        lang: nextLang,
      });
    },
    [enterEditWithLayout, syncStudyCardsFromRaw],
  );

  const handleLayoutChange = useCallback(
    async (profile: PosterLayoutProfile) => {
      if (profile === layoutProfile || !bodyHtml.trim()) {
        return;
      }
      await ensurePosterFontsLoaded();
      const pageHtmls = buildPosterPagesFromBody(
        bodyHtml,
        title,
        profile,
        artist,
        lyricsLanguage,
        lang,
        titleMarkupHtml,
        posterRenderOpts,
      );
      setLayoutProfile(profile);
      setPages(pageHtmls);
      resetPosterPageRefs(pageRefs, pageHtmls.length);
    },
    [layoutProfile, bodyHtml, title, artist, lyricsLanguage, lang, titleMarkupHtml, posterRenderOpts],
  );

  const handleBackToEdit = useCallback(() => {
    setMode('edit');
    setInkEditTarget(null);
    setInkPopoverClosing(false);
  }, []);

  // ---- 截屏识别流程已移除 ----

  const handleReset = useCallback(() => {
    setMode('input');
    setLyrics('');
    setTitle('');
    setArtist('');
    setBodyHtml('');
    setPages([]);
    setLayoutProfile(EDIT_LAYOUT);
    setSavedProjectId(null);
    setInputResetKey((k) => k + 1);
    setInkEditTarget(null);
    setInkPopoverClosing(false);
    setLang(undefined);
    setTitleMarkupHtml(undefined);
    setInkToolboxOpen(false);
    setShowRubyAnnotations(true);
    setPreviewTypography(DEFAULT_PREVIEW_TYPOGRAPHY);
    undoStackRef.current = [];
    setCanUndoInkEdit(false);
    resetPosterPageRefs(pageRefs, 0);
  }, []);

  const closeInkPopover = useCallback(() => {
    setInkPopoverClosing(true);
    window.setTimeout(() => {
      setInkEditTarget(null);
      setInkPopoverClosing(false);
    }, INK_POPOVER_CLOSE_MS);
  }, []);

  const pushUndoSnapshot = useCallback(() => {
    const snap: InkEditSnapshot = {
      bodyHtml: bodyHtmlRef.current,
      title: titleRef.current,
      artist: artistRef.current,
      titleMarkupHtml: titleMarkupHtmlRef.current,
    };
    const stack = undoStackRef.current;
    const last = stack[stack.length - 1];
    if (last && inkEditSnapshotsEqual(last, snap)) return;
    stack.push(snap);
    if (stack.length > INK_EDIT_UNDO_LIMIT) stack.shift();
    setCanUndoInkEdit(true);
  }, []);

  const handleInkUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack.pop()!;
    setBodyHtml(prepareBodyHtmlForPreview(prev.bodyHtml));
    setTitle(prev.title);
    setArtist(prev.artist);
    setTitleMarkupHtml(prepareTitleMarkupHtml(prev.titleMarkupHtml));
    setCanUndoInkEdit(stack.length > 0);
    closeInkPopover();
    playPencilScratchSound();
  }, [closeInkPopover]);

  const handleInkOpenTarget = useCallback((target: InkEditTarget) => {
    setInkEditTarget(target);
    setInkPopoverClosing(false);
    if (target.kind === 'title') {
      setInkDraftTitle(target.title);
      setInkDraftArtist(target.artist);
    } else if (target.kind === 'zh') {
      setInkDraftZh(target.text);
    } else {
      setInkDraftKanji(target.kanji);
      setInkDraftKana(target.kana);
    }
  }, []);

  const handleInkConfirm = useCallback(async () => {
    if (!inkEditTarget) return;

    pushUndoSnapshot();

    if (inkEditTarget.kind === 'title') {
      setTitle(inkDraftTitle.trim());
      setArtist(inkDraftArtist.trim());
      setTitleMarkupHtml(undefined);
      playPencilScratchSound();
      closeInkPopover();
      return;
    }

    let nextBody = bodyHtml;
    if (inkEditTarget.kind === 'zh') {
      nextBody = applyZhLineEdit(bodyHtml, inkEditTarget.groupIndex, inkDraftZh);
    } else {
      nextBody = applyRubyEdit(
        bodyHtml,
        inkEditTarget.groupIndex,
        inkEditTarget.rubyIndex,
        inkDraftKanji,
        inkDraftKana,
      );
    }

    const normalized = prepareBodyHtmlForPreview(nextBody);
    setBodyHtml(normalized);
    saveInkFineTuneDraft(savedProjectId ?? 'session', normalized);
    playPencilScratchSound();
    closeInkPopover();
  }, [
    inkEditTarget,
    bodyHtml,
    inkDraftZh,
    inkDraftKanji,
    inkDraftKana,
    inkDraftTitle,
    inkDraftArtist,
    savedProjectId,
    closeInkPopover,
    pushUndoSnapshot,
  ]);

  const handleExportPdf = useCallback(async () => {
    if (!pages.length) {
      alert('没有可导出的页面');
      return;
    }
    if (exportingRef.current) {
      return;
    }
    exportingRef.current = true;
    setExporting(true);

    const deadline = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`导出超时（${EXPORT_DEADLINE_MS / 1000}s），请重试`)), EXPORT_DEADLINE_MS),
    );

    try {
      await Promise.race([
        exportPosterPdf(
          pages,
          resolveExportTitle(title),
          layoutProfile,
          artist,
          lyricsLanguage,
          lang,
          posterRenderOpts,
        ),
        deadline,
      ]);
    } catch (e) {
      console.error('[export-pdf]', e);
      alert(e instanceof Error ? e.message : '导出失败');
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [pages, layoutProfile, title, artist, lyricsLanguage, lang, posterRenderOpts]);

  const handleSave = useCallback(async () => {
    if (!bodyHtml.trim() || saving) {
      return;
    }
    setSaving(true);
    try {
      await ensurePosterFontsLoaded();
      const slices = buildPosterPagesFromBody(
        bodyHtml,
        title,
        layoutProfile,
        artist,
        lyricsLanguage,
        lang,
        titleMarkupHtml,
        posterRenderOpts,
      );
      const pageHtmls = posterPageHtmls(slices);
      if (mode === 'export') {
        setPages(slices);
        resetPosterPageRefs(pageRefs, slices.length);
      }
      const cleanedBody = prepareBodyHtmlForPreview(bodyHtml);
      const cleanedTitleMarkup = prepareTitleMarkupHtml(titleMarkupHtml);
      const saved = await saveLyricsProject({
        id: savedProjectId ?? undefined,
        title: resolveExportTitle(title),
        artist: artist.trim() || undefined,
        rawLyrics: lyrics,
        bodyHtml: cleanedBody,
        pageHtmls,
        layoutProfile,
        lang,
        ...(cleanedTitleMarkup ? { titleMarkupHtml: cleanedTitleMarkup } : {}),
      });
      setSavedProjectId(saved.id);
      const sessionBundleId = studyCardsBundleIdRef.current;
      if (!savedProjectId) {
        await tryMigrateStudyCardsBundle(sessionBundleId, saved.id);
      }
      studyCardsBundleIdRef.current = saved.id;
      syncStudyCardsFromRaw(lyrics, saved.id, {
        title: resolveExportTitle(title),
        artist: artist.trim() || undefined,
        lang,
      });
      setLibraryRefreshKey((k) => k + 1);
      appToast.show('已保存到我的歌词库', 2400);
      hapticSuccess();
    } catch (e) {
      hapticError();
      alert(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [
    bodyHtml,
    mode,
    savedProjectId,
    title,
    artist,
    lyrics,
    layoutProfile,
    saving,
    appToast.show,
    titleMarkupHtml,
    lyricsLanguage,
    lang,
    posterRenderOpts,
    syncStudyCardsFromRaw,
  ]);

  const isWorkspaceMode = mode === 'edit' || mode === 'export';
  const inkFocusGroupIndex =
    inkEditTarget && inkEditTarget.kind !== 'title' ? inkEditTarget.groupIndex : null;

  return (
    <ErrorBoundary>
    <AppToastContext.Provider value={appToast.show}>
    <div
      className={`app app-screen${mode === 'input' ? ' app--home' : ''}${mode === 'edit' ? ' app--edit' : ''}${mode === 'export' ? ' app--export app--preview' : ''}`}
    >
      <OfflineBanner online={network.online} loading={network.loading} />

      <header
        className={`app-header app-brand-bar app-screen__header${isWorkspaceMode ? ' app-header--compact' : ''}`}
      >
        <div className="app-brand-bar__inner">
          <div className="app-brand-bar__top">
            {mode === 'input' && (
              <div className="app-chain-btn-wrapper">
                <button
                  ref={chainBtnRef}
                  type="button"
                  className={`app-chain-btn${hasMusicLink ? ' has-link' : ''}`}
                  aria-label={hasMusicLink ? '已检测到音乐链接' : '暂无音乐链接'}
                  onClick={async () => {
                    if (!hasMusicLink) {
                      setChainTipVisible((prev) => !prev);
                    } else {
                      // 有链接：重新粘贴最近一次检测到的歌曲信息
                      // 安全校验：当前剪贴板若是 AI 结构化歌词，禁止粘贴到输入字段
                      try {
                        const currentClipText = await postClipboardRead();
                        if (currentClipText && isStructuredLyricsClipboardText(currentClipText)) {
                          // 剪贴板已是 AI 歌词 → 不污染字段
                          console.log('[LinkChain] 剪贴板为结构化歌词，拒绝恢复');
                          return;
                        }
                      } catch { /* 读取失败则允许恢复 */ }
                      // 恢复历史数据
                      if (lastDetectedShareRef.current) {
                        const d = lastDetectedShareRef.current;
                        setShareOcrData((prev) => ({ ...prev, ...d }));
                        if (d.detectedLanguage) {
                          const mappedLang = ocrLangToLyricsLanguage(d.detectedLanguage);
                          if (mappedLang) {
                            setAppSettings((prev) => ({ ...prev, lyricsLanguage: mappedLang }));
                            saveAppSettings({ lyricsLanguage: mappedLang });
                          }
                        }
                      }
                    }
                  }}
                >
                  <LinkChainIcon />
                </button>
              </div>
            )}
            <div className="app-brand-stack">
              <p className="app-brand">SHUFURI</p>
              <p className="app-brand-tagline">优雅简洁的日语释音与排版助手</p>
            </div>
            {mode === 'input' && (
              <div className="app-header-buttons">
                <button
                  type="button"
                  className="app-settings-btn"
                  aria-label="设置"
                  onClick={() => setSettingsOpen(true)}
                >
                  <SettingsMenuIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 链条 tooltip：position:fixed + 边界检测，避免被屏幕边缘截断 */}
      {chainTipVisible && mode === 'input' && chainBtnRef.current && (
        <ChainLinkTooltip anchorRect={chainBtnRef.current.getBoundingClientRect()} />
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChange={handleSettingsChange}
      />

      <div className="app-screen__body">
        <main className={`app-main${isWorkspaceMode ? ' app-main--preview' : ''}`}>
          {mode === 'input' && (
            <div className="home-body">
                  <HtmlPasteInput
                    key={inputResetKey}
                    includeVocabAndGrammar={appSettings.defaultIncludeVocabAndGrammar}
                    language={appSettings.lyricsLanguage}
                    wheelLanguages={wheelLanguages}
                    matrix={languageMatrixContext}
                    onLanguageChange={(lang) => {
                      handleSettingsChange(saveAppSettings({ lyricsLanguage: lang }));
                    }}
                    initialTitle={shareOcrData?.title}
                    initialArtist={shareOcrData?.artist}
                    ocrDetectedLanguage={shareOcrData?.detectedLanguage}
                    pasteLayoutReady={pasteLayoutReady}
                    onActivatePasteLayout={(formMeta) => void handleActivatePasteLayout(formMeta)}
                    onFormMetaChange={(meta) => {
                      homeFormMetaRef.current = meta;
                    }}
                  />
                  <SavedLyricsLibrary onOpen={openProject} refreshKey={libraryRefreshKey} />
                  <StudyCardsLibrary refreshKey={studyCardsRefreshKey} />
            </div>
          )}

          {mode === 'edit' && (
            <div className="edit-area">
              <InkToolbox
                open={inkToolboxOpen}
                canUndo={canUndoInkEdit}
                showRuby={showRubyAnnotations}
                rubySupported={rubyToggleSupported}
                onToggle={() => setInkToolboxOpen((v) => !v)}
                onUndo={handleInkUndo}
                onShowRubyChange={handleShowRubyChange}
              />
              <div className="edit-toolbar">
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  ← 重新输入
                </button>
                <div className="toolbar-actions">
                  <button
                    type="button"
                    className="btn-export btn-export-save"
                    onClick={() => void handleSave()}
                    disabled={saving || !bodyHtml.trim()}
                  >
                    {saving ? '保存中…' : '保存'}
                  </button>
                  <button
                    type="button"
                    className="btn-export btn-export-primary"
                    onClick={() => void enterExportFlow()}
                    disabled={!bodyHtml.trim()}
                  >
                    导出
                  </button>
                </div>
              </div>

              <div ref={editCanvasRef} className="edit-canvas-scroll">
                <InkFineTuneEditor
                  containerRef={editCanvasRef}
                  focusGroupIndex={inkFocusGroupIndex}
                  editTarget={inkEditTarget}
                  popoverClosing={inkPopoverClosing}
                  draftKanji={inkDraftKanji}
                  draftKana={inkDraftKana}
                  draftZh={inkDraftZh}
                  draftTitle={inkDraftTitle}
                  draftArtist={inkDraftArtist}
                  interaction="click"
                  onOpenTarget={handleInkOpenTarget}
                  onClose={closeInkPopover}
                  onKanjiChange={setInkDraftKanji}
                  onKanaChange={setInkDraftKana}
                  onZhChange={setInkDraftZh}
                  onTitleChange={setInkDraftTitle}
                  onArtistChange={setInkDraftArtist}
                  onConfirm={() => void handleInkConfirm()}
                >
                  <ShufuriPosterEditCanvas
                    title={title}
                    artist={artist}
                    bodyHtml={bodyHtml}
                    layoutProfile={EDIT_LAYOUT}
                    displayScale={editScale}
                    titleMarkupHtml={titleMarkupHtml}
                    lang={lang}
                    language={lyricsLanguage}
                    colorTheme={appSettings.colorTheme}
                    showRuby={showRubyAnnotations}
                  />
                </InkFineTuneEditor>
              </div>
            </div>
          )}

          {mode === 'export' && (
            <ExportPreviewPanel
              pages={pages}
              title={title}
              artist={artist}
              layoutProfile={layoutProfile}
              displayScale={exportScale}
              exporting={exporting}
              saving={saving}
              repaginating={repaginating}
              showRuby={showRubyAnnotations}
              rubySupported={rubyToggleSupported}
              previewTypography={previewTypography}
              previewPagesRef={exportPagesRef}
              onBackToEdit={handleBackToEdit}
              onLayoutChange={(profile) => void handleLayoutChange(profile)}
              onSave={() => void handleSave()}
              onExportPdf={() => void handleExportPdf()}
              onShowRubyChange={handleShowRubyChange}
              onPreviewTypographyChange={setPreviewTypography}
              onPreviewTypographyCommit={scheduleRebuildExportPages}
              language={lyricsLanguage}
              lang={lang}
              renderOptions={posterRenderOpts}
              captureRef={(index) => (el) => {
                pageRefs.current[index] = el;
              }}
            />
          )}

        </main>
      </div>
      {/* 剪贴板检测：从 AI App 返回时检测结构化歌词 */}
      <ClipboardDetectCard
        songTitle={clipboardDetectedSong}
        artist={clipboardDetectedArtist}
        language={clipboardDetectedLang}
        visible={clipboardCardVisible}
        onRenderLayout={() => {
          setClipboardCardVisible(false);
          // 从剪贴板读取全文并进入排版预览
          void (async () => {
            try {
              const text = await postClipboardRead();
              if (text && isStructuredLyricsClipboardText(text)) {
                const { preparePasteForLayout } = await import('./services/lyricsHtml');
                const prepared = preparePasteForLayout(text);
                await handleLayoutFromHtml(
                  prepared.bodyHtml,
                  prepared.title || '',
                  text,
                  prepared.artist,
                  prepared.lang,
                );
              }
            } catch {
              // 静默失败
            }
          })();
        }}
        onDismiss={() => {
          // 标记当前内容为「已消费」，防止下次回到前台时重复弹窗
          if (prevClipboardHashRef.current) {
            consumedClipboardRef.current.add(prevClipboardHashRef.current);
          }
          setClipboardCardVisible(false);
        }}
      />

      <AppToast message={appToast.message} placement="fixed" />
    </div>
    </AppToastContext.Provider>
    </ErrorBoundary>
  );
}
