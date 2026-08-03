# 工程交接手册 — SHUFURI

> 全栈工程师快速上手文档。本文档覆盖 **5 分钟入口 → 30 分钟架构 → 雷区清单 → 最近变更** 四个层次，读完即可安全改码。

---

## 一、5 分钟上手（入口层）

### 启动验证（先跑通，再读码）

```bash
git clone git@github.com:MarukoWorkShop/SHUFURI.git
cd SHUFURI
npm install
npm run dev          # → http://localhost:5173
npm run test         # vitest，应 38/38 通过
npm run build        # 验证生产构建（tsc 门禁 + vite build）
```

**技术栈**：Vite + React（Web）+ iOS WebView 壳（Capacitor 桥接）  
**语言**：TypeScript 为主  
**说明文档**：
- [`README.md`](./README.md) — 产品定位、语种支持、部署命令、隐私政策
- [`AGENTS.md`](./AGENTS.md) — 海报分页排版系统完整架构 + 11 条锁定清单（必读）
- 本文档 — 快速对接地图 + 雷区汇总

---

## 二、架构地图（30 分钟）

| 目录 | 说明 | 修改频率 |
|---|---|---|
| `src/components/screens/` | 页面级组件（EditScreen 等主页面） | 高 |
| `src/components/` | 通用 UI 组件（海报预览、工具箱等） | 高 |
| `src/utils/shufuriPoster/` | **海报分页核心算法**（贪心装箱 → 校验修复 → 导出） | 极低（雷区） |
| `src/utils/posterTypography/` | 排版字号计算（`resolvePosterTypography` → `compilePosterCss`） | 低 |
| `src/utils/posterExportMount.ts` | PDF/PNG 导出挂载（DOM 结构必须与测量容器一致） | 极低（雷区） |
| `src/utils/clipboard.ts` | 剪贴板读取 + 权限事件派发 | 低 |
| `src/services/` | 云函数代理、AI 讲解流、剪贴板检测等服务层 | 中 |
| `src/hooks/` | 业务 hooks（剪贴板检测、桌面分享检测、歌词卡等） | 中 |
| `src/codec/` | 歌词编解码（24 个 ts 文件） | 低 |
| `src/i18n/` | 多语言国际化 | 中 |
| `src/lexicon/` | 本地词典（JMdict lite / Kuromoji / KRDICT） | 低 |
| `cloudfunctions/` | 云函数 `arkProxy` / `arkExplainStream` | 低 |

---

## 三、设计文档（docs/ 目录，按需查阅）

| 文档 | 主题 |
|---|---|
| `AI_MODE_VOLCENGINE_DESIGN.md` | 划词 AI 讲解架构：本地 JMdict + Kuromoji → CloudBase → 火山引擎 |
| `COLOR_AUDIT.md` | 色彩审计规范（新组件遵循的统一视觉规范） |
| `DESIGN_SYSTEM.md` | 设计系统 |
| `PRD.md` | 产品需求文档 |

---

## 四、雷区清单（改错会导致白屏 / 零字节导出 / 分页溢出）

| # | 文件 | 约束 | 违反后果 |
|---|---|---|---|
| 1 | `src/utils/shufuriPoster/dimensions.ts` | canvasW/canvasH / padH / SAFETY_MARGIN_PX 等常量改动会影响全局测量 | 分页溢出或内容截断 |
| 2 | `src/utils/shufuriPoster/paginateShufuriPosterHtml.ts` | `.lyrics-group` 不可拆分；贪婪装箱 + 两阶段校验的循环上限不能改小 | jp/zh 分离、死循环 |
| 3 | `src/utils/posterExportMount.ts` | **绝对禁止** clip-path / opacity:0 / visibility:hidden / z-index:-1；shell 必须 `position: relative` 并复用 `buildFuriganaPosterRootStyle` | PDF 零字节、PNG 全空白 |
| 4 | `src/utils/clipboard.ts` | `readClipboardText` 已不自动派发 blocked 事件，调用方需自行在用户手势 catch 中决策 | 误弹权限提示 |
| 5 | 测量容器 `createPosterMeasurer` | wrapper 必须 `position:relative` + 固定 canvas 宽高；shell 必须 `Object.assign` 复用根样式 | 测量与预览不一致 |
| 6 | `.fv-body-h` CSS | 必须 `flex: 1 1 auto; min-height: 0; overflow: hidden` | flex 收缩失效 |
| 7 | 字体 `@font-face` | 修改字体需同步更新测量容器 + 导出挂载中的注入 | 字体尺寸差异 → 溢出误判 / 错位 |

> 修改以上任何文件前，**必须先读 [`AGENTS.md`](./AGENTS.md) 第七节 11 条锁定清单**。

---

## 五、生产环境

| 资源 | 地址 / ID |
|---|---|
| 静态托管 | `https://shufu-life-d8g9j8v5385543c1a-1435171508.tcloudbaseapp.com/?v=20260731-1` |
| 环境 ID | `shufu-life-d8g9j8v5385543c1a` |
| 云函数 arkProxy | 划词讲解 / 歌词生成（`lyrics.step2`），已接入 `ai_usage` 用量埋点 |
| 云函数 arkExplainStream | 流式讲解，已接入 `ai_usage` 用量日志 |

**部署命令**：
```bash
npm run deploy:ark-proxy              # arkProxy
npm run deploy:ark-explain-stream     # arkExplainStream
npm run build && npx tcb hosting deploy dist -e shufu-life-d8g9j8v5385543c1a
```

---

## 六、最近主要变更（最近 25 个提交）

| 类别 | 变更内容 |
|---|---|
| 剪贴板修复 | 权限已授权时仍误弹「无法读取」提示 — 被动检测无 user activation 导致 NotAllowedError 误报 |
| UI 与视觉 | 全局色彩审计、新增组件、LOGO 呼吸空间、多语言拨轮改本语言显示、中文拼音样式调整 |
| 编辑能力 | InkFineTune 支持整行日文编辑/取消注音、高亮笔刷涂抹替换划词 |
| AI 讲解 | 多句选区适配、语种感知翻译、i18n 跟随界面语言、歌词语法缓存（6 维结构哈希） |
| 安全与运维 | P0 安全加固（硬配额、用量记录、费用日报）、CSP 头、全局 unhandledrejection 上报 |
| 海报分页 | 多项溢出修复、划词笔记条目化、导出挂载防白屏、多语言歌词注音 ruby 统一 |
| 代码清理 | 删除 22 个重复/死文件、修复 TS 编译错误 |
