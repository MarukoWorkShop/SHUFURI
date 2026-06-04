import { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import { normalizeLyricsBodyHtml } from './services/lyricsHtml';
import { resolveExportTitle } from './utils/furiganaLayout/posterTitle';
import { buildPosterPagesFromBody, posterPageHtmls } from './utils/furiganaLayout/buildPosterPages';
import { exportPosterPdf } from './utils/exportPosterPdf';
import { exportPosterPdfFromPageHtmls, exportPosterPngFromPageHtmls, posterPdfExportFilename } from './utils/pdfExport';
import InkFineTuneEditor from './components/InkFineTuneEditor';
import type { InkEditTarget } from './components/InkFineTunePopover';
import FuriganaEditCanvas from './components/FuriganaEditCanvas';
import ExportPreviewPanel from './components/ExportPreviewPanel';
import SavedLyricsLibrary from './components/SavedLyricsLibrary';
import HtmlPasteInput from './components/HtmlPasteInput';
import OfflineBanner from './components/OfflineBanner';
import { usePosterPreviewFitScale } from './hooks/usePosterPreviewFitScale';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { hapticSuccess, hapticError } from './hooks/useHaptics';
import { useGlobalButtonFeedback } from './hooks/useGlobalButtonFeedback';
import { ensurePosterFontsLoaded } from './utils/furiganaLayout/fonts';
import { resetPosterPageRefs } from './utils/posterPageRefs';
import { saveLyricsProject, type SavedLyricsProject } from './services/savedLyricsStore';
import { annotateInkEditTargets } from './utils/inkFineTune/annotateInkEditTargets';
import { applyRubyEdit, applyZhLineEdit } from './utils/inkFineTune/applyInkEdit';
import { saveInkFineTuneDraft } from './utils/inkFineTune/inkFineTuneDraft';
import { playPencilScratchSound } from './utils/inkFineTune/pencilScratchSound';
import type { PosterLayoutProfile, PosterPageSlice } from './utils/furiganaLayout/types';
import SettingsPanel from './components/SettingsPanel';
import SettingsMenuIcon from './components/icons/SettingsMenuIcon';
import { getAppSettings, type AppSettings } from './services/appSettings';
import { applyColorTheme } from './utils/applyColorTheme';
import {
  initNativeBridge,
  postToNative,
  type BridgeCommand,
} from './bridge/nativeBridge';

type Mode = 'input' | 'edit' | 'export';

const EDIT_LAYOUT: PosterLayoutProfile = 'mobilePoster';
/** 导出操作总超时（毫秒），超过则强制恢复按钮 */
const EXPORT_DEADLINE_MS = 180_000;
const INK_POPOVER_CLOSE_MS = 220;

function prepareBodyHtmlForPreview(rawBodyHtml: string): string {
  return annotateInkEditTargets(normalizeLyricsBodyHtml(rawBodyHtml));
}

/** 桥接用：解析 rawText → bodyHtml */
async function prepareBridgedRawText(rawText: string): Promise<string> {
  const { preparePasteForLayout } = await import('./services/lyricsHtml');
  const parsed = preparePasteForLayout(rawText);
  return annotateInkEditTargets(normalizeLyricsBodyHtml(parsed.bodyHtml));
}

export default function App() {
  // ---- State 声明（必须在 hooks 使用之前） ----
  const [mode, setMode] = useState<Mode>('input');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [pages, setPages] = useState<PosterPageSlice[]>([]);
  const [layoutProfile, setLayoutProfile] = useState<PosterLayoutProfile>(
    () => getAppSettings().defaultExportLayout,
  );
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [inputResetKey, setInputResetKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getAppSettings());

  const network = useNetworkStatus();

  useGlobalButtonFeedback();

  const handleSettingsChange = useCallback((next: AppSettings) => {
    setAppSettings(next);
    applyColorTheme(next.colorTheme);
  }, []);
  const [inkEditTarget, setInkEditTarget] = useState<InkEditTarget | null>(null);
  const [inkPopoverClosing, setInkPopoverClosing] = useState(false);
  const [inkDraftKanji, setInkDraftKanji] = useState('');
  const [inkDraftKana, setInkDraftKana] = useState('');
  const [inkDraftZh, setInkDraftZh] = useState('');
  const [inkDraftTitle, setInkDraftTitle] = useState('');
  const [inkDraftArtist, setInkDraftArtist] = useState('');
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const editCanvasRef = useRef<HTMLDivElement>(null);
  const exportPagesRef = useRef<HTMLDivElement>(null);
  const exportingRef = useRef(false);

  // ---- 用 refs 保持 bridge 回调中的最新状态 ----
  const bodyHtmlRef = useRef('');
  const titleRef = useRef('');
  const artistRef = useRef('');
  const pagesRef = useRef<PosterPageSlice[]>([]);
  const layoutProfileRef = useRef<PosterLayoutProfile>(getAppSettings().defaultExportLayout);
  const bridgeReadyRef = useRef(false);
  const nativeExportingRef = useRef(false);

  // 同步 state 到 refs
  useEffect(() => { bodyHtmlRef.current = bodyHtml; }, [bodyHtml]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { artistRef.current = artist; }, [artist]);
  useEffect(() => { layoutProfileRef.current = layoutProfile; }, [layoutProfile]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

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
        );
      } else {
        await exportPosterPngFromPageHtmls(
          currentPages,
          currentTitle,
          currentProfile,
          baseFilename,
          currentArtist,
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
      resetPosterPageRefs(pageRefs, 0);
    },
    [],
  );

  const enterExportFlow = useCallback(async () => {
    if (!bodyHtml.trim()) {
      return;
    }
    await ensurePosterFontsLoaded();
    const pageHtmls = buildPosterPagesFromBody(bodyHtml, title, layoutProfile, artist);
    setPages(pageHtmls);
    setMode('export');
    resetPosterPageRefs(pageRefs, pageHtmls.length);
  }, [bodyHtml, title, layoutProfile, artist]);

  const openProject = useCallback(
    async (project: SavedLyricsProject) => {
      const profile = project.layoutProfile ?? getAppSettings().defaultExportLayout;
      await enterEditWithLayout(
        project.bodyHtml,
        project.title,
        project.rawLyrics,
        profile,
        project.id,
        project.artist,
      );
    },
    [enterEditWithLayout],
  );

  const handleLayoutFromHtml = useCallback(
    async (nextBodyHtml: string, nextTitle: string, rawPaste: string, nextArtist?: string) => {
      await enterEditWithLayout(
        nextBodyHtml,
        nextTitle,
        rawPaste,
        appSettings.defaultExportLayout,
        null,
        nextArtist,
      );
    },
    [enterEditWithLayout, appSettings.defaultExportLayout],
  );

  const handleLayoutChange = useCallback(
    async (profile: PosterLayoutProfile) => {
      if (profile === layoutProfile || !bodyHtml.trim()) {
        return;
      }
      await ensurePosterFontsLoaded();
      const pageHtmls = buildPosterPagesFromBody(bodyHtml, title, profile, artist);
      setLayoutProfile(profile);
      setPages(pageHtmls);
      resetPosterPageRefs(pageRefs, pageHtmls.length);
    },
    [layoutProfile, bodyHtml, title, artist],
  );

  const handleBackToEdit = useCallback(() => {
    setMode('edit');
    setInkEditTarget(null);
    setInkPopoverClosing(false);
  }, []);

  const handleReset = useCallback(() => {
    setMode('input');
    setLyrics('');
    setTitle('');
    setArtist('');
    setBodyHtml('');
    setPages([]);
    setLayoutProfile(getAppSettings().defaultExportLayout);
    setSavedProjectId(null);
    setInputResetKey((k) => k + 1);
    setInkEditTarget(null);
    setInkPopoverClosing(false);
    resetPosterPageRefs(pageRefs, 0);
  }, []);

  const closeInkPopover = useCallback(() => {
    setInkPopoverClosing(true);
    window.setTimeout(() => {
      setInkEditTarget(null);
      setInkPopoverClosing(false);
    }, INK_POPOVER_CLOSE_MS);
  }, []);

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

    if (inkEditTarget.kind === 'title') {
      setTitle(inkDraftTitle.trim());
      setArtist(inkDraftArtist.trim());
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
        exportPosterPdf(pages, resolveExportTitle(title), layoutProfile, artist),
        deadline,
      ]);
    } catch (e) {
      console.error('[export-pdf]', e);
      alert(e instanceof Error ? e.message : '导出失败');
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [pages, layoutProfile, title, artist]);

  const handleSave = useCallback(async () => {
    if (!bodyHtml.trim() || saving) {
      return;
    }
    setSaving(true);
    setSaveNotice('');
    try {
      await ensurePosterFontsLoaded();
      const pageHtmls =
        pages.length > 0
          ? posterPageHtmls(pages)
          : posterPageHtmls(buildPosterPagesFromBody(bodyHtml, title, layoutProfile, artist));
      const saved = await saveLyricsProject({
        id: savedProjectId ?? undefined,
        title: resolveExportTitle(title),
        artist: artist.trim() || undefined,
        rawLyrics: lyrics,
        bodyHtml,
        pageHtmls,
        layoutProfile,
      });
      setSavedProjectId(saved.id);
      setLibraryRefreshKey((k) => k + 1);
      setSaveNotice('已保存到我的歌词库');
      hapticSuccess();
      window.setTimeout(() => setSaveNotice(''), 2400);
    } catch (e) {
      hapticError();
      alert(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [bodyHtml, pages, savedProjectId, title, artist, lyrics, layoutProfile, saving]);

  const isWorkspaceMode = mode === 'edit' || mode === 'export';
  const inkFocusGroupIndex =
    inkEditTarget && inkEditTarget.kind !== 'title' ? inkEditTarget.groupIndex : null;

  return (
    <div
      className={`app app-screen${mode === 'input' ? ' app--home' : ''}${mode === 'edit' ? ' app--edit' : ''}${mode === 'export' ? ' app--export app--preview' : ''}`}
    >
      <OfflineBanner online={network.online} loading={network.loading} />

      <header
        className={`app-header app-brand-bar app-screen__header${isWorkspaceMode ? ' app-header--compact' : ''}`}
      >
        <div className="app-brand-bar__inner">
          <div className="app-brand-bar__top">
            <div className="app-brand-stack">
              <p className="app-brand">SHUFURI</p>
              <p className="app-brand-tagline">优雅简洁的日语释音与排版助手</p>
            </div>
            {mode === 'input' && (
              <button
                type="button"
                className="app-settings-btn"
                aria-label="设置"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsMenuIcon />
              </button>
            )}
          </div>
        </div>
      </header>

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
                onLayout={handleLayoutFromHtml}
              />
              <SavedLyricsLibrary onOpen={openProject} refreshKey={libraryRefreshKey} />
            </div>
          )}

          {mode === 'edit' && (
            <div className="edit-area">
              <div className="edit-toolbar">
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  ← 重新输入
                </button>
                <div className="toolbar-actions">
                  {saveNotice && <span className="toolbar-save-notice">{saveNotice}</span>}
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
                  <FuriganaEditCanvas
                    title={title}
                    artist={artist}
                    bodyHtml={bodyHtml}
                    layoutProfile={EDIT_LAYOUT}
                    displayScale={editScale}
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
              previewPagesRef={exportPagesRef}
              onBackToEdit={handleBackToEdit}
              onLayoutChange={(profile) => void handleLayoutChange(profile)}
              saveNotice={saveNotice}
              onSave={() => void handleSave()}
              onExportPdf={() => void handleExportPdf()}
              captureRef={(index) => (el) => {
                pageRefs.current[index] = el;
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
