# SHUFURI 产品需求文档（PRD）

**版本**：v1.5  
**更新日期**：2026-07-31  
**产品定位**：多语歌词释音与排版助手  
**技术栈**：Vite + React 19（Web）/ iOS WebView 壳（Capacitor 桥接）  
**当前活跃分支**：`feature/global-ui-optimization`（全局 UI 优化）  
**关联计划分支**：`feat/self-evolving-explain-pipeline`（自我进化划词架构，见 [`plan.md`](./plan.md)）

---

## 1. 产品愿景与边界

### 1.1 解决什么问题

用户学习日语/韩语/英语/中文歌词时，需要带发音标注（振假名、拼音等）或多语言字体的歌词海报、可选词汇释义与语法品读，以及可编辑、可分页、可导出的「数字活页」。

SHUFURI **主流程不负责搜歌词**；歌词生成仍走外部 AI 口令。排版侧负责：

1. 生成给外部 AI 的「搜索 + 结构化」口令
2. 解析 AI 返回的结构化文本
3. 排版、微调、分页、导出、本地保存
4. （可选）编辑页**高亮笔刷划词**：本地词典即时释义 + 托管云函数 AI讲解 → 写入正文笔记
5. （可选）编辑页**内嵌 AI 生成**：对已排版正文直接生成词汇/语法区段（无需走完整外部 AI 管线）
6. **自我进化划词架构**：共享热词讲解缓存 + 赞踩反馈 → 越用越聪明（见 [`plan.md`](./plan.md)）

### 1.2 明确不做

| 不做 | 说明 |
|------|------|
| 内置歌词库 / 应用内搜歌词 | 不提供首页「AI 查找歌词」；不直连版权歌词源 |
| 客户端持有生产 ARK Key | Key 仅在 CloudBase 云函数或本地开发 `.env` |
| 截屏 OCR 识歌词 | 主流程已移除；仅保留分享链接解析 |
| 云端同步歌词本 | 歌词本存 IndexedDB，仅本地 |
| 整首双语对照 | 一首歌一个 `LANG:`，波轮用于搜对语言版本 |
| 行内英/法混排 | 已在技术 plan 中设计，尚未实现 |
| 用户内容上传云端 | **铁律**：歌词全文、用户改写、笔记正文、学习卡永不上云；云端仅收赞/踩信号 |

> ~~划词仅单选~~ → **已实现**多句选区（`feat/explain-multi-sentence`）  
> ~~无编辑页内 AI 生成~~ → **已实现**编辑页嵌入 AI 生成词解/语法（`feat/embedded-ai-generation`）  
> ~~无桌面端适配~~ → **已实现**浏览器桌面端布局 + 多语品牌文案（`feat/browser-ui-adaptation`）

划词 AI讲解的设计与部署见 [`docs/AI_MODE_VOLCENGINE_DESIGN.md`](./AI_MODE_VOLCENGINE_DESIGN.md)。  
自我进化划词架构（共享缓存 + 赞踩 + Prompt 热更新）见 [`docs/plan.md`](./plan.md) 和 [`docs/SELF_EVOLVING_EXPLAIN_ARCHITECTURE.md`](./SELF_EVOLVING_EXPLAIN_ARCHITECTURE.md)。

### 1.3 合规立场

不内置、不传输、不存储有版权的音乐及歌词。用户保存内容为个人学习摘录。

---

## 2. 用户角色与场景

| 角色 | 典型场景 |
|------|----------|
| 日语学习者 | 从豆包等 App 复制带 `{汉字\|假名}` 的歌词 → 排版成 B5 打印海报 |
| 韩语学习者 | 选 KOR 波轮 → AI 返回 `KO:` 行 + 词汇/语法 → HCR Batang 排版 |
| 英语学习者 | 选 ENG → `EN:` 纯英文 + Sansation Light 排版 |
| 重度用户 | 编辑注音/翻译 → 保存歌词本 → 多次导出 |

---

## 3. 应用状态机

| 模式 | 界面 | 核心能力 |
|------|------|----------|
| **input** | 首页表单 | 歌名/歌手、语言波轮、生成 AI 口令、粘贴并排版、歌词本抽屉 |
| **edit** | 手机竖屏/桌面编辑画布 | 预览海报、墨微调、高亮笔刷划词AI讲解、内嵌AI生成、词解/语法可编辑 |
| **export** | 导出预览 | B5/手机规格切换、分页预览、保存、导出 PDF、长按存图 |

```
input → edit → export → edit
         ↑___________|
input ← 重置 / 新建
```

---

## 4. 端到端主流程

### 4.1 标准路径（外部 AI 管线）

1. 首页填写歌名/歌手，选择语言波轮（JAP/KOR/ENG/中文）
2. 「一键生成指令」→ 口令写入剪贴板 → 跳转外部 AI App
3. 用户在豆包等粘贴口令，AI 返回记录流（`@0 … @9`）
4. 回到 SHUFURI：自动剪贴板弹窗 或 手动「粘贴并排版」
5. 确认 → `compileDocument` → **edit** 模式
6. 可选墨微调 → **export** → 保存歌词本 / 导出 PDF·PNG

### 4.2 辅助入口

| 入口 | 触发条件 | 行为 |
|------|----------|------|
| QQ/网易云分享链接 | 剪贴板含分享 URL | 解析歌名/歌手预填；推断 jp/ko |
| 歌词本抽屉 | 用户打开 | IndexedDB 项目恢复 edit |
| Native Bridge | iOS 壳 `set_content` | 注入 rawText/bodyHtml |
| 链条按钮 tooltip | 无音乐链接时 | 引导去音乐 App 复制链接 |

---

## 5. 首页（input）功能规格

### 5.1 表单

| 字段 | 必填 | 用途 |
|------|------|------|
| TITLE | 是 | Prompt Meta、海报标题 |
| ARTIST | 否 | 默认「佚名」 |

### 5.2 语言波轮

拨轮选项由**语言矩阵 → 学习目标语言**推导（顺序 JAP → KOR → ENG → 中文），**无 AUTO**。标签以**本语言**显示（日本語 / 한국어 / ENG / 中文），移除原有 AUTO 提示文案。详见 [`docs/LANGUAGE_MATRIX.md`](LANGUAGE_MATRIX.md)。

| 选项 | 标签 | Prompt `activeTarget` | 说明 |
|------|------|----------------------|------|
| JAP | 日本語 | `jp` | 日语 + `{汉字:假名}` |
| KOR | 한국어 | `ko` | 韩语 |
| ENG | ENG | `en` | 英语 |
| 中文 | 中文 | `zh` | 中文 + `{汉字:拼音}` |

- 存 `appSettings.lyricsLanguage`（localStorage）
- OCR/链接检测仅**预选**拨轮，不生成 AUTO 口令

### 5.3 一键生成指令

- `buildEncoderPrompt(artist, title, options)` + **`LanguageMatrixContext`**
- 四份隔离 encoder：jp / ko / en / zh
- 「附词解与语法品读」控制 VOCAB/GRAMMAR 区段
- 可注入 OCR/链接上下文

### 5.4 粘贴与剪贴板

- 「粘贴并排版」：`useClipboardStructuredLyrics()` 就绪时可点
- Native 回前台三阶段重试读剪贴板（0/600/1400ms）
- 哈希去重 + 取消后消费标记
- `ClipboardDetectCard` 确认后进入排版

---

## 6. 外部 AI 数据协议（记录流 ENC）

```
@0
H|歌手|歌名|jp
L|1|{淡:あわ}い{色:いろ}|淡淡的
...
@1
V|1|{秋桜:コスモス}|秋樱|3|
@2
G|1|ば形（假定形）|详解|7|译
@9
```

- 注音：`{基字:读音}`（冒号）；列分隔 `|`，字段内字面 `|` 写 `\|`
- V/G 第 5 列纯数字 = 歌词行号引用

本地清洗：`cleanDoubaoPaste.ts` 去 Python 污染 + strip 围栏。

---

## 7. 解析与 HTML 管线

| 步骤 | 模块 |
|------|------|
| 清洗 | `cleanDoubaoPaste` |
| 解析 | `src/codec/compileDocument` → roleCompiler → 现有 DOM class |
| Ruby | `applyRubyMarkup`（仅 JP） |
| 语法标题拆分 | `buildGrammarTitleHtml`（括号 → ja/ko + zh span） |
| 归一化 | `normalizeLyricsBodyHtml` |
| 墨微调标注 | `annotateInkEditTargets` |

`lang` 状态：优先 `LANG:` 字段，否则字符统计自动检测。

---

## 8. 排版管线

### 8.1 双规格

| Profile | 尺寸 |
|---------|------|
| `clipPosterPrint` | 600×852 B5 |
| `mobilePoster` | 1080×1920 手机竖屏 |

### 8.2 字体

| 用途 | jp | ko | en | zh |
|------|----|----|-----|-----|
| 歌词 | Kozuka Mincho EL | HCR Batang | Sansation Light | 思源宋体（Source Han Serif） |
| 中文 | PingFang SC | 同左 | 同左 | 同左 |
| 拼音 | — | — | — | PingFang SC（字号+1档，色 #454f5f） |
| UI | Sansation Light + PingFang | | | |

### 8.3 桌面端适配

浏览器桌面端布局已通过 `feat/browser-ui-adaptation` 实现：编辑页笔记本面板、显微镜 AI 增强、多语品牌文案（`docs/BROWSER_UI_ADAPTATION_PLAN.md`）。

### 8.4 分页

`paginateFuriganaBodyHtml`：原子化 → 贪心装箱 → 溢出修复。`.lyrics-group` 不可拆。

### 8.5 导出

- iOS：矢量 HTML + expo-print
- Web：html2canvas + jsPDF
- PNG：单页长按 / Native 批量

---

## 9. 编辑页（edit）能力

编辑页是排版与学习的核心界面，提供以下能力栈：

### 9.1 墨微调（Ink Fine-Tune）

双击编辑：标题、ruby（汉字+假名）、zh-line。`InkFineTunePopover` + 草稿持久化（`useInkEditSession`）。

### 9.2 划词 AI 讲解（Explain Microscope）

通过 **高亮笔刷（Highlighter Brush）** 涂抹选区（替代原生文字选择），触发讲解流程：

1. **本地词典**：JMdict（日语）/ KRDICT + Garu（韩语）即时释义
2. **AI 深度讲解**：点「AI讲解」→ 云函数调火山引擎豆包 → 结构化 JSON 返回
   - 支持 **多句选区**（`feat/explain-multi-sentence`），逐句翻译解析
   - 语法讲解输出语言**跟随界面语言**（`interfaceLanguage`，i18n）
   - 讲解结果可**写入正文笔记**（`appendExplainNoteToBody`）
3. **韩语增强**：Garu 形态素分析 + KRDICT 词典（`feat/ko-dict-lite`、`feat/ko-garu-morphology`）

主要组件：`ExplainMicroscopePanel`、`HighlighterBrush`、`useExplainSession`

### 9.3 内嵌 AI 生成（Embedded AI Generation）

在编辑页**无需走完整外部 AI 管线**，可直接对已排版正文生成词汇/语法区段（`feat/embedded-ai-generation`）：

- AI 词解（vocabulary）+ AI 语法（grammar）独立生成
- 受设置「附词解与语法」控制
- 详见 [`docs/EMBEDDED_AI_GENERATION_PLAN.md`](./EMBEDDED_AI_GENERATION_PLAN.md)

### 9.4 词解/语法可编辑删除

重点词汇（`.lyrics-vocab-item`）和语法点（`.lyrics-grammar-item`）在编辑页可直接编辑或删除（`feat/edit-parchment-reading`）。

---

## 10. 歌词本

IndexedDB `saved-lyrics`：title, artist, bodyHtml, rawLyrics, pageHtmls, layoutProfile, lang。

---

## 11. 学习卡（Study Cards）

从记录流 `V|` / `G|` 区段提取词汇与语法点，存入独立 IndexedDB `japanese-kana-app-study-cards`，在首页抽屉浏览、导出 Anki TSV。

### 11.1 触发时机

| 时机 | 行为 |
|------|------|
| 粘贴并排版 | 从 raw 提取词卡，绑定当前 `bundleId`（未保存时为 `session-*`） |
| 保存歌词本 | `session-*` 迁移为项目 `id`，再同步词卡 |
| 从歌词本打开 | 以项目 `id` 为 `bundleId` 重新同步 |

受设置「附词解与语法」控制；raw 无 `V|`/`G|` 行时不写入。

### 11.2 全局去重（重点）

**目标**：同一学习语种下，同一词条只保留一张词卡；重复导入同一首歌或不同歌含相同词时，词卡库不增殖。

| 规则 | 说明 |
|------|------|
| 去重键 `dedupeKey` | `` `${lang}\|${kind}\|${canonicalTerm}` `` |
| `lang` | 排版管线语言：`jp` / `ko` / `en` / `zh` |
| `kind` | `vocab` 与 `grammar` **分开**去重（同形可同时各一张） |
| `canonicalTerm` — 词汇 | `V\|` 第 1 列 `sourceRaw`：`trim` → jp/zh 走 `normalizeRubyMarkupText` → Unicode NFC |
| `canonicalTerm` — 语法 | 语法标题**括号前原形**（如 `は（助词）` → `は`），再同样规范化 |
| 命中已有键 | **保留库中已有卡**（`id` / `createdAt` 不变），跳过新 draft |
| 同批写入 | 同一 `dedupeKey` 仅写第一张，其余 skip |
| 按 bundle 替换 | 同步时先删除该 `bundleId` 下旧卡，再对剩余库做全局去重后插入 |

**刻意不做**：按歌名/项目隔离去重（两首歌同词仍合并为一张）；多来源 `sourceLabel` 拼接（v2 可选）。

### 11.3 存储与迁移

- Object store：`study-cards`；字段含 `dedupeKey`
- 索引：`bundleId`、`createdAt`、`dedupeKey`（**unique**）
- DB 版本升级（v1→v2）：为存量卡回填 `dedupeKey`；同键多条时保留 **`createdAt` 最早** 的一条，其余删除

### 11.4 导出

- Anki TSV：`buildAnkiImportTsv`；去重后同语种同词不会重复出现在导出列表

---

## 12. 自我进化划词架构（进行中）

> 分支 `feat/self-evolving-explain-pipeline`，详设见 [`docs/plan.md`](./plan.md) 和 [`docs/SELF_EVOLVING_EXPLAIN_ARCHITECTURE.md`](./SELF_EVOLVING_EXPLAIN_ARCHITECTURE.md)

### 12.1 目标

让划词 AI 讲解「越用越聪明、维护成本下降」，同时**不收集用户自创内容**。

**数据分层**：
| 层 | 存储 | 内容 |
|----|------|------|
| 本地（不上云） | IndexedDB | 歌词本、学习卡、笔记、本地词典结果 |
| 云端共享 | CloudBase `explain_cache` + COS | 热词讲解 JSON 缓存、Prompt 配置 |
| 信号（不上云） | CloudBase `explain_votes` | 匿名赞/踩计数 |

### 12.2 MVP 五阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase A | `ExplainPayload` 类型 + 适配器（零产品变化） | 待实现 |
| Phase B | `explainLookup` 云函数 → 共享缓存命中/未命中 | 待实现 |
| Phase C | 👍/👎 赞踩 UI + `explainVote` 云函数 | 待实现 |
| Phase D | Prompt 配置外置 COS → 热更新 | 待实现 |
| Phase E | 30 条黄金回归用例防 Prompt 改坏 | 待实现 |

### 12.3 歌词语法缓存（已实现）

分享歌词的**词汇/语法生成结果**通过 6 维结构哈希缓存（`feat/lyrics-grammar-cache`）：`songKey + termKey + lang + schemaVer`。相同歌词+词条复用缓存，减少豆包调用量。支持 `forceRefresh` 覆盖修复。

---

## 13. 设置

| 项 | 默认 |
|----|------|
| 配色主题 mono/blue/red | mono |
| 默认导出规格 | B5 |
| **语言矩阵 — 释义语言** | 首次安装按系统 locale 推断（`zh*`→中文，`en*`→English，**其他→English**）；用户手动切换后持久化，启动不覆盖 |
| **语言矩阵 — 学习目标语言** | JAP + KOR + ENG |
| 附词解与语法 | 开 |
| 交互音效 | 开 |
| ~~AI 讲解语言~~ | **已实现**：语法讲解输出跟随界面语言（`interfaceLanguage`，i18n） |

语言矩阵完整规格见 [`docs/LANGUAGE_MATRIX.md`](LANGUAGE_MATRIX.md)。

---

## 14. 安全加固（已实现）

| 项 | 说明 |
|----|------|
| CSP 头 | 内容安全策略限制脚本/样式来源 |
| 全局 unhandledrejection | 捕获未处理 Promise 异常 |
| 错误上报 | `errorReport` 服务集中上报 |
| 后端硬配额 | 云函数层每日调用量上限 |
| NoSQL 用量记录 | `ai_usage` 埋点追踪 AI 调用 |
| 每日费用日报 | 云函数定时统计 AI 成本 |

---

## 15. Native 桥接

命令：`ping` / `set_content` / `export_pdf` / `export_png`  
能力：剪贴板、相册、触觉、回前台监听

---

## 16. 已知限制

| 项 | 状态 |
|----|------|
| 混排拉丁语 | 未实现 |
| 海报 CSS 不随 App 主题变色 | 固定印刷色 |
| `buildVectorPrintInnerCss` 未完全接入 `lang` | 部分滞后 |
| ~~`ui-tokens.css` 未接入~~ | `feature/global-ui-optimization` 分支进行中 |
| 自我进化划词架构 | Phase A-E 待实现（`feat/self-evolving-explain-pipeline`） |
| 桌面端编辑页滚动画布性能 | `useEditCanvasScrollPerfProbe` 探测中 |

---

## 17. 关键文件

| 区域 | 路径 |
|------|------|
| 主控 | `src/App.tsx` |
| 口令 | `src/codec/prompt/buildEncoderPrompt.ts` |
| 解析 | `src/codec/` |
| 分页 | `src/utils/shufuriPoster/paginateShufuriPosterHtml.ts` |
| 排版 CSS | `src/utils/shufuriPoster/shufuriPosterShared.ts` |
| **学习卡** | `src/studyCards/`、`src/services/studyCardsStore.ts` |
| 主题 | `src/styles/theme.css` |
| 设计规范 | `docs/DESIGN_SYSTEM.md` |
| **语言矩阵** | `docs/LANGUAGE_MATRIX.md` |
| **划词 AI 讲解** | `src/components/ExplainMicroscopePanel.tsx`、`src/hooks/useExplainSession.ts`、`src/services/ai/` |
| **内嵌 AI 生成** | `src/hooks/useEmbeddedAiGenerate.ts`、`docs/EMBEDDED_AI_GENERATION_PLAN.md` |
| **高亮笔刷** | `src/utils/highlighterBrush.ts` |
| **歌词语法缓存** | `docs/LYRICS_GRAMMAR_CACHE_DESIGN.md` |
| **自我进化架构** | `docs/plan.md`、`docs/SELF_EVOLVING_EXPLAIN_ARCHITECTURE.md` |
| **安全 / CSP** | `vite.config.ts`（CSP）、`src/services/errorReport.ts` |
| **桌面端适配** | `docs/BROWSER_UI_ADAPTATION_PLAN.md` |
| **韩语词典** | `src/services/dict/krdictLite.ts`、`src/services/dict/garuKoTokenizer.ts` |

---

## 18. 成功指标（建议）

- 口令→排版一次解析成功率
- 分页溢出告警率
- 导出完成率（180s 超时内）
- 歌词本复用率
- **划词缓存命中率**（目标：热词 > 50%）
- **云端用户内容量**（目标：恒为 0）
- **安全事件数**（目标：0）

---

## 19. 需求状态追踪

> **产品经理（WORKBUDDY）负责**：优先级、需求描述、验收标准  
> **CodeBuddy（我）负责**：实现状态、阻塞项、关联 commit  
> 状态：📋待规划 → 🏗️进行中 → ✅已交付 → 🔁需返工

| 需求 ID | 需求 | PRD 章节 | 优先级 | 实现状态 | 负责人 | 备注 / 阻塞项 |
|---------|------|----------|--------|----------|--------|--------------|
| FEAT-01 | 口令生成管线 | 6 | P0 | ✅已交付 | CodeBuddy | — |
| FEAT-02 | HTML 解析管线 | 7 | P0 | ✅已交付 | CodeBuddy | — |
| FEAT-03 | 排版 / 分页 / 导出 | 8 | P0 | ✅已交付 | CodeBuddy | — |
| FEAT-04 | 墨微调（双击编辑） | 9.1 | P1 | ✅已交付 | CodeBuddy | — |
| FEAT-05 | 高亮笔刷划词 AI 讲解 | 9.2 | P1 | ✅已交付 | CodeBuddy | 多句选区已交付 |
| FEAT-06 | 内嵌 AI 生成（词解/语法） | 9.3 | P2 | ✅已交付 | CodeBuddy | — |
| FEAT-07 | 词解/语法可编辑删除 | 9.4 | P2 | ✅已交付 | CodeBuddy | — |
| FEAT-08 | 歌词本 | 10 | P1 | ✅已交付 | CodeBuddy | IndexedDB 本地 |
| FEAT-09 | 学习卡（全局去重） | 11 | P1 | ✅已交付 | CodeBuddy | — |
| FEAT-10 | 语言矩阵 + 波轮 | 5.2 | P0 | ✅已交付 | CodeBuddy | 本语言标签已更新 |
| FEAT-11 | 中文拼音 + 思源宋体 | 8.2 | P2 | ✅已交付 | CodeBuddy | — |
| FEAT-12 | 韩语 Garu + KRDICT | 9.2 | P1 | ✅已交付 | CodeBuddy | — |
| FEAT-13 | 语法讲解 i18n | 13 | P2 | ✅已交付 | CodeBuddy | 跟随界面语言 |
| FEAT-14 | 浏览器桌面端适配 | 8.3 | P2 | ✅已交付 | CodeBuddy | — |
| FEAT-15 | 安全加固（CSP/配额/上报） | 14 | P0 | ✅已交付 | CodeBuddy | — |
| FEAT-16 | 歌词语法缓存 | 12.3 | P1 | ✅已交付 | CodeBuddy | 6 维结构哈希 |
| FEAT-17 | 自我进化划词架构 | 12 | P1 | 📋待规划 | — | Phase A-E 待实现，见 `plan.md` |
| FEAT-18 | 全局 UI 优化 | — | P1 | 🏗️进行中 | CodeBuddy | 分支 `feature/global-ui-optimization` |
| FEAT-19 | 混排拉丁语 | 16 | P3 | 📋待规划 | — | 技术 plan 已有，未排期 |
| FEAT-20 | `ui-tokens.css` 接入 | 16 | P2 | 🏗️进行中 | CodeBuddy | 随 FEAT-18 一起推进 |
| FEAT-21 | 桌面端滚动画布性能 | 16 | P3 | 📋待规划 | — | 性能探测中 |

> **图例**：P0=核心主流程 / P1=重要功能 / P2=体验增强 / P3=远期规划  
> **更新规则**：产品经理改优先级和需求描述；CodeBuddy 改实现状态和备注。双方均可追加新行。
