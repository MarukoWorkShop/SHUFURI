import { useCallback, useRef, useState } from 'react';
import type { PedagogicalLevel } from '../services/appSettings';
import type { LanguageMatrixContext } from '../services/languageMatrix/types';
import { buildEncoderPrompt } from '../codec/prompt/buildEncoderPrompt';
import { cleanDoubaoPaste } from '../utils/cleanDoubaoPaste';
import { normalizeStreamInput } from '../codec/repairStreamEnvelope';
import { compileDocument } from '../codec/compileDocument';
import type { ParsedStreamLyrics } from '../codec/types';
import { cloudbaseGateway } from '../services/ai/cloudbaseGateway';
import type { AiGatewayResponse, ArkProxyUsage } from '../services/ai/types';

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
  code: 'aborted' | 'no_parse' | 'compile_failed' | 'api_error';
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
 * 「AI 直接找歌词」（lyrics.step1）已移除，歌词获取改由外部分享 / 剪贴板回流。
 */
export function useEmbeddedAiGenerate() {
  const [status, setStatus] = useState<StudyGenerateStatus>('idle');
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastApiInfo, setLastApiInfo] = useState<LastApiInfo>({});
  const [progressMessage, setProgressMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

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

      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setProgressMessage('AI 正在产出词解与语法（联网多源检索）…');

      const prompt = buildEncoderPrompt(params.artist ?? '', params.title ?? '', {
        matrix: params.matrix,
        pedagogicalLevel: params.pedagogicalLevel,
        includeVocabAndGrammar: params.includeVocabAndGrammar ?? true,
        confirmedLyrics: params.confirmedLyrics,
        phase: 'study',
        retry: params.retry,
      });

      let resp: AiGatewayResponse;
      try {
        resp = await cloudbaseGateway.send(
          {
            action: 'lyrics.step2',
            requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            prompt,
            targetLanguage: params.matrix.activeTarget,
            interfaceLanguage: params.matrix.interfaceLanguage,
          },
          signal,
        );
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

      const cleaned = cleanDoubaoPaste(resp.content ?? '');
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
        return {
          status: 'error',
          code: 'compile_failed',
          message: '歌词流校验失败：缺少 jp 段落或结构不完整',
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
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setAttemptCount(0);
    setLastApiInfo({});
    setProgressMessage('');
  }, []);

  return {
    status,
    attemptCount,
    lastApiInfo,
    progressMessage,
    generateStudy,
    cancel,
    reset,
  };
}
