import { useCallback, useRef, useState } from 'react';
import { buildEncoderPrompt } from '../codec/prompt/buildEncoderPrompt';
import { mergeConfirmedLyricsWithStudy } from '../codec/mergeStream';
import { hapticSuccess } from './useHaptics';
import type { LangCode, PedagogicalLevel } from '../services/appSettings';
import type { LanguageMatrixContext } from '../services/languageMatrix/types';
import { readClipboardText } from '../utils/clipboard';
import {
  clipboardContentHash,
  getStructuredLyricsCardMeta,
  isStructuredLyricsClipboardText,
  prepareStructuredLyricsClipboardText,
  type StructuredLyricsCardFallbacks,
} from '../utils/clipboardStructuredLyrics';
import {
  getLyricConfirmPreview,
  isLyricsOnlyStream,
  isStudyEnrichedStream,
  type LyricPreviewLine,
} from '../utils/lyricConfirm';
import { postClipboardRead, postClipboardWrite } from '../utils/nativeBridge';
import type { ShowAppToast } from '../context/AppToastContext';
import { useEmbeddedAiGenerate } from './useEmbeddedAiGenerate';

type ShareOcrData = {
  title: string;
  artist: string;
  detectedLanguage?: 'jp' | 'ko' | 'zh' | 'mixed' | 'unknown';
};

export type ExternalPromptRequest = {
  text: string;
  token: number;
};

type Options = {
  shareOcrData: ShareOcrData | null;
  showToast: ShowAppToast;
  onRenderLayout: (
    bodyHtml: string,
    title: string,
    rawPaste: string,
    artist?: string,
    lang?: LangCode,
  ) => Promise<void>;
  pedagogicalLevel: PedagogicalLevel;
  matrix: LanguageMatrixContext;
};

async function layoutFromRaw(
  raw: string,
  onRenderLayout: Options['onRenderLayout'],
  showToast: ShowAppToast,
): Promise<void> {
  try {
    const cleaned = prepareStructuredLyricsClipboardText(raw);
    const { preparePasteForLayout } = await import('../services/lyricsHtml');
    const prepared = preparePasteForLayout(cleaned);
    await onRenderLayout(
      prepared.bodyHtml,
      prepared.title || '',
      cleaned,
      prepared.artist,
      prepared.lang,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : '粘贴解析失败';
    if (msg.includes('缺少 @9') || msg.includes('流未闭合')) {
      showToast('解析失败：缺少 @9 闭合行，请让 AI 在末尾单独输出 @9');
    } else if (msg.includes('未知行类型')) {
      showToast('解析失败：含非记录流行（请删除 @9 后的说明文字）');
    } else {
      showToast(`解析失败：${msg}`);
    }
  }
}

export function useStructuredLyricsClipboardCard({
  shareOcrData,
  showToast,
  onRenderLayout,
  pedagogicalLevel,
  matrix,
}: Options) {
  const [clipboardCardVisible, setClipboardCardVisible] = useState(false);
  const [clipboardDetectedSong, setClipboardDetectedSong] = useState('');
  const [clipboardDetectedArtist, setClipboardDetectedArtist] = useState('');
  const [clipboardDetectedLang, setClipboardDetectedLang] = useState<LangCode | undefined>(
    undefined,
  );

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmStreaming, setConfirmStreaming] = useState(false);
  const [isGeneratingStudy, setIsGeneratingStudy] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmArtist, setConfirmArtist] = useState('');
  const [confirmLang, setConfirmLang] = useState<LangCode | undefined>(undefined);
  const [confirmLineCount, setConfirmLineCount] = useState(0);
  const [confirmPreviewLines, setConfirmPreviewLines] = useState<LyricPreviewLine[]>([]);
  const confirmedStreamRef = useRef('');
  const awaitingStudyPasteRef = useRef(false);

  const [externalPrompt, setExternalPrompt] = useState<ExternalPromptRequest | null>(null);
  const promptTokenRef = useRef(0);
  const studyAi = useEmbeddedAiGenerate();

  const consumedClipboardRef = useRef<Set<string>>(new Set());
  const prevClipboardHashRef = useRef('');
  const homeFormMetaRef = useRef({ title: '', artist: '' });

  const pushExternalPrompt = useCallback((text: string) => {
    promptTokenRef.current += 1;
    setExternalPrompt({ text, token: promptTokenRef.current });
  }, []);

  const clearExternalPrompt = useCallback(() => {
    setExternalPrompt(null);
  }, []);

  const buildLyricsPrompt = useCallback(
    (retry = false) => {
      const title = homeFormMetaRef.current.title.trim() || confirmTitle.trim() || '未知歌曲';
      const artist = homeFormMetaRef.current.artist.trim() || confirmArtist.trim() || '佚名';
      return buildEncoderPrompt(artist, title, {
        includeVocabAndGrammar: false,
        matrix,
        phase: 'lyrics',
        retry,
      });
    },
    [matrix, confirmTitle, confirmArtist],
  );

  const buildStudyPrompt = useCallback(
    (confirmed: string) => {
      const title = homeFormMetaRef.current.title.trim() || confirmTitle.trim() || '未知歌曲';
      const artist = homeFormMetaRef.current.artist.trim() || confirmArtist.trim() || '佚名';
      return buildEncoderPrompt(artist, title, {
        includeVocabAndGrammar: true,
        pedagogicalLevel,
        matrix,
        phase: 'study',
        confirmedLyrics: confirmed,
      });
    },
    [matrix, pedagogicalLevel, confirmTitle, confirmArtist],
  );

  const openConfirmSheet = useCallback(
    (raw: string, formMeta?: StructuredLyricsCardFallbacks & { streaming?: boolean }) => {
      const preview = getLyricConfirmPreview(raw, {
        title: formMeta?.title || shareOcrData?.title || homeFormMetaRef.current.title,
        artist: formMeta?.artist || shareOcrData?.artist || homeFormMetaRef.current.artist,
      });
      if (!preview) return false;
      confirmedStreamRef.current = preview.cleanedStream;
      setConfirmStreaming(formMeta?.streaming === true);
      setStudyError(null);
      setConfirmTitle(preview.title);
      setConfirmArtist(preview.artist);
      setConfirmLang(preview.lang);
      setConfirmLineCount(preview.lineCount);
      setConfirmPreviewLines(preview.lines);
      setConfirmVisible(true);
      setClipboardCardVisible(false);
      hapticSuccess();
      return true;
    },
    [shareOcrData],
  );

  const activateClipboardDetectCardFromText = useCallback(
    (text: string, formMeta?: StructuredLyricsCardFallbacks & { streaming?: boolean }): boolean => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      // Step2：等待学习材料粘贴 → 与已确认歌词合并后排版
      if (awaitingStudyPasteRef.current && confirmedStreamRef.current) {
        const study = prepareStructuredLyricsClipboardText(trimmed);
        const hasStudyRows = /(^|\n)[VG]\|/.test(study);
        if (!hasStudyRows && !isStructuredLyricsClipboardText(trimmed)) {
          return false;
        }
        try {
          const { merged, vocabCount, grammarCount } = mergeConfirmedLyricsWithStudy(
            confirmedStreamRef.current,
            study,
          );
          awaitingStudyPasteRef.current = false;
          setConfirmVisible(false);
          void layoutFromRaw(merged, onRenderLayout, showToast).then(() => {
            showToast(
              vocabCount + grammarCount > 0
                ? `已合并词解（V${vocabCount}/G${grammarCount}）并排版`
                : '未检测到词解行，已按确认歌词排版',
            );
          });
          hapticSuccess();
          return true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : '合并失败';
          showToast(`合并失败：${msg}`);
          return true;
        }
      }

      // Step1：仅歌词 → 确认 Sheet
      if (isLyricsOnlyStream(trimmed)) {
        return openConfirmSheet(trimmed, formMeta);
      }

      // 已含 V/G 的完整流 → 旧确认卡直接排版
      if (isStudyEnrichedStream(trimmed)) {
        const meta = getStructuredLyricsCardMeta(trimmed, {
          title: formMeta?.title || shareOcrData?.title || homeFormMetaRef.current.title,
          artist: formMeta?.artist || shareOcrData?.artist || homeFormMetaRef.current.artist,
        });
        if (!meta) return false;
        setClipboardDetectedSong(meta.title);
        setClipboardDetectedArtist(meta.artist);
        setClipboardDetectedLang(meta.lang);
        setClipboardCardVisible(true);
        setConfirmVisible(false);
        hapticSuccess();
        return true;
      }

      return false;
    },
    [openConfirmSheet, onRenderLayout, showToast, shareOcrData],
  );

  const handleActivatePasteLayout = useCallback(
    async (formMeta?: StructuredLyricsCardFallbacks) => {
      try {
        const text = await readClipboardText();
        const trimmed = text.trim();
        if (!trimmed) {
          showToast('剪贴板为空');
          return;
        }
        if (activateClipboardDetectCardFromText(trimmed, formMeta)) {
          prevClipboardHashRef.current = clipboardContentHash(trimmed);
          return;
        }
        showToast(
          awaitingStudyPasteRef.current
            ? '未检测到学习材料记录流（需含 V/G）'
            : '未检测到结构化歌词',
        );
      } catch {
        showToast('无法读取剪贴板');
      }
    },
    [activateClipboardDetectCardFromText, showToast],
  );

  const handleClipboardRenderLayout = useCallback(() => {
    setClipboardCardVisible(false);
    void (async () => {
      try {
        const text = await postClipboardRead();
        if (text && isStructuredLyricsClipboardText(text)) {
          await layoutFromRaw(text, onRenderLayout, showToast);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '粘贴解析失败';
        showToast(`解析失败：${msg}`);
      }
    })();
  }, [onRenderLayout, showToast]);

  const handleClipboardDismiss = useCallback(() => {
    if (prevClipboardHashRef.current) {
      consumedClipboardRef.current.add(prevClipboardHashRef.current);
    }
    setClipboardCardVisible(false);
  }, []);

  const handleConfirmDismiss = useCallback(() => {
    if (prevClipboardHashRef.current) {
      consumedClipboardRef.current.add(prevClipboardHashRef.current);
    }
    setConfirmVisible(false);
    setConfirmStreaming(false);
    awaitingStudyPasteRef.current = false;
  }, []);

  const handleConfirmLayout = useCallback(() => {
    const stream = confirmedStreamRef.current;
    setConfirmVisible(false);
    awaitingStudyPasteRef.current = false;
    if (!stream) return;
    void layoutFromRaw(stream, onRenderLayout, showToast);
  }, [onRenderLayout, showToast]);

  const handleConfirmStudy = useCallback(async () => {
    const stream = confirmedStreamRef.current;
    if (!stream) return;

    // 优先走内部 AI 生成学习材料；失败时留在弹窗内显示错误，不自动跳到外部粘贴
    setStudyError(null);
    setIsGeneratingStudy(true);
    try {
      const result = await studyAi.generateStudy({
        title: homeFormMetaRef.current.title.trim() || confirmTitle.trim() || '未知歌曲',
        artist: homeFormMetaRef.current.artist.trim() || confirmArtist.trim(),
        confirmedLyrics: stream,
        matrix,
        pedagogicalLevel,
      });
      if (result.status === 'ok') {
        try {
          const { merged, vocabCount, grammarCount } = mergeConfirmedLyricsWithStudy(
            stream,
            result.rawText,
          );
          awaitingStudyPasteRef.current = false;
          setConfirmVisible(false);
          await layoutFromRaw(merged, onRenderLayout, showToast);
          showToast(
            vocabCount + grammarCount > 0
              ? `已生成并合并词解（V${vocabCount}/G${grammarCount}）并排版`
              : '已按确认歌词排版',
          );
          hapticSuccess();
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : '合并失败';
          setStudyError(`合并失败：${msg}`);
          showToast(`合并失败：${msg}，可重试或改用外部口令`);
        }
      } else {
        setStudyError(result.message || '学习材料生成失败');
        showToast(`学习材料生成失败：${result.message || '未知错误'}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '网络错误';
      setStudyError(`生成失败：${msg}`);
      showToast(`生成失败：${msg}`);
    } finally {
      setIsGeneratingStudy(false);
    }
  }, [
    confirmTitle,
    confirmArtist,
    confirmLang,
    matrix,
    pedagogicalLevel,
    studyAi,
    onRenderLayout,
    showToast,
  ]);

  // 用户显式选择改用外部 AI 口令时，再回退到剪贴板口令
  const handleConfirmStudyFallback = useCallback(async () => {
    const stream = confirmedStreamRef.current;
    if (!stream) return;

    const prompt = buildStudyPrompt(stream);
    awaitingStudyPasteRef.current = true;
    setConfirmVisible(false);
    setStudyError(null);
    const write = postClipboardWrite
      ? postClipboardWrite(prompt).catch(() => navigator.clipboard.writeText(prompt))
      : navigator.clipboard.writeText(prompt);
    await write
      .then(() => {
        pushExternalPrompt(prompt);
        showToast('✓ 学习材料口令已复制，粘贴 AI 结果后点「粘贴剪贴板歌词」');
      })
      .catch(() => {
        showToast('复制学习材料口令失败');
        awaitingStudyPasteRef.current = false;
      });
  }, [buildStudyPrompt, pushExternalPrompt, showToast]);

  const handleConfirmRetry = useCallback(() => {
    // 关闭确认页，避免底部 ActionSheet / Toast 被歌词确认浮层（z-index 更高）盖住
    setClipboardCardVisible(false);
    setStudyError(null);
    const prompt = buildLyricsPrompt(true);
    const write = postClipboardWrite
      ? postClipboardWrite(prompt).catch(() => navigator.clipboard.writeText(prompt))
      : navigator.clipboard.writeText(prompt);
    void write
      .then(() => {
        pushExternalPrompt(prompt);
        showToast('✓ 已复制加强完整口令，请重试后再粘贴');
      })
      .catch(() => {
        showToast('复制口令失败');
      });
  }, [buildLyricsPrompt, pushExternalPrompt, showToast, setClipboardCardVisible, setStudyError]);

  return {
    clipboardCardVisible,
    clipboardDetectedSong,
    clipboardDetectedArtist,
    clipboardDetectedLang,
    consumedClipboardRef,
    prevClipboardHashRef,
    homeFormMetaRef,
    activateClipboardDetectCardFromText,
    handleActivatePasteLayout,
    handleClipboardRenderLayout,
    handleClipboardDismiss,
    confirmVisible,
    confirmStreaming,
    isGeneratingStudy,
    studyError,
    confirmTitle,
    confirmArtist,
    confirmLang,
    confirmLineCount,
    confirmPreviewLines,
    handleConfirmLayout,
    handleConfirmStudy,
    handleConfirmStudyFallback,
    handleConfirmRetry,
    handleConfirmDismiss,
    externalPrompt,
    clearExternalPrompt,
  };
}
