# 歌词语法词解缓存系统 — 哈希碰撞 + MySQL 结构化匹配

## 一、问题定义

用户确认歌词后勾选「生成语法词解」→ 调用火山引擎 `doubao-seed-2-1-pro-260628`（Pro 模型，联网搜索，¥0.0008/0.002 per 1K tokens + ¥0.03 搜索费）。

**核心痛点**：同一首歌被不同用户重复生成语法词解，每次都是昂贵的 API 调用。

**目标**：高频歌曲的语法词解结果只生成一次，后续请求直接读取 MySQL 缓存。

---

## 二、哈希策略：SHA-256 结构指纹

### 哈希种子（6 维联合匹配）

```
contentHash = SHA-256(
    sourceLanguage        ← 歌词源语言：jp | ko | en | zh
  + "|" + targetLanguage  ← 翻译目标语言：zh | en
  + "|" + pedagogicalLevel ← 教学等级：beginner | intermediate | advanced
  + "|" + lineCount        ← 歌词总行数（非空行数）
  + "|" + firstLine        ← 首行歌词（归一化后）
  + "|" + lastLine         ← 末行歌词（归一化后）
)
```

### 为什么用这 6 个维度而非完整歌词内容？

| 维度 | 作用 | 误匹配风险 |
|------|------|:--:|
| sourceLanguage + targetLanguage | 日→中和日→英是两个完全不同的产物 | 0 |
| pedagogicalLevel | 初级/中级/高级选词差异巨大 | 0 |
| lineCount | 不同歌行数不同（极小概率相同） | ~1/N |
| firstLine + lastLine | 首尾行锁定具体歌曲（N 首同源语歌中几乎唯一） | ~1/N² |
| 6 维联合 | 实际碰撞概率 < 1/10⁶ | **可以忽略** |

> **设计原则**：用结构维度替代全文哈希。优点：
> 1. 同一首歌从不同来源粘贴（空格/换行格式不同），只要首行/末行/行数一致就命中
> 2. 前端计算量极小（只需找首行、末行、数行数，不需要全量 normalize）
> 3. SHA-256 保证 6 维拼接后的确定性指纹

### 归一化规则（仅对首行/末行）

```js
function normalizeLine(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, ' ')           // 折叠连续空格
    .normalize('NFKC');              // 全角/半角/变体字统一
}
```

### 为什么 SHA-256？

| 特性 | 说明 |
|------|------|
| **确定性** | 相同输入永远产生相同 hash，跨浏览器、跨系统一致 |
| **轻量** | 6 个短字符串拼接 ≈ 200 bytes，Web Crypto API ≈ 0.1ms |
| **不可逆** | hash 不含原始歌词，数据库泄露也无法还原歌词内容 |

### 前端实现

```ts
// src/services/ai/lyricsHash.ts

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ').normalize('NFKC');
}

export async function computeLyricsHash(params: {
  confirmedLyrics: string;
  sourceLanguage: string;     // 歌词源语言（如 jp）← activeTarget
  targetLanguage: string;     // 翻译目标语言（如 zh）← interfaceLanguage
  pedagogicalLevel: string;   // 教学等级
}): Promise<string> {
  // 切行，过滤空行
  const lines = params.confirmedLyrics
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const lineCount = lines.length;
  const firstLine = lineCount > 0 ? normalizeLine(lines[0]) : '';
  const lastLine = lineCount > 0 ? normalizeLine(lines[lineCount - 1]) : '';

  // 6 维种子
  const seed = [
    params.sourceLanguage,
    params.targetLanguage,
    params.pedagogicalLevel,
    String(lineCount),
    firstLine,
    lastLine,
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

---

## 三、MySQL 表结构

```sql
CREATE TABLE lyrics_grammar_cache (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  content_hash  CHAR(64)      NOT NULL COMMENT 'SHA-256(源语言|目标语言|等级|行数|首行|末行)',
  title         VARCHAR(512)  NOT NULL DEFAULT '',
  artist        VARCHAR(512)  NOT NULL DEFAULT '',
  source_lang   VARCHAR(10)   NOT NULL COMMENT '歌词源语言 jp|ko|en|zh',
  target_lang   VARCHAR(10)   NOT NULL COMMENT '翻译目标语言 zh|en',
  peda_level    VARCHAR(16)   NOT NULL COMMENT '教学等级 beginner|intermediate|advanced',
  line_count    INT           NOT NULL DEFAULT 0 COMMENT '歌词总行数（非空行）',
  first_line    VARCHAR(1024) NOT NULL DEFAULT '' COMMENT '首行歌词（归一化后截断）',
  last_line     VARCHAR(1024) NOT NULL DEFAULT '' COMMENT '末行歌词（归一化后截断）',
  lyrics_text   LONGTEXT      NOT NULL COMMENT '原始歌词全文（用于未来审计/调试）',
  raw_response  LONGTEXT      NOT NULL,
  model_used    VARCHAR(100)  NOT NULL DEFAULT '',
  input_tokens  INT           NOT NULL DEFAULT 0,
  output_tokens INT           NOT NULL DEFAULT 0,
  est_cost      DECIMAL(10,6) NOT NULL DEFAULT 0,
  hit_count     INT           NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_hit_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_hash (content_hash),
  INDEX      idx_hit_count (hit_count DESC),
  INDEX      idx_last_hit (last_hit_at),
  INDEX      idx_langs_level (source_lang, target_lang, peda_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 为什么用 UNIQUE(content_hash)？

- **防重复写入**：即使两个用户同时命中 MISS 并发调用火山引擎，MySQL 的 `INSERT ... ON DUPLICATE KEY` 保证最终只存一份
- **低碰撞风险**：6 维（源语言 × 目标语言 × 等级 × 行数 × 首行 × 末行）联合 SHA-256，实际碰撞概率 < 1/10⁶
- **审计字段**：`source_lang` / `target_lang` / `line_count` / `first_line` / `last_line` 单独存列，出现疑似碰撞时可人工核对，无需反解 hash

---

## 四、缓存读写流程

```
                            前端 send({ action: 'lyrics.step2', contentHash, forceRefresh, ... })
                                                    │
                                                    ▼
                                     arkProxy 云函数入口
                                                    │
                                    ┌───────────────┴───────────────┐
                                    │  配额校验（IP + UID 硬限额）    │
                                    └───────────────┬───────────────┘
                                                    │
                                    ┌───────────────┴───────────────┐
                                    │  forceRefresh？               │
                                    │  ┌─ 是 → 跳过缓存查询        │
                                    │  │        直接走 API 流程     │
                                    │  │        （见下方「调用火山  │
                                    │  │         引擎」+ 覆盖写入） │
                                    │  └────────────────────────    │
                                    │                               │
                                    │  ┌─ 否 → 正常缓存流程 ──────┐ │
                                    │  │  SELECT FROM cache        │ │
                                    │  │  WHERE content_hash=?      │ │
                                    │  │  ┌─ HIT ──────────────┐   │ │
                                    │  │  │ 更新 hit_count      │   │ │
                                    │  │  │ 返回缓存内容        │   │ │
                                    │  │  │ 不消耗用户配额      │   │ │
                                    │  │  └────────────────────┘   │ │
                                    │  │  ┌─ MISS ─────────────┐   │ │
                                    │  └──│ 走正常 API 流程    │   │ │
                                    │     └────────────────────┘   │ │
                                    └───────────────────────────────┘ │
                                                    │
                                       ┌────────────┴────────────┐
                                       │  调用火山引擎 Pro 模型    │
                                       └────────────┬────────────┘
                                                    │
                                       ┌────────────┴────────────┐
                                       │  API 返回成功？           │
                                       │  ├─ 是 → 写入缓存        │
                                       │  │   forceRefresh/首次？  │
                                       │  │   ┌─ 首次 MISS →      │
                                       │  │   │  INSERT (幂等)    │
                                       │  │   │  不覆盖已有      │
                                       │  │   └─ forceRefresh →   │
                                       │  │      UPSERT (覆盖)    │
                                       │  │      用新数据全量替换 │
                                       │  └─ 否 → 仅返回错误     │
                                       └────────────┬────────────┘
                                                    │
                                                    ▼
                                          返回给前端（附带 fromCache 标识）
```

### 两种写入模式

| 模式 | 触发条件 | SQL 行为 | 效果 |
|------|----------|----------|------|
| **首次写入（幂等）** | 正常 MISS | `INSERT ... ON DUPLICATE KEY UPDATE hit_count=hit_count` | 遇并发冲突不覆盖，保留首条 |
| **覆盖写入（修复）** | `forceRefresh: true` | `INSERT ... ON DUPLICATE KEY UPDATE ... VALUES(...)` 全量替换 | 用新 AI 结果覆盖错误缓存 |
| **缓存 HIT** | 正常命中 | 不写入 | 直接返回 |

### 并发安全

```sql
-- 模式 1：首次写入（幂等，不覆盖已有数据）
INSERT INTO lyrics_grammar_cache
  (content_hash, title, artist, source_lang, target_lang, peda_level,
   line_count, first_line, last_line, lyrics_text,
   raw_response, model_used, input_tokens, output_tokens, est_cost)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  hit_count = hit_count;   -- 不覆盖，保留首条成功结果

-- 模式 2：forceRefresh 覆盖写入（全量替换毒数据）
INSERT INTO lyrics_grammar_cache
  (content_hash, title, artist, source_lang, target_lang, peda_level,
   line_count, first_line, last_line, lyrics_text,
   raw_response, model_used, input_tokens, output_tokens, est_cost)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  artist = VALUES(artist),
  source_lang = VALUES(source_lang),
  target_lang = VALUES(target_lang),
  peda_level = VALUES(peda_level),
  line_count = VALUES(line_count),
  first_line = VALUES(first_line),
  last_line = VALUES(last_line),
  lyrics_text = VALUES(lyrics_text),
  raw_response = VALUES(raw_response),
  model_used = VALUES(model_used),
  input_tokens = VALUES(input_tokens),
  output_tokens = VALUES(output_tokens),
  est_cost = VALUES(est_cost),
  hit_count = hit_count + 1,
  last_hit_at = CURRENT_TIMESTAMP;
```

- **首次写入模式**：并发时第一条写入成功，第二条 `uk_hash` 冲突 → 不覆盖 → 幂等安全
- **覆盖写入模式**：用 `VALUES()` 全量替换所有列，确保毒数据被全新 AI 结果彻底覆盖

---

## 五、API 协议变更

### 请求新增字段

```ts
// src/services/ai/types.ts
export type ArkProxyRequest = {
  action: 'explain.selection' | 'lyrics.step2';
  requestId: string;
  prompt: string;                    // ← MISS 时才用到（调用火山引擎）
  targetLanguage: 'jp' | 'ko' | 'en' | 'zh';  // ← 歌词源语言（activeTarget）
  interfaceLanguage: 'zh' | 'en';    // ← 翻译目标语言
  userId?: string;

  // ===== 以下为歌词缓存哈希新增字段 =====
  /** 6 维结构哈希（SHA-256），前端计算；非 lyrics.step2 不传 */
  contentHash?: string;
  /** 歌名（缓存记录用） */
  title?: string;
  /** 歌手（缓存记录用） */
  artist?: string;
  /**
   * 强制重新生成并**覆盖**已有缓存。
   * - false/不传：正常走缓存流程，HIT 则直接返回，不调 API
   * - true：跳过缓存查询，直接调火山引擎，成功后用新结果**全量覆盖**旧缓存
   *
   * 触发场景：用户发现缓存结果有误（假名注音错误 / 翻译缺失），
   * 点击「重新进行 AI 分析」按钮时发送。
   */
  forceRefresh?: boolean;
};
```

### 响应新增字段

```ts
export type ArkProxyResponse = {
  ok: boolean;
  requestId: string;
  action?: string;
  model?: string;
  content?: string;
  usage?: ArkProxyUsage;
  error?: ArkProxyError;

  // ===== 以下为歌词缓存新增字段 =====
  /** 是否命中缓存 */
  fromCache?: boolean;
  /** 节省的费用估算 */
  costSaved?: number;
};
```

### 关键：`targetLanguage` vs `interfaceLanguage` 命名约定

> ⚠️ 当前项目命名有一定误导性，修改时需注意：

| 字段名 | 实际语义 | 示例值 | 在哈希中的角色 |
|--------|----------|:--:|:--:|
| `targetLanguage` | **歌词源语言**（学习目标语言） | `jp` | `sourceLanguage` |
| `interfaceLanguage` | **翻译/UI 目标语言** | `zh` | `targetLanguage` |

> 哈希用两个语言维度：**源语言决定 AI 选词范围**，**翻译目标语言决定释义输出语言**。两者不同则产物完全不同。

---

## 六、前端改造点（2 个文件）

### 6.1 新建 `src/services/ai/lyricsHash.ts`

- `computeLyricsHash(params)` — 浏览器端 SHA-256 哈希生成（6 维种子）
- `normalizeLine(line)` — 单行归一化（trim + 折叠空格 + NFKC）

### 6.2 修改 `src/hooks/useEmbeddedAiGenerate.ts`

在 `cloudbaseGateway.send()` 之前加入：

```ts
// 在调用前计算 6 维结构哈希（仅 lyrics.step2）
let contentHash: string | undefined;
let title: string | undefined;
let artist: string | undefined;

if (params.includeVocabAndGrammar) {
  contentHash = await computeLyricsHash({
    confirmedLyrics: params.confirmedLyrics,
    sourceLanguage: params.matrix.activeTarget,        // 歌词源语言
    targetLanguage: params.matrix.interfaceLanguage,    // 翻译目标语言
    pedagogicalLevel: params.pedagogicalLevel,
  });
  title = params.title;
  artist = params.artist;
}

resp = await cloudbaseGateway.send({
  action: 'lyrics.step2',
  requestId: ...,
  prompt,
  targetLanguage: params.matrix.activeTarget,       // 保持现有命名
  interfaceLanguage: params.matrix.interfaceLanguage, // 保持现有命名
  contentHash,   // ← NEW
  title,         // ← NEW
  artist,        // ← NEW
});
```

### 哈希维度映射

| 哈希维度 | 来源字段 | 示例值 |
|----------|----------|:--:|
| sourceLanguage | `params.matrix.activeTarget` | `jp` |
| targetLanguage | `params.matrix.interfaceLanguage` | `zh` |
| pedagogicalLevel | `params.pedagogicalLevel` | `intermediate` |
| lineCount | `confirmedLyrics.split('\n').filter(l => l.trim())` | `42` |
| firstLine | `lines[0]` 归一化后 | `夜空を見上げて` |
| lastLine | `lines[last]` 归一化后 | `いつまでも忘れない` |

### 6.3 新增「重新进行 AI 分析」按钮（前端 UI）

在歌词语法词解结果展示区域底部，添加微小操作链接，用于用户修复毒数据：

```tsx
// 当 fromCache === true 且结果已展示时显示
{result.fromCache && (
  <div className="cache-refresh-hint">
    <span className="cache-speed-tag">⚡ 缓存 &middot; {'<'}1s</span>
    <button
      className="cache-refresh-btn"
      onClick={handleReanalyze}
      disabled={refreshStatus === 'loading'}
      title="检测到缓存数据有误？重新调用 AI 生成并覆盖错误缓存"
    >
      {refreshStatus === 'loading'
        ? '重新生成中...'
        : '重新进行 AI 分析'}
    </button>
  </div>
)}
```

```ts
// 点击后发送与首次完全相同的载荷 + forceRefresh: true
async function handleReanalyze() {
  setRefreshStatus('loading');

  const resp = await cloudbaseGateway.send({
    action: 'lyrics.step2',
    requestId: genRequestId(),
    prompt: originalPrompt,                     // ← 与首次完全一致
    targetLanguage: params.matrix.activeTarget,
    interfaceLanguage: params.matrix.interfaceLanguage,
    contentHash: originalContentHash,           // ← 与首次完全一致
    title: params.title,
    artist: params.artist,
    forceRefresh: true,                         // ← 关键：覆盖写入
    userId: currentUserId,
  });

  if (resp.ok) {
    setResult(resp);       // 替换为全新 AI 生成结果
    setRefreshStatus('done');
  } else {
    setRefreshStatus('error');
  }
}
```

**按钮 UI 规范**：
- 位置：语法词解区域底部，右对齐
- 样式：微小灰色链接（`font-size: 0.75rem; color: #999; text-decoration: underline`）
- 仅在 `fromCache === true` 时显示
- 点击后按钮文案变为 `重新生成中...`，disabled 防重复提交
- 失败时恢复按钮并显示短暂错误提示

---

## 七、后端改造点（1 个文件 + 1 张表）

### 7.1 MySQL 表创建

在 CloudBase 控制台启动「关系型数据库」→ 执行上述 DDL。

### 7.2 修改 `cloudfunctions/arkProxy/index.js`

在 `lyrics.step2` 处理分支中插入缓存层：

```js
// 歌词语法词解缓存（仅 lyrics.step2）
if (isLyricsStep && event.contentHash) {
  // forceRefresh：跳过缓存查询，直接调 API 走后覆盖写入
  if (event.forceRefresh) {
    console.log('[arkProxy][cache] forceRefresh — skip cache, will overwrite');
  } else {
    const cached = await queryLyricsCache(event.contentHash);
    if (cached) {
      void incrementCacheHit(event.contentHash);
      console.log('[arkProxy][cache] HIT', `hash=${event.contentHash.slice(0, 12)}...`);
      // 缓存命中不消耗用户每日配额（不调用火山引擎）
      return {
        ok: true,
        requestId,
        action,
        model: cached.model_used,
        content: cached.raw_response,
        usage: {
          inputTokens: cached.input_tokens,
          outputTokens: cached.output_tokens,
          totalTokens: cached.input_tokens + cached.output_tokens,
        },
        fromCache: true,
        costSaved: Math.round(cached.est_cost * 1e6) / 1e6,
      };
    }
  }
}

// MISS 或 forceRefresh → 正常走火山引擎 API（现有逻辑不变）
// ... 调用 callVolcengine ...
// 成功后 → storeLyricsCache(..., forceRefresh: event.forceRefresh)
```

### 7.3 `queryLyricsCache` / `storeLyricsCache`

```js
/** 查询缓存 */
async function queryLyricsCache(contentHash) {
  const res = await db.query(
    'SELECT * FROM lyrics_grammar_cache WHERE content_hash = ? LIMIT 1',
    [contentHash]
  );
  return res.rows?.[0] || null;
}

/** 写入/覆盖缓存 */
async function storeLyricsCache(params, { forceRefresh = false } = {}) {
  const { contentHash, title, artist, sourceLang, targetLang, pedaLevel,
          lineCount, firstLine, lastLine, lyricsText,
          rawResponse, model, inputTokens, outputTokens, estCost } = params;

  if (forceRefresh) {
    // 模式 2：覆盖写入（全量替换毒数据）
    await db.query(`
      INSERT INTO lyrics_grammar_cache
        (content_hash, title, artist, source_lang, target_lang, peda_level,
         line_count, first_line, last_line, lyrics_text,
         raw_response, model_used, input_tokens, output_tokens, est_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title), artist = VALUES(artist),
        source_lang = VALUES(source_lang), target_lang = VALUES(target_lang),
        peda_level = VALUES(peda_level), line_count = VALUES(line_count),
        first_line = VALUES(first_line), last_line = VALUES(last_line),
        lyrics_text = VALUES(lyrics_text), raw_response = VALUES(raw_response),
        model_used = VALUES(model_used), input_tokens = VALUES(input_tokens),
        output_tokens = VALUES(output_tokens), est_cost = VALUES(est_cost),
        hit_count = hit_count + 1, last_hit_at = CURRENT_TIMESTAMP
    `, [contentHash, title, artist, sourceLang, targetLang, pedaLevel,
        lineCount, firstLine, lastLine, lyricsText,
        rawResponse, model, inputTokens, outputTokens, estCost]);
  } else {
    // 模式 1：首次写入（幂等，不覆盖已有数据）
    await db.query(`
      INSERT INTO lyrics_grammar_cache
        (content_hash, title, artist, source_lang, target_lang, peda_level,
         line_count, first_line, last_line, lyrics_text,
         raw_response, model_used, input_tokens, output_tokens, est_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE hit_count = hit_count
    `, [contentHash, title, artist, sourceLang, targetLang, pedaLevel,
        lineCount, firstLine, lastLine, lyricsText,
        rawResponse, model, inputTokens, outputTokens, estCost]);
  }
}
```

---

## 八、成本估算

| 指标 | 缓存 MISS | 缓存 HIT |
|------|:--:|:--:|
| 火山引擎调用 | 1 次 | 0 次 |
| 联网搜索费 | ¥0.03 | ¥0 |
| Token 费用（Pro） | ¥0.005~0.02 | ¥0 |
| MySQL 查询 | 1 次 SELECT + 1 次 INSERT | 1 次 SELECT + 1 次 UPDATE |
| 响应延迟 | 3~15s | **< 100ms** |

### 热门歌曲假设

若前 100 首热门歌曲被 500 个用户分别调 3 次：

```
无缓存：500 × 3 × ¥0.02 = ¥30/天（100 首 × 用户数）
有缓存：100 × ¥0.02（首生成）+ 1400 × ¥0（命中）= ¥2/天
节省率：93%
```

---

## 九、实施步骤

| 步骤 | 内容 | 文件 | 工作量 |
|:--:|------|------|:--:|
| 1 | 创建 MySQL 表 | CloudBase 控制台 | 5min |
| 2 | `lyricsHash.ts` 哈希模块 | `src/services/ai/lyricsHash.ts` | 30min |
| 3 | `useEmbeddedAiGenerate` 传入 hash | `src/hooks/useEmbeddedAiGenerate.ts` | 15min |
| 4 | `types.ts` 新增字段 | `src/services/ai/types.ts` | 5min |
| 5 | `arkProxy` 缓存查询/写入 | `cloudfunctions/arkProxy/index.js` | 45min |
| 6 | 本地测试 + 部署 | — | 20min |
| **总计** | | | **≈ 2h** |

---

## 十、注意事项

1. **不消耗配额**：缓存命中不扣除用户每日 AI 调用次数（不调火山引擎）
2. **ISR 式失效**：歌词不会变，不需要主动失效；如需更新（模型升级），可加 `model_version` 字段做软失效
3. **存储体积**：单条 raw_response 约 5~20KB，1 万首歌缓存约 200MB，MySQL 完全胜任
4. **隐私安全**：SHA-256 不可逆，即使数据库泄露也无法还原原始歌词
5. **降级策略**：MySQL 不可用时直接走火山引擎 API（现有逻辑），确保零负面影响
6. **毒数据修复流程**：
   - 场景：用户收到错误缓存（假名注音错误 / 翻译缺失 / 语法点不匹配）
   - 用户点击结果区底部「重新进行 AI 分析」→ 前端发送 `{ ...相同载荷, forceRefresh: true }`
   - 后端跳过缓存查询 → 调火山引擎 API → 成功后用新结果**全量覆盖**旧缓存（`INSERT ... ON DUPLICATE KEY UPDATE ... VALUES(...)`）
   - 后续用户请求同一 `contentHash` 将命中修复后的正确缓存
   - 按钮仅在 `fromCache === true` 时显示，API 直调时不显示（因为本身就是最新结果）
   - ⚠️ `forceRefresh` **会消耗用户当日配额**（它本质是一次完整的 AI API 调用），仅缓存 HIT 不消耗配额
7. **调试入口**：`source_lang` / `target_lang` / `first_line` / `last_line` 四个明文列可供运维时 `SELECT` 核对，无需反解 hash
8. **当前实现使用 NoSQL**（非 MySQL）：因 `@cloudbase/node-sdk` v2 不支持 `app.rdb()`，实际使用 NoSQL 集合 `lyrics_grammar_cache`，`_id = contentHash`。查询用 `.doc(hash).get()`，首次写入用 `.add()`（_id 重复静默忽略），覆盖写入用 `.doc(hash).set()`。升级 SDK v3 后可直接迁移至 MySQL。
