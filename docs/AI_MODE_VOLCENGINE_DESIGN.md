# 划词 AI 讲解（CloudBase + 火山引擎）

**版本**：v2.0（产品方向已从「首页 AI 搜歌词」改为「编辑页划词解释」）  
**分支**：`feat/ai-mode-volcengine`  
**更新日期**：2026-07-19

---

## 1. 目标

在**不改变**现有「外部 AI 口令 → 粘贴排版」主流程的前提下，于编辑页提供划词学习能力：

1. **本地优先**：日语用 JMdict lite + Kuromoji；韩语用 KRDICT lite（韩→中）+ Garu 形态分析即时给出读音 / 词性 / 基础义
2. **可选 AI讲解**：经腾讯云 CloudBase 代理调用火山方舟（Doubao Mini），输出语境释义 /（日语）外来语原词 / 语法拆解 / 歌词意境
3. **添加到笔记**：将 AI 结果写入歌词正文末尾「划词笔记」区（样式与重点词汇条一致）

**不做**：首页 AI 搜歌词、客户端直持 ARK API Key、整句翻译替代划选焦点。

---

## 2. 交互

| 步骤 | 行为 |
|------|------|
| 入口 | 编辑页墨水工具箱 → `?` 开启划词 |
| 选区 | 光标 I 型；选中词 / 短语 / 句内片段；钳制在语义块内 |
| 本地 | 面板先出本地词典结果 |
| AI | 用户点「AI讲解」→ 流式或整段返回三段结构 |
| 笔记 | 「添加到笔记」→ 正文末尾追加 `lyrics-vocab-item` |

### AI 输出结构（严格）

```text
【语境释义】…
【外来语原词】…   ← 仅日语；片假名外来语须含源语言+原词+译义；非外来语写「—」
【语法分子式】…
【语法拆解】…   ← 须还原口语缩略 / 活用 / 接续；禁止敷衍「整段=词典形」
【语法胶囊】…
【歌词意境】…   ← ≤50 字；无可写「—」
【歌词黑话】…
```

外来语行格式：`片假名 ← 源语言 原词 → 中文译义`（多词连写拆成多行）。

---

## 3. 架构

```text
编辑页选区
  → lookupJmdictLite (+ Kuromoji)
  →（可选）streamExplanation / generateExplanation
       ├─ DEV：Vite 中间件 /api/explain-stream（scripts/arkExplainStream.mjs）
       ├─ 正式包：VITE_EXPLAIN_STREAM_URL → 云函数 arkExplainStream（HTTP Access）
       └─ 降级：callFunction(arkProxy) action=explain.selection
  →（可选）appendExplainNote → bodyHtml「划词笔记」
```

### 密钥边界

| 位置 | 内容 |
|------|------|
| 客户端 `.env` | 仅开发用 `ARK_API_KEY`（Vite 中间件注入）；**勿**设 `VITE_ARK_*` |
| 云函数环境变量 | 生产 `ARK_API_KEY`（arkProxy / arkExplainStream） |
| 正式包 | `VITE_EXPLAIN_STREAM_URL`（公开 HTTP 入口，无 Key） |

---

## 4. 云函数

目录：`cloudfunctions/`（`functions` → 同目录符号链接，兼容 CLI）  
配置：`cloudbaserc.json`（`functionRoot: ./cloudfunctions`）

| 函数 | 类型 | 用途 |
|------|------|------|
| `arkProxy` | Event | `explain.selection` 非流式降级；Mini + `thinking: disabled` |
| `arkExplainStream` | Event + HTTP Access | 返回 SSE 协议正文（meta/delta/done）；首包延迟≈整段生成 |

部署示例：

```bash
npm run deploy:ark-proxy
npm run deploy:ark-explain-stream
# 控制台为 arkExplainStream 绑定 HTTP 路径 /api/explain-stream，并配置 ARK_API_KEY
```

模型常量：`doubao-seed-2-0-mini-260215`，`max_tokens`≈360（与 `src/services/ai/types.ts` 对齐）。

---

## 5. 本地词典

| 资源 | 路径 | 说明 |
|------|------|------|
| JMdict eng-common lite | `public/dict/jmdict-lite.json.gz` | `npm run generate:jmdict-lite`（约 0.8MB gzip） |
| Kuromoji IPAdic | `public/dict/kuromoji/*.dat.gz` | `npm run generate:kuromoji-dict` |
| 日语查词 | `src/services/dict/jmdictLite.ts` | 精确 → Kuromoji → 剥助词 → 活用 → 最长匹配 |
| KRDICT lite（韩中优先） | `public/dict/krdict-lite.json.gz` | `npm run generate:krdict-lite`（释义：中文→英语→韩义兜底；不再因无中文丢词） |
| 韩语查词 | `src/services/dict/krdictLite.ts` | 本地假分词：精确 / 剥助词 / 词尾规则 / 前缀词干 / 最长匹配 |
| 韩语假分词 | `src/services/dict/koSurfaceNormalize.ts` | 助词 / 常见活用还原（纯本地，无 WASM 依赖） |

**韩语数据与许可**：국립국어원《한국어기초사전》(KRDICT)，经 [spellcheck-ko/korean-dict-nikl](https://github.com/spellcheck-ko/korean-dict-nikl) 镜像构建。许可 **CC-BY-SA 2.0 KR**，再分发须署名国立国语院。释义优先中文 Equivalent，其次英语，再次韩语 Sense（标记「（韩义）」）；**不再因缺少中文 Equivalent 丢弃词条**。划选走本地假分词（助词剥离 + 词尾还原 + 最长匹配）查 KRDICT。注：原 garu-ko WASM 形态分析因 CloudBase 静态托管 CSP 限制（`unsafe-eval` 不可用）无法在线上加载，已于纯本地方案移除该依赖。运行时另有 `krdictSeedPatches` 补极少数仍缺的高频洞。

**明确不采用（当前）**：

- 官方「JMdict-chs」（官方无 Mandarin 发行）、SudachiJava/Py（不进 WebView）；日语中文义由 AI讲解补足
- 社区 Evidict / 无名 StarDict 韩中整包（许可不明，不宜内置）
- sql.js + SQLite 运行时；完整 MeCab-ko 重型词典包（数十 MB；已用轻量 garu-ko WASM 替代）

---

## 6. 客户端环境变量

见 `.env.example`：

- `ARK_API_KEY`：仅本地 Vite 流式中间件
- `VITE_EXPLAIN_STREAM_URL`：正式包 / 非局域网必填
- `CAP_SERVER_URL`：可选；设则 Capacitor 加载电脑 Vite（联调），正式包勿设

```bash
# 正式包
# 1. 写入 VITE_EXPLAIN_STREAM_URL
# 2. 确认未设置 CAP_SERVER_URL
npm run cap:sync
# Xcode 重装真机

# 局域网联调 AI 流式
npm run dev
npm run cap:sync:live   # 或 CAP_SERVER_URL=http://<LAN-IP>:5173
```

---

## 7. 主要源码索引

| 区域 | 路径 |
|------|------|
| 会话 | `src/hooks/useExplainSession.ts` |
| 面板 | `src/components/ExplainMicroscopePanel.tsx` |
| 选区 | `src/utils/readSelectionForExplain.ts` | 行级钳制；日语松手后 Kuromoji 词界吸附；读区去 ruby |
| 笔记写入 | `src/utils/appendExplainNoteToBody.ts` |
| AI 网关 | `src/services/ai/*` |
| 编辑页接线 | `src/components/screens/EditScreen.tsx` |

---

## 8. 验收清单

- [x] 工具箱 `?` 开启划词，本地词典先出结果
- [x] 韩语 `lang=ko` 走 KRDICT lite + Garu 形态分析（假分词回退）
- [x] AI讲解三段结构 + 单卡 UI
- [x] 添加到笔记 → 正文末尾词汇条样式
- [x] 正式包走 `VITE_EXPLAIN_STREAM_URL`；失败可降级 `arkProxy`
- [x] 不在客户端打包生产 ARK Key

---

## 9. 历史说明

v1 设计曾规划首页 `AI` 开关自动搜歌词（Step1/Step2）。产品已否决该方向：主流程仍为外部 AI 口令；本仓库 CloudBase 能力仅服务**划词讲解**。
