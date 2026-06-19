# 语言矩阵（Language Matrix）

**版本**：v1.2  
**更新日期**：2026-06-18  
**关联 PRD**：§5.2–5.3、§11；**关联设计规范**：§7.3、§7.4

语言矩阵是 SHUFURI **设置层与 Prompt 生成层**之间的二维约束框架，决定：

1. 学习者母语（使用语言）→ AI 输出的释义、翻译、语法解析用什么语言写  
2. 学习目标语言（多选）→ 首页拨轮可选项 + Prompt 允许检索的歌词语言范围

---

## 1. 两个维度

| 维度 | 字段 | 类型 | 作用 |
|------|------|------|------|
| **使用语言** | `interfaceLanguage` | `'zh' \| 'en'` | Prompt 中 `MEANING` / `DETAIL` / `ZH` / `EX_ZH` 及语法标题括注的内容语言 |
| **学习目标语言** | `learningTargetLanguages` | `('jp'\|'ko'\|'en'\|'zh')[]` | 过滤首页拨轮；约束 AI 只检索允许的原曲语言 |
| **拨轮当前项** | `lyricsLanguage` | `'jp'\|'ko'\|'en'\|'zh'` | 运行时 `activeTarget`，写入 Prompt `[Language_Target]` |

**与排版管线的关系**：

- `LangCode`（`jp` / `ko` / `en` / `zh`）仍由 AI 输出 `LANG:` 或解析器检测，与矩阵解耦  
- 已保存歌词本项目**不存矩阵快照**，只存 `lang`；矩阵仅影响**生成口令**，不影响已排版内容

---

## 2. 默认值与存储

**localStorage 键**：`shufu-lyrics-app-settings`（与全局设置合并）

```json
{
  "interfaceLanguage": "<首次默认，见 §3；之后由设置手动持久化>",
  "learningTargetLanguages": ["jp", "ko", "en"],
  "lyricsLanguage": "jp"
}
```

**源码**：[`src/services/appSettings.ts`](../src/services/appSettings.ts)  
**矩阵逻辑**：[`src/services/languageMatrix/`](../src/services/languageMatrix/)

---

## 3. 使用语言与首次默认

### 3.1 系统语言推断（仅首次安装 / 无 localStorage 时）

[`resolveSystemLanguage.ts`](../src/services/languageMatrix/resolveSystemLanguage.ts) 在 `buildDefaults()` 中调用一次：

| `navigator.language` | → `interfaceLanguage` |
|----------------------|-------------------------|
| 以 `en` 开头 | `en` |
| 以 `zh` 开头 | `zh` |
| 其他（泰语、日语、韩语等） | `en`（兜底） |

### 3.2 优先级

| 场景 | 生效值 |
|------|--------|
| **首次安装**（无 localStorage） | `resolveSystemInterfaceLanguage()` 写入默认 |
| 设置里手动点「中文 / English」 | 更新并持久化 `interfaceLanguage` |
| **App 启动** | 保持上次保存的 `interfaceLanguage`，**不再**根据系统语言覆盖 |
| **生成 Prompt** | 读当前 persisted 的 `interfaceLanguage` |

> 暂不提供「跟随系统语言」开关；产品当前仅支持中文 / English 两套 Prompt 释义。日后扩展第三母语时可恢复跟随或改为下拉选择。

### 3.3 日后扩展（Future）

| 层 | 扩展方式 |
|----|----------|
| 类型 | `InterfaceLanguage` 扩 union 或 BCP-47 主码 |
| 推断 | `resolveSystemLanguage` 加 `th→th` 等映射；未知仍可 `en` |
| Prompt | `glossSpec.ts` 增加对应母语条目 |
| 设置 | 恢复「跟随系统」或「使用语言」多选 |
| 同步时机 | 可选：回前台 `visibilitychange` 再 sync |

---

## 4. 学习目标语言与拨轮联动

[`getWheelLanguages()`](../src/services/languageMatrix/wheelLanguages.ts)：

```
拨轮选项 = AUTO + learningTargetLanguages（顺序固定：JAP → KOR → ENG → 中文）
```

| 学习目标勾选 | 拨轮显示 |
|--------------|----------|
| jp, ko, en | AUTO, JAP, KOR, ENG |
| jp, ko | AUTO, JAP, KOR |
| jp | AUTO, JAP |

**边界**：

- 至少保留 1 项学习目标；取消最后一项无效  
- 若 `lyricsLanguage` 不在允许集合 → 重置为 `auto`  
- 取消勾选当前拨轮对应语言 → `lyricsLanguage` 自动切为 `auto`

**LanguageWheel**：接收 `languages: LyricsLanguage[]` 动态渲染（[`LanguageWheel.tsx`](../src/components/LanguageWheel.tsx)）。

---

## 5. Prompt 映射

### 5.1 组装顺序

[`buildEncoderPrompt()`](../src/codec/prompt/buildEncoderPrompt.ts)（原 `buildExternalAiPrompt` 已废弃）：

```
[Role: Sequence_Encoder] + [Lang: xx]
+ [Learner]                 ← buildLearnerGlossBlock(matrix)
+ [Context]                 ← OCR / 链接（可选）
+ [STRICT_RAW] + [Wire_Schema] + [Integrity]
```

### 5.3 记录流格式（ENC）

AI 输出 `@0 … @9` 单行管道密文（`H/L/V/G` 记录），前端 [`src/codec/`](../src/codec/) 解析并编译为现有 DOM class HTML。旧 `===BEGIN===` 格式已停用。

### 5.4 Gloss 规格

[`glossSpec.ts`](../src/services/languageMatrix/glossSpec.ts) 提供 zh / en 两套：

| 项 | zh | en |
|----|----|-----|
| 释义字段 | Simplified Chinese | Natural English |
| 语法 TITLE | `原语言（中文括注）` | `original (English gloss)` |
| 语法规则块 | `[Grammar_TITLE_Format]` 中文括注规范 | 英文括注规范 |

---

## 6. 设置 UI

位置：设置抽屉 → **语言矩阵**（在「附词解与语法品读」之上）

| 控件 | 绑定字段 |
|------|----------|
| 分段：中文 / English | `interfaceLanguage` |
| 多选 chip：JAP / KOR / ENG / 中文 | `learningTargetLanguages` |

样式：`.app-settings__lang-chip`（6px 字、主题色底，对齐 Study Cards 语言标签尺寸）

---

## 7. 数据流

```
navigator.language
       ↓ (仅首次 buildDefaults)
appSettings.interfaceLanguage ──→ getGlossSpec ──→ Prompt 释义语言
appSettings.learningTargetLanguages ──→ getWheelLanguages ──→ LanguageWheel
appSettings.lyricsLanguage ──→ activeTarget ──→ [Language_Target]
       ↓
buildEncoderPrompt → 外部 AI → src/codec（parseStream + roleCompiler）
```

---

## 8. 中文目标管线（lang: zh）

与 JP/KO/EN **隔离**：拨轮选「中文」时走 `encoderZh.ts` + `roleCompiler` 内 `applyZhRubyMarkup`。

| 层 | 模块 | 说明 |
|----|------|------|
| Prompt | `src/codec/prompt/encoderZh.ts` | `H\|…\|zh` + `L` 行 `{汉字:拼音}` |
| 解析 | `src/codec/compileDocument.ts` | `.cn-line` 主行 + 可选 `.gloss-line` |
| 排版 | `src/utils/zhLayout/zhPosterCss.ts` | PingFang 正文；拼音 rt 跟随 `colorTheme` |
| Study Cards | `extractStudyCards.ts` | 消费 `StreamDocument` AST |

**使用语言 × 中文歌**：

- `interfaceLanguage: zh`（中文母语）：主行拼音注音 + 中文词解，**无 GLOSS 行**
- `interfaceLanguage: en`：主行拼音 + `GLOSS:` 英语行译/释义

---

## 9. 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/services/languageMatrix/types.ts` | 类型定义 |
| `src/services/languageMatrix/wheelLanguages.ts` | 拨轮选项推导、activeTarget 校验 |
| `src/services/languageMatrix/glossSpec.ts` | zh/en 释义模板 |
| `src/services/languageMatrix/promptContext.ts` | `[Learner_Matrix]` 块 |
| `src/services/languageMatrix/index.ts` | 统一导出、`buildLanguageMatrixContext` |
| `src/services/appSettings.ts` | 持久化、首次默认推断 |
| `src/codec/prompt/buildEncoderPrompt.ts` | 四语 encoder 组装 |
| `src/codec/` | 记录流解析 + roleCompiler |
| `src/utils/zhLayout/zhPosterCss.ts` | 中文海报 CSS（拼音主题色） |
| `src/services/externalPromptTemplate.ts` | 薄 re-export（deprecated） |
| `src/components/SettingsPanel.tsx` | 语言矩阵 UI |
| `src/components/LanguageWheel.tsx` | 动态拨轮 |
| `src/components/HtmlPasteInput.tsx` | 传入 matrix 生成口令 |

---

## 10. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.2 | 2026-06-18 | 移除「跟随系统语言」；未知 locale 首次默认 English；启动不再覆盖用户选择 |
| v1.1 | 2026-06-03 | 中文目标管线：独立 Prompt/解析/CSS；GLOSS 标签；拼音主题色 |
| v1.0 | 2026-06-03 | 初版：使用语言 × 学习目标语言；Prompt gloss 参数化；拨轮联动 |
