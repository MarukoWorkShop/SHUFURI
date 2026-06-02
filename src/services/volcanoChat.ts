/**
 * 火山引擎 ARK Chat Completions
 * 本地开发 / preview：走 Vite 代理 /api/ark，避免浏览器 CORS
 * .env：VITE_ARK_API_KEY（或 ARK_API_KEY）、VITE_ARK_HOME_MODEL
 */

const ARK_DIRECT = 'https://ark.cn-beijing.volces.com';

function shouldUseArkProxy(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

const USE_PROXY = shouldUseArkProxy();
const ARK_BASE = USE_PROXY ? '/api/ark' : ARK_DIRECT;
const ARK_CHAT_URL = `${ARK_BASE}/api/v3/chat/completions`;

const ARK_API_KEY = import.meta.env.VITE_ARK_API_KEY || import.meta.env.ARK_API_KEY || '';
const ARK_DEFAULT_MODEL =
  import.meta.env.VITE_ARK_HOME_MODEL || 'doubao-seed-2-0-mini-260215';
const DEFAULT_TIMEOUT_MS = 120_000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SendChatMessageOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function parseStreamChunk(line: string): string {
  if (line !== 'data: [DONE]' && line.startsWith('data: ')) {
    try {
      const data = JSON.parse(line.slice(6)) as {
        choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
      };
      const delta = data?.choices?.[0]?.delta;
      return delta?.content ?? '';
    } catch {
      // ignore parse errors
    }
  }
  return '';
}

function wrapFetchError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return error;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return error;
  }
  if (error instanceof TypeError) {
    if (USE_PROXY) {
      return new Error(
        '网络请求失败：请确认已用 npm run dev 启动，并访问 http://localhost:5173（不要直接打开 dist 文件）',
      );
    }
    return new Error(
      '网络请求失败：浏览器无法直连火山引擎 API。请使用 npm run dev 本地启动',
    );
  }
  if (error instanceof Error) return error;
  return new Error('网络请求失败');
}

/**
 * 流式发送对话请求
 */
export async function sendChatMessageStream(
  messages: ChatMessage[],
  options: SendChatMessageOptions = {},
  onChunk?: (text: string) => void,
): Promise<string> {
  const {
    model = ARK_DEFAULT_MODEL,
    max_tokens = 8192,
    temperature = 0.2,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
  } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!USE_PROXY) {
    if (!ARK_API_KEY) {
      throw new Error('未配置 VITE_ARK_API_KEY，请在 .env 中设置');
    }
    headers['Authorization'] = `Bearer ${ARK_API_KEY}`;
  }

  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens,
    temperature,
    stream: true,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  let res: Response;
  try {
    res = await fetch(ARK_CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
    throw wrapFetchError(e);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ARK Chat 错误: ${res.status} ${errText.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('ARK Chat 响应无 body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  try {
    while (true) {
      if (controller.signal.aborted) {
        await reader.cancel().catch(() => undefined);
        throw new DOMException('Aborted', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const delta = parseStreamChunk(trimmed);
        if (delta) {
          fullContent += delta;
          onChunk?.(delta);
        }
      }
    }
    if (buffer.trim()) {
      const delta = parseStreamChunk(buffer.trim());
      if (delta) {
        fullContent += delta;
        onChunk?.(delta);
      }
    }
  } catch (e) {
    await reader.cancel().catch(() => undefined);
    throw wrapFetchError(e);
  } finally {
    externalSignal?.removeEventListener('abort', onExternalAbort);
    reader.releaseLock();
  }

  const content = fullContent.trim();
  if (!content) {
    throw new Error('ARK Chat 返回为空，请检查模型接入点是否正常');
  }
  return content;
}
