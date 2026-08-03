# 全局配色审计报告

> 分支 `feature/color-audit` | 2026-08-02

---

## 一、当前颜色架构概览

项目颜色分两套独立体系：

| 体系 | 文件 | 作用域 |
|---|---|---|
| **设计令牌**（CSS 变量） | `src/styles/theme.css` | UI 壳层：首页、编辑页 chrome、抽屉、弹窗、按钮、输入框 |
| **海报排版**（JS 常量/硬编码） | `typographyConstants.ts` + `fontResolver.ts` + `cssCompiler.ts` | 海报正文渲染：歌词行、注音、章节标题、词汇/语法条目 |

两套体系**完全割裂**，没有交叉引用。

---

## 二、颜色资产清单

### 2.1 设计令牌层（theme.css `:root` 下 86 个 `--color-*` 变量）

| 色组 | 色值 | 变量名 |
|---|---|---|
| 背景 | `#f7f7f7` | `--color-bg` |
| 背景 | `#ffffff` | `--color-bg-elevated` |
| 背景 | `#efefef` | `--color-bg-muted` |
| 背景 | `#e8e8e8` | `--color-bg-muted-active` |
| 背景 | `#f4f4f4` | `--color-bg-subtle` |
| 背景 | `#f8fafc` | `--color-bg-segment` |
| 前景 | `#000000` | `--color-fg` |
| 前景 | `#666666` | `--color-fg-secondary` |
| 前景 | `#999999` | `--color-fg-muted` |
| 前景 | `#94a3b8` | `--color-fg-subtle` |
| 前景 | `#cbd5e1` | `--color-fg-faint` |
| 前景 | `#b0b8c4` | `--color-fg-disabled` |
| 描边 | `#e0e0e0` | `--color-border` |
| 描边 | `#f1f5f9` | `--color-border-subtle` |
| 描边 | `#f8fafc` | `--color-border-faint` |
| 描边 | `#000000` | `--color-border-strong` |
| 描边 | `#d0d0d0` | `--color-border-input` |
| 强调 | `#000000` / `#333333` / `#555555` | `--color-accent` 系列 |
| 编辑画布 | `#1a1a1a`, `#666666`, `#2a2a2a`, `#3d3d3d` | `--color-edit-*` |
| 状态横幅 | `#f59e0b`, `#10b981` | `--color-banner-*` |
| 遮罩 | `rgba(0,0,0,0.35)` 等 | `--color-scrim-*` |
| 叠加 | `rgba(15,23,42,0.18)` 等 | `--color-overlay-*` |

### 2.2 海报排版层（硬编码 JS 颜色）

| 色值 | 使用位置 | 语义 |
|---|---|---|
| `#0a0a0a` | `fontResolver.ts` (8x), `cssCompiler.ts` (12x) | 默认正文色（日/中/韩歌词行） |
| `#111827` | `fontResolver.ts`, `cssCompiler.ts` (2x) | 海报标题色 |
| `#64748b` | `typographyConstants.ts` (常量), `fontResolver.ts` (3x), `cssCompiler.ts` (5x) | ruby 注音 + gloss 辅文 + 拼音 |
| `#94a3b8` | `fontResolver.ts`, `posterExportMount.ts`, `ShufuriPosterPreview.tsx`, `generatePageSvg.ts` | 辅文 / 页码 |
| `#1e293b` | `fontResolver.ts`, `cssCompiler.ts` | 章节标题 |
| `#454f5f` | `typographyConstants.ts` | 中文拼音 |
| `#1e3a5f` | `typographyConstants.ts` | 词汇强调 |
| `#cbd5e1` | `cssCompiler.ts` | 标题占位 |
| `#e0e0e0` | `cssCompiler.ts` (mm 单位下分界线) | 分隔线 |
| `#ffffff` / `#fff` | 6 个文件 | 海报/打印页白色背景 |
| `#f0f0f0` | `generatePageSvg.ts` | SVG 多页 body 背景 |

### 2.3 UI 组件内联硬编码

| 色值 | 位置 | 出现次数 |
|---|---|---|
| `rgba(15, 23, 42, 0.35)` | `EditScreen.tsx` 弹窗遮罩 | 3x |
| `rgba(15, 23, 42, 0.18)` | `EditScreen.tsx` 面板阴影 | 3x |
| `rgba(148, 163, 184, 0.35)` | `EditScreen.tsx` 面板边框 | 3x |
| `rgba(148, 163, 184, 0.5)` | `EditScreen.tsx` 输入框边框 | 13x |

---

## 三、问题清单

### 🔴 严重

#### 3.1 两套颜色体系完全割裂

theme.css 定义了大量语义色，但海报渲染层（`fontResolver.ts`、`cssCompiler.ts`）**完全不引用这些令牌**。这意味着：

- 海报颜色无法通过主题变量统一调整
- 若未来需要深色模式或换肤，海报层需要单独修改 20+ 处硬编码值
- 同一颜色（如 `#64748b`）在 JS 常量、UI token、硬编码三处各有一套

#### 3.2 颜色重复定义与不一致

| 问题 | 详情 |
|---|---|
| `#94A3B8` 重复定义 | `posterExportMount.ts` 和 `ShufuriPosterPreview.tsx` 各自定义了 `PAGE_NUMBER_TEXT_COLOR` 常量，且大小写不一致（`#94A3B8` vs `#94a3b8`） |
| `#64748b` 三处定义 | `typographyConstants.ts` 有 `GLOSS_COLOR` 和 `JP_RUBY_COLOR` 两个同名常量；`fontResolver.ts` 和 `cssCompiler.ts` 仍有硬编码引用 |
| `#0a0a0a` 20+ 次硬编码 | 日/中/韩歌词正文色，散落在 `fontResolver.ts` 和 `cssCompiler.ts` 中，每次出现都是独立字符串 |
| `#fff` vs `#ffffff` 混用 | 3 位和 6 位写法并存，分布在 6 个文件 |
| 颜色写法不一致 | 大写 `#94A3B8` / 小写 `#94a3b8` / 小写 `#64748b` 混用 |

#### 3.3 设计师难以理解的颜色映射

| 问题 | 详情 |
|---|---|
| `--color-accent: #000` | 纯黑作为强调色 = 几乎不可见。hover 为 `#333`，基础色 `#000` 在 `#f7f7f7` 背景上对比度最高，但在 `#ffffff` 上无区分度 |
| `--color-fg-subtle: #94a3b8` | slate-400 被用作 UI 辅助文字，在白色背景上对比度仅 ~3.02:1（低于 WCAG AA 4.5:1） |
| `--color-overlay` | 使用 `rgba(15, 23, 42, ...)` (slate-900 色相) 定义，但 UI 壳使用墨色系（灰度），色彩基调不一致 |
| 编辑画布色不在色阶中 | `#1a1a1a`, `#2a2a2a`, `#3d3d3d` 与前景色阶 `#000,#666,#999` 没有明确的逻辑关系 |

### 🟡 中等

#### 3.4 海报颜色缺设计令牌

海报排版层需要自己的 CSS 变量，但目前完全硬编码。影响范围：

- `fontResolver.ts` — 15 处硬编码颜色
- `cssCompiler.ts` — 30+ 处硬编码颜色
- `shufuriPosterShared.ts` — 2 处（1 处已用 `var(--color-edit-canvas-bg)`✅，1 处仍硬编码）
- `posterExportMount.ts` — 2 处硬编码

#### 3.5 近义色碎片化

| 用途 | 值 1 | 值 2 | 值 3 | 差异 |
|---|---|---|---|---|
| 浅灰背景 | `#f7f7f7` (--color-bg) | `#f4f4f4` (--color-bg-subtle) | `#f0f0f0` (generatePageSvg) | L 差 0-2% |
| 编辑深灰 | `#1a1a1a` | `#2a2a2a` | `#3d3d3d` | L 差 3-6% |

是否有必要用 3 个几乎相同的浅灰？建议统一为 2 级。

#### 3.6 透明度滥用

`EditScreen.tsx` 三个弹窗大量使用 `rgba(148, 163, 184, x)` (slate-400 半透明)，但这些值在 theme.css 中没有对应变量。且 slate-400 `#94a3b8` 本身已经是低对比度色，再叠加透明度后几乎不可见。

### 🟢 轻微

#### 3.7 theme.css 结构微小问题

- `--color-border-subtle: #f1f5f9` 和 `--color-border-faint: #f8fafc` 在 `#f7f7f7` 背景上不可见（等同于透明）
- `--color-scrim-strong` 和 `--color-scrim-medium` 差异仅 0.05 透明度（0.4 vs 0.35），实际感知无区分

---

## 四、对比度审计（WCAG AA）

| 前景 | 背景 | 对比度 | 评级 | 建议 |
|---|---|---|---|---|
| `#0a0a0a` | `#fff` | 17.97:1 | ✅ AAA | 优秀 |
| `#111827` | `#fff` | 16.75:1 | ✅ AAA | 优秀 |
| `#64748b` | `#fff` | 4.65:1 | ⚠️ AA 边缘 | 建议降到 `#5a6d80` 安全性更高 |
| `#94a3b8` | `#fff` | 3.02:1 | ❌ 不通过 | 需提升到 `#758599` 以上 |
| `#666666` | `#f7f7f7` | 5.24:1 | ✅ AA | 可接受 |
| `#999999` | `#f7f7f7` | 3.03:1 | ❌ 不通过 | 禁用/placeholder 可豁免 |
| `#454f5f` | `#fff` | 7.25:1 | ✅ AAA | 优秀 |
| `#1e3a5f` | `#fff` | 10.89:1 | ✅ AAA | 优秀 |

---

## 五、优化方案

### 阶段 1：统一与去重（低风险，立即可做）

#### 1.1 消除重复常量

```
PAGE_NUMBER_TEXT_COLOR 合并到 typographyConstants.ts 一处定义
posterExportMount.ts / ShufuriPosterPreview.tsx → import { PAGE_NUMBER_TEXT_COLOR }
```

#### 1.2 统一颜色写法

- 全项目统一使用**小写** 6 位 hex（`#ffffff` 而非 `#fff`、`#94a3b8` 而非 `#94A3B8`）
- 在 ESLint 添加规则或至少统一规范

#### 1.3 海报正文色常量化

将 `fontResolver.ts` / `cssCompiler.ts` 中的 `#0a0a0a` 提取为 `BODY_TEXT_COLOR` 常量（放入 `typographyConstants.ts`），两文件改为引用该常量。

```ts
// typographyConstants.ts 新增
export const BODY_TEXT_COLOR = '#0a0a0a';
export const TITLE_TEXT_COLOR = '#111827';
export const SECTION_TITLE_COLOR = '#1e293b';
export const PLACEHOLDER_COLOR = '#cbd5e1';
export const SEPARATOR_COLOR = '#e0e0e0';
export const POSTER_BG_COLOR = '#ffffff';
```

#### 1.4 `EditScreen.tsx` 弹窗样式提取

三个弹窗的遮罩/面板/输入框样式提取为共享对象，消除 22 处 `rgba(...)` 重复。

### 阶段 2：海报 CSS 变量化（中等风险，需测分页）

在 `buildShufuriPosterInnerCss` 注入的 `<style>` 顶部插入 CSS 变量：

```css
.fv-html-poster-root {
  --pv-body: #0a0a0a;
  --pv-title: #111827;
  --pv-section: #1e293b;
  --pv-ruby: #64748b;
  --pv-gloss: #64748b;
  --pv-zh-ruby: #454f5f;
  --pv-vocab-em: #1e3a5f;
  --pv-placeholder: #cbd5e1;
  --pv-separator: #e0e0e0;
  --pv-page-no: #94a3b8;
  --pv-bg: #ffffff;
}
```

然后把 `cssCompiler.ts` 中所有硬编码 `#0a0a0a` 等替换为 `var(--pv-body)`。

**收益**：若未来需要换肤/深色模式，只需改一处 CSS 变量定义，不用遍历 JS 代码。

### 阶段 3：对比度修复（低风险）

| 修改 | 原值 | 目标值 | 影响范围 |
|---|---|---|---|
| `--color-fg-subtle` | `#94a3b8` | `#718096` | 所有 UI 辅助文字（页脚、说明、标签） |
| `--color-fg-muted` | `#999999` | `#7a7a7a` | placeholder、禁用态（但通常豁免） |

### 阶段 4：未来扩展点（暂不做）

- 深色模式：当前架构已具备基础，需新增 `[data-theme="dark"]` 选择器覆盖语义色
- 海报主题切换（樱花/墨色/靛蓝）：海报 CSS 变量化（阶段 2）是前置条件
- 设计 tokens 导出为 Figma 同步 JSON

---

## 六、实施建议

| 优先级 | 任务 | 影响文件数 | 预估工时 |
|---|---|---|---|
| P0 | 消除重复常量 + 统一写法 | 5 | 30min |
| P0 | 海报正文色常量化 | 4 | 45min |
| P1 | `EditScreen.tsx` 弹窗样式提取 | 1 | 20min |
| P1 | 海报 CSS 变量化 | 2 | 1.5h |
| P2 | 对比度修复 | 1 | 15min |
| P2 | 彩色一致性脚本（CI lint） | 1 | 1h |

---

## 七、彩色统计一览

```
项目颜色总量:  ~45 个唯一色值
CSS 变量覆盖:  ~36 个 (80%)
硬编码遗漏:    ~15 个 (在 JS/TS 文件中)
重复定义:      3 组
对比度不合规:  2 处
```

