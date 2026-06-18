# Japanese Kana App

Vite + React web app. Run `npm run dev` to start the dev server.

---

## 日语歌词海报分页排版系统

### 一、整体流程

```
原始 HTML 正文
  → normalizeBodyRoot（配平 jp/zh 歌词对、合并相邻区域）
  → flattenAtoms（拆解为不可约原子列表）
  → repairLyricsGroupAtoms（修复不完整的歌词组）
  → preparePaginationAtoms（vocab/grammar 区段拆为可独立装箱的子单元）
  → flowAtomsIntoPages（贪心装箱，生成初步分页）
  → verifyAndRepairPages（逐页 HTML 级别校验并修复溢出，两阶段）
  → joinPageBlocks（输出 HTML 字符串数组）
```

**入口函数**: `paginateShufuriPosterBodyHtml`（`src/utils/shufuriPoster/paginateShufuriPosterHtml.ts`；兼容别名 `paginateFuriganaBodyHtml`）

**预览组件**: `ShufuriPosterPreview`（`src/components/ShufuriPosterPreview.tsx`）

**Typography API**: `src/utils/posterTypography/` — `resolvePosterTypography` → `compilePosterCss`

---

### 二、核心尺寸常量（`src/utils/shufuriPoster/dimensions.ts`）

| 参数 | B5 打印 (600×852) | 手机竖屏 (1080×1920) |
|---|---|---|
| canvasWidth / height | 600 / 852 | 1080 / 1920 |
| padH（左右内边距） | 45 | 160 |
| pagePadTopCont（上内边距） | 40 | 96 |
| pageBottomDefault（下内边距） | 80 | 156 |
| elasticFontBase | 12 | 32 |
| titleFontSize | 17 | 56 |
| titleLineHeightRatio | 1.22 | 1.2 |
| titleToBodyGap | 14 | 40 |

---

### 三、CSS 生成（`buildShufuriPosterInnerCss` + `buildShufuriPosterRootStyle`）

> **Typography 由 `posterTypography/` 统一算力；`shufuriPosterShared` 为薄包装。**

**根节点样式**（`buildFuriganaPosterRootStyle`）：
- `display: flex; flex-direction: column; box-sizing: border-box`
- `padding: top right bottom left`（用 insets）
- `overflow: hidden`

**正文区样式**（`.fv-body-h`）：
- `flex: 1 1 auto; min-height: 0`（占据剩余空间，允许收缩）
- `box-sizing: border-box; overflow: hidden`
- `padding-bottom: 64px`（mobile）/ `32px`（print）

**关键语义 class**：
- `.lyrics-group` — 日语/中文歌词对（jp-line + zh-line）
- `.lyrics-vocabulary` / `.lyrics-grammar` — 词汇区/语法区容器
- `.lyrics-vocab-item` / `.lyrics-grammar-item` — 单个词汇/语法条目
- `.lyrics-pagination-unit` — 分页单元（内部包装，由分页算法产生）
- `h2.lyrics-section-title` — 区段标题（"重点词汇"/"重点语法"）
- `.grammar-point-title` — 语法点标题（h3）
- `.grammar-detail` — 语法详细解析（p）
- `.grammar-ex-ja` / `.grammar-ex-zh` — 语法例句日/中（p）

---

### 四、测量容器（`createPosterMeasurer`）— 关键设计

> **这是最核心的部分，修改时务必保持与预览 DOM 完全一致。**

```
wrapper (position:relative, width=canvasW, height=canvasH, 离屏)
  └── shell (fv-html-poster-root, 复用 buildFuriganaPosterRootStyle 所有样式)
        ├── <style> (buildFuriganaPosterInnerCss)
        ├── h1.fv-title-h
        └── div.fv-body-h
```

**三个关键约束（一条都不能少，否则溢出判定失效）**：

1. **Wrapper 提供固定尺寸 containing block**：`position: relative` + 固定宽高。不能用 `position: fixed`，否则内部 `max-width:100%` 按视口宽度计算，换行减少，高度被严重低估。

2. **Shell 必须复用 `buildFuriganaPosterRootStyle` 的所有样式**（`Object.assign`）：包括 `display: flex; flex-direction: column; padding; overflow: hidden`。缺少 flex 会导致测量布局和预览不一致。

3. **Body 通过 `style.maxHeight` 约束高度**，然后比较 `scrollHeight > clientHeight` 判断溢出：
   ```
   maxHeight = shellInnerH - titleH - titleMB - SAFETY_MARGIN_PX
   shellInnerH = canvasH - insets.top - insets.bottom
   ```
   - `bodyContentOverflows(body)`: `clientH >= 1 && scrollHeight > clientH + FIT_EPSILON_PX`

**常量**：
- `FIT_EPSILON_PX = 1`（scrollHeight 与 clientHeight 的容差）
- `SAFETY_MARGIN_PX = 16`（吸收字体渲染差异、子像素误差的保守余量）

---

### 五、分页算法

#### 5.1 预处理（`preparePaginationAtoms`）

将 `.lyrics-vocabulary` / `.lyrics-grammar` 区段拆为细粒度分页原子：

1. **`explodeSectionToItemUnits`**：按 `.lyrics-vocab-item` / `.lyrics-grammar-item` 拆为独立单元，首个 item 附带区段标题（h2.`lyrics-section-title`）。
2. **`splitPaginationUnit`**：将每个 item 逐子元素拆分（如语法点的 h3 → p.detail → p.ex-ja → p.ex-zh），使每个子元素可独立装箱。

**保留的不可拆单元**：
- `.lyrics-group`（日/中歌词对）不允许拆分，保证 jp-line 和 zh-line 永不分离。
- 空内容、`.lyrics-grammar-spacer` 等跳过。

#### 5.2 贪心装箱（`flowAtomsIntoPages`）

```
对每个原子 atom:
  1. 如果 atom 强制换页 (data-lyrics-force-next-page) → flush 当前页
  2. 如果 current + atom 能放下 → 推进 current
  3. 否则 flush 当前页
  4. 如果 atom 单独能放下 → 推进新页的 current
  5. 否则 splitPaginationUnit(atom) 拆分后重新入队
  6. 否则警告并强制单页（超大不可拆内容）
```

判定函数：`measurer.contentFits(nodes, showTitle)` → 内部 `fillBodyAndMeasure` + `bodyContentOverflows`

#### 5.3 校验修复（`verifyAndRepairPages`）

两阶段循环：

**第一阶段**（最多 32 轮或 pages.length × 8 轮）：逐页用 `joinPageBlocks` 拼接 HTML，通过 `pageHtmlOverflows` 检查溢出。溢出时从页尾 pop block 到 carry（下一页头部）。单 atom 溢出时尝试 `splitPaginationUnit` 拆分。

**第二阶段**（最终清理）：追加一层校验，溢出时从页尾拆块到 pending 数组。确保 carry 整页也不溢出。

---

### 六、预览渲染（`FuriganaPosterPreview`）

```
fv-poster-preview-frame (缩放容器)
  └── scaleWrapper (transform: scale)
       └── .fv-html-poster-root (buildFuriganaPosterRootStyle 样式)
             ├── <style> (buildFuriganaPosterInnerCss)
             ├── h1.fv-title-h (仅首页)
             ├── div.fv-body-h (dangerouslySetInnerHTML)
             └── div.fv-poster-page-no (页码，绝对定位)
```

**页码样式**：`position: absolute; right: pad.right; bottom: pad.bottom * 0.42 (mobile) / 0.28 (print)`

**Dev 调试**：`useLayoutEffect` 中用 `detectFuriganaPosterBodyOverflow` 检测溢出，溢出时添加红色 debug outline 并 console.warn。

---

### 六、导出挂载（`posterExportMount.ts`）— 与测量容器同等重要

PDF/PNG 导出使用的离屏 DOM 结构必须与测量容器、预览组件保持**样式完全一致**。

```
backdrop (position:fixed, fullscreen, white bg, z-index:2147483646)     ← 视觉遮罩
  └── wrapper (position:absolute, left:0, top:0, width=canvasW, height=canvasH)
        └── shell (fv-html-poster-root, position:relative, 复用 buildFuriganaPosterRootStyle 所有样式)
              ├── <style> (buildFuriganaPosterInnerCss)
              ├── h1.fv-title-h
              ├── div.fv-body-h
              └── div.fv-poster-page-no
```

**关键约束**：

1. **Shell 必须是 `position: relative`**，不能用 `position: fixed`。html2canvas 对 fixed 元素使用 viewport 绝对坐标，当元素被移到视口外时，内容完全落在 canvas 裁剪区域之外，导致栅格化空白。
2. **Shell 必须复用 `buildFuriganaPosterRootStyle` 的所有样式**，包括 `display: flex`、`width/height`、`padding`、`overflow: hidden`。
3. **Backdrop 提供全屏白色遮罩**：`position: fixed; width: 100vw; height: 100vh; background: #fff;`。导出期间用户看到白屏=加载态，同时为 html2canvas 提供干净的渲染上下文。
4. **禁止在 shell/wrapper 上使用 clip-path / opacity:0 / visibility:hidden / z-index:-1**——html2canvas 会直接裁切或忽略不可见内容，导致栅格化全空白（PDF 零字节、PNG 无反应）。
5. **导出的 `pageRoot` 返回 shell 而非 wrapper/backdrop**，因为 `rasterizePosterLayoutPageRoot` 和 `buildHtml2CanvasOpts` 以 shell 为 target，读取 `offsetWidth/offsetHeight` 作为 canvas 尺寸。
6. **dispose 移除 backdrop（含 wrapper + shell）**，确保不残留 DOM 节点。

---

### 七、⭐ 锁定清单（修改前必须理解这些约束）

| # | 约束 | 风险 |
|---|---|---|
| 1 | `createPosterMeasurer` 中 wrapper.width/height 必须 = canvasW/canvasH | 否则 `width:100%` / `max-width:100%` 计算错误 |
| 2 | `createPosterMeasurer` 中 shell 必须 `Object.assign(..., buildFuriganaPosterRootStyle(profile))` | 缺少 `display:flex` 等会导致测量和渲染不一致 |
| 3 | shell 不能是 `position: fixed`（测量容器 + 导出挂载均适用） | 否则内部 `max-width:100%` 按视口宽度算，高度低估；html2canvas 栅格化空白 |
| 4 | `body.style.maxHeight` 的计算公式不能改公式形式 | `shellInnerH - titleH - titleMB - SAFETY_MARGIN_PX` |
| 5 | `.fv-body-h` 必须 `flex: 1 1 auto; min-height: 0; overflow: hidden` | flex 收缩 + 溢出裁剪 |
| 6 | `.lyrics-group` 不能被拆分（`isCompleteLyricsGroup` 检查） | jp/zh 分离破坏歌词阅读 |
| 7 | `joinPageBlocks` 必须在全页范围内只保留一份区段标题 | 区段标题去重 |
| 8 | `SAFETY_MARGIN_PX` 和 `FIT_EPSILON_PX` 不要随意缩小 | 内容截断/溢出 |
| 9 | `getFuriganaCanvasInsets` 的 bottom 和 `getFuriganaBodyBottomPaddingPx` 要联动 | 正文底部空间 vs 页码空间 |
| 10 | 字体通过 `@font-face` 注入（`POSTER_JP_FONT_FACE_CSS`），修改字体必须同步更新测量容器与导出挂载 | 字体尺寸差异导致溢出误判 / 栅格化字体错位 |
| 11 | 导出挂载中禁止 clip-path / opacity:0 / visibility:hidden / z-index:-1；改用全屏白色 backdrop 遮罩 | html2canvas 栅格化空白 → PDF 零字节、PNG 导出无反应 |
