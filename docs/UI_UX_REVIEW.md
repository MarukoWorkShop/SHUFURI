# 全局 UI/UX 审查报告 — feature/global-ui-optimization

> 审查日期：2026-07-31 | 审查范围：全项目 227 个源文件，21 个 CSS 文件，51 个 TSX 组件

---

## 总览

| 类别 | 问题数 | 严重程度 |
|------|--------|----------|
| 无障碍 (a11y) | 5 个高优 | 🔴 高 |
| 国际化遗漏 | 6 个组件 | 🔴 高 |
| 代码重复 | 3 处重大重复 | 🟡 中 |
| 加载/空/错误状态 | 4 个缺失 | 🟡 中 |
| 视觉一致性 | 7 处不一致 | 🟡 中 |
| z-index 混乱 | 全项目 | 🟡 中 |
| CSS 规范 | 若干 | 🟢 低 |

---

## 一、无障碍 (Accessibility) — 🔴 高优

### 1.1 缺少 role / aria-modal

| 组件 | 文件 | 行号 | 问题 |
|------|------|------|------|
| `AiAppActionSheet` | `AiAppActionSheet.tsx` | 67 | 缺少 `role="dialog"` + `aria-modal="true"` |
| `BatchExportPanel` | `BatchExportPanel.tsx` | 80 | 缺少 `role="dialog"` + `aria-modal="true"` |

### 1.2 缺少 Escape 键关闭

| 组件 | 问题 |
|------|------|
| `AiAppActionSheet` | 未注册 Escape 关闭 |
| `BatchExportPanel` | 未注册 Escape 关闭 |

### 1.3 键盘导航不完整

| 组件 | 文件 | 行号 | 问题 |
|------|------|------|------|
| `LanguageWheel` | `LanguageWheel.tsx` | 190 | 有 `tabIndex={0}`，但**无 onKeyDown**，ArrowLeft/Right 无法切换语言 |

### 1.4 表单缺少关联 label

| 组件 | 文件 | 行号 | 问题 |
|------|------|------|------|
| `HtmlPasteInput` | `HtmlPasteInput.tsx` | 321 | textarea 仅用 `placeholder` 作标签，不符合 WCAG 标准 |

### 1.5 aria-label 硬编码中文

| 组件 | 文件 | 行号 | 问题 |
|------|------|------|------|
| `AppHeader` | `AppHeader.tsx` | 28 | `aria-label="设置"` 硬编码，未使用 `L()` |

---

## 二、国际化 (i18n) 遗漏 — 🔴 高优

以下组件存在**硬编码中文**，未使用 `L(zh, en)` 国际化函数：

| 组件 | 文件 | 硬编码文本示例 |
|------|------|----------------|
| `ClipboardDetectCard` | `ClipboardDetectCard.tsx:92,99` | `取消`、`一键渲染排版` |
| `StudyCardDetailOverlay` | `StudyCardDetailOverlay.tsx:17,86,92` | `词汇`/`语法`、`释义`/`详解`、`例句`/`出典` |
| `ImageCropper` | `ImageCropper.tsx:209-218` | 裁剪按钮文本 |
| `ErrorBoundary` | `ErrorBoundary.tsx:40-50` | 错误提示文案 |

> 注：`LyricConfirmSheet.tsx:58` 重新定义了 `const L = ...`，覆盖了全局导入，虽然不是硬编码但做法不够规范。

---

## 三、代码重复 — 🟡 中优

### 3.1 Drawer 动画逻辑 × 2

`SavedLyricsLibrary` 和 `StudyCardsLibrary` 有**完全相同的 drawer 动画逻辑**：

```
DRAWER_MS=400, UNLATCH_MS=100, DISMISS_DRAG_THRESHOLD_PX=72
打开/关闭动画时序、dismiss drag 手势处理
```

→ **建议**：抽取为 `useDrawer` 共享 hook

### 3.2 编辑器 Overlay × 3

`EditScreen` 中三个内联编辑器（笔记、词汇、语法）有 **~130 行几乎一模一样的代码**：

```
EditScreen.tsx:580-688  笔记编辑器
EditScreen.tsx:690-802  词汇编辑器
EditScreen.tsx:804-927  语法编辑器
```

→ **建议**：抽取为 `EditItemOverlay` 通用组件

### 3.3 z-index 管理体系缺失

```
当前 z-index 跨度：200（编辑器） → 10002（歌词候选弹窗）
```

| 组件 | z-index |
|------|---------|
| `.app-screen__header` | 250 |
| EditScreen inline dialog | 200 |
| `.screenshot-banner` | 400 |
| `.app-settings` | 400 |
| `.clipboard-detect-overlay` | 10000 |
| `.lyric-confirm-overlay` | 10000 |
| `.ai-action-sheet-overlay` | 10001 |
| `.lyric-candidates-overlay` | 10002 |

→ **建议**：定义 z-index 层级系统（如 `--z-header: 100 / --z-drawer: 300 / --z-modal: 400 / --z-topmost: 500`）

---

## 四、加载/空/错误状态 — 🟡 中优

### 4.1 缺失的加载状态

| 屏幕 | 问题 |
|------|------|
| **HomeScreen** | 无统一加载态，无全局 ErrorBoundary 包裹 |
| **EditScreen** | 当 `bodyHtml` 为空时不展示空状态占位符 |
| **所有列表/卡片** | 无骨架屏，加载时用一行文字，导致布局跳动 |

### 4.2 缺失的空状态

| 组件 | 问题 |
|------|------|
| **HomeScreen** | `home-libraries-grid` 区当两个库都为空时无引导文案 |
| **EditScreen** | 导出按钮仅 `disabled`，无"暂无内容"提示 |

### 4.3 缺失的错误状态

| 组件 | 问题 |
|------|------|
| **HomeScreen** | 整体无 ErrorBoundary |
| **SettingsPanel** | 备份导入/导出只用 toast，无内联错误信息 |

---

## 五、视觉一致性问题 — 🟡 中优

### 5.1 圆角 (border-radius) 不统一

| 元素 | 使用的值 | 应使用变量 |
|------|----------|------------|
| `.ext-pipeline__action-btn` | 16px | `--radius-lg` (14px) |
| `.app-settings__backup-btn` | 4px | `--radius-sm` (8px) |
| `.app-settings__lang-chip` | 4px | `--radius-sm` (8px) |
| EditScreen inline dialog | 14px (硬编码) | `--radius-lg` |
| `.ocr-sheet__btn` | 14px | `--radius-lg` |
| `.lyric-candidate-card__adopt` | 10px | `--radius-md` (10px ✅) |

### 5.2 字号不统一

| 元素 | font-size | 偏离变量 |
|------|-----------|----------|
| `.home-hero__headline` | 22px / 34px | 未使用变量 |
| `.home-hero__subtitle` | 13px / 15px | 未使用变量 |
| `.ext-pipeline__label` | 10px | 无对应变量 (最小 `--text-xs: 11px`) |
| `.app-settings__hint` | 10px | 同上 |
| `.clipboard-detect-card__label` | **8px** | 严重偏小，可读性差 |

### 5.3 内边距不统一

| 元素 | padding | 偏离模式 |
|------|---------|----------|
| `.ext-pipeline__action-btn` | `padding-inline: 12px` | 不一致 |
| `.app-settings__backup-btn` | `10px 14px` | 不一致 |
| `.app-settings__lang-chip` | `8px 14px` | 不一致 |
| `.app-settings__segment` | `8px 10px` | 不一致 |

### 5.4 暗色模式缺失

当前只有**墨色主题**（浅色）。`theme.css` 文件结构良好，变量系统已为暗色模式做好了架构准备，但实际只实现了单一主题。

---

## 六、交互流畅性 — 🟡 中优

### 6.1 按钮视觉权重动态切换

`HtmlPasteInput.tsx:396-398` 中粘贴/口令按钮根据 `pastePrimary` 在 `btn-filled`（主按钮）和 `btn-tonal is-dormant`（次按钮）之间切换。两个按钮的角色在**主次之间动态互换**，可能导致用户困惑。

→ **建议**：固定按钮角色，用其他方式引导用户当前推荐操作

### 6.2 SettingsPanel 动画时序硬编码

```tsx
// SettingsPanel.tsx:76
setTimeout(() => onClose(), 280);  // 280ms 匹配 CSS transition
```

JS 中的 280ms 与 CSS 的 `--duration-drawer: 0.4s` (400ms) 不匹配。

### 6.3 LanguageWheel 视觉参数硬编码

```tsx
// LanguageWheel.tsx
ITEM_W = 76              // 硬编码
scale = Math.max(0.78, ...)
opacity = Math.max(0.32, ...)
blur = dist * 2.8
```

### 6.4 clipboard-detect-card__label 字号 8px

在移动端阅读性极差，建议至少提升到 11px（`--text-xs`）。

---

## 七、响应式设计 — 🟢 低优

### 7.1 断点使用情况

| 断点 | 位置 | 用途 |
|------|------|------|
| `768px` | `home.css:1146` | 桌面端 home-body 布局 |
| `EDIT_DESKTOP_SPLIT_QUERY` | `EditScreen.tsx:69` | 编辑区左右分栏 |

整体响应式处理得当，移动端隐藏部分桌面专属元素（如 footer）。

### 7.2 安全区适配

`theme.css` 已有 `--safe-top/bottom/left/right` 变量，使用了 `env(safe-area-inset-*, 0px)`，适配良好。

---

## 八、改进优先级排序

### 🔴 P0 — 立即修复

1. **`AiAppActionSheet` + `BatchExportPanel` 无障碍**：补 `role="dialog"` + `aria-modal` + Escape 键
2. **硬编码中文国际化**：`ClipboardDetectCard`、`StudyCardDetailOverlay`、`ImageCropper`、`ErrorBoundary` 改用 `L()`

### 🟡 P1 — 本分支完成

3. **z-index 层级系统**：定义 5 级层级常量，全项目统一
4. **圆角/字号/间距统一**：将所有硬编码值迁移到 CSS 变量
5. **`clipboard-detect-card__label` 8px → 11px**：可读性修复
6. **SettingsPanel 动画时序**：280ms → 引用 CSS 变量

### 🟢 P2 — 后续分支

7. **抽取共享 hook/组件**：`useDrawer`、`EditItemOverlay`
8. **骨架屏**：为列表/卡片加载态添加骨架屏
9. **暗色模式**：在现有变量体系上加 dark 主题
10. **HomeScreen/EditScreen 空状态 + 错误边界**

---

## 九、已确认的良好实践 ✅

| 方面 | 说明 |
|------|------|
| 设计令牌体系 | `theme.css` 结构完整，从 `--color-*` / `--font-*` / `--space-*` / `--radius-*` 到组件令牌的层级清晰 |
| `--ui-*` 兼容别名 | 大量旧样式通过别名映射到新令牌，迁移兼容层设计完善 |
| `LanguageWheel` | `role="listbox"` + `role="option"` + `aria-selected`，无障碍基础正确 |
| `StudyCardDetailOverlay` | 完整的键盘导航（Escape/Arrow/Enter/Space） |
| `LyricConfirmSheet` | 加载 spinner + 错误重试 + 外部方案降级，状态处理最完整 |
| 安全区适配 | `--safe-*` 变量适配全面 |
| 品牌字体 | `Sansation Light` 用于 SHUFURI brand logo，一致性强 |
