import { useCallback, useRef, useState } from 'react';
import type { PedagogicalLevel } from '../services/appSettings';
import type { LanguageMatrixContext } from '../services/languageMatrix/types';
import { buildEncoderPrompt } from '../codec/prompt/buildEncoderPrompt';
import {
  resolveStudySourceLanguage,
  type DetectedLyricsLanguage,
} from '../codec/detectLyricsLanguage';
import {
  buildStudyLangProbeBase,
  logStudyLangProbe,
  sampleVocabHeadwords,
} from '../codec/studyLangProbe';
import { isZhPinyinVocabPoison } from '../codec/studyVocabSanity';
import { cleanDoubaoPaste } from '../utils/cleanDoubaoPaste';
import { normalizeStreamInput } from '../codec/repairStreamEnvelope';
import { compileDocument } from '../codec/compileDocument';
import type { ParsedStreamLyrics } from '../codec/types';
import { cloudbaseGateway } from '../services/ai/cloudbaseGateway';
import type { AiGatewayResponse, ArkProxyUsage } from '../services/ai/types';
import { useAiLimit } from '../components/AiLimitContext';
import { refundAiUsage } from '../services/aiUsageLimit';
import { computeLyricsHash } from '../services/ai/lyricsHash';

/** 中文歌词流校验失败的兜底消息（与历史文案兼容） */
const COMPILE_FAILED_MESSAGE_JP = '歌词流校验失败：缺少 jp 段落或结构不完整';
const COMPILE_FAILED_MESSAGE_ZH = '歌词流校验失败：缺少 zh 段落或结构不完整';
const COMPILE_FAILED_MESSAGE_KO = '歌词流校验失败：缺少 ko 段落或结构不完整';
const COMPILE_FAILED_MESSAGE_EN = '歌词流校验失败：缺少 en 段落或结构不完整';

type LastApiInfo = {
  model?: string;
  tokens?: ArkProxyUsage;
};

export type StudyGenerateStatus = 'idle' | 'loading' | 'ok' | 'network_error';

export interface GenerateStudyResultOk {
  status: 'ok';
  rawText: string;
  document: ParsedStreamLyrics;
  apiInfo: LastApiInfo;
  /** 是否命中歌词语法词解缓存（未调用 AI） */
  fromCache?: boolean;
  /** 本次缓存命中节省的费用（元） */
  costSaved?: number;
}

export interface GenerateStudyResultError {
  status: 'error';
  code: 'aborted' | 'no_parse' | 'compile_failed' | 'api_error' | 'limit_reached';
  message: string;
  apiInfo: LastApiInfo;
}

export type GenerateStudyResult = GenerateStudyResultOk | GenerateStudyResultError;

export interface GenerateStudyParams {
  title?: string;
  artist?: string;
  /** 已确认的完整歌词流（H+L+@9），即「粘贴剪贴板歌词」回流的内容 */
  confirmedLyrics: string;
  matrix: LanguageMatrixContext;
  pedagogicalLevel: PedagogicalLevel;
  includeVocabAndGrammar?: boolean;
  retry?: boolean;
  /** 强制重新生成并覆盖已有缓存（用于修复毒数据） */
  forceRefresh?: boolean;
}

/**
 * 内嵌 AI 生成封装。
 * 仅保留「词解与语法」学习材料生成（lyrics.step2）；
 * 「AI 直接找歌词」（lyrics.step1）已移除，歌词获取改由外部分享 / 剪贴板回流。
 */
export function useEmbeddedAiGenerate() {
  const [status, setStatus] = useState<StudyGenerateStatus>('idle');
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastApiInfo, setLastApiInfo] = useState<LastApiInfo>({});
  const [progressMessage, setProgressMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // 保存最近一次 generateStudy 的参数和哈希，供「重新进行 AI 分析」复用
  const lastParamsRef = useRef<GenerateStudyParams | null>(null);
  const lastContentHashRef = useRef<string | undefined>(undefined);

  const { tryUse } = useAiLimit();

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setProgressMessage('');
  }, []);

  const generateStudy = useCallback(
    async (params: GenerateStudyParams): Promise<GenerateStudyResult> => {
      setStatus('loading');
      setProgressMessage('正在生成词解与语法…');
      setAttemptCount((c) => c + 1);

      // 保存参数用于后续 forceRefresh
      lastParamsRef.current = params;

      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setProgressMessage('AI 正在产出词解与语法（联网多源检索）…');

      // AI 限额检查（词解与语法生成）
      // 本地开发 (npm run dev) 不限制 AI 调用次数
      const isDev = (import.meta as any).env?.DEV ?? false;
      if (!params.forceRefresh && !isDev && !tryUse('lyrics')) {
        setStatus('idle');
        return {
          status: 'error',
          code: 'limit_reached',
          message: 'AI 调用次数已用完',
          apiInfo: {},
        } as const;
      }

      // ====== 源语决议：只检 L col3；仅原文强证据才覆盖拨轮 ======
      const wheel = params.matrix.activeTarget as DetectedLyricsLanguage;
      const sourceResolved = resolveStudySourceLanguage(params.confirmedLyrics, wheel);
      const effectiveMatrix: LanguageMatrixContext = sourceResolved.overrideApplied
        ? {
            ...params.matrix,
            activeTarget: sourceResolved.effective,
            learningTargetLanguages: params.matrix.learningTargetLanguages.includes(
              sourceResolved.effective,
            )
              ? params.matrix.learningTargetLanguages
              : ([
                  ...params.matrix.learningTargetLanguages,
                  sourceResolved.effective,
                ] as typeof params.matrix.learningTargetLanguages),
          }
        : params.matrix;

      // 计算内容哈希（非 forceRefresh 场景，为缓存匹配做准备）
      let contentHash: string | undefined;
      if (params.includeVocabAndGrammar !== false) {
        try {
          contentHash = await computeLyricsHash({
            confirmedLyrics: params.confirmedLyrics,
            sourceLanguage: effectiveMatrix.activeTarget,
            targetLanguage: effectiveMatrix.interfaceLanguage,
            pedagogicalLevel: params.pedagogicalLevel,
          });
          lastContentHashRef.current = contentHash;
        } catch {
          // 哈希计算失败不应阻塞主流程（Web Crypto 异常概率极低）
          console.warn('[useEmbeddedAiGenerate] hash computation failed, skipping cache');
        }
      }

      // 埋点：对照旧整段检测 vs 新 L-col3 决议。关闭：localStorage shufuri.studyLangProbe=0
      const studyLangProbeBase = buildStudyLangProbeBase({
        confirmedLyrics: params.confirmedLyrics,
        wheel,
        interfaceLanguage: params.matrix.interfaceLanguage,
        pedagogicalLevel: params.pedagogicalLevel,
        overrideApplied: sourceResolved.overrideApplied,
        effectiveSource: effectiveMatrix.activeTarget,
        contentHash,
      });
      logStudyLangProbe({ ...studyLangProbeBase, phase: 'pre-request' });

      const prompt = buildEncoderPrompt(params.artist ?? '', params.title ?? '', {
        matrix: effectiveMatrix,
        pedagogicalLevel: params.pedagogicalLevel,
        includeVocabAndGrammar: params.includeVocabAndGrammar ?? true,
        confirmedLyrics: params.confirmedLyrics,
        phase: 'study',
        retry: params.retry,
      });

      const sendStudyRequest = async (forceRefresh: boolean, promptText: string) =>
        cloudbaseGateway.send(
          {
            action: 'lyrics.step2',
            requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            prompt: promptText,
            targetLanguage: effectiveMatrix.activeTarget,
            interfaceLanguage: effectiveMatrix.interfaceLanguage,
            contentHash,
            title: params.title,
            artist: params.artist,
            forceRefresh,
          },
          signal,
        );

      let resp: AiGatewayResponse;
      let poisonRejected = false;
      try {
        resp = await sendStudyRequest(params.forceRefresh ?? false, prompt);
        // 毒结果（缓存或现场生成）：源语非 zh 却挖出中文/拼音词头 → 强制覆盖重生成一次
        if (
          resp.ok &&
          isZhPinyinVocabPoison(resp.content ?? '', effectiveMatrix.activeTarget)
        ) {
          poisonRejected = true;
          console.warn(
            '[useEmbeddedAiGenerate] rejected wrong-script vocab',
            `fromCache=${!!resp.fromCache}`,
            '→ forceRefresh + retry prompt',
          );
          const retryPrompt = buildEncoderPrompt(params.artist ?? '', params.title ?? '', {
            matrix: effectiveMatrix,
            pedagogicalLevel: params.pedagogicalLevel,
            includeVocabAndGrammar: params.includeVocabAndGrammar ?? true,
            confirmedLyrics: params.confirmedLyrics,
            phase: 'study',
            retry: true,
            retryReason: 'hallucination',
          });
          resp = await sendStudyRequest(true, retryPrompt);
        }
      } catch (err) {
        if (signal.aborted) {
          return finishStudyAborted();
        }
        return finishStudyNetworkError(err);
      }

      const apiInfo: LastApiInfo = {
        model: resp.model,
        tokens: resp.usage,
      };
      setLastApiInfo(apiInfo);

      if (!resp.ok) {
        return {
          status: 'error',
          code: 'api_error',
          message: resp.error?.message || 'AI 生成词解与语法失败',
          apiInfo,
        };
      }

      const fromCache = !!resp.fromCache;
      const costSaved = resp.costSaved;

      // 缓存命中时不消耗配额（生产环境退还已扣次数，dev 模式从未扣过）
      if (fromCache && !isDev) {
        refundAiUsage('lyrics');
      }

      const rawContent = resp.content ?? '';

      logStudyLangProbe({
        ...studyLangProbeBase,
        phase: 'post-response',
        fromCache: !!resp.fromCache && !poisonRejected,
        vgSample: sampleVocabHeadwords(rawContent),
        poisonRejected,
      });

      // 缓存命中的结果同样需要 parse / compile
      const cleaned = cleanDoubaoPaste(rawContent);
      const normalized = normalizeStreamInput(cleaned);
      if (!normalized) {
        return {
          status: 'error',
          code: 'no_parse',
          message: 'AI 返回的解析文本无法识别为歌词流',
          apiInfo,
        };
      }

      let parsed: ParsedStreamLyrics;
      try {
        parsed = compileDocument(normalized);
      } catch {
        // 按检测到的语种给出更准确的错误提示
        const compileFailedMessage =
          effectiveMatrix.activeTarget === 'zh'
            ? COMPILE_FAILED_MESSAGE_ZH
            : effectiveMatrix.activeTarget === 'ko'
              ? COMPILE_FAILED_MESSAGE_KO
              : effectiveMatrix.activeTarget === 'en'
                ? COMPILE_FAILED_MESSAGE_EN
                : COMPILE_FAILED_MESSAGE_JP;
        return {
          status: 'error',
          code: 'compile_failed',
          message: compileFailedMessage,
          apiInfo,
        };
      }

      const progress = fromCache
        ? `⚡ 缓存命中（< 1s，节省 ¥${costSaved != null ? costSaved.toFixed(4) : '0.0000'}）`
        : '词解与语法已生成';

      setStatus('ok');
      setProgressMessage(progress);
      return { status: 'ok', rawText: normalized, document: parsed, apiInfo, fromCache, costSaved };

      function finishStudyAborted(): GenerateStudyResult {
        setStatus('idle');
        setProgressMessage('');
        return {
          status: 'error',
          code: 'aborted',
          message: '已取消',
          apiInfo: {},
        };
      }

      function finishStudyNetworkError(err: unknown): GenerateStudyResult {
        setStatus('network_error');
        setProgressMessage('');
        const message = err instanceof Error ? err.message : '网络错误，请稍后重试';
        return {
          status: 'error',
          code: 'api_error',
          message,
          apiInfo: {},
        };
      }
    },
    [tryUse],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setAttemptCount(0);
    setLastApiInfo({});
    setProgressMessage('');
    lastParamsRef.current = null;
    lastContentHashRef.current = undefined;
  }, []);

  /**
   * 重新进行 AI 分析（forceRefresh: true）。
   * 使用与首次完全相同的参数，但跳过缓存并覆盖已有错误数据。
   */
  const reanalyze = useCallback(async (): Promise<GenerateStudyResult> => {
    const params = lastParamsRef.current;
    if (!params) {
      return {
        status: 'error',
        code: 'api_error',
        message: '没有可重试的歌词参数',
        apiInfo: {},
      };
    }
    return generateStudy({ ...params, forceRefresh: true });
  }, [generateStudy]);

  return {
    status,
    attemptCount,
    lastApiInfo,
    progressMessage,
    generateStudy,
    reanalyze,
    cancel,
    reset,
  };
}
