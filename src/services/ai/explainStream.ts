import type { AiGatewayResponse } from './types';

/** 流式讲解事件（与 /api/explain-stream SSE 协议一致） */
export type ExplainStreamEvent =
  | { type: 'meta'; model?: string; stage?: string }
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type StreamExplanationResult = {
  ok: boolean;
  requestId: string;
  model?: string;
  content?: string;
  error?: { code: string; message: string; retryable: boolean };
};

/**
 * 流式端点：
 * - 开发：`/api/explain-stream`（Vite 中间件）
 * - Capacitor live（CAP_SERVER_URL → 电脑 Vite）或局域网 http(s) 源：同源 `/api/explain-stream`
 * - 生产正式包：`VITE_EXPLAIN_STREAM_URL`（CloudBase HTTP 云函数 arkExplainStream）
 * - 都没有：返回 null → 降级 callFunction
 */
export function resolveExplainStreamUrl(): string | null {
  const fromEnv = (import.meta.env.VITE_EXPLAIN_STREAM_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return '/api/explain-stream';

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isHttp = protocol === 'http:' || protocol === 'https:';
    const isLocalLan =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local') ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname);
    // Capacitor 指向 Vite live / preview 时，同源即可流式
    if (isHttp && isLocalLan) return '/api/explain-stream';
  }

  return null;
}

function parseSseChunk(buffer: string): { events: ExplainStreamEvent[]; rest: string } {
  const events: ExplainStreamEvent[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() || '';
  for (const block of parts) {
    const line = block
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('data:'));
    if (!line) continue;
    const raw = line.replace(/^data:\s*/, '').trim();
    if (!raw) continue;
    try {
      events.push(JSON.parse(raw) as ExplainStreamEvent);
    } catch {
      /* ignore malformed */
    }
  }
  return { events, rest };
}

/**
 * 流式 AI讲解。onDelta 每次追加增量文本（完整累计由调用方维护或用返回值）。
 */
export async function streamExplanation(params: {
  requestId: string;
  prompt: string;
  targetLanguage: string;
  interfaceLanguage: 'zh' | 'en';
  onDelta?: (accumulated: string, delta: string) => void;
  onMeta?: (model: string, stage?: string) => void;
  signal?: AbortSignal;
}): Promise<StreamExplanationResult> {
  const url = resolveExplainStreamUrl();
  if (!url) {
    return {
      ok: false,
      requestId: params.requestId,
      error: {
        code: 'INVALID_REQUEST',
        message: '流式端点未配置（开发请用 npm run dev；生产请设 VITE_EXPLAIN_STREAM_URL）',
        retryable: false,
      },
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'explain.selection',
      requestId: params.requestId,
      prompt: params.prompt,
      targetLanguage: params.targetLanguage,
      interfaceLanguage: params.interfaceLanguage,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      requestId: params.requestId,
      error: {
        code: 'UPSTREAM_ERROR',
        message: text.slice(0, 300) || `HTTP ${res.status}`,
        retryable: res.status >= 500,
      },
    };
  }

  if (!res.body) {
    return {
      ok: false,
      requestId: params.requestId,
      error: {
        code: 'UPSTREAM_ERROR',
        message: '响应无 body（无法流式）',
        retryable: true,
      },
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let model: string | undefined;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.rest;
    for (const ev of parsed.events) {
      if (ev.type === 'meta' && ev.model) {
        model = ev.model;
        params.onMeta?.(ev.model, ev.stage);
      } else if (ev.type === 'delta' && ev.text) {
        content += ev.text;
        params.onDelta?.(content, ev.text);
      } else if (ev.type === 'error') {
        streamError = ev.message || 'stream error';
      } else if (ev.type === 'done') {
        /* fallthrough */
      }
    }
  }

  // flush trailing
  if (buffer.trim()) {
    const parsed = parseSseChunk(buffer + '\n\n');
    for (const ev of parsed.events) {
      if (ev.type === 'delta' && ev.text) {
        content += ev.text;
        params.onDelta?.(content, ev.text);
      } else if (ev.type === 'meta' && ev.model) {
        model = ev.model;
        params.onMeta?.(ev.model);
      } else if (ev.type === 'error') {
        streamError = ev.message || 'stream error';
      }
    }
  }

  if (streamError) {
    return {
      ok: false,
      requestId: params.requestId,
      model,
      content: content || undefined,
      error: {
        code: 'UPSTREAM_ERROR',
        message: streamError,
        retryable: true,
      },
    };
  }

  if (!content.trim()) {
    return {
      ok: false,
      requestId: params.requestId,
      model,
      error: {
        code: 'EMPTY_OUTPUT',
        message: 'Model returned empty output',
        retryable: true,
      },
    };
  }

  return {
    ok: true,
    requestId: params.requestId,
    model,
    content,
  };
}

/** 将流式结果对齐为 AiGatewayResponse，便于降级路径复用 */
export function streamResultToGateway(
  result: StreamExplanationResult,
): AiGatewayResponse {
  return {
    ok: result.ok,
    requestId: result.requestId,
    model: result.model,
    content: result.content,
    error: result.error
      ? {
          code: result.error.code as AiGatewayResponse['error'] extends infer E
            ? E extends { code: infer C }
              ? C
              : never
            : never,
          message: result.error.message,
          retryable: result.error.retryable,
        }
      : undefined,
  };
}
