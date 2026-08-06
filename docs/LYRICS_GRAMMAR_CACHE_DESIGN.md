# DEPRECATED — 歌词语法词解公共缓存（已退役）

> **状态：已退役（MVP 合规，2026-08）**  
> **勿再实现、勿再部署读写 `lyrics_grammar_cache` 的逻辑。**

## 退役原因

将用户 A 的 AI 词解结果缓存并提供给用户 B，会使产品成为实质**内容分发平台**，需承担版权与合规审查责任。MVP 将 SHUFURI 定位为**个人效率工具 / 无状态 AI 网关**：

- 云函数只透传：请求 → API Key → 大模型 → 回传当前用户  
- **不**写入可供第三人命中的内容库  
- 歌词与学习材料仅用户主动保存到**本机**

产品口径见 [`docs/PRD.md`](./PRD.md) §1.5 隐私与内容分发、§12.3。

曾规划的「保存才写云」方案亦已取消：[`LYRICS_HASH_CACHE_ON_SAVE_PLAN.md`](./LYRICS_HASH_CACHE_ON_SAVE_PLAN.md)。

---

以下为历史设计原文归档（不再作为实现依据）。

---

# 歌词语法词解缓存系统 — 哈希碰撞 + MySQL 结构化匹配（历史）

> 原文保留至仓库供审计；实现已从 `arkProxy` / 前端移除。云端集合 `lyrics_grammar_cache` 应在腾讯云控制台删除。

（完整历史正文曾描述 6 维/4 维 contentHash、`forceRefresh`、HIT/MISS 与 NoSQL 集合写入。若需细节请查 git 历史中本文件删除前的版本。）
