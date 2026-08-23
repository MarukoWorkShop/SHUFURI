import { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  buildGrammarPointLessonPrompt,
  buildMicroscopeAiExplainPrompt,
  formatLoanwordsForNote,
  langCodeToMicroscopeLanguage,
  normalizeAiExplainText,
  parseAiExplainParts,
  parseGrammarPointLesson,
  type AiGrammarCapsule,
  type GrammarExampleItem,
  type GrammarPointLesson,
  type MicroscopeExplainResult,
  type MicroscopeLocalLemma,
  type MicroscopeSongContext,
} from '../codec/prompt/buildMicroscopePrompt';
import { cloudbaseGateway, generateExplanation } from '../services/ai';
import { resolveExplainStreamUrl, streamExplanation } from '../services/ai/explainStream';
import { useAiLimit } from '../components/AiLimitContext';
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
import { findGrammarExamplesFromStudyCards } from '../services/grammarExamplesFromStudyCards';

import { ensureKuromojiLoaded } from '../services/dict/kuromojiTokenizer';
import { L } from '../utils/i18n';
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
    formula?: string;
    mood?: string;
  }) => void;
  /** 将胶囊「进一步讲解」单独写入重点语法条 */
  appendGrammarStudyItem?: (payload: {
    id: string;
    titlePrimary: string;
    titleSecondary: string;
    detail: string;
    example: string;
    translation: string;
  }) => void;
};

/** 本地词典/分词器预加载超时阈值（毫秒）：超过即认为加载异常缓慢 */
export const DICT_PRELOAD_TIMEOUT_MS = 8000;

export type UseExplainSessionResult = {
  explainMode: boolean;
  arm: () => void;
  disarm: () => void;
  toggleArmed: () => void;
  /** 提前预加载本地词典/分词器（EditScreen mount 即调用，不必等用户开启划词） */
  preload: () => void;

  panelOpen: boolean;
  closePanel: () => void;

  targetPhrase: string;
  surroundingLine: string;
  /** 曲目语种（用于 AI 解析防串行） */
  lang: LangCode | undefined;
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
  /** 将当前展开的语法讲义单独写入重点语法笔记 */
  addGrammarLessonToNote: () => void;
  /** 点击语法胶囊：短讲义（含义/用法/情感）+ 一条例句 */
  requestGrammarExamples: (capsule: AiGrammarCapsule) => void;
  clearGrammarExamples: () => void;
  activeGrammarCapsule: AiGrammarCapsule | null;
  /** @deprecated 兼容：由 grammarLesson.example 派生 */
  grammarExamples: GrammarExampleItem[];
  grammarLesson: GrammarPointLesson | null;
  grammarExamplesLoading: boolean;
  grammarExamplesError: string | null;
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
  appendGrammarStudyItem,
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
  const [activeGrammarCapsule, setActiveGrammarCapsule] = useState<AiGrammarCapsule | null>(
    null,
  );
  const [grammarLesson, setGrammarLesson] = useState<GrammarPointLesson | null>(null);
  const [grammarExamplesLoading, setGrammarExamplesLoading] = useState(false);
  const [grammarExamplesError, setGrammarExamplesError] = useState<string | null>(null);
  const grammarAbortRef = useRef<AbortController | null>(null);
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

  const { tryUse } = useAiLimit();

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
    if (grammarAbortRef.current) {
      grammarAbortRef.current.abort();
      grammarAbortRef.current = null;
    }
  }, []);

  const clearGrammarExamples = useCallback(() => {
    if (grammarAbortRef.current) {
      grammarAbortRef.current.abort();
      grammarAbortRef.current = null;
    }
    setActiveGrammarCapsule(null);
    setGrammarLesson(null);
    setGrammarExamplesLoading(false);
    setGrammarExamplesError(null);
  }, []);

  /** 提前预加载本地词典/分词器资源（不开启划词模式，仅热身） */
  const preloadDictResources = useCallback(() => {
    const code = lang ?? 'jp';
    if (code === 'jp') {
      void ensureJmdictLiteLoaded().catch((err) => {
        console.warn('[jmdict] preload failed', err);
      });
      void ensureKuromojiLoaded().catch((err) => {
        console.warn('[kuromoji] preload failed', err);
      });
    } else if (code === 'ko') {
      void ensureKrdictLiteLoaded().catch((err) => {
        console.warn('[krdict] preload failed', err);
      });
    }
  }, [lang]);

  const arm = useCallback(() => {
    setExplainMode(true);
    preloadDictResources();
  }, [preloadDictResources]);

  /** 提前预加载：EditScreen mount 即调用，避免首次划词时词典还在加载 */
  const preload = useCallback(() => {
    preloadDictResources();
  }, [preloadDictResources]);

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
    setActiveGrammarCapsule(null);
    setGrammarLesson(null);
    setGrammarExamplesLoading(false);
    setGrammarExamplesError(null);
  }, [cancelInFlight]);

  const requestAiDeepDive = useCallback(() => {
    const meta = analyzeMetaRef.current;
    if (!meta.phrase || deepDiveLoading || loading) return;

    if (!tryUse('explain')) return; // AI 限额检查（划词）

    clearGrammarExamples();
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
            (res.error?.message || L('AI讲解失败', 'AI explanation failed.')) +
              (res.model ? `（model: ${res.model}）` : ''),
          );
          return;
        }
        const text = normalizeAiExplainText(res.content);
        if (!text) {
          setError(L('AI讲解为空，请重试', 'AI explanation is empty, please try again.') + (res.model ? `（model: ${res.model}）` : ''));
          return;
        }
        applyDelta(text);
      } catch (err) {
        if (controller.signal.aborted) return;
        setDeepDiveLoading(false);
        setAiStreamReady(false);
        const raw = err instanceof Error ? err.message : L('请求失败', 'Request failed.');
        const isTimeout =
          (err instanceof DOMException && err.name === 'AbortError') ||
          /超时|timeout|AbortError/i.test(raw);
        setError(
          isTimeout
            ? L('AI讲解超时：请检查网络或云函数超时≥60s', 'AI timeout: Check network or cloud function timeout (≥60s).')
            : raw,
        );
      }
    })();
  }, [buildContext, cancelInFlight, clearGrammarExamples, deepDiveLoading, lang, loading]);

  const requestGrammarExamples = useCallback(
    (capsule: AiGrammarCapsule) => {
      if (!capsule.term || grammarExamplesLoading || deepDiveLoading || loading) return;

      if (grammarAbortRef.current) {
        grammarAbortRef.current.abort();
        grammarAbortRef.current = null;
      }
      const controller = new AbortController();
      grammarAbortRef.current = controller;

      setActiveGrammarCapsule(capsule);
      setGrammarLesson(null);
      setGrammarExamplesError(null);
      if (!tryUse('explain')) return; // AI 限额检查（语法例句）

      setGrammarExamplesLoading(true);

      const meta = analyzeMetaRef.current;
      const settings = getAppSettings();
      const language = langCodeToMicroscopeLanguage(lang);

      void (async () => {
        try {
          const local = await findGrammarExamplesFromStudyCards({
            lang,
            term: capsule.term,
            excludeText: meta.line || meta.phrase,
            limit: 1,
          });
          if (controller.signal.aborted) return;

          const seed = local[0]
            ? { source: local[0].source, text: local[0].text, zh: local[0].zh }
            : null;

          const prompt = buildGrammarPointLessonPrompt({
            language,
            exam: capsule.exam,
            term: capsule.term,
            title: capsule.title,
            songTitle: title,
            artist,
            seedExample: seed,
            interfaceLanguage: settings.interfaceLanguage,
          });
          const requestId = nanoid();

          await cloudbaseGateway.init();
          const res = await generateExplanation(
            cloudbaseGateway,
            requestId,
            prompt,
            lang ?? 'jp',
            settings.interfaceLanguage,
            controller.signal,
          );
          if (controller.signal.aborted) return;

          if (!res.ok || !res.content) {
            // AI 失败时：若有本地例句，仍给一条极简回落
            if (seed) {
              setGrammarLesson({
                meaning: capsule.title || `关于「${capsule.term}」`,
                usage: L('（网络讲解暂不可用，以下为学习卡例句）', '(Online explanation unavailable. Showing study card example below.)'),
                emotion: '—',
                example: { ...local[0], via: 'local' },
                raw: '',
              });
              setGrammarExamplesLoading(false);
              setGrammarExamplesError(res.error?.message || L('讲解生成失败，已显示本地例句', 'Explanation failed, showing local example.'));
              return;
            }
            setGrammarExamplesLoading(false);
            setGrammarExamplesError(res.error?.message || L('获取语法讲解失败', 'Failed to get grammar explanation.'));
            return;
          }

          const lesson = parseGrammarPointLesson(res.content, capsule.term, language);
          // 模型例句不合格时，用本地种子补上
          if (!lesson.example && seed) {
            lesson.example = { ...local[0], via: 'local' };
          }
          setGrammarLesson(lesson);
          setGrammarExamplesLoading(false);
          if (!lesson.meaning && !lesson.usage && !lesson.example) {
            setGrammarExamplesError(L('未生成有效讲解，请重试', 'No valid explanation generated, please try again.'));
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          setGrammarExamplesLoading(false);
          const raw = err instanceof Error ? err.message : L('请求失败', 'Request failed.');
          setGrammarExamplesError(raw);
        }
      })();
    },
    [artist, deepDiveLoading, grammarExamplesLoading, lang, loading, title],
  );

  /**
   * 给本地查词包一层超时：词典/分词器首次加载可能很慢（JMdict gzip 解压 + Kuromoji 17MB），
   * 若超过 DICT_PRELOAD_TIMEOUT_MS 仍未返回，则抛出带标记的错误，UI 会提示改用 AI 讲解或重试，
   * 而不是一直停留在骨架屏。
   */
  const withDictTimeout = useCallback(
    <T>(p: Promise<T>, ms: number = DICT_PRELOAD_TIMEOUT_MS): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('__DICT_TIMEOUT__'));
        }, ms);
        p.then(
          (val) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(val);
          },
          (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
          },
        );
      });
    },
    [],
  );

  /** 把查词错误归一化为用户可见文案（含超时特判） */
  const formatDictError = useCallback(
    (err: unknown): string => {
      if (err instanceof Error && err.message === '__DICT_TIMEOUT__') {
        return L(
          '本地词典加载较慢，已超过 8 秒。可点「AI讲解」直接获取讲解，或稍后重试。',
          'Local dictionary is loading slowly (over 8s). Tap "AI Explain" for instant results, or try again later.',
        );
      }
      if (err instanceof Error) {
        return `${L('本地词典加载失败：', 'Local dictionary load failed:')}${err.message}${L('。可点「AI讲解」。', '. Tap "AI Explain".')}`;
      }
      return L('本地词典加载失败。可点「AI讲解」。', 'Failed to load local dictionary. Tap "AI Explain".');
    },
    [L],
  );

  const analyzeSelection = useCallback(
    (selection: string, context?: string | ExplainPickContext) => {
      const phrase = selection.replace(/\s+/g, ' ').trim();
      if (!phrase) {
        showToast(L('请先划选要分析的词或句', 'Please select a word or sentence to analyze.'));
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
      setActiveGrammarCapsule(null);
      setGrammarLesson(null);
      setGrammarExamplesLoading(false);
      setGrammarExamplesError(null);

      const code = lang ?? 'jp';
      const useLocal = code === 'jp' || code === 'ko';

      if (!useLocal) {
        setLoading(false);
        setError(L('当前语言暂无本地词典，可点「AI讲解」。', 'No local dictionary available for this language. Tap "AI Explain".'));
        return;
      }

      setLoading(true);

      if (code === 'ko') {
        void withDictTimeout(lookupKrdictLite(phrase))
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
            setError(L('本地词典未命中。可缩短选区，或直接点「AI讲解」。', 'Not found in local dictionary. Shorten selection or tap "AI Explain".'));
          })
          .catch((err) => {
            console.warn('[krdict]', err);
            resultRef.current = null;
            setResult(null);
            setResultSource(null);
            setLoading(false);
            setError(formatDictError(err));
          });
        return;
      }

      void withDictTimeout(lookupJmdictLite(phrase))
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
          setError(L('本地词典未命中。可缩短选区，或直接点「AI讲解」。', 'Not found in local dictionary. Shorten selection or tap "AI Explain".'));
        })
        .catch((err) => {
          console.warn('[jmdict]', err);
          resultRef.current = null;
          setResult(null);
          setResultSource(null);
          setLoading(false);
          setError(formatDictError(err));
        });
    },
    [cancelInFlight, formatDictError, lang, showToast, withDictTimeout],
  );

  const retryAnalyze = useCallback(() => {
    const { phrase, line, prevLine, nextLine } = analyzeMetaRef.current;
    if (!phrase) return;
    analyzeSelection(phrase, { text: phrase, surroundingLine: line, prevLine, nextLine });
  }, [analyzeSelection]);

  const addToLyricsNote = useCallback(() => {
    if (!appendExplainNote) {
      showToast(L('当前页面无法添加笔记', 'Cannot add notes on this page.'));
      return;
    }
    const noteId = nanoid();
    const micro = result?.micro_analysis;
    const aiParts = aiExplain
      ? parseAiExplainParts(aiExplain, { language: langCodeToMicroscopeLanguage(lang) })
      : null;
    const contextSense = aiParts?.contextSense?.trim() || '';
    const grammar = aiParts?.grammar?.trim() || '';
    const formula = aiParts?.formulaRaw?.trim() || '';
    const mood = aiParts?.mood?.trim() || '';
    const slang = aiParts?.slang?.trim() || '';
    const loanSummary = formatLoanwordsForNote(aiParts?.loanwords ?? []);
    const moodCombined = [mood, slang].filter(Boolean).join('\n');
    const senseWithLoan = [contextSense, loanSummary ? `外来语：${loanSummary}` : '']
      .filter(Boolean)
      .join('\n');
    const term = (targetPhrase || micro?.dictionary_form || '').replace(/\s+/g, '').trim();
    if (!term) {
      showToast(L('暂无可添加的内容', 'Nothing to add.'));
      return;
    }
    if (!senseWithLoan && !grammar && !moodCombined) {
      showToast(L('请先完成 AI讲解', 'Please wait for the AI explanation to finish.'));
      return;
    }
    appendExplainNote({
      id: noteId,
      term,
      contextSense: senseWithLoan || micro?.direct_meaning?.trim() || term,
      grammar: grammar || undefined,
      formula: formula || undefined,
      mood: moodCombined || undefined,
    });
    showToast(L('已添加到笔记', 'Added to Notes.'));
  }, [aiExplain, appendExplainNote, lang, result, showToast, targetPhrase]);

  const addGrammarLessonToNote = useCallback(() => {
    if (!appendGrammarStudyItem) {
      showToast(L('当前页面无法添加笔记', 'Cannot add notes on this page.'));
      return;
    }
    if (!grammarLesson || !activeGrammarCapsule) {
      showToast(L('请先打开语法考点讲解', 'Open a grammar point lesson first.'));
      return;
    }
    const titlePrimary = activeGrammarCapsule.term.replace(/\s+/g, ' ').trim();
    if (!titlePrimary || titlePrimary === '—' || titlePrimary === '-') {
      showToast(L('暂无可添加的语法点', 'No grammar point to add.'));
      return;
    }
    const detail = [
      grammarLesson.meaning.trim()
        ? `${L('通常含义', 'Common Meaning')}：${grammarLesson.meaning.trim()}`
        : '',
      grammarLesson.usage.trim()
        ? `${L('如何使用', 'How to Use')}：${grammarLesson.usage.trim()}`
        : '',
      grammarLesson.emotion.trim()
        ? `${L('情感语气', 'Emotion & Tone')}：${grammarLesson.emotion.trim()}`
        : '',
      grammarLesson.example?.source
        ? `${L('例句出处', 'Example source')}：${grammarLesson.example.source}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    const example = grammarLesson.example?.text?.trim() || '';
    const translation = grammarLesson.example?.zh?.trim() || '';
    if (!detail && !example) {
      showToast(L('讲解内容为空，请稍后再试', 'Lesson is empty. Try again later.'));
      return;
    }
    appendGrammarStudyItem({
      id: nanoid(),
      titlePrimary,
      titleSecondary: activeGrammarCapsule.title.trim(),
      detail,
      example,
      translation,
    });
    showToast(L('已写入语法笔记', 'Saved as grammar note.'));
  }, [
    activeGrammarCapsule,
    appendGrammarStudyItem,
    grammarLesson,
    showToast,
  ]);

  return {
    explainMode,
    arm,
    disarm,
    toggleArmed,
    preload,
    panelOpen,
    closePanel,
    targetPhrase,
    surroundingLine,
    lang,
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
    addGrammarLessonToNote,
    requestGrammarExamples,
    clearGrammarExamples,
    activeGrammarCapsule,
    grammarExamples: grammarLesson?.example ? [grammarLesson.example] : [],
    grammarLesson,
    grammarExamplesLoading,
    grammarExamplesError,
  };
}
