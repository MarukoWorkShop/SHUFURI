# SHUFURI 产品需求文档（PRD）

**版本**：v1.1  
**更新日期**：2026-06-03  
**产品定位**：个人字音排版与数字活页工具  
**技术栈**：Vite + React（Web）/ iOS WebView 壳（Capacitor 桥接）

---

## 1. 产品愿景与边界

### 1.1 解决什么问题

用户学习日语/韩语/英语歌词时，需要带假名注音或多语言字体的歌词海报、可选词汇释义与语法品读，以及可编辑、可分页、可导出的「数字活页」。

SHUFURI **不负责搜歌词、不负责 AI 推理**，只负责：

1. 生成给外部 AI 的「搜索 + 结构化」口令
2. 解析 AI 返回的结构化文本
3. 排版、微调、分页、导出、本地保存

### 1.2 明确不做

| 不做 | 说明 |
|------|------|
| 内置歌词库 / 在线歌词 API | 已移除 Volcengine 等旧版内置 AI |
| 截屏 OCR 识歌词 | 主流程已移除；仅保留分享链接解析 |
| 云端同步 | 歌词本存 IndexedDB，仅本地 |
| 整首双语对照 | 一首歌一个 `LANG:`，波轮用于搜对语言版本 |
| 行内英/法混排 | 已在技术 plan 中设计，尚未实现 |

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
| **edit** | 手机竖屏编辑画布 | 预览海报、墨微调（双击编辑注音/中文/标题） |
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

拨轮选项由**语言矩阵 → 学习目标语言**推导（顺序 JAP → KOR → ENG → 中文），**无 AUTO**。详见 [`docs/LANGUAGE_MATRIX.md`](LANGUAGE_MATRIX.md)。

| 选项 | Prompt `activeTarget` | 说明 |
|------|----------------------|------|
| JAP | `jp` | 日语 + `{汉字:假名}` |
| KOR | `ko` | 韩语 |
| ENG | `en` | 英语 |
| 中文 | `zh` | 中文 + `{汉字:拼音}` |

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

| 用途 | jp | ko | en |
|------|----|----|-----|
| 歌词 | Kozuka Mincho EL | HCR Batang | Sansation Light |
| 中文 | PingFang SC | 同左 | 同左 |
| UI | Sansation Light + PingFang | | |

### 8.3 分页

`paginateFuriganaBodyHtml`：原子化 → 贪心装箱 → 溢出修复。`.lyrics-group` 不可拆。

### 8.4 导出

- iOS：矢量 HTML + expo-print
- Web：html2canvas + jsPDF
- PNG：单页长按 / Native 批量

---

## 9. 墨微调（edit）

双击编辑：标题、ruby（汉字+假名）、zh-line。`InkFineTunePopover` + 草稿持久化。

---

## 10. 歌词本

IndexedDB `saved-lyrics`：title, artist, bodyHtml, rawLyrics, pageHtmls, layoutProfile, lang。

---

## 11. 设置

| 项 | 默认 |
|----|------|
| 配色主题 mono/blue/red | mono |
| 默认导出规格 | B5 |
| **语言矩阵 — 使用语言** | 跟随系统（zh / en） |
| **语言矩阵 — 跟随系统语言** | 开 |
| **语言矩阵 — 学习目标语言** | JAP + KOR + ENG |
| 附词解与语法 | 开 |
| 交互音效 | 开 |

语言矩阵完整规格见 [`docs/LANGUAGE_MATRIX.md`](LANGUAGE_MATRIX.md)。

---

## 12. Native 桥接

命令：`ping` / `set_content` / `export_pdf` / `export_png`  
能力：剪贴板、相册、触觉、回前台监听

---

## 13. 已知限制

| 项 | 状态 |
|----|------|
| 混排拉丁语 | 未实现 |
| 海报 CSS 不随 App 主题变色 | 固定印刷色 |
| `buildVectorPrintInnerCss` 未完全接入 `lang` | 部分滞后 |
| `ui-tokens.css` | 未接入，与 theme 冲突 |

---

## 14. 关键文件

| 区域 | 路径 |
|------|------|
| 主控 | `src/App.tsx` |
| 口令 | `src/codec/prompt/buildEncoderPrompt.ts` |
| 解析 | `src/codec/` |
| 分页 | `src/utils/furiganaLayout/paginateFuriganaHtml.ts` |
| 排版 CSS | `src/utils/furiganaLayout/furiganaPosterShared.ts` |
| 主题 | `src/styles/theme.css` |
| 设计规范 | `docs/DESIGN_SYSTEM.md` |
| **语言矩阵** | `docs/LANGUAGE_MATRIX.md` |

---

## 15. 成功指标（建议）

- 口令→排版一次解析成功率
- 分页溢出告警率
- 导出完成率（180s 超时内）
- 歌词本复用率
