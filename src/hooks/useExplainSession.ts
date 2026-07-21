import { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  buildMicroscopeAiExplainPrompt,
  langCodeToMicroscopeLanguage,
  normalizeAiExplainText,
  parseAiExplainParts,
  type MicroscopeExplainResult,
  type MicroscopeLocalLemma,
  type MicroscopeSongContext,
} from '../codec/prompt/buildMicroscopePrompt';
import { cloudbaseGateway, generateExplanation } from '../services/ai';
import { resolveExplainStreamUrl, streamExplanation } from '../services/ai/explainStream';
import type { InterfaceLanguage, LangCode } from '../services/appSettings';
import { getAppSettings } from '../services/appSettings';
import {
  ensureJmdictLiteLoaded,
  getJmdictLiteMeta,
  jmdictHitToMicroscope,
  lookupJmdictLite,
} from '../services/dict/jmdictLite';
import {
  ensureKrdictLiteLoaded,
  getKrdictLiteMeta,
  krdictHitToMicroscope,
  lookupKrdictLite,
} from '../services/dict/krdictLite';
import { ensureKuromojiLoaded } from '../services/dict/kuromojiTokenizer';
import type { ExplainPickContext } from '../utils/readSelectionForExplain';

export type ExplainResultSource = 'local' | 'ai' | null;

export type UseExplainSessionOptions = {
  title: string;
  artist: string;
  lyrics: string;
  lang: LangCode | undefined;
  savedProjectId: string | null;
  showToast: (msg: string) => void;
  /** 将 AI 讲解写入歌词正文笔记区 */
  appendExplainNote?: (payload: {
    id: string;
    term: string;
    contextSense: string;
    grammar?: string;
    mood?: string;
  }) => void;
};

export type UseExplainSessionResult = {
  explainMode: boolean;
  arm: () => void;
  disarm: () => void;
  toggleArmed: () => void;

  panelOpen: boolean;
  closePanel: () => void;

  targetPhrase: string;
  surroundingLine: string;
  result: MicroscopeExplainResult | null;
  resultSource: ExplainResultSource;
  /** AI讲解纯文本（不覆盖本地词条） */
  aiExplain: string | null;
  lastModel: string | null;
  loading: boolean;
  deepDiveLoading: boolean;
  /** 流式已连上上游、等待首字 */
  aiStreamReady: boolean;
  error: string | null;
  dictMetaLabel: string | null;

  analyzeSelection: (selection: string, context?: string | ExplainPickContext) => void;
  retryAnalyze: () => void;
  /** 显式「AI讲解」：带上下文 + 本地摘要 */
  requestAiDeepDive: () => void;
  /** 将当前 AI 讲解追加为歌词正文笔记条 */
  addToLyricsNote: () => void;
};

type AnalyzeMeta = {
  phrase: string;
  line: string;
  prevLine: string;
  nextLine: string;
};

function lemmaFromResult(result: MicroscopeExplainResult | null): MicroscopeLocalLemma | null {
  if (!result) return null;
  const m = result.micro_analysis;
  return {
    dictionary_form: m.dictionary_form,
    pronunciation: m.pronunciation,
    part_of_speech: m.part_of_speech,
    direct_meaning: m.direct_meaning,
  };
}

export function useExplainSession({
  title,
  artist,
  lyrics: _lyrics,
  lang,
  savedProjectId: _savedProjectId,
  showToast,
  appendExplainNote,
}: UseExplainSessionOptions): UseExplainSessionResult {
  const [explainMode, setExplainMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [targetPhrase, setTargetPhrase] = useState('');
  const [surroundingLine, setSurroundingLine] = useState('');
  const [result, setResult] = useState<MicroscopeExplainResult | null>(null);
  const [resultSource, setResultSource] = useState<ExplainResultSource>(null);
  const [aiExplain, setAiExplain] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [aiStreamReady, setAiStreamReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dictMetaLabel, setDictMetaLabel] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const analyzeMetaRef = useRef<AnalyzeMeta>({
    phrase: '',
    line: '',
    prevLine: '',
    nextLine: '',
  });
  const resultRef = useRef<MicroscopeExplainResult | null>(null);
  const aiExplainRef = useRef<string | null>(null);

  const buildContext = useCallback(
    (
      phrase: string,
      meta: AnalyzeMeta,
      localLemma?: MicroscopeLocalLemma | null,
    ): MicroscopeSongContext => {
      const settings = getAppSettings();
      const interfaceLanguage: InterfaceLanguage = settings.interfaceLanguage;
      return {
        language: langCodeToMicroscopeLanguage(lang),
        title: title.trim() || '未知曲目',
        artist: artist.trim() || '佚名',
        targetPhrase: phrase,
        surroundingLine: meta.line || phrase,
        prevLine: meta.prevLine || undefined,
        nextLine: meta.nextLine || undefined,
        localLemma: localLemma ?? null,
        interfaceLanguage,
      };
    },
    [artist, lang, title],
  );

  const cancelInFlight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    setExplainMode(true);
    const code = lang ?? 'jp';
    if (code === 'jp') {
      void ensureJmdictLiteLoaded().catch(() => {});
      void ensureKuromojiLoaded().catch((err) => {
        console.warn('[kuromoji] preload failed', err);
      });
    } else if (code === 'ko') {
      void ensureKrdictLiteLoaded().catch((err) => {
        console.warn('[krdict] preload failed', err);
      });
    }
  }, [lang]);

  const disarm = useCallback(() => {
    setExplainMode(false);
  }, []);

  const toggleArmed = useCallback(() => {
    setExplainMode((v) => !v);
  }, []);

  const closePanel = useCallback(() => {
    cancelInFlight();
    setPanelOpen(false);
    setError(null);
    setDeepDiveLoading(false);
  }, [cancelInFlight]);

  const requestAiDeepDive = useCallback(() => {
    const meta = analyzeMetaRef.current;
    if (!meta.phrase || deepDiveLoading || loading) return;

    cancelInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    const localLemma = lemmaFromResult(resultRef.current);
    const prompt = buildMicroscopeAiExplainPrompt(
      buildContext(meta.phrase, meta, localLemma),
    );
    const settings = getAppSettings();
    const requestId = nanoid();
    setDeepDiveLoading(true);
    setAiStreamReady(false);
    setError(null);
    setAiExplain(''); // 立刻清空，准备边收边显
    aiExplainRef.current = '';

    const applyDelta = (accumulated: string) => {
      aiExplainRef.current = accumulated;
      setAiExplain(accumulated);
    };

    void (async () => {
      try {
        const streamUrl = resolveExplainStreamUrl();
        // 优先 SSE；失败（404/网络）再降级 callFunction，避免手机白等或硬失败
        if (streamUrl) {
          const streamed = await streamExplanation({
            requestId,
            prompt,
            targetLanguage: lang ?? 'jp',
            interfaceLanguage: settings.interfaceLanguage,
            signal: controller.signal,
            onDelta: (acc) => applyDelta(acc),
            onMeta: (model, stage) => {
              setLastModel(model);
              if (stage === 'upstream') setAiStreamReady(true);
            },
          });
          if (controller.signal.aborted) return;
          if (streamed.ok && streamed.content) {
            setDeepDiveLoading(false);
            setAiStreamReady(false);
            if (streamed.model) setLastModel(streamed.model);
            applyDelta(normalizeAiExplainText(streamed.content));
            return;
          }
          // 流式不可用：清空半截文本，走云函数整段
          console.warn(
            '[explain] stream failed, fallback callFunction',
            streamed.error?.message || 'empty',
          );
          applyDelta('');
          setAiStreamReady(false);
        }

        await cloudbaseGateway.init();
        setAiStreamReady(true);
        const res = await generateExplanation(
          cloudbaseGateway,
          requestId,
          prompt,
          lang ?? 'jp',
          settings.interfaceLanguage,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (res.model) setLastModel(res.model);
        setDeepDiveLoading(false);
        setAiStreamReady(false);
        if (!res.ok || !res.content) {
          setError(
            (res.error?.message || 'AI讲解失败') +
              (res.model ? `（model: ${res.model}）` : ''),
          );
          return;
        }
        const text = normalizeAiExplainText(res.content);
        if (!text) {
          setError('AI讲解为空，请重试' + (res.model ? `（model: ${res.model}）` : ''));
          return;
        }
        applyDelta(text);
      } catch (err) {
        if (controller.signal.aborted) return;
        setDeepDiveLoading(false);
        setAiStreamReady(false);
        const raw = err instanceof Error ? err.message : '请求失败';
        const isTimeout =
          (err instanceof DOMException && err.name === 'AbortError') ||
          /超时|timeout|AbortError/i.test(raw);
        setError(
          isTimeout
            ? 'AI讲解超时：请检查网络或云函数超时≥60s'
            : raw,
        );
      }
    })();
  }, [buildContext, cancelInFlight, deepDiveLoading, lang, loading]);

  const analyzeSelection = useCallback(
    (selection: string, context?: string | ExplainPickContext) => {
      const phrase = selection.replace(/\s+/g, ' ').trim();
      if (!phrase) {
        showToast('请先划选要分析的词或句');
        return;
      }

      let line = phrase;
      let prevLine = '';
      let nextLine = '';
      if (typeof context === 'string') {
        line = context.replace(/\s+/g, ' ').trim() || phrase;
      } else if (context && typeof context === 'object') {
        line = (context.surroundingLine || phrase).replace(/\s+/g, ' ').trim();
        prevLine = (context.prevLine || '').replace(/\s+/g, ' ').trim();
        nextLine = (context.nextLine || '').replace(/\s+/g, ' ').trim();
      }

      cancelInFlight();
      const meta: AnalyzeMeta = { phrase, line, prevLine, nextLine };
      analyzeMetaRef.current = meta;
      setTargetPhrase(phrase);
      setSurroundingLine(line);
      setResult(null);
      resultRef.current = null;
      setResultSource(null);
      setAiExplain(null);
      aiExplainRef.current = null;
      setError(null);
      setLastModel(null);
      setPanelOpen(true);
      setDeepDiveLoading(false);

      const code = lang ?? 'jp';
      const useLocal = code === 'jp' || code === 'ko';

      if (!useLocal) {
        setLoading(false);
        setError('当前语言暂无本地词典，可点「AI讲解」。');
        return;
      }

      setLoading(true);

      if (code === 'ko') {
        void lookupKrdictLite(phrase)
          .then((hit) => {
            const dictMeta = getKrdictLiteMeta();
            if (dictMeta) {
              setDictMetaLabel(`KRDICT lite · ${dictMeta.n} 词`);
            }
            if (hit) {
              const parsed = krdictHitToMicroscope(hit);
              resultRef.current = parsed;
              setResult(parsed);
              setResultSource('local');
              setLoading(false);
              setError(null);
              return;
            }
            resultRef.current = null;
            setResult(null);
            setResultSource(null);
            setLoading(false);
            setError('本地词典未命中。可缩短选区，或直接点「AI讲解」。');
          })
          .catch((err) => {
            console.warn('[krdict]', err);
            resultRef.current = null;
            setResult(null);
            setResultSource(null);
            setLoading(false);
            setError(
              err instanceof Error
                ? `本地词典加载失败：${err.message}。可点「AI讲解」。`
                : '本地词典加载失败。可点「AI讲解」。',
            );
          });
        return;
      }

      void lookupJmdictLite(phrase)
        .then((hit) => {
          const dictMeta = getJmdictLiteMeta();
          if (dictMeta) {
            setDictMetaLabel(`Kuromoji + ${dictMeta.src} · ${dictMeta.n} 词`);
          }
          if (hit) {
            const parsed = jmdictHitToMicroscope(hit);
            resultRef.current = parsed;
            setResult(parsed);
            setResultSource('local');
            setLoading(false);
            setError(null);
            return;
          }
          resultRef.current = null;
          setResult(null);
          setResultSource(null);
          setLoading(false);
          setError('本地词典未命中。可缩短选区，或直接点「AI讲解」。');
        })
        .catch((err) => {
          console.warn('[jmdict]', err);
          resultRef.current = null;
          setResult(null);
          setResultSource(null);
          setLoading(false);
          setError(
            err instanceof Error
              ? `本地词典加载失败：${err.message}。可点「AI讲解」。`
              : '本地词典加载失败。可点「AI讲解」。',
          );
        });
    },
    [cancelInFlight, lang, showToast],
  );

  const retryAnalyze = useCallback(() => {
    const { phrase, line, prevLine, nextLine } = analyzeMetaRef.current;
    if (!phrase) return;
    analyzeSelection(phrase, { text: phrase, surroundingLine: line, prevLine, nextLine });
  }, [analyzeSelection]);

  const addToLyricsNote = useCallback(() => {
    if (!appendExplainNote) {
      showToast('当前页面无法添加笔记');
      return;
    }
    const noteId = nanoid();
    const micro = result?.micro_analysis;
    const aiParts = aiExplain ? parseAiExplainParts(aiExplain) : null;
    const contextSense = aiParts?.contextSense?.trim() || '';
    const grammar = aiParts?.grammar?.trim() || '';
    const mood = aiParts?.mood?.trim() || '';
    const term = (targetPhrase || micro?.dictionary_form || '').replace(/\s+/g, '').trim();
    if (!term) {
      showToast('暂无可添加的内容');
      return;
    }
    if (!contextSense && !grammar && !mood) {
      showToast('请先完成 AI讲解');
      return;
    }
    appendExplainNote({
      id: noteId,
      term,
      contextSense: contextSense || micro?.direct_meaning?.trim() || term,
      grammar: grammar || undefined,
      mood: mood || undefined,
    });
    showToast('已添加到笔记');
  }, [aiExplain, appendExplainNote, result, showToast, targetPhrase]);

  return {
    explainMode,
    arm,
    disarm,
    toggleArmed,
    panelOpen,
    closePanel,
    targetPhrase,
    surroundingLine,
    result,
    resultSource,
    aiExplain,
    lastModel,
    loading,
    deepDiveLoading,
    aiStreamReady,
    error,
    dictMetaLabel,
    analyzeSelection,
    retryAnalyze,
    requestAiDeepDive,
    addToLyricsNote,
  };
}
