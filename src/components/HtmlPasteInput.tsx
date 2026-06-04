import { useCallback, useEffect, useState } from 'react';
import { buildExternalAiPrompt } from '../services/externalPromptTemplate';
import {
  extractMetaFromPaste,
  isPasteReadyForLayout,
  preparePasteForLayout,
  resolveLayoutArtist,
  resolveLayoutTitle,
} from '../services/lyricsHtml';
import { readClipboardText, writeClipboardText } from '../utils/clipboard';
import { cleanDoubaoPaste } from '../utils/cleanDoubaoPaste';
import EraserIcon from './icons/EraserIcon';

type Props = {
  /** 设置中的「附词解与语法品读」总开关 */
  includeVocabAndGrammar: boolean;
  onLayout: (
    bodyHtml: string,
    title: string,
    rawPaste: string,
    artist?: string,
  ) => void | Promise<void>;
};

function pasteValidationError(text: string): string {
  if (!text.trim()) {
    return '';
  }
  return isPasteReadyForLayout(text)
    ? ''
    : '内容需为 Shufu 结构化文本（===LYRICS===）或 HTML 片段';
}

export default function HtmlPasteInput({ includeVocabAndGrammar, onLayout }: Props) {
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [pasteBack, setPasteBack] = useState('');
  const [error, setError] = useState('');
  const [copyHint, setCopyHint] = useState('');

  const canLayout = isPasteReadyForLayout(pasteBack);
  const canCopyPrompt = Boolean(songTitle.trim());
  const canClear = Boolean(pasteBack.trim());

  useEffect(() => {
    if (!songTitle.trim()) {
      setCopyHint('');
    }
  }, [songTitle]);

  const applyPastedText = useCallback((text: string) => {
    const cleaned = cleanDoubaoPaste(text);
    setPasteBack(cleaned);
    const meta = extractMetaFromPaste(cleaned);
    if (meta.title) {
      setSongTitle((prev) => (prev.trim() ? prev : meta.title!));
    }
    if (meta.artist) {
      setArtist((prev) => (prev.trim() ? prev : meta.artist!));
    }
    setError(pasteValidationError(cleaned));
  }, []);

  const handlePasteBackChange = useCallback((text: string) => {
    setPasteBack(text);
    setError(pasteValidationError(text));
  }, []);

  const handleCopyPrompt = useCallback(async () => {
    const title = songTitle.trim();
    if (!title) {
      setError('请填写歌名');
      setCopyHint('');
      return;
    }
    setError('');
    const promptArtist = artist.trim() || '佚名';
    const prompt = buildExternalAiPrompt(promptArtist, title, { includeVocabAndGrammar });
    try {
      await writeClipboardText(prompt);
      setCopyHint(
        includeVocabAndGrammar
          ? '好了，去粘贴到外部AI（含词解与语法）'
          : '好了，去粘贴到外部AI（仅歌词）',
      );
    } catch {
      setCopyHint('');
      setError('无法写入剪贴板，请允许浏览器权限');
    }
  }, [artist, songTitle, includeVocabAndGrammar]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await readClipboardText();
      if (!text.trim()) {
        setError('剪贴板为空');
        return;
      }
      applyPastedText(text);
    } catch {
      setError('无法读取剪贴板，请允许浏览器访问剪贴板权限');
    }
  }, [applyPastedText]);

  const handleClear = useCallback(() => {
    if (!canClear) {
      return;
    }
    setPasteBack('');
    setError('');
  }, [canClear]);

  const handleLayout = useCallback(async () => {
    if (!canLayout) {
      return;
    }
    const raw = pasteBack.trim();
    try {
      const prepared = preparePasteForLayout(raw);
      const meta = extractMetaFromPaste(raw);
      const title = resolveLayoutTitle(songTitle, prepared.title, meta.title);
      const resolvedArtist = resolveLayoutArtist(
        artist,
        prepared.artist,
        meta.artist,
      );
      setError('');
      await onLayout(prepared.bodyHtml, title, raw, resolvedArtist);
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法进入排版预览');
    }
  }, [onLayout, pasteBack, songTitle, artist, canLayout]);

  const handleTextareaPaste = useCallback(
    (e: { preventDefault(): void; clipboardData: DataTransfer; currentTarget: HTMLTextAreaElement }) => {
      const pasted = e.clipboardData.getData('text/plain');
      if (!pasted) {
        return;
      }
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart ?? pasteBack.length;
      const end = el.selectionEnd ?? pasteBack.length;
      applyPastedText(pasteBack.slice(0, start) + pasted + pasteBack.slice(end));
    },
    [applyPastedText, pasteBack],
  );

  const pasteActionsClass = 'ext-pipeline__paste-actions';

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
        <div className="ext-pipeline__prompt-row">
          {copyHint ? <span className="ext-pipeline__hint">{copyHint}</span> : null}
          <button
            type="button"
            className="btn-filled ext-pipeline__prompt-btn"
            onClick={() => void handleCopyPrompt()}
            disabled={!canCopyPrompt}
          >
            一键生成指令
          </button>
        </div>
      </div>

      <div className="ext-pipeline__paste html-paste__body">
        <textarea
          className="ext-pipeline__textarea"
          placeholder="请在此粘贴 AI 生成的完整歌词..."
          value={pasteBack}
          onChange={(e) => handlePasteBackChange(e.target.value)}
          onPaste={handleTextareaPaste}
        />
        <div className={pasteActionsClass}>
          <button
            type="button"
            className={`btn-tonal${canClear ? '' : ' is-dormant'}`}
            onClick={handleClear}
            disabled={!canClear}
            aria-label="一键清除"
          >
            <EraserIcon size={14} />
            <span>一键清除</span>
          </button>
          <button
            type="button"
            className="btn-filled"
            onClick={() => void handlePasteFromClipboard()}
          >
            一键粘贴
          </button>
          <button
            type="button"
            className="btn-tonal ext-pipeline__layout-btn"
            onClick={() => void handleLayout()}
            disabled={!canLayout}
          >
            排版预览
          </button>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
