import { useState, useCallback, useRef } from 'react';
import './App.css';
import { fetchLyricsNotesFromVolcengine, normalizeLyricsBodyHtml } from './services/volcengineLyricsNotes';
import { buildPosterPagesFromBody } from './utils/furiganaLayout/buildPosterPages';
import {
  exportPosterPdfFromPageHtmls,
  exportPosterPngFromPageHtmls,
} from './utils/pdfExport';
import FuriganaHtmlPosterPreview from './components/FuriganaPosterPreview';
import SavedLyricsLibrary from './components/SavedLyricsLibrary';
import { usePosterPreviewFitScale } from './hooks/usePosterPreviewFitScale';
import { ensurePosterJapaneseFontLoaded } from './utils/furiganaLayout/fonts';
import { resetPosterPageRefs } from './utils/posterPageRefs';
import type { SavedLyricsProject } from './services/savedLyricsStore';
import type { PosterLayoutProfile } from './utils/furiganaLayout/types';

type Mode = 'input' | 'generating' | 'preview';

const DEFAULT_LAYOUT: PosterLayoutProfile = 'clipPosterPrint';

export default function App() {
  const [mode, setMode] = useState<Mode>('input');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [streamText, setStreamText] = useState('');
  const [layoutProfile, setLayoutProfile] = useState<PosterLayoutProfile>(DEFAULT_LAYOUT);
  const [includeVocabAndGrammar, setIncludeVocabAndGrammar] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewPagesRef = useRef<HTMLDivElement>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  const exportingRef = useRef(false);

  const previewScale = usePosterPreviewFitScale(
    layoutProfile,
    previewPagesRef,
    mode === 'preview',
    `${pages.length}:${savedProjectId ?? 'new'}:${layoutProfile}`,
  );

  const enterPreviewWithLayout = useCallback(
    async (
      nextBodyHtml: string,
      nextTitle: string,
      nextLyrics: string,
      profile: PosterLayoutProfile,
      projectId: string | null,
    ) => {
      await ensurePosterJapaneseFontLoaded();
      const normalized = normalizeLyricsBodyHtml(nextBodyHtml);
      const pageHtmls = buildPosterPagesFromBody(normalized, nextTitle, profile);
      setTitle(nextTitle);
      setBodyHtml(normalized);
      setLyrics(nextLyrics);
      setLayoutProfile(profile);
      setPages(pageHtmls);
      setError('');
      setMode('preview');
      setSavedProjectId(projectId);
      resetPosterPageRefs(pageRefs, pageHtmls.length);
    },
    [],
  );

  const openProject = useCallback(
    async (project: SavedLyricsProject) => {
      const profile = project.layoutProfile ?? DEFAULT_LAYOUT;
      await enterPreviewWithLayout(
        project.bodyHtml,
        project.title,
        project.rawLyrics,
        profile,
        project.id,
      );
    },
    [enterPreviewWithLayout],
  );

  const handleCancelGenerate = useCallback(() => {
    generateAbortRef.current?.abort();
    generateAbortRef.current = null;
    setStreamText('');
    setMode('input');
  }, []);

  const handleGenerate = useCallback(async () => {
    const text = lyrics.trim();
    if (!text) {
      setError('请先输入日语歌词（一句日语一句中文的格式）');
      return;
    }

    generateAbortRef.current?.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;

    setMode('generating');
    setError('');
    setStreamText('');

    try {
      const result = await fetchLyricsNotesFromVolcengine(
        text,
        (chunk) => {
          setStreamText((prev) => prev + chunk);
        },
        { includeVocabAndGrammar, signal: controller.signal },
      );

      if (controller.signal.aborted) {
        return;
      }

      setStreamText('');
      await enterPreviewWithLayout(
        result.bodyHtml,
        result.title,
        text,
        DEFAULT_LAYOUT,
        null,
      );
    } catch (e) {
      if (controller.signal.aborted) {
        return;
      }
      setError(e instanceof Error ? e.message : '生成失败，请重试');
      setMode('input');
    } finally {
      if (generateAbortRef.current === controller) {
        generateAbortRef.current = null;
      }
    }
  }, [lyrics, includeVocabAndGrammar, enterPreviewWithLayout]);

  const handleLayoutChange = useCallback(
    async (profile: PosterLayoutProfile) => {
      if (profile === layoutProfile || !bodyHtml.trim()) {
        return;
      }
      await ensurePosterJapaneseFontLoaded();
      const pageHtmls = buildPosterPagesFromBody(bodyHtml, title, profile);
      setLayoutProfile(profile);
      setPages(pageHtmls);
      resetPosterPageRefs(pageRefs, pageHtmls.length);
    },
    [layoutProfile, bodyHtml, title],
  );

  const handleReset = useCallback(() => {
    setMode('input');
    setLyrics('');
    setTitle('');
    setBodyHtml('');
    setPages([]);
    setError('');
    setStreamText('');
    setLayoutProfile(DEFAULT_LAYOUT);
    setSavedProjectId(null);
    resetPosterPageRefs(pageRefs, 0);
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('剪贴板为空');
        return;
      }
      setLyrics(text);
      setError('');
    } catch {
      setError('无法读取剪贴板，请允许浏览器访问剪贴板权限');
    }
  }, []);

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
    try {
      await exportPosterPdfFromPageHtmls(
        pages,
        title.trim() || '歌词笔记',
        layoutProfile,
        title.trim() || '歌词笔记',
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : '导出失败');
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [pages, layoutProfile, title]);

  const handleExportPng = useCallback(async () => {
    if (!pages.length) {
      alert('没有可导出的页面');
      return;
    }
    if (exportingRef.current) {
      return;
    }
    exportingRef.current = true;
    setExporting(true);
    try {
      await exportPosterPngFromPageHtmls(
        pages,
        title.trim() || '歌词笔记',
        layoutProfile,
        title.trim() || '歌词笔记',
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : '导出失败');
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [pages, layoutProfile, title]);

  return (
    <div className={`app${mode === 'preview' ? ' app--preview' : ''}${mode === 'input' ? ' app--home' : ''}`}>
      <header className={`app-header${mode === 'preview' ? ' app-header--compact' : ''}`}>
        <h1>日语歌词假名标注</h1>
        {mode !== 'preview' && (
          <p className="subtitle">输入日语歌词，AI 自动添加振假名</p>
        )}
      </header>

      <main className={`app-main${mode === 'preview' ? ' app-main--preview' : ''}`}>
        {mode === 'input' && (
          <div className="home-shell">
            <div className="input-area">
              <div className="toolbar toolbar--home">
                <label className="export-option">
                  <input
                    type="checkbox"
                    checked={includeVocabAndGrammar}
                    onChange={(e) => setIncludeVocabAndGrammar(e.target.checked)}
                  />
                  包含词汇与语法点
                </label>
              </div>

              <div className="lyrics-field">
                <textarea
                  className="lyrics-input"
                  placeholder="请粘贴日语歌词（一句日语一句中文的格式）"
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  onContextMenu={(e) => e.preventDefault()}
                />

                <div className="input-actions">
                  <button type="button" className="btn-paste" onClick={handlePasteFromClipboard}>
                    一键粘贴
                  </button>
                  <button className="btn-primary" onClick={handleGenerate} disabled={!lyrics.trim()}>
                    生成假名标注
                  </button>
                </div>
              </div>

              {error && <p className="error-msg">{error}</p>}
            </div>

            <SavedLyricsLibrary onOpen={openProject} />
          </div>
        )}

        {mode === 'generating' && (
          <div className="generating-shell">
            <button
              type="button"
              className="btn-generating-exit"
              onClick={handleCancelGenerate}
            >
              退出
            </button>
            <div className="generating-area">
              <div className="spinner" />
              <p className="gen-status">AI 正在生成假名标注...</p>
              {streamText && (
                <div className="stream-preview">
                  <pre>{streamText.slice(-500)}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'preview' && (
          <div className="preview-area">
            <div className="preview-toolbar">
              <div className="preview-toolbar-left">
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  ← 重新输入
                </button>
              </div>

              <div className="preview-toolbar-center layout-toggle layout-toggle--preview">
                <button
                  type="button"
                  className={`btn-toggle ${layoutProfile === 'clipPosterPrint' ? 'active' : ''}`}
                  onClick={() => void handleLayoutChange('clipPosterPrint')}
                >
                  B5 打印
                </button>
                <button
                  type="button"
                  className={`btn-toggle ${layoutProfile === 'mobilePoster' ? 'active' : ''}`}
                  onClick={() => void handleLayoutChange('mobilePoster')}
                >
                  手机预览
                </button>
              </div>

              <div className="preview-toolbar-right">
                <span className="page-count">共 {pages.length} 页</span>
                <div className="export-buttons">
                  <button
                    type="button"
                    className="btn-export btn-export-pdf"
                    onClick={() => void handleExportPdf()}
                    disabled={exporting}
                  >
                    {exporting ? '导出中…' : '导出 PDF'}
                  </button>
                  <button
                    type="button"
                    className="btn-export btn-export-png"
                    onClick={() => void handleExportPng()}
                    disabled={exporting}
                  >
                    导出 PNG
                  </button>
                </div>
              </div>
            </div>

            <div ref={previewPagesRef} className="preview-pages-fit">
              <FuriganaHtmlPosterPreview
                title={title}
                pageBodyHtmls={pages}
                layoutProfile={layoutProfile}
                displayScale={previewScale}
                captureRef={(index) => (el) => {
                  pageRefs.current[index] = el;
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
