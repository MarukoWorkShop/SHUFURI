# SHUFURI 设计规范

**版本**：v1.2  
**更新日期**：2026-06-03  
**适用范围**：App 壳层 UI（非海报排版画布）

海报排版有独立字体与颜色体系，见本文 §6。

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **纸感稳定** | 全屏 `overflow: hidden`，内部区域滚动；模拟铜版纸/App 壳，非网页 |
| **无滚动条** | 所有可滚动区域隐藏滚动条（全局策略），触控/滚轮滚动照常 |
| **字音优先** | UI 用现代无衬线（Sansation + PingFang）；海报正文用明朝/ Batang 等学习字体 |
| **轻触反馈** | 按键 scale 0.965 + 可选触觉 + 「カタ」声，强调物理质感 |
| **克制强调** | 主色用于关键 CTA；词汇/语法用深蓝绀色标识，不用粗体 |
| **三主题换肤** | 墨 / 绀 / 赤，语义令牌驱动，非硬编码色值 |

---

## 2. 令牌架构（四层）

源码：`src/styles/theme.css`（唯一生效源；`index.css` 仅 `@import` 它）

```
Layer 1  静态基元     --font-* / --text-* / --space-* / --radius-* / --duration-*
Layer 2  语义色       --color-*        （随 data-theme 切换）
Layer 3  组件令牌     --input-* / --btn-* / --panel-* / --chip-*
Layer 4  兼容别名     --ui-*           （映射到上层，供 App.css 引用）
```

**主题切换**：`document.documentElement.dataset.theme = 'mono' | 'blue' | 'red'`  
入口：`applyColorTheme()`（`src/utils/applyColorTheme.ts`）

---

## 3. 色彩

### 3.1 主题色板

| 令牌 | mono 墨 | blue 绀 | red 赤 |
|------|---------|---------|--------|
| `--color-bg` | `#f7f7f7` | `#f3f5f7` | `#faf6f5` |
| `--color-fg` | `#000000` | `#1a2330` | `#1c1917` |
| `--color-accent` | `#000000` | `#2b3a4a` | `#a63e3e` |
| `--color-accent-on` | `#ffffff` | `#ffffff` | `#ffffff` |
| `--color-fg-secondary` | `#666666` | `#4a5568` | `#57534e` |

### 3.2 语义用途

| 令牌 | 用途 |
|------|------|
| `--color-bg-elevated` | 卡片、面板、抽屉 |
| `--color-bg-muted` | 输入框底、分段控件底 |
| `--color-border` | 分割线、描边 |
| `--color-overlay` | 模态遮罩 |
| `--color-focus-ring` | 焦点环（待统一使用） |
| `--color-row-hover` | 歌词本列表悬停 |

### 3.3 禁止事项

- 新增 UI 样式**不得**直接写 `#2B3A4A` 等硬编码（现有遗留见 §8 审查）
- 离线横幅、错误态等应逐步迁入语义色

---

## 4. 字体与排版（App UI）

### 4.1 字体族

| 令牌 | 栈 |
|------|-----|
| `--font-sans` / `--ui-font-sans` | Sansation Light → PingFang SC → 系统黑体 |
| `--font-en` | Sansation Light → system-ui |
| `--font-mono` | SF Mono → Menlo |

`@font-face`：Sansation Light / Regular（`public/assets/`）

### 4.2 字号阶梯

| 令牌 | 值 | 典型用途 |
|------|-----|----------|
| `--text-xs` | 11px | Chip 标签、辅助说明 |
| `--text-sm` | 13px | Tonal 按钮、hint |
| `--text-base` | 15px | 正文、Filled 按钮 |
| `--text-lg` | 20px | 小节标题 |
| `--text-xl` | 28px | 大标题 |
| `--text-home-title` | 24px | 首页标题区（预留） |

### 4.3 字重

- UI 品牌名 SHUFURI：`font-weight: 300`（Light 气质）
- 按钮 Filled：`--weight-medium` (500)
- 按钮 Tonal：`--weight-regular` (400)

### 4.4 全局排版规则

- `body`：`font-family: var(--ui-font-sans)`，`antialiased`
- 全局 `user-select: none`；`input`/`textarea` 例外可选取
- 安全区：`env(safe-area-inset-*)` 用于顶栏、底栏、横幅

---

## 5. 间距、圆角、动效

### 5.1 间距（8px 网格）

`--space-1` 8px → `--space-6` 64px

常用：页面水平 `--ui-space-2` (16px)；区块间距 `--ui-space-3`~`4`。

### 5.2 圆角

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--radius-sm` | 8px | 小卡片 |
| `--radius-md` | 10px | 文本域 |
| `--radius-lg` | 14px | 面板、设置抽屉 |
| `--radius-pill` | 9999px | 按钮、输入框 |

### 5.3 动效

| 令牌 | 值 |
|------|-----|
| `--duration-fast` | 0.15s |
| `--duration-normal` | 0.28s |
| `--duration-drawer` | 0.4s |
| `--btn-press-scale` | 0.965 |
| `--ease-out` | cubic-bezier(0.25, 1, 0.5, 1) |

**按压反馈**：`useGlobalButtonFeedback` + CSS `:active { transform: scale(0.965) }`

### 5.4 滚动条（全局隐藏）

App 壳层**不得**显示可见滚动条（含抽屉、下拉列表、文本域、预览区、波轮等），以维持纸感 UI；**滚动能力必须保留**。

**唯一实现处**：`src/index.css`

```css
* {
  overscroll-behavior: none;
  scrollbar-width: none;        /* Firefox */
  -ms-overflow-style: none;     /* IE / 旧 Edge */
}

*::-webkit-scrollbar {
  display: none;                /* WebKit / iOS / Chrome */
}
```

**约定**：

| 项 | 规则 |
|----|------|
| 页面级 | `html` / `body` / `#root` 保持 `overflow: hidden`，禁止整页滚动 |
| 区域级 | 需要滚动的面板用 `overflow-y: auto`（或横向 `overflow-x: auto`），**不要**再写局部 `::-webkit-scrollbar` |
| 触控 | 长列表容器可加 `-webkit-overflow-scrolling: touch` |
| 例外 | 海报排版画布、PDF 导出 HTML 等**印刷预览**不在 App 壳内，不受此条约束 |

### 5.5 层级

| 令牌 | 值 |
|------|-----|
| `--z-drawer` | 300 |
| `--z-modal` | 400 |
| 链条 tooltip | 9999 |
| `--z-export-backdrop` | 2147483646 |

---

## 6. 海报排版设计（独立体系）

**生成处**：`furiganaPosterShared.ts` / `buildVectorPrintInnerCss.ts`  
**不随 App 主题变色**；固定印刷向黑白 + 强调色。

### 6.1 海报字体

| 角色 | 字体 | 来源 |
|------|------|------|
| 日文歌词主文 | Kozuka Mincho Pro R (Regular) | `KozMinPro-Regular.otf` |
| 日文注音 rt | Kozuka Mincho Pro EL | `KozMinPro-ExtraLight.otf` |
| 韩文歌词 | HCR Batang | `HCRBatang.ttf` |
| 英文歌词 | Sansation Light | `Sansation-Light.ttf` |
| 中文翻译/释义 | PingFang SC | 系统 |
| Ruby 注音 | 与正文同族，0.54–0.58em，色 `#64748b` |

### 6.2 海报颜色（固定）

| 用途 | 色值 |
|------|------|
| 正文 | `#0a0a0a` |
| 词汇/语法强调 | `#1e3a5f`（深绀，替代粗体） |
| 区段标题 | `#1e293b` |
| 占位/弱化 | `#64748b` / `#cbd5e1` |
| 画布底 | `#ffffff` |

### 6.3 海报字号（随 profile 弹性缩放）

- 日文正文约 `26px × (elasticFontBase/18)`
- 中文辅文约 `18px × 同比例`
- B5 vs 手机：见 `dimensions.ts`

### 6.4 海报语义 class

| Class | 含义 |
|-------|------|
| `.fv-title-h` | 歌名 + 歌手 |
| `.jp-line` / `.ko-line` | 原文行 |
| `.zh-line` | 翻译行 |
| `.vocab-word` / `.vocab-meaning` | 词汇词条/释义 |
| `.grammar-title-ja/ko` + `.grammar-title-zh` | 语法点标题 |
| `.lyrics-group` | 不可拆分的歌词对 |

---

## 7. 组件规范

### 7.1 按钮

| 类名 | 类型 | 令牌 |
|------|------|------|
| `.btn-filled` | 主操作（生成指令） | `--btn-filled-*` |
| `.btn-tonal` | 次操作（粘贴并排版） | `--btn-tonal-*` |
| `.btn-secondary` | 工具栏返回 | App.css 局部 |
| `.btn-export` | 导出/保存 | App.css 局部 |

**状态**：

- `:disabled` / `.is-dormant`：降透明度，Tonal 用 `--btn-tonal-fg-disabled`
- `:active`：全局 scale 反馈

### 7.2 输入

- Chip 标签：`--chip-*`（歌名/歌手字段标签）
- 文本域：`--textarea-*`，圆角 `--radius-md`
- 输入框：胶囊形 `--input-radius: pill`

### 7.3 面板

| 组件 | 类名前缀 | 说明 |
|------|----------|------|
| 设置 | `.app-settings` | 右侧滑入，`--panel-*` |
| 歌词本抽屉 | `.saved-library-drawer` | 装订线 `--library-binding` |
| 剪贴板卡片 | `.clipboard-detect-card` | 居中模态 |
| 墨微调 | `.ink-fine-tune-popover` | `--color-ink-popover` 底 |

#### 7.3.1 语言矩阵（设置抽屉）

详见 [`docs/LANGUAGE_MATRIX.md`](LANGUAGE_MATRIX.md)。

| 控件 | 类名 / 模式 | 说明 |
|------|-------------|------|
| 使用语言 | `.app-settings__segmented` | 中文 / English 二选一 |
| 跟随系统 | `.app-settings__row` + checkbox | 启动时同步 `navigator.language` |
| 学习目标 | `.app-settings__lang-chip` | JAP / KOR / ENG 多选；6px 字、`--color-accent` 字 + 20% 主题底 |
| 子标题 | `.app-settings__sublabel` | 「使用语言」「学习目标语言」分组 |

**交互约定**：

- 手动切换使用语言 → 自动关闭「跟随系统」
- 学习目标至少保留 1 项；chip 取消最后一项无效
- 区块位于「附词解与语法品读」之上

### 7.4 语言波轮

- `.lang-wheel`：横向 snap 滚轮
- **选项由语言矩阵推导**：`AUTO` + 已勾选学习目标（非固定四项）；见 `getWheelLanguages()`
- 选中项：`--color-accent` 色、字间距 `0.12em`
- 两侧渐变遮罩 `.lang-wheel__mask`

### 7.5 工具栏（export）

- 左：返回编辑
- 中：`PosterLayoutToggle` B5 / 手机
- 右：页数、保存、导出 PDF

---

## 8. 图标与品牌

- 品牌字标：**SHUFURI**，23px / weight 300
- 设置：线性齿轮 `SettingsMenuIcon`
- 链条：音乐链接 `LinkChainIcon`
- 生成指令：右箭头 `ArrowRightIcon`

---

## 9. 无障碍

- 语言波轮：`role="listbox"` + `role="option"` + `aria-selected="true|false"`
- 设置抽屉：`role="dialog"` + `aria-modal`
- 禁用按钮：使用原生 `disabled`，不重复 `aria-disabled`
- 海报编辑：依赖双击，需提供替代入口（待完善）

---

## 10. 设计系统审查与优化建议

### 10.1 架构问题

| 问题 | 严重度 | 建议 |
|------|--------|------|
| **`ui-tokens.css` 未接入** | 高 | 文件内 `--ui-font-sans` 为宋体，与 `theme.css` 的 Sansation 冲突。应**删除**或合并进 `theme.css`，避免误引用 |
| **双轨令牌 `--color-*` vs `--ui-*`** | 中 | 迁移未完成。新代码只用 `--color-*`；`App.css` 逐步替换 `--ui-fg` 等为语义名 |
| **`App.css` 约 2700 行单体** | 中 | 按模块拆分：`buttons.css` / `home.css` / `export.css` / `drawer.css` |
| **海报 CSS 与 App 主题割裂** | 低（有意） | 在文档中明确「印刷模式不换肤」；可选：导出预览外框随主题，画布内不变 |

### 10.2 色彩一致性

| 问题 | 位置 | 建议 |
|------|------|------|
| `.app-brand { color: #2B3A4A }` 硬编码 | App.css | 改为 `var(--color-accent)`，三主题自动适配 |
| `.btn-tonal` 色值写死 `#4a627a` | theme.css L336 | 迁入 `[data-theme]` 块，赤主题下图标/次按钮偏暖灰 |
| `offline-banner` 硬编码琥珀/绿 | index.css | 新增 `--color-banner-warn` / `--color-banner-ok` |
| 海报 `vocabEmphasisColor #1e3a5f` | furiganaPosterShared | 可接受（印刷统一）；若要做「赤墨」打印主题再抽令牌 |
| **App.css 约 56 处硬编码 hex/rgba** | 全局 | 建立 lint 规则或注释 `/* token-exception */` 白名单 |

### 10.3 字体一致性

| 层级 | 现状 | 建议 |
|------|------|------|
| App UI | Sansation + PingFang | 保持；补充 `--font-zh` 显式令牌 |
| 海报 | 独立 OTF/TTF | `fonts.ts` 已是单一源；设计规范与 PRD 交叉引用 |
| 品牌名 | Sansation Light 300 | 与 `--text-home-title` 对齐，考虑用 `var(--text-home-title)` |

### 10.4 组件缺口

| 缺口 | 建议 |
|------|------|
| 无统一 `Focus` 样式 | 按钮/波轮补充 `:focus-visible { outline: 2px solid var(--color-focus-ring) }` |
| 无 `Toast` 令牌 | `pasteLayoutHint`、保存提示用 `--panel-*` + 统一 `.app-toast` |
| 错误页 `ErrorBoundary` 内联样式 | 迁入 `App.css` + 用语义色 |
| 截图横幅 `ScreenshotBanner` 未挂主流程 | 删除或接入并统一 banner 令牌 |

### 10.5 响应式与平台

| 项 | 建议 |
|----|------|
| `max-width: 720px` 主栏 | 保持；iPad 可考虑双栏（歌词本 + 预览） |
| 安全区 | 已用；检查 export 工具栏底部 `safe-bottom` |
| 深色模式 | 非 MVP；若做则仅 App 壳，海报仍白底 |

### 10.6 推荐实施优先级

```
P0  删除/归档 ui-tokens.css；.app-brand 改用 var(--color-accent)
P1  btn-tonal 主题化；offline-banner 令牌化
P2  App.css 拆分；硬编码色扫描清单
P3  focus-visible；Toast 组件；海报与 UI 令牌文档自动化（Style Dictionary 可选）
```

---

## 11. 文件索引

| 文件 | 职责 |
|------|------|
| `src/styles/theme.css` | 设计令牌唯一真相源 |
| `src/index.css` | 全局重置、安全区、**滚动条隐藏策略** |
| `src/App.css` | 组件样式（待模块化） |
| `src/components/LanguageWheel.css` | 波轮局部样式 |
| `src/services/languageMatrix/` | 语言矩阵类型、拨轮推导、Prompt gloss |
| `docs/LANGUAGE_MATRIX.md` | 语言矩阵产品与实现规格 |
| `src/utils/posterTypography/` | Metadata-Driven 海报 Typography API（tokenRegistry → fontResolver → cssCompiler） |
| `src/utils/shufuriPoster/fonts.ts` | 海报字体常量 |
| `src/utils/shufuriPoster/shufuriPosterShared.ts` | 海报排版薄包装（调用 Typography API） |
| `src/utils/applyColorTheme.ts` | 主题切换逻辑 |

---

## 12. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-06-03 | 初版：基于当前代码库整理；含设计系统审查 |
| v1.1 | 2026-06-03 | 新增 §5.4 全局隐藏滚动条规范；`index.css` 统一实现 |
| v1.2 | 2026-06-03 | 新增 §7.3.1 语言矩阵设置 UI；§7.4 拨轮与矩阵联动；索引 `LANGUAGE_MATRIX.md` |
