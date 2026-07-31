# SHUFURI — 多语歌词释音与排版助手

一款专为语言学习者和排版爱好者设计的本地优先字音排版工具。支持 **日语 · 韩语 · 英语 · 中文** 歌词的发音标注、双语翻译对比、分页海报排版与高清导出。

## 支持语种

| 语种 | 发音标注 | 排版字体 | 海报样式 |
|------|----------|----------|----------|
| 日本語 | 振假名 `{漢字:よみ}` | Kozuka Mincho EL | 传统竖/横排 |
| 한국어 | 谚文原样排版 | HCR Batang | 清爽横排 |
| English | 纯英文原版 | Sansation Light | 现代横排 |
| 中文 | 拼音 `{汉字:pīnyīn}` | PingFang SC | 标准横排 |

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

| 资源 | 说明 |
|------|------|
| 静态托管 | `https://shufu-life-d8g9j8v5385543c1a-1435171508.tcloudbaseapp.com/?v=20260731-1` |
| 云函数 arkProxy | `explain.selection`（划词/语法讲解）/ `lyrics.step2`（词解与语法生成，已开启 `web_search` 联网搜索）；已接入 `ai_usage` 结构化用量日志（input/output/total/cache/searchCount） |
| 云函数 arkExplainStream | 流式讲解（主路径，已开启 `stream_options.include_usage` 并记录 `ai_usage` 用量日志） |
| 环境 ID | `shufu-life-d8g9j8v5385543c1a` |

**部署命令**：

```bash
# 部署云函数
npm run deploy:ark-proxy        # arkProxy（含歌词生成 + 划词讲解）
npm run deploy:ark-explain-stream  # arkExplainStream

# 构建 + 部署前端到静态托管
npm run build
npx tcb hosting deploy dist -e shufu-life-d8g9j8v5385543c1a
```

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
