# AI 模式（腾讯云代理 + 火山引擎）设计

## 1. 目标

在保留现有“外部 AI + 剪贴板”手动模式的同时，将首页左上角原音乐链接按钮改为 `AI` 模式开关。

AI 模式开启后，应用不再复制 Prompt、打开外部 AI 或等待用户粘贴，而是通过腾讯云后端代理调用火山引擎，自动完成：

1. Step 1：生成完整歌词记录流（`@0 + H + L + @9`）
2. 用户在现有 `LyricConfirmSheet` 中确认歌词
3. 未选择学习材料：直接排版
4. 选择学习材料：Step 2 自动生成 V/G，和已确认 H/L 合并后排版
5. 歌词错误或不完整：使用 `retry: true` 重新调用 Step 1

现有手动模式保留为网络、配额、后端故障时的降级路径。

---

## 2. 分支基线

- 本地整合分支：`integration/all-features-local`
- AI 功能分支：`feat/ai-mode-volcengine`
- `main` 保持不变

整合分支包含：

- 两步歌词确认流程
- JSON 数据备份/导入
- 编辑预览令牌色层级与词条竖线样式

未直接合并 `fix/lyrics-completeness-prompt`，因为它基于旧代码快照，整体合并会删除或回退当前功能；其中有效的完整性约束已经由当前 `phase: 'lyrics'` Prompt 覆盖。

---

## 3. 交互设计

### 3.1 左上角 AI 开关

删除原 `LinkChainIcon` 和下列行为：

- 音乐链接状态提示
- 从剪贴板恢复音乐分享
- `ChainLinkTooltip`
- `useChainLink` 在 Header 中的控制职责

替换为 `AiModeToggle`：

- 手动模式：显示 `AI`，弱化边框态
- AI 模式：显示 `AI`，令牌色实心/高亮态
- `aria-pressed` 表示切换状态
- 模式持久化到 `AppSettings.generationMode`

建议默认值：`external`。首次发布不改变现有用户习惯。

```ts
type GenerationMode = 'external' | 'ai';
```

未来 BYOK 不扩展模式枚举，而扩展凭证来源：

```ts
type AiCredentialMode = 'managed' | 'byok';
```

### 3.2 首页按钮

手动模式维持当前行为：

- 一键生成口令
- 外部 AI
- 返回后粘贴并排版

AI 模式：

- 主按钮文案改为“AI 查找歌词”
- 点击后直接调用 Step 1
- 生成中禁用重复提交，并显示“正在查找完整歌词…”
- 不展示/不启用“粘贴并排版”
- 保留取消请求入口（`AbortController`）

### 3.3 歌词确认页

复用现有 `LyricConfirmSheet`：

- 完整滚动显示全部歌词
- “重试”：
  - AI 模式：内部重跑 Step 1（`retry: true`）
  - 手动模式：继续复制强化 Prompt 并打开外部 AI
- 未勾选学习材料：“确认并排版”
- 勾选学习材料：“→ 去生成学习材料”
  - AI 模式：内部调用 Step 2
  - 手动模式：继续现有外部 Prompt 流程

### 3.4 Step 2

AI 模式下：

1. 使用已确认 H/L 构建 `phase: 'study'` Prompt
2. 后端调用火山引擎
3. 客户端只采纳返回的 V/G
4. 使用 `mergeConfirmedLyricsWithStudy` 合并
5. H/L 永远使用用户确认版本，屏蔽模型第二次修改歌词
6. 合并成功后直接排版

---

## 4. 前端状态机

状态应独立于页面的 `input | edit | export` 模式。

```ts
type AiGenerationStage =
  | 'idle'
  | 'lyrics-loading'
  | 'lyrics-confirm'
  | 'study-loading'
  | 'layout-loading'
  | 'error';
```

会话数据：

```ts
type AiGenerationSession = {
  stage: AiGenerationStage;
  requestId: string | null;
  lyricsRaw: string;
  error: string | null;
  retryCount: number;
};
```

状态转换：

```text
idle
  → lyrics-loading
  → lyrics-confirm
      ├─ 直接排版 → layout-loading → edit
      ├─ 生成学习材料 → study-loading → layout-loading → edit
      └─ 重试 → lyrics-loading

任何 loading
  → error
  → 重试或切回手动模式
```

同一时刻只允许一个活跃请求。新请求开始前取消旧 `AbortController`。

---

## 5. 后端代理契约

### 5.1 安全边界

- 火山引擎 API Key 只存在腾讯云环境变量 `ARK_API_KEY`
- 前端不包含 `VITE_ARK_API_KEY`
- 前端不能把任意模型、任意 URL 或任意 Authorization 头透传给代理
- 后端固定火山引擎域名、模型白名单和最大 token
- 后端按匿名用户/IP 做限流、日配额和并发限制
- 日志禁止记录完整歌词、完整 Prompt 和 API Key

### 5.2 MVP：缓冲响应

CloudBase `callFunction` 调用一般在函数完成后一次性返回，不应把它描述为浏览器可读 SSE。

请求：

```ts
type ArkProxyRequest = {
  action: 'lyrics.generate';
  requestId: string;
  phase: 'lyrics' | 'study';
  prompt: string;
  targetLanguage: 'jp' | 'ko' | 'en' | 'zh';
  interfaceLanguage: 'zh' | 'en';
};
```

响应：

```ts
type ArkProxyResponse = {
  ok: boolean;
  requestId: string;
  content?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  error?: {
    code:
      | 'AUTH_FAILED'
      | 'RATE_LIMITED'
      | 'UPSTREAM_TIMEOUT'
      | 'UPSTREAM_ERROR'
      | 'EMPTY_OUTPUT'
      | 'INVALID_REQUEST';
    message: string;
    retryable: boolean;
  };
};
```

后端映射到火山引擎：

```json
{
  "model": "doubao-seed-2-0-mini-260215",
  "messages": [
    { "role": "user", "content": "<客户端生成的阶段 Prompt>" }
  ],
  "temperature": 0.1,
  "max_tokens": 16384,
  "stream": false
}
```

说明：

- Step 1 长歌词优先，`max_tokens` 必须高于过去的 8192；最终值受模型接入点上限约束。
- Step 1 的低温度用于减少改写、漏行与格式漂移。
- Step 2 可以使用 `temperature: 0.2`。

### 5.3 后续：真实 SSE

若需要逐字显示进度，腾讯云必须提供 HTTP/API Gateway 地址，由该地址转发：

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

前端通过 `fetch()` 读取 `response.body.getReader()`。不能通过普通 `app.callFunction()` 获得同等流式体验。

首版不依赖 SSE；只显示阶段级进度，降低后端改造风险。

---

## 6. 输出验证

后端返回不等于成功。客户端必须依次执行：

### Step 1

1. `prepareStructuredLyricsClipboardText`
2. `parseStream`
3. 必须有 H
4. 必须有至少一个 L
5. 必须闭合 `@9`
6. 必须没有 V/G
7. L 序号必须连续
8. 通过后进入歌词确认页

客户端无法自动证明“官方歌词绝对完整”，因此仍保留人工确认。可以把下列情况标记为可疑但不阻塞：

- 行数异常少
- 最后一行疑似未完成
- 出现省略号/“副歌重复”等占位文本

### Step 2

1. 允许完整流或仅 V/G 片段
2. `mergeConfirmedLyricsWithStudy`
3. H/L 必须来自 Step 1 确认稿
4. 丢弃越界 `lyric_line_no`
5. 无 V/G 时提示用户重试或直接按歌词排版

---

## 7. 前端模块拆分

新增：

```text
src/services/ai/
  types.ts                 # 请求、响应、错误类型
  aiGateway.ts             # 后端代理抽象
  cloudbaseGateway.ts      # 腾讯云 CloudBase 实现
  volcengineLyrics.ts      # Step1/Step2 阶段调用

src/hooks/
  useAiLyricsSession.ts    # 状态机、取消、重试、合并、排版

src/components/app/
  AiModeToggle.tsx         # 替换左上角链条按钮
```

修改：

```text
src/services/appSettings.ts
  + generationMode: 'external' | 'ai'

src/components/app/AppHeader.tsx
  - LinkChainIcon
  + AiModeToggle

src/components/app/AppLayout.tsx
  - ChainLinkTooltip

src/App.tsx
  - Header 中的 useChainLink 控制
  + AI 模式及 useAiLyricsSession 接线

src/components/HtmlPasteInput.tsx
  根据 generationMode 切换“外部口令”与“内部 API”动作

src/components/LyricConfirmSheet.tsx
  复用 UI；回调由当前模式决定走内部 API 或外部 Prompt
```

`useChainLink` 中仍有 OCR/音乐分享状态写入职责；删除 Header 功能时不能直接整文件删除。应先把仍被 OCR 使用的 `storeMusicShare`/语言同步职责迁移到独立 hook。

---

## 8. BYOK 预留

未来 BYOK 仍走腾讯云后端，避免浏览器直接请求火山引擎。

推荐：

1. 用户在设置页提交 Key 到后端
2. 后端使用 KMS 加密保存
3. 前端只保存不透明 `credentialId`
4. 请求中传 `credentialMode: 'byok'` 和 `credentialId`
5. 后端解密后调用火山引擎
6. 前端永远不能重新读取明文 Key

MVP 请求可以预留：

```ts
credentialMode: 'managed'
```

---

## 9. 实施顺序

1. 定义 AI 类型、错误码和 `AiGateway` 接口
2. 接入腾讯云代理（先缓冲响应）
3. 实现 `useAiLyricsSession`
4. 将左上角按钮替换为 AI 模式切换
5. 改造首页主按钮
6. 复用歌词确认页接入内部 Step 1/Step 2
7. 增加取消、超时、配额、切回手动模式
8. 单元测试 Prompt、状态机、响应清洗、V/G 合并
9. 真机测试前后台切换、弱网、超时和重复点击

---

## 10. 开发前需要的腾讯云信息

开始实际联调前需要确认：

1. CloudBase 环境 ID（旧设计记录为 `shufu-life-d8g9j8v5385543c1a`，需确认仍有效）
2. 云函数名（旧设计记录为 `arkProxy`）
3. 当前云函数是否接受 `{ action, body }`
4. 是否已开启匿名登录
5. 火山引擎模型接入点/模型 ID
6. 模型支持的最大输出 token
7. 是否已有域名/API Gateway；若有，是否支持 SSE

