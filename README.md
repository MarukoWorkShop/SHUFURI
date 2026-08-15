# SHUFURI — 多语歌词释音与排版助手

一款专为语言学习者和排版爱好者设计的本地优先字音排版工具。支持 **日语 · 韩语 · 英语 · 中文** 歌词的发音标注、双语翻译对比、分页海报排版与高清导出。

## 支持语种

| 语种 | 发音标注 | 排版字体 | 海报样式 |
|------|----------|----------|----------|
| 日本語 | 振假名 `{漢字:よみ}` | Kozuka Mincho EL | 传统竖/横排 |
| 한국어 | 谚文原样排版 | HCR Batang | 清爽横排 |
| English | 纯英文原版 | Sansation Light | 现代横排 |
| 中文 | 拼音 `{汉字:pīnyīn}` | PingFang SC | 标准横排 |

## 开发者文档

- [`AGENTS.md`](./AGENTS.md) — 海报分页排版系统完整架构 + 11 条锁定约束（必读）
- [`HANDOFF.md`](./HANDOFF.md) — 新成员快速对接：入口、架构地图、雷区清单、最近变更

---

## 核心功能

- **歌词排版**：输入歌名/歌手 → 一键生成外部 AI 口令 → 粘贴返回结果 → 自动分页排版
- **词汇与语法解析**：自动提取重点词汇和语法点，附带释义和例句
- **学习词卡**：从歌词中提取词汇/语法卡，支持去重导出 Anki TSV
- **墨微调**：双击编辑假名注音、中文翻译、标题等
- **多格式导出**：PDF / PNG / 矢量打印，支持 B5 和手机竖屏两种规格
- **本地优先**：IndexedDB 本地存储歌词本和学习卡，无需云端同步

## 技术栈

Vite + React（Web）/ iOS WebView 壳（Capacitor 桥接）

## 部署

### CloudBase（生产环境）

> **当前生产环境：`ai-native-d5gtc59uc47601f23`**（上海 ap-shanghai）。旧环境 `shufu-life-d8g9j8v5385543c1a` 已弃用。

| 资源 | 说明 |
|------|------|
| 静态托管 | `https://ai-native-d5gtc59uc47601f23-1412422924.tcloudbaseapp.com/` |
| 云函数 arkProxy | **无状态网关**：`explain.selection` / `lyrics.step2` → 代持 Key 调火山 → 结果只回传当前用户。**不**读写词解内容库（已退役 `lyrics_grammar_cache`）。可记 `ai_usage` 用量元数据（无正文）。需环境变量 `ARK_API_KEY` |
| 云函数 arkExplainStream | 流式讲解（主路径，已开启 `stream_options.include_usage` 并记录 `ai_usage` 用量日志）；兼容 arkProxy 的 HTTP 访问形态 |
| 云函数 aiFeedback | 事件埋点 + 错误上报 + 用户反馈（`ai_feedback` NoSQL 集合），经 JS-SDK `callFunction` 调用 |
| 云函数 costReport | Token 成本统计报表 |
| 环境 ID | `ai-native-d5gtc59uc47601f23`（上海 ap-shanghai） |

**最近部署**：2026-08-14（前端重新部署到静态托管，53 文件。本次包含首页 UI 重构：`MorphingWidget` 形变微件、链接分享胶囊组件、`HtmlPasteInput` 折叠态、`home.css` 样式更新；音乐链接白名单过滤；X 按钮仅在"已复制"态浮现）

**部署命令**：

```bash
# 构建（已排除测试文件）
npm run build

# 部署云函数（4 个，force 覆盖更新）
npx tcb fn deploy arkProxy -e ai-native-d5gtc59uc47601f23 --force
npx tcb fn deploy arkExplainStream -e ai-native-d5gtc59uc47601f23 --force
npx tcb fn deploy aiFeedback -e ai-native-d5gtc59uc47601f23 --force
npx tcb fn deploy costReport -e ai-native-d5gtc59uc47601f23 --force

# 部署前端到静态托管
npx tcb hosting deploy dist -e ai-native-d5gtc59uc47601f23
```

**合规运维**：部署无缓存版 `arkProxy` 后，在 CloudBase 控制台**删除文档型数据库集合** `lyrics_grammar_cache`（历史跨用户词解内容残留）。

**说明**：
- `aiFeedback` / `arkProxy` 经 JS-SDK `callFunction` 调用，无需额外 HTTP 服务。
- 前端初始化需开启 CloudBase **匿名登录**（控制台 → 登录授权 → 匿名登录），否则报 `signInAnonymously() 所需的登录方式尚未启用`。
- `ARK_API_KEY` 在 arkProxy 函数配置页的环境变量中手动填写（不写入代码仓库）。
- CDN 刷新：访问前端 URL 时追加随机 query（如 `?v=20260808`）以避免缓存。

**前端访问地址（含 CDN 刷新参数）**：
`https://ai-native-d5gtc59uc47601f23-1412422924.tcloudbaseapp.com/?v=20260811b`

### 本地开发

```bash
npm install
npm run dev      # 开发服务器 → localhost:5173
```

SHUFURI Privacy Policy

Last Updated: July 19, 2026

Welcome to SHUFURI (the "App"), a local-first typography and linguistic tech-stationery application designed for independent language learners and typography enthusiasts.

Our philosophy is rooted in "Use-and-Go" utility and absolute privacy. Therefore, our data privacy policy is simple: We do not collect, store, or share any of your personal data.

1. Zero Data Collection
Linguistic Streams & Layouts: All text parsing, phonetic ruby annotations (such as {base:reading} micro-syntax), and typographic page calculations happen 100% locally on your device. We do not have servers, and we never upload your texts, lyrics, or generated study cards.

Clipboard Data: The App may access your clipboard only when you explicitly trigger the paste function on the input screen to decode your stream. This data is processed transiently in the device memory and is never saved or transmitted.

Device Information: We do not track your device ID, IP address, or location.

2. Third-Party Services
No Analytics: The App does not integrate any third-party analytics SDKs, tracking pixels, or advertising platforms.

External AI Clipboard (User-Driven): When you manually copy external encrypted data streams into the App, that transaction is handled entirely by you. The App remains a pure offline rendering container for the main lyrics layout pipeline.

Optional Selection Explain (User-Triggered): If you enable selection explain and tap “AI讲解”, the selected phrase and minimal sentence context are sent to a Tencent CloudBase cloud function that proxies Volcengine Ark. No ARK API key is embedded in the client for production builds. Local dictionary lookup (JMdict / Kuromoji) stays on-device. You can skip AI explain and use local results only.

3. Children's Privacy
Since we collect absolutely zero personal data, the App is inherently compliant with the Children's Online Privacy Protection Act (COPPA) and GDPR.

4. Contact Us
If you have any questions about this privacy policy, please contact the developer directly within the open-source repository or developer channel.
