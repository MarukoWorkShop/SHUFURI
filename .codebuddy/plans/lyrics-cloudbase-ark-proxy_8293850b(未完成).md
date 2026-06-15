---
name: lyrics-cloudbase-ark-proxy
overview: 将 SHUFURI 歌词模块从「生成Prompt → 手动复制 → 跳转粘贴 → 返回粘贴」的繁琐流程，改造为「一键调用云函数 → 自动获取AI结果 → 直接进入排版」的无感知流程。前端通过 @cloudbase/js-sdk 调用腾讯云函数 arkProxy，由云函数代理火山引擎 ARK API，API Key 不暴露前端。同时复用现有排版与导出模块，确保输出效果完全一致。
design:
  architecture:
    framework: react
    component: shadcn
  styleKeywords:
    - Minimalism
    - Clean
    - Elegant
    - Japanese Aesthetic
  fontSystem:
    fontFamily: PingFang-SC
    heading:
      size: 32px
      weight: 600
    subheading:
      size: 18px
      weight: 500
    body:
      size: 16px
      weight: 400
  colorSystem:
    primary:
      - "#062E9A"
      - "#073AB5"
      - "#084DCD"
    background:
      - "#F9FAFB"
      - "#FFFFFF"
    text:
      - "#1F2937"
      - "#6B7280"
    functional:
      - "#10B981"
      - "#EF4444"
      - "#F59E0B"
todos:
  - id: install-cloudbase-sdk
    content: 安装 @cloudbase/js-sdk 依赖
    status: pending
  - id: create-cloudbase-init
    content: 新建 src/services/cloudbase.ts CloudBase 初始化文件
    status: pending
    dependencies:
      - install-cloudbase-sdk
  - id: create-cloudbase-auth
    content: 新建 src/services/cloudbaseAuth.ts 匿名登录逻辑
    status: pending
    dependencies:
      - create-cloudbase-init
  - id: create-ark-proxy
    content: 新建 src/services/arkProxy.ts 云函数调用封装
    status: pending
    dependencies:
      - create-cloudbase-auth
  - id: restore-volcano-chat
    content: 从 Git 历史恢复并改造 src/services/volcanoChat.ts 支持云函数代理
    status: pending
    dependencies:
      - create-ark-proxy
  - id: restore-volcengine-lyrics
    content: 从 Git 历史恢复 src/services/volcengineLyricsNotes.ts 歌词生成服务
    status: pending
    dependencies:
      - restore-volcano-chat
  - id: modify-html-paste-input
    content: 改造 src/components/HtmlPasteInput.tsx 删除手动流程按钮，新增"一键生成"
    status: pending
    dependencies:
      - restore-volcengine-lyrics
  - id: test-e2e-flow
    content: 端到端测试：填写歌名→一键生成→自动进入排版预览→编辑→导出
    status: pending
    dependencies:
      - modify-html-paste-input
---

## 用户需求

将歌词模块整体架构调整为：前端 → 腾讯云函数 arkProxy → 火山引擎 API，要求架构设计与 shufulife 项目保持完全一致。该模块必须无缝对接现有的排版和导出模块，核心目标是彻底简化用户当前"生成Prompt → 手动复制 → 跳转粘贴 → 返回粘贴"的繁琐交互流程，将其转化为无感知的内部API直接调用，并在最终输出效果与原流程完全一致的前提下，消除所有多余的手动操作。

## 现有流程 vs 目标流程

### 现有流程（繁琐，需简化）

1. 用户填写歌名/歌手 → 点"一键生成指令" → 复制 Prompt 到剪贴板
2. 用户手动跳转豆包/Deepseek → 粘贴 Prompt → 等待 AI 生成
3. 用户复制 AI 输出 → 切回 SHUFURI → 点"一键粘贴"
4. 点"排版预览" → 进入编辑/导出流程

### 目标流程（无感知）

1. 用户填写歌名/歌手 → 点"一键生成"
2. 前端调用云函数 arkProxy → 火山引擎 API 流式返回
3. 自动解析结果 → 直接进入排版预览
4. 后续编辑/导出流程完全不变

## 技术栈

- **前端 SDK**：`@cloudbase/js-sdk`（与 shufulife 完全一致）
- **云函数**：复用已有 `arkProxy`（腾讯云 SCF，无需新建）
- **AI 模型**：火山引擎 `doubao-seed-2-0-mini-260215`（流式 SSE）
- **状态管理**：现有 `App.tsx` 的 `Mode` 状态机，不引入新状态库

## 架构设计

### 调用链路（与 shufulife 完全一致）

```
前端 (japanese-kana-app)
  → @cloudbase/js-sdk (匿名登录)
  → app.callFunction({ name: 'arkProxy', data: { action, body } })
  → 腾讯云函数 arkProxy
  → 火山引擎 ARK API (API Key 存在 SCF 环境变量，不暴露前端)
```

### 系统架构图

```mermaid
graph TD
    A[用户填写歌名/歌手] --> B[点"一键生成"]
    B --> C[HtmlPasteInput 调用 fetchLyricsNotesFromVolcengine]
    C --> D[volcanoChat.sendChatMessageStream]
    D --> E[arkProxy.ts → callArkProxy]
    E --> F[cloudbase.js-sdk → app.callFunction]
    F --> G[腾讯云函数 arkProxy]
    G --> H[火山引擎 ARK API SSE 流式]
    H --> I[前端 onChunk 回调实时更新]
    I --> J[解析 AI 输出为 Structured Text]
    J --> K[preparePasteForLayout → bodyHtml]
    K --> L[onLayout → 进入排版预览]
    L --> M[现有编辑/导出流程不变]
```

### 关键文件对照

| 功能 | shufulife 路径 | 本项目路径 |
| --- | --- | --- |
| CloudBase 初始化 | `services/cloudbase.ts` | 新建 `src/services/cloudbase.ts` |
| 云函数调用封装 | `services/arkProxy.ts` | 新建 `src/services/arkProxy.ts` |
| 流式 ARK 调用 | `services/volcanoChat.ts` | 新建 `src/services/volcanoChat.ts` |
| 歌词笔记生成 | `services/volcengineLyricsNotes.ts` | 新建 `src/services/volcengineLyricsNotes.ts` |
| UI 入口改造 | `components/HtmlPasteInput.tsx` | 改造现有文件 |


### 核心改造点

#### 1. 新建 `src/services/cloudbase.ts`

与 shufulife 完全一致：

```typescript
import cloudbase from '@cloudbase/js-sdk';
export const app = cloudbase.init({
  env: 'shufu-life-d8g9j8v5385543c1a',
});
export default app;
```

#### 2. 新建 `src/services/arkProxy.ts`

封装云函数调用，含匿名登录校验：

```typescript
import app from './cloudbase';
import { ensureCloudbaseAuth } from './cloudbaseAuth';

export async function callArkProxy(
  action: 'chat' | 'responses',
  body: unknown
): Promise<{ statusCode: number; body: string }> {
  const authOk = await ensureCloudbaseAuth();
  if (!authOk) throw new Error('CloudBase 匿名登录未成功');
  const res = await app.callFunction({
    name: 'arkProxy',
    data: { action, body },
  });
  if ((res as any).err) throw new Error((res as any).err?.message || '云函数调用失败');
  return res.result as { statusCode: number; body: string };
}
```

> 注：`cloudbaseAuth.ts` 参考 shufulife 实现匿名登录逻辑。

#### 3. 新建 `src/services/volcanoChat.ts`

从 Git 历史 `455dbc0` commit 恢复，改造为通过 `callArkProxy` 调用（不再直连火山引擎）。核心函数：

- `sendChatMessageStream(messages, options?, onChunk?)`: SSE 流式解析，通过 `onChunk` 回调实时更新 UI

改造要点：原来直连 `https://ark.cn-beijing.volces.com/api/v3/chat/completions`，现改为：

1. 调用 `callArkProxy('chat', body)` 拿到云函数返回
2. 云函数返回 `stream: true` 的 SSE 响应，前端需解析 `data: {...}` 事件
3. 提取 `choices[0].delta.content` 累积为完整内容

#### 4. 新建 `src/services/volcengineLyricsNotes.ts`

从 Git 历史 `455dbc0` commit 恢复，调用 `volcanoChat.sendChatMessageStream()` 生成歌词笔记。

关键函数：`fetchLyricsNotesFromVolcengine(rawText, onChunk?, options?)`

#### 5. 新建 `src/services/cloudbaseAuth.ts`

实现 CloudBase 匿名登录：

```typescript
import app from './cloudbase';

let authPromise: Promise<boolean> | null = null;

export async function ensureCloudbaseAuth(): Promise<boolean> {
  if (authPromise) return authPromise;
  authPromise = (async () => {
    try {
      const user = await app.auth().currentUser();
      if (user) return true;
      await app.auth().signInAnonymously();
      return true;
    } catch (e) {
      console.error('[cloudbase-auth]', e);
      return false;
    }
  })();
  return authPromise;
}
```

#### 6. 改造 `src/components/HtmlPasteInput.tsx`

**删除**以下按钮和逻辑：

- "一键生成指令"按钮（`handleCopyPrompt` 及相关 state：`copyHint`）
- "一键粘贴"按钮（`handlePasteFromClipboard`）

**新增**以下按钮和逻辑：

- "一键生成"按钮：调用 `fetchLyricsNotesFromVolcengine()`，流式接收结果
- 生成过程中显示进度（如"正在生成歌词..."通过 `onChunk` 更新）
- 生成完成后自动调用 `onLayout()` 进入排版预览

**保留**以下按钮：

- "一键清除"按钮
- "排版预览"按钮（生成完成后自动触发，也可手动点）

**新增 state**：

- `generating: boolean` — 是否正在生成
- `generateProgress: string` — 生成进度提示

**新增函数**：

```typescript
const handleGenerate = useCallback(async () => {
  const title = songTitle.trim();
  if (!title) { setError('请填写歌名'); return; }
  setGenerating(true);
  setError('');
  try {
    const result = await fetchLyricsNotesFromVolcengine(
      title, artist.trim() || '佚名',
      (chunk) => setGenerateProgress(chunk.slice(-20)), // 显示最新生成内容
    );
    // 直接把 AI 生成的结构化文本当作 pasteBack
    applyPastedText(result.bodyHtml);
    // 自动进入排版预览
    await onLayout(result.bodyHtml, result.title, '', result.artist);
  } catch (e) {
    setError(e instanceof Error ? e.message : '生成失败');
  } finally {
    setGenerating(false);
  }
}, [songTitle, artist, onLayout]);
```

#### 7. 安装依赖

```
npm install @cloudbase/js-sdk
```

#### 8. 改造 `src/services/externalPromptTemplate.ts`

不需要改动。`buildExternalAiPrompt()` 构建的 Prompt 格式完全不变，AI 输出格式保持一致。

#### 9. 改造 `src/services/lyricsHtml.ts`

不需要改动。`preparePasteForLayout()` 能正确解析 AI 返回的结构化文本。

## 流式响应处理

`volcanoChat.ts` 中的 `sendChatMessageStream()` 需要：

1. 通过 `callArkProxy('chat', body)` 调用云函数
2. 云函数返回 SSE 流式响应（云函数需支持流式返回，参考 shufulife 的 `arkProxy` 实现）
3. 前端解析 `data: {...}` 事件，提取 `choices[0].delta.content`
4. 通过 `onChunk?.(delta)` 回调实时更新 UI（显示生成进度）

## 错误处理与降级

1. **CloudBase 登录失败**：提示用户检查网络，提供"手动模式"入口
2. **云函数调用失败**：解析错误信息，提示用户
3. **AI 生成失败**：保留用户已填写的歌名/歌手，允许重试
4. **降级方案**：在设置面板中添加"使用手动模式"开关，切回原来的"复制 Prompt→跳转 AI"流程

## 输出格式保证

AI 的 System Prompt（`externalPromptTemplate.ts`）**完全不变**，确保：

- 输出格式为 Shufu-Structured-Text（`===BEGIN===` / `===LYRICS===` / `---PAIR---` 等）
- `preparePasteForLayout()` 能正确解析 AI 输出
- 进入排版预览后的所有流程完全不变

## 目录结构

```
src/
├── services/
│   ├── cloudbase.ts          # [NEW] CloudBase 初始化
│   ├── cloudbaseAuth.ts      # [NEW] 匿名登录逻辑
│   ├── arkProxy.ts           # [NEW] 云函数调用封装
│   ├── volcanoChat.ts        # [NEW] 流式 ARK 调用（从 Git 历史恢复）
│   ├── volcengineLyricsNotes.ts  # [NEW] 歌词笔记生成（从 Git 历史恢复）
│   ├── externalPromptTemplate.ts  # [MODIFY] 无需改动
│   └── lyricsHtml.ts        # [MODIFY] 无需改动
├── components/
│   └── HtmlPasteInput.tsx   # [MODIFY] 删除手动流程按钮，新增"一键生成"
└── App.tsx                  # [MODIFY] 无需改动（状态管理已完备）
```

## 关键代码接口

```typescript
// src/services/volcanoChat.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export async function sendChatMessageStream(
  messages: ChatMessage[],
  options?: SendChatMessageOptions,
  onChunk?: (text: string) => void,
): Promise<string>;

// src/services/volcengineLyricsNotes.ts
export interface LyricsNotesClipResult {
  title: string;
  bodyHtml: string;
  artist?: string;
}
export async function fetchLyricsNotesFromVolcengine(
  title: string,
  artist: string,
  onChunk?: (chunk: string) => void,
): Promise<LyricsNotesClipResult>;
```

## 设计风格

采用与现有 SHUFURI 应用完全一致的极简风格，保持品牌一致性。

### 视觉风格

- **整体调性**：优雅简洁的日语释音与排版助手
- **参考现有设计**：`App.css` 和 `styles/theme.css` 中的设计令牌
- **按钮风格**：继续使用 `.btn-filled`、`.btn-tonal`、`.btn-secondary` 样式类

### "一键生成"按钮设计

1. **默认状态**：

- 文本："一键生成"
- 样式：`.btn-filled ext-pipeline__prompt-btn`（复用现有样式）
- 图标：`ArrowRightIcon`（复用现有图标）

2. **生成中状态**：

- 文本："生成中..."
- 样式：`.btn-filled` + `disabled` 状态
- 禁用点击，防止重复提交

3. **生成进度**：

- 在按钮旁显示 `.ext-pipeline__hint` 元素
- 内容：显示最新生成的歌词片段（通过 `onChunk` 回调更新）

### 布局调整

移除"一键生成指令"和"一键粘贴"按钮后，布局需要微调：

- 保留"歌名"和"歌手"输入框
- "一键生成"按钮放在输入框行的最右侧
- "一键清除"和"排版预览"按钮保留在底部操作栏

### 响应式设计

- 桌面端：按钮和输入框横向排列
- 移动端：自动适配现有响应式布局（Capacitor iOS 应用）

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 探索 shufulife 项目中 `cloudbaseAuth.ts` 的实现细节，确保匿名登录逻辑与现有架构完全一致
- Expected outcome: 获取完整的 `ensureCloudbaseAuth()` 实现代码

### Skill

- **skill-creator**（如需要）
- Purpose: 如果需要创建新的 CloudBase 相关 skill，使用此技能
- Expected outcome: 创建可复用的 CloudBase 集成技能