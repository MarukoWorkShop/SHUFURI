# 内嵌 AI 歌词生成方案

**分支**: `feat/embedded-ai-generation`
**创建日期**: 2026-07-23
**目标**: 用户输入歌名/歌手 → 一键点击 → 应用直接调用火山引擎 ARK API → 返回结构化记录流 → 自动解码排版，**无需跳转到外部 AI App 粘贴**。

---

## 1. 现状 vs 目标

### 当前流程（外部粘贴）

```
输入歌名/歌手 → 生成口令 → 写入剪贴板 → 唤起外部 AI App
→ 用户手动粘贴 → AI 返回 → 用户复制 → 回到 App → 解码排版
```

| 问题 | 详情 |
|------|------|
| 操作 6 步 | 需要两次 App 切换 |
| 依赖外部 App | 需用户安装豆包/ChatGPT 等 |
| 容易出错 | 粘贴污染、格式不一致 |
| 学习成本 | 新用户容易卡住 |

### 目标流程（内嵌直连）

```
输入歌名/歌手 → 点击「生成」 → App 调用 arkProxy (火山引擎 ARK)
→ AI 返回结构化记录流 → 自动解码排版
```

- **操作 2 步**: 输入 → 点击 → 等待 → 完成
- **保留降级**: 如果直连失败，回退到剪贴板方案

---

## 2. 技术方案

### 2.1 架构

```
┌─────────────────────────────────────────────────────────┐
│  HomeScreen (前端)                                       │
│                                                          │
│  HtmlPasteInput                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  歌名 [____________]  歌手 [____________]         │    │
│  │  [ 内嵌直连生成 ] 🔄️ [ 剪贴板方案 ]  ← 双按钮   │    │
│  └─────────────────────────────────────────────────┘    │
│         │                                                │
│         ▼ (主路径)                                       │
│  useEmbeddedAiGenerate.ts  ← NEW hook                  │
│         │                                                │
│         ├── buildEncoderPrompt()  已有                  │
│         ├── cloudbaseGateway.send()  已有               │
│         │   action: 'lyrics.step1'  ← NEW action        │
│         ├── compileDocument()  已有                     │
│         └── navigateToEditor(bodyHtml)  已有            │
│                                                          │
└─────────────┬───────────────────────────────────────────┘
              │ callFunction('arkProxy')
              ▼
┌─────────────────────────────────────────────────────────┐
│  arkProxy 云函数 (cloudfunctions/arkProxy/index.js)     │
│                                                          │
│  action: 'lyrics.step1'  ← 新增                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  构建 Chat Request:                               │    │
│  │    model: doubao-seed-2-1-pro-260628              │    │
│  │    temperature: 0.2                               │    │
│  │    max_tokens: 8000  ← 远大于显微镜 360            │    │
│  │    stream: false  ← 先用非流式简化                  │    │
│  │    thinking: { type: 'disabled' }                 │    │
│  └─────────────────────────────────────────────────┘    │
│         │                                                │
│         ▼                                                │
│  火山引擎 ARK Chat Completions API                       │
│         │                                                │
│         ▼                                                │
│  返回 @0...@9 结构化记录流                                │
│         │                                                │
│         ▼                                                │
│  cleanDoubaoPaste() → compileDocument()                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 为什么用 arkProxy 而非前端直连

| 方案 | 优点 | 缺点 |
|------|------|------|
| **arkProxy 云函数** ✅ | API Key 安全存储（环境变量）<br>已有云函数架构可复用<br>前端零改动 | 多一跳网络延迟(~200ms)<br>CloudBase 调用计费 |
| 前端直连 ARK API | 少一跳延迟 | API Key 暴露在前端<br>需要新的 CORS/认证方案 |

**结论**: 沿用 arkProxy 云函数。

### 2.3 模型选择

| 任务 | 模型 | max_tokens | 说明 |
|------|------|------------|------|
| Step1 歌词生成 | `doubao-seed-2-1-pro-260628` | 8000 | 高质量，需联网搜索歌词 |
| Step2 词解生成 | `doubao-seed-2-1-pro-260628` | 4000 | 词汇+语法解释 |
| 显微镜划词 | `doubao-seed-2-0-mini-260215` | 360 | 已有，不变 |

---

## 3. 改动清单

### 3.1 云函数 `arkProxy/index.js`

**新增 action: `lyrics.step1` 和 `lyrics.step2`**

```js
// 已有关键路径
const MODEL_EXPLAIN = 'doubao-seed-2-0-mini-260215';
// 新增歌词生成模型
const MODEL_LYRICS = 'doubao-seed-2-1-pro-260628';

function buildLyricsChatRequest(prompt, maxTokens = 8000) {
  return {
    model: MODEL_LYRICS,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.15,        // 输出格式高度结构化，低温度
    max_tokens: maxTokens,
    stream: false,
    thinking: { type: 'disabled' },
  };
}
```

改动:
1. 新增 `MODEL_LYRICS` 常量
2. 新增 `buildLyricsChatRequest()` 函数
3. `main` 中新增 `lyrics.step1` 和 `lyrics.step2` 分支
4. 超时时间云函数配置 ≥ 120s

### 3.2 `src/services/ai/types.ts`

```ts
// ArkProxyRequest.action 扩展
export type ArkProxyRequest = {
  action: 'explain.selection' | 'lyrics.step1' | 'lyrics.step2';
  requestId: string;
  prompt: string;
  targetLanguage: 'jp' | 'ko' | 'en' | 'zh';
  interfaceLanguage: 'zh' | 'en';
};

// AiGatewayRequest.action 同步扩展
export type AiGatewayRequest = {
  action: 'explain.selection' | 'lyrics.step1' | 'lyrics.step2';
  // ...
};
```

### 3.3 新增 `src/hooks/useEmbeddedAiGenerate.ts`

核心 Hook，封装内嵌生成流程：

```
函数签名:
  generateLyricsStep1(options: {
    title: string;
    artist: string;
    language: LearningTargetLanguage;
    pedagogicalLevel: number;
    includeVocabAndGrammar: boolean;
  }) → { stream, result, error, loading, cancel }

流程:
  1. buildEncoderPrompt(phase='lyrics', ...)  →  构建 Step1 Prompt
  2. cloudbaseGateway.send({ action: 'lyrics.step1', prompt })  →  调用云函数
  3. cleanDoubaoPaste(result.content)  →  清理污染
  4. compileDocument(cleaned)  →  编译为 bodyHtml
  5. 返回 bodyHtml 供 HomeScreen 跳转
```

可选：也提供 `generateLyricsStep2()` 用于学习材料。

### 3.4 `src/components/HtmlPasteInput.tsx`

改动最小化，添加新按钮：

```
现有: [✂️ 一键生成口令]  [📋 粘贴并排版]
新增: [🚀 直连生成] (当 cloudBase 可用时显示)
```

按钮行为:
- 点击 → 调用 `useEmbeddedAiGenerate.generateLyricsStep1()`
- 显示 loading 状态（进度条/loading 文案）
- 成功 → 跳转编辑器
- 失败 → toast 错误 + 提供降级到剪贴板方案

### 3.5 `src/components/screens/HomeScreen.tsx`

```tsx
// 新增状态
const [generateState, setGenerateState] = useState<'idle' | 'loading' | 'error'>('idle');

// 新增回调
const handleEmbeddedGenerate = async (title, artist, language) => {
  setGenerateState('loading');
  try {
    const bodyHtml = await generateLyricsStep1({ title, artist, language });
    navigateToEditor(bodyHtml);
  } catch (err) {
    setGenerateState('error');
    // 展示错误并提示使用剪贴板方案
  }
};
```

### 3.6 加载态 UI

在按钮区下方显示生成进度：

```
[🎵 正在生成歌词... 请稍候 (预计 10-30 秒)    ]
[████████████░░░░░░  60%                      ]
```

方案:
- 简单版: 旋转 spinner + 文字提示「AI 正在搜索歌词并排版…」
- 进阶版（后续迭代）: SSE 流式实时显示进度

---

## 4. 反幻觉策略 (Anti-Hallucination)

### 4.1 问题分析

使用 LLM 生成歌词存在两类典型幻觉：

| 类型 | 表现 | 现有 handling |
|------|------|---------------|
| **截断/不完整** | L 行缺少后半段，中途停止 | ✅ `retry=true` → "INCOMPLETE / truncated mid-song" |
| **错误歌词** | 返回了其他歌曲的歌词，或编造/臆造的歌词 | ❌ **无处理** |

内嵌直连下用户无法像剪贴板方案那样通过切换不同 AI App 来绕过幻觉，因此必须内置自动检测 + 重试 + 降级。

### 4.2 幻觉检测分级

```ts
type LyricsValidationResult =
  | { ok: true }                                    // 校验通过
  | { ok: false; reason: 'format_parse_failed';   message: string }  // 格式无法解析
  | { ok: false; reason: 'title_mismatch';         message: string; returnedTitle: string }
  | { ok: false; reason: 'too_few_lines';          message: string; lineCount: number }
  | { ok: false; reason: 'no_lyrics';              message: string }; // H行有但L行为空
```

| 检测项 | 检测方式 | 敏感度 |
|--------|----------|--------|
| **格式可解析** | `parseStream()` 是否 throw | 强制 → 自动重试 |
| **标题匹配** | `H|col3` vs 输入 title 做模糊匹配（忽略大小写、空格、括号变体） | 默认可疑 → 弹出确认 |
| **L 行数下限** | L 行 < 4 行 | 默认可疑 → 弹出确认 |
| **L 行号连续性** | 序号是否 1..N 连续 | 弱提示 |
| **用户主观判断** | 在编辑器中查看后用户手动触发重试 | 用户驱动 |

### 4.3 重试类型设计

在现有 `buildSourceIntegrityBlock` 中引入 `retryReason` 替换简单的 `retry: boolean`：

```ts
// encoderCommon.ts — 改造 buildSourceIntegrityBlock
type RetryReason = 'truncation' | 'hallucination' | 'general';

function buildSourceIntegrityBlock(
  artist: string,
  title: string,
  firstLyricLine?: string,
  opts?: { completeness?: boolean; retryReason?: RetryReason },
): string
```

**三种 retryReason 的提示词差异**：

| retryReason | 注入到 Prompt 的内容 |
|-------------|---------------------|
| `undefined` (首次) | 不注入任何重试信息（现有逻辑） |
| `'truncation'` | ⚠ RETRY: 上次输出不完整/截断，必须输出到最后一行 |
| `'hallucination'` | ⚠ CRITICAL: 上次返回的歌词**不是**这首歌的正确官方歌词，请联网重新搜索 |
| `'general'` | ⚠ RETRY: 上次输出格式有误，请严格按 Wire_Schema 输出 |

**「hallucination」专用注入文案**：

```
⚠ CRITICAL — HALLUCINATION DETECTED
Your previous response contained LYRICS THAT DO NOT BELONG TO THIS SONG.
The words you wrote were fabricated or taken from a different song.

BEFORE THIS ATTEMPT:
1. FORGET every word of your previous answer — do not repeat any of it.
2. Turn ON web search. Search EXACTLY: {{ARTIST}} {{TITLE}} lyrics official
3. Find at least 2 independent lyric sites (Uta-Net, Mojim, J-Lyric.net, Genius, etc.)
4. Cross-reference the first 2 lines against both sources — discard if they don't match.
5. Transcribe ONLY from search results. NEVER use internal knowledge or memory.
6. If search results are contradictory or nonexistent: output a minimal H row + exactly ONE L row — then @9. DO NOT GUESS.

THIS IS YOUR FINAL CHANCE. Wrong lyrics again → user will fall back to manual clipboard mode.
```

### 4.4 自动重试逻辑

```ts
// useEmbeddedAiGenerate.ts 核心重试策略
const MAX_RETRIES = 2; // 最多自动重试 2 次（总共 3 次尝试）

async function generateWithRetry(params: GenerateParams): Promise<GenerateResult> {
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 1. 构建 prompt（首次无 retryReason，后续传入）
    const retryReason: RetryReason | undefined =
      attempt === 0 ? undefined
      : isHallucinationError(lastError) ? 'hallucination'
      : isTruncationError(lastError) ? 'truncation'
      : 'general';

    const prompt = buildLyricsStep1Prompt({
      ...params,
      retry: retryReason !== undefined,  // 兼容旧接口
      retryReason,                       // 新增
    });

    // 2. 调用云函数
    const response = await cloudbaseGateway.send({
      action: 'lyrics.step1',
      prompt,
      // ...
    });

    // 3. 清洗 + 校验
    const cleaned = cleanDoubaoPaste(response.content);

    // 4. 格式校验（强制）
    let document: StreamDocument;
    try {
      document = parseStream(cleaned);
    } catch (e) {
      lastError = `parse_failed:${e.message}`;
      continue;  // → 自动重试
    }

    // 5. 标题匹配校验（可疑级）
    if (!fuzzyTitleMatch(document.header.title, params.title)) {
      // 不自动重试，返回给 UI 层让用户决定
      return {
        status: 'suspicious',
        reason: 'title_mismatch',
        returnedTitle: document.header.title,
        expectedTitle: params.title,
        document,
        bodyHtml: compileStreamDocument(document),
        attemptsUsed: attempt + 1,
      };
    }

    // 6. 行数下限校验（可疑级）
    if (document.lyrics.length < 4) {
      if (attempt < MAX_RETRIES) {
        lastError = `too_few_lines:${document.lyrics.length}`;
        continue;  // → 自动重试
      }
      return {
        status: 'suspicious',
        reason: 'too_few_lines',
        lineCount: document.lyrics.length,
        document,
        bodyHtml: compileStreamDocument(document),
        attemptsUsed: attempt + 1,
      };
    }

    // 7. 全部通过
    return {
      status: 'ok',
      document,
      bodyHtml: compileStreamDocument(document),
      attemptsUsed: attempt + 1,
    };
  }

  // 重试耗尽
  return {
    status: 'error',
    reason: 'max_retries_exhausted',
    message: `已重试 ${MAX_RETRIES} 次，仍然无法获得正确歌词`,
  };
}
```

### 4.5 标题模糊匹配算法

```ts
function fuzzyTitleMatch(returned: string, expected: string, threshold = 0.6): boolean {
  // 1. 标准化：去括号 + 去空格 + 小写 + 去特殊符号
  const norm = (s: string) => s
    .replace(/[（(][^）)]*[）)]/g, '')   // 去全/半角括号内容
    .replace(/[《》「」『』""''\[\]]/g, '') // 去书名号和引号
    .replace(/[〜～~\-–—·・／/　 \t]/g, '') // 去空格和连接符
    .toLowerCase();

  const n1 = norm(returned);
  const n2 = norm(expected);
  if (!n1 || !n2) return false;

  // 2. 精确匹配
  if (n1 === n2) return true;

  // 3. 包含匹配（"秋桜" 包含于 "秋樱" → 模糊）
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // 4. 编辑距离相似度（用 Levenshtein）
  const dist = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  return (1 - dist / maxLen) >= threshold;
}
```

---
## 5. 剪贴板降级策略

### 5.1 设计原则

剪贴板方案不是"备用"，而是有明确优势的同等路径：
- **内嵌直连**：快、自动化，但模型单一，无法利用豆包的 web_search 能力
- **剪贴板方案**：慢、需要手工操作，但用户可自由选择 AI App，部分 App 自带联网搜索

**双按钮始终并列展示**，不做主次暗示。内嵌失败时，剪贴板按钮高亮引导。

### 5.2 降级触发场景总览

| 场景 | 自动行为 | 用户可选 |
|------|----------|----------|
| 网络错误 / 云函数超时 | 无自动重试，直接报错 | → [📋 剪贴板方案] |
| ARK API 限流 / 服务不可用 | 无自动重试，直接报错 | → [📋 剪贴板方案] |
| parseStream 格式错误 | **自动重试** 2 次（retryReason='general'） | 3 次均失败 → [📋 剪贴板方案] |
| L 行 < 4 | **自动重试** 2 次（retryReason='hallucination'） | 3 次均不满 → 弹窗确认 → [📋 剪贴板方案] |
| 标题不匹配 | 弹确认框（不自动重试） | [🔄 再试一次] [📋 剪贴板方案] [✅ 继续] |
| 用户质疑结果（编辑器中） | 不自动 | [🔄 重新生成] [📋 剪贴板方案] [✅ 保留] |

### 5.3 弹窗 UI 设计

```
┌─────────────────────────────────────────────┐
│  ⚠️ AI 疑似幻觉                              │
│                                             │
│  返回的歌词标题为「秋桜 - 山口百惠」           │
│  您输入的是「秋樱 - 山口百惠」                 │
│  标题不完全匹配，可能歌词有误。                │
│                                             │
│  已尝试 2 次                                 │
│                                             │
│  [🔄 强调正确歌词，再试一次]                   │
│  [📋 切换剪贴板方案]    [✅ 看起来没问题，继续] │
└─────────────────────────────────────────────┘
```

### 5.4 剪贴板降级的实现

降级到剪贴板方案时，复用现有的 `buildLyricsStep1Prompt` 生成口令 → `navigator.clipboard.writeText` → 唤起外部 AI App。

**关键**：如果经历了 retry，降级到剪贴板时使用的 prompt 也应是反幻觉版的（带上 `retryReason='hallucination'`），保证最大正确率。

```ts
function fallbackToClipboard(params: GenerateParams, retriesUsed: number) {
  const prompt = buildLyricsStep1Prompt({
    ...params,
    retry: true,
    retryReason: retriesUsed > 0 ? 'hallucination' : undefined,
  });

  await navigator.clipboard.writeText(prompt);

  // 唤起外部 AI App（复用现有 AiAppActionSheet 逻辑）
  onActivatePasteLayout?.(appId);

  // 同时告知用户后续步骤
  showToast('已复制口令，请在外部分享给 AI，完成后回来粘贴');
}
```

---
## 6. 全流程示意图

```
                        ┌──────────────────────────┐
                        │    用户输入 歌名 + 歌手     │
                        └────────────┬─────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼──────┐
            │ [🚀 直连生成] │ │ [📋 剪贴板方案]│ │ (已有流程) │
            └───────┬──────┘ └──────────────┘ └───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  buildLyricsStep1Prompt│
        │  (retryReason=undefined)│
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   cloudbaseGateway    │
        │   → arkProxy 云函数    │
        │   → 火山引擎 ARK       │
        └───────────┬───────────┘
                    │
              ┌─────▼─────┐
              │ 返回内容？  │
              └─┬───────┬─┘
           成功  │       │ 失败/超时
                │       └──────────────┐
                ▼                      ▼
    ┌───────────────────┐  ┌──────────────────────┐
    │ cleanDoubaoPaste  │  │ Toast: "网络异常"     │
    │ → parseStream     │  │ [📋 降级到剪贴板方案] │
    └─────────┬─────────┘  └──────────────────────┘
              │
    ┌─────────▼──────────────────────────────┐
    │  validateLyrics(document, params)       │
    │                                          │
    │  三级检测：                              │
    │  ┌─────────────────────────────────────┐ │
    │  │ L1 格式: parseStream 失败?          │ │
    │  │  ├─ 是 → 自动重试(retry='general')  │ │
    │  │  └─ 否 → L2                         │ │
    │  │ L2 标题: H|col3 不匹配?             │ │
    │  │  ├─ 是 → 弹窗: [🔄再试] [📋降级]    │ │
    │  │  └─ 否 → L3                         │ │
    │  │ L3 行数: < 4 行?                    │ │
    │  │  ├─ 是 → 自动重试(retry='halluc')   │ │
    │  │  │   → 仍不够 → 弹窗确认              │ │
    │  │  └─ 否 → ✅ 校验通过                 │ │
    │  └─────────────────────────────────────┘ │
    └─────────┬──────────────────────────────┘
              │
    ┌─────────▼─────────────┐
    │  compileDocument      │
    │  → bodyHtml           │
    └─────────┬─────────────┘
              │
    ┌─────────▼─────────────┐
    │  跳转编辑器            │
    │  展示歌词海报预览      │
    │                        │
    │  工具栏保留:           │
    │  [🔄 歌词不对?重新生成]│  ← 编辑器内二次重试入口
    │  [📋 剪贴板方案]       │
    └────────────────────────┘
```

---

## 7. 安全性 & 成本控制

| 维度 | 措施 |
|------|------|
| API Key | 仅存在云函数环境变量，不传前端 |
| Token 消耗 | max_tokens=8000（Step1）, 4000（Step2）|
| 滥用防护 | 前端加 rate limit（同一用户 1 分钟内最多 3 次）|
| 日志 | 云函数记录 requestId + token 消耗 |
| 成本估算 | Pro 模型 ¥0.0008/k token → Step1 约 ¥0.006/次 |

---

## 8. 实施步骤

| # | 内容 | 文件 | 预计 |
|---|------|------|------|
| 1 | `buildSourceIntegrityBlock` 改造：`retry: boolean` → `retryReason: RetryReason` | `encoderCommon.ts`, `buildEncoderPrompt.ts`, `buildLyricsStep1Prompt.ts` | 30min |
| 2 | 创建 `detectLyricsHallucination` 校验工具（parse + fuzzyTitle + minLines） | `src/utils/detectLyricsHallucination.ts` | 30min |
| 3 | 扩展云函数 action：`lyrics.step1` | `cloudfunctions/arkProxy/index.js` | 30min |
| 4 | 扩展 `AiGateway` 类型定义 | `src/services/ai/types.ts` | 15min |
| 5 | 创建 `useEmbeddedAiGenerate` hook（含自动重试 + 校验 + 反幻觉 prompt） | `src/hooks/useEmbeddedAiGenerate.ts` | 60min |
| 6 | 改造 HomeScreen：双按钮 + 确认弹窗 + 降级到剪贴板 | `HomeScreen.tsx`, `LyricsHallucinationDialog.tsx` | 60min |
| 7 | 加载态 UI（spinner + 重试计数 + 降级引导） | CSS + 组件 | 20min |
| 8 | 编辑器内「歌词不对？重新生成」入口 | Editor 组件 | 20min |
| 9 | 部署云函数 + 端到端测试 | — | 30min |
| **合计** | | | **~5h** |

---

## 9. 后续迭代（可选）

- [ ] SSE 流式返回：云函数用 stream=true → 前端实时显示生成进度
- [ ] 错误信息中文化
- [ ] 成本统计面板
- [ ] WebView Bridge 路径优化（Capacitor 上走本地 HTTP 调云函数）
