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
}

/**
 * 内嵌 AI 生成封装。
 * 仅保留「词解与语法」学习材料生成（lyrics.step2）；
 * 无状态网关：不做公共哈希缓存读写。
 */
export function useEmbeddedAiGenerate() {
  const [status, setStatus] = useState<StudyGenerateStatus>('idle');
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastApiInfo, setLastApiInfo] = useState<LastApiInfo>({});
  const [progressMessage, setProgressMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const lastParamsRef = useRef<GenerateStudyParams | null>(null);

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

      lastParamsRef.current = params;

      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setProgressMessage('AI 正在产出词解与语法（联网多源检索）…');

      // AI 限额检查（词解与语法生成）
      // 本地开发 (npm run dev) 不限制 AI 调用次数
      const isDev = (import.meta as any).env?.DEV ?? false;
      if (!isDev && !tryUse('lyrics')) {
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

      const studyLangProbeBase = buildStudyLangProbeBase({
        confirmedLyrics: params.confirmedLyrics,
        wheel,
        interfaceLanguage: params.matrix.interfaceLanguage,
        pedagogicalLevel: params.pedagogicalLevel,
        overrideApplied: sourceResolved.overrideApplied,
        effectiveSource: effectiveMatrix.activeTarget,
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

      const sendStudyRequest = async (promptText: string) =>
        cloudbaseGateway.send(
          {
            action: 'lyrics.step2',
            requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            prompt: promptText,
            targetLanguage: effectiveMatrix.activeTarget,
            interfaceLanguage: effectiveMatrix.interfaceLanguage,
            title: params.title,
            artist: params.artist,
          },
          signal,
        );

      let resp: AiGatewayResponse;
      let poisonRejected = false;
      try {
        resp = await sendStudyRequest(prompt);
        // 毒结果：源语非 zh 却挖出中文/拼音词头 → 用 retry prompt 再请求一次
        if (
          resp.ok &&
          isZhPinyinVocabPoison(resp.content ?? '', effectiveMatrix.activeTarget)
        ) {
          poisonRejected = true;
          console.warn(
            '[useEmbeddedAiGenerate] rejected wrong-script vocab → retry prompt',
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
          resp = await sendStudyRequest(retryPrompt);
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

      const rawContent = resp.content ?? '';

      logStudyLangProbe({
        ...studyLangProbeBase,
        phase: 'post-response',
        vgSample: sampleVocabHeadwords(rawContent),
        poisonRejected,
      });

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

      setStatus('ok');
      setProgressMessage('词解与语法已生成');
      return { status: 'ok', rawText: normalized, document: parsed, apiInfo };

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
  }, []);

  /** 用最近一次参数再次生成（照常扣配额；无云端缓存覆盖语义） */
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
    return generateStudy({ ...params });
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
