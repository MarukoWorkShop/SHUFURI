# ⚠️ 此项目已归档

**归档日期**: 2026-06-04

核心排版引擎（`src/utils/furiganaLayout/`）已迁移至原生 SwiftUI 项目 **ShufuLyrics**。

## 迁移说明

旧项目的核心价值在于日语歌词海报的分页排版管道，该管道已完整重写为纯 Swift 实现。

### 新项目路径

```
~/Desktop/ShufuLyrics/
```

### 迁移内容

| 模块 | 状态 |
|------|------|
| 分页排版引擎 | ✅ 已迁移至 SwiftUI |
| 结构化歌词解析 | ✅ 已迁移 |
| 注音标记解析（ruby） | ✅ 已迁移 |
| HTML 兼容解析 | ✅ 已迁移 |
| PNG / PDF 导出 | ✅ 已迁移 |
| React 预览 UI | ❌ 已用 SwiftUI 重写 |
| Expo / WebView 壳 | ❌ 已废弃 |
| 火山引擎 API 调用 | ❌ 已废弃 |

### 此仓库用途

- 只读参考（旧算法实现对照）
- 历史记录存档
- 测试用例来源（structuredLyricsParser.sample）

### 不要做的事

- ❌ 不要再向此仓库提交新功能
- ❌ 不要再修复 bug（在新项目中修复）
- ✅ 可以查阅代码作为算法参考
- ✅ 可以用 `scripts/generate_golden_standard.mjs` 生成测试参考数据
