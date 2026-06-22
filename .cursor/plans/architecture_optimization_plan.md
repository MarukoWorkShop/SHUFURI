# 架构优化 PLAN（10 项）

> 基于 PosterWorkspace 重构完成后的代码审查整理。  
> 建议按文末「推进顺序」分批实施，每批独立可验证（`npm run verify`）。

---

## 1. 收敛 / 拆分 `PosterWorkspaceContext`

### 目的
- 降低「改一处、整树重渲染」的概率；`EditScreen` / `ExportScreen` / 未来新面板不必订阅 40+ 字段。
- 让 context 边界与域（文档 / 排版 / Ink）对齐，新人更容易定位状态来源。

### 做法
**路径 A（低成本）：** 在 `PosterWorkspaceProvider` 内用 `useMemo` 稳定 `contextValue` 与 `ink` 对象；将 `handleSave` 等用 `useCallback` 包稳（若尚未稳定）。

**路径 B（结构性）：** 拆为子 context 或并列 Provider：
- `PosterDocumentContext`：`bodyHtml`、`title`、`artist`、`lang`、`lyrics`、`savedProjectId`
- `PosterTypographyContext`：`showRubyAnnotations`、`previewTypography`、`repaginating`、`rubyToggleSupported`
- `PosterInkContext`：现有 `ink` 会话字段

消费者按需 `usePosterDocument()` 等，避免 Export 面板因 Ink draft 变化而重渲染。

### 风险
- **路径 B** 拆分后 hook 调用顺序与 Provider 嵌套变复杂，易出现「子组件在 Provider 外」的运行时错误。
- 过度拆分会导致 props/context 来回跳转，反而难读；建议先 A 再按需 B。
- 拆 context 时需确认 Ink 确认仍只经 workspace setter 改文档（数据流铁律不变）。

---

## 2. 统一 State + Ref 与原生/导出入口

### 目的
- 消除 `bodyHtml` 与 `bodyHtmlRef` 双轨漏同步（如原生 `set_content` 未设 `lang`、`lyrics`）。
- 所有「进入编辑」路径行为一致：字体加载、Ink 重置、Typography 重置、词卡 bundle。

### 做法
1. 抽单一入口函数，例如 `enterWorkspaceFromPrepared(prepared: PreparedPasteForLayout, rawLyrics, opts?)`，内部调用现有 `enterEditWithLayout`。
2. 剪贴板卡片、`openProject`、`useNativeBridge` 的 `set_content` **全部**走该入口。
3. 原生路径：`prepareBridgedRawText` → `preparePasteForLayout` 解析 `lang` → 传入 `enterEditWithLayout`。
4. 文档化 ref 契约：export / native 只读 ref；UI 改文档只经 `setBodyHtml` 等 setter + `useEffect` 同步 ref。

### 风险
- 原生桥若仍旁路 workspace，会再次出现注音开关、词卡同步类 bug。
- `enterEditWithLayout` 变重（async 链变长），需注意重复调用与竞态（快速连续粘贴）。
- 合并入口时勿改变 `onAfterEnterEdit` 时机（Ink / typography 重置依赖它）。

---

## 3. 首页 `HomeSessionProvider`（减少 AppLayout prop 管道）

### 目的
- `AppLayout` 当前承载 15+ 剪贴板/OCR 相关 props，职责过重。
- `HomeScreen` props 过多，与 workspace 无关的首页逻辑难以单独测试。

### 做法
1. 新增 `HomeSessionProvider`（或 `ClipboardSessionProvider`），包裹 `AppShell` 内首页相关子树。
2. 迁入：`shareOcrData`、`useStructuredLyricsClipboardCard`、`useClipboardDetection` 暴露的状态与 handler。
3. `AppLayout` 仅保留：`mode`、网络、设置抽屉、Header chrome、`children`。
4. `ClipboardDetectCard` 改从 context 读数据，或通过 Provider 子组件渲染。

### 风险
- Provider 范围过大时，首页任意状态变化仍可能触发 `AppLayout` 重渲染；需把 Provider 尽量靠近 `HomeScreen` 或拆 selector。
- 与 `PosterWorkspaceProvider` 边界要清晰：粘贴排版仍调用 `handleLayoutFromHtml`（workspace），不在 Home context 里 duplicate workspace 状态。

---

## 4. 明确 `lyricsLanguage` vs `lang`（文档元数据单一真相）

### 目的
- 拨轮「学习目标」与记录流 H 行「内容语言」不再混用，避免 `resolvePosterPipelineLang` 误判（注音开关、紧凑行距、Prompt）。
- 保存/打开项目时元数据一致。

### 做法
1. 定义类型：`LearningTarget`（设置拨轮）与 `DocumentLang`（`jp|ko|en|zh`，来自 H 行或推断）。
2. 工作区状态：`documentLang`（声明语言）+ `activeLearningTarget`（只读设置，来自 props）。
3. `resolvePosterPipelineLang(declaredLang, bodyHtml, fallbackTarget)` 规则写入 `inferPosterLang.ts` 文档注释。
4. 保存项目时 `lang` 字段明确存 `DocumentLang`；无 H 行时保存推断结果。

### 风险
- 旧库项目 `lang` 缺失或错误需迁移或继续依赖 `resolvePosterRubyToggleSupported` 的 body+拨轮兜底。
- 英语学习目标 + 日语内容等边界场景要在 `testInferPosterLang` 中固化预期。

---

## 5. 扩大 `verify` 测试覆盖面

### 目的
- 核心链路（codec → 编译 → 分页 → 注音显隐）回归不被遗漏；CI 与本地 `npm run verify` 一致。

### 做法
1. 新增 `scripts/test-all.mjs` 串联现有 `scripts/test*.mjs`，或扩展 `package.json` 的 `test:codec`。
2. **最低集（建议进 verify）：**
   - `testStreamCodec.mjs`
   - `testPaginateCodecBody.mjs`
   - `testMatchLyricCitation.mjs`
   - `testInferPosterLang.mjs`
   - `testUserAkizakuraPaste.mjs`（或 `testAkizakuraPaste.mjs`）
   - `testShowRubyPagination.mjs`
3. 其余脚本标为 `test:extended`，PR 前本地可选跑。
4. 失败时输出 fixture 名与断言标签，便于定位。

### 风险
- 全量脚本变慢，`verify` 可能超过 30s；可分层 `verify:fast` / `verify:full`。
- 部分脚本依赖 `tsx` 与 fixture 路径，需在 CI 环境确认 Node 版本一致。

---

## 6. 遗留命名与死代码清理

### 目的
- 降低 `furigana` / `Furigana` 与 `shufuri` 双命名带来的搜索与改错成本。
- 删除无引用组件（如 `AudioLinesIcon`）减少干扰。

### 做法
1. **分阶段改名（非一次性）：** 对外 API 保留别名一版周期，例如 `paginateFuriganaBodyHtml` → 仅 re-export，`AGENTS.md` 以 `paginateShufuriPosterBodyHtml` 为准。
2. `grep furigana/Furigana` 分类：Anki/学习卡专用保留；海报管线逐步改为 shufuri/ruby。
3. 删除确认无引用的文件；`bridge/nativeBridge` vs `utils/nativeBridge` 在 `AGENTS.md` 增加「导入指引」表。
4. 运行 `tsc` + 全量 test 防止删错。

### 风险
- 大范围 rename 易与进行中分支冲突；宜小 PR、按目录推进。
- Anki 导出等对外字段名 `furigana` 不宜改，避免破坏用户工作流。

---

## 7. 打印字体懒加载（构建体积）

### 目的
- `printFontBase64.generated` 约 48MB 独立 chunk，拖慢首屏与 Capacitor 包体；仅 PDF/矢量导出需要完整字体。

### 做法
1. 将 `printFontBase64.generated.ts` 改为动态 `import()`，在 `exportPosterPdf` / `buildPrintDocumentHtml` 路径首次调用时加载。
2. 预览继续用 `@font-face` + `public/assets` OTF（现有 `ensurePosterFontsLoaded`）。
3. Vite `manualChunks` 将 print 字体单独 chunk，且不进入主 bundle 的静态依赖。
4. 可选：Capacitor 原生 PDF 走系统字体，Web 才载 base64。

### 风险
- 首次导出 PDF 延迟增加，需 UI「加载字体…」或沿用现有导出 loading。
- 动态 import 与 html2canvas / 离屏导出时序要测，避免字体未就绪导致栅格化 fallback 字体。
- **分页测量** 不得依赖 print base64 模块（测量用 screen 字体路径）。

---

## 8. 简化 `PosterWorkspaceProvider` 生命周期回调

### 目的
- 去掉 `afterWorkspaceEnterRef.current = () => …` 的间接赋值，提高可读性与可测试性。

### 做法
1. 将 `resetTypographyPreview`、`inkSession.resetInkSession` 合并为 `resetWorkspaceSession()`。
2. 在 `usePosterWorkspace` 的 `enterEditWithLayout` / `handleReset` **参数**中传入 `onAfterEnterEdit` / `onAfterReset`（Provider 组装时注入稳定 callback）。
3. 或：`usePosterWorkspace` 返回 `enterEditWithLayout` 前由 Provider `useEffect` 订阅 mode 变化——优先直接回调，避免 effect 竞态。

### 风险
- Hook 初始化顺序：若 `inkSession` 在 `usePosterWorkspace` 之后创建，不能把 ink reset 直接写进 workspace hook 内部，需回调或 ref。
- 改回调时机可能重复 reset Ink 历史，需手动测：粘贴 → 编辑 → 返回 → 再粘贴。

---

## 9. 学习卡列表刷新机制

### 目的
- 去掉 `studyCardsRefreshKey` 贯穿 `App → AppLayout → HomeScreen` 的强制 remount 刷新。
- 编辑/导出时隐藏挂载 `StudyCardsLibrary` 仅为刷新的 hack 可移除或简化。

### 做法
1. `studyCardsStore` 写入后 emit 轻量事件（`subscribeStudyCardsStore(onChange)`）或 React `useSyncExternalStore`。
2. `StudyCardsLibrary` 订阅 store，保存/同步成功后自动 `reload()`。
3. 首页为唯一可见实例；编辑/导出不再挂载隐藏组件（若订阅全局 store）。
4. `useStudyCardsSession` 仅保留 `bundleIdRef` 与 `syncStudyCardsFromRaw`。

### 风险
- IndexedDB 跨 tab 不同步（若未来需要）需 `storage` 事件或省略。
- 订阅泄漏：Provider 卸载时 unsubscribe。
- 与 `replaceStudyCardsForBundle` upsert 逻辑联动测试，避免列表不更新或重复请求。

---

## 10. 组件层小优化

### 目的
- 减少无意义的 props 透传层；修正误导性 UI（铅笔常亮）。

### 做法
1. **`ExportPreviewPanel`：** 仅在 export 使用时可 `usePosterWorkspaceContext()` 内部读取，删除 `ExportScreen` 20+ props 映射（保留 panel 作为 dumb 组件的 story/测试可选 props 接口）。
2. **`InkToolbox`：** 铅笔按钮去掉硬编码 `is-active`，或改为与 `inkEditTarget` 真实联动；「音」按钮已统一 `PosterRubyToggleButton`。
3. **可选：** `AppSettings` 用 context 供 `HtmlPasteInput`，减少 `HomeScreen` 传 `appSettings` 整包。

### 风险
- Panel 直接绑 context 后难以在 Storybook 中无 Provider 渲染；可保留 optional props override。
- Export 与 Edit 若共用 Panel 片段，context 耦合增加；当前仅 Export 使用则风险低。

---

## 建议推进顺序

| 阶段 | 项 | 预估工作量 | 验证重点 |
|------|-----|------------|----------|
| **P0** | 2 统一进入编辑入口 | 小 | 原生桥、剪贴板、库打开；lang/词卡 |
| **P0** | 1-A Context `useMemo` | 小 | 编辑页输入无明显卡顿 |
| **P1** | 5 扩展 verify | 小 | CI 全绿 |
| **P1** | 4 文档语言元数据 | 中 | testInferPosterLang + 注音/行距 |
| **P2** | 3 HomeSessionProvider | 中 | 首页剪贴板卡片、OCR 链 |
| **P2** | 9 学习卡 store 订阅 | 中 | 保存后首页张数更新 |
| **P3** | 1-B Context 拆分 | 中 | React DevTools 重渲染_profiler |
| **P3** | 8 Provider 生命周期 | 小 | 粘贴/重置 Ink 状态 |
| **P3** | 10 组件层 | 小 | 导出预览、文具盒 UI |
| **P4** | 6 命名清理 | 中 | 分批 PR |
| **P4** | 7 字体懒加载 | 中 | PDF/PNG 导出、分页不回归 |

---

## 不动的部分（刻意不纳入本 PLAN）

- `paginateShufuriPosterHtml` / `createPosterMeasurer` / `posterExportMount` 三者 DOM 一致性（见 `AGENTS.md` 锁定清单）。
- `codec/` + `masterHandbook` 多语言 class 映射模型。
- `useInkEditSession` 与 `usePosterTypography` 职责分离（仅通过回调/入口 2 衔接）。

---

## 完成定义（每项）

- [ ] `npm run verify` 通过  
- [ ] 手动：首页粘贴 → 编辑 → 导出 PDF → 保存 → 词卡张数更新  
- [ ] 无新增 `AGENTS.md` 锁定清单违规（分页/导出 DOM）
