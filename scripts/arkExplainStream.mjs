/**
 * 开发环境 / 可部署的 ARK 流式讲解代理（ESM）。
 * 协议：text/event-stream
 *   data: {"type":"meta","model":"..."}\n\n
 *   data: {"type":"delta","text":"..."}\n\n
 *   data: {"type":"done"}\n\n
 *   data: {"type":"error","message":"..."}\n\n
 */

const ARK_CHAT_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
/** 划词短答用 Mini；Pro 深度思考会导致「正在连接模型…」卡住几十秒 */
export const EXPLAIN_STREAM_MODEL = 'doubao-seed-2-0-mini-260215';
export const EXPLAIN_STREAM_MAX_TOKENS = 360;

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<any>}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.prompt
 * @param {import('http').ServerResponse} params.res
 */
export async function writeExplainSse({ apiKey, prompt, res }) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const emit = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    if (!apiKey) throw new Error('ARK_API_KEY not configured');
    if (!prompt || !String(prompt).trim()) throw new Error('prompt is required');

    // 立刻回 meta，避免 UI 一直停在「正在连接…」
    emit({ type: 'meta', model: EXPLAIN_STREAM_MODEL, stage: 'upstream' });

    const upstream = await fetch(ARK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EXPLAIN_STREAM_MODEL,
        messages: [{ role: 'user', content: String(prompt) }],
        temperature: 0.2,
        max_tokens: EXPLAIN_STREAM_MAX_TOKENS,
        stream: true,
        thinking: { type: 'disabled' },
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      let msg = `Upstream ${upstream.status}`;
      try {
        const json = JSON.parse(text);
        msg = json.error?.message || json.message || msg;
      } catch {
        if (text) msg = `${msg}: ${text.slice(0, 200)}`;
      }
      emit({ type: 'error', message: msg });
      res.end();
      return;
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
      emit({ type: 'error', message: 'empty upstream body' });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let modelSent = true; // 已在连接时发出

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line.startsWith('data:')) continue;
        const raw = line.replace(/^data:\s*/, '').trim();
        if (!raw) continue;
        if (raw === '[DONE]') {
          emit({ type: 'done' });
          res.end();
          return;
        }
        let json;
        try {
          json = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!modelSent && json.model) {
          modelSent = true;
          emit({ type: 'meta', model: json.model });
        }
        // 忽略 thinking/reasoning 增量，只取可见正文
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          emit({ type: 'delta', text: delta });
        }
        if (json.choices?.[0]?.finish_reason) {
          emit({ type: 'done' });
          res.end();
          return;
        }
      }
    }

    emit({ type: 'done' });
    res.end();
  } catch (err) {
    try {
      emit({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } catch {
      /* ignore */
    }
    res.end();
  }
}

/**
 * Connect-style middleware for Vite.
 * @param {string} apiKey
 */
export function createExplainStreamMiddleware(apiKey) {
  return async function explainStreamMiddleware(req, res, next) {
    const url = req.url?.split('?')[0] || '';
    if (url !== '/api/explain-stream') return next();
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    try {
      const body = await readJsonBody(req);
      await writeExplainSse({
        apiKey,
        prompt: body.prompt,
        res,
      });
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: { message: err instanceof Error ? err.message : String(err) },
          }),
        );
      } else {
        res.end();
      }
    }
  };
}
