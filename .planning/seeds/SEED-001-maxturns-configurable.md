---
id: SEED-001
status: dormant
planted: 2026-04-05
planted_during: v1.0/Phase 3 (truth-surface-and-planning-agents)
trigger_when: v1 发布后
scope: Small
---

# SEED-001: maxTurns 可通过 config.json 配置

## Why This Matters

Agent 的 maxTurns 当前在 `.claude/agents/*.md` frontmatter 中硬编码。MVP 阶段这足够了，但当用户开始实际使用 pipeline 后，不同项目/场景对 agent 运行时长的需求不同。通过 config.json 覆盖 frontmatter 默认值，用户无需修改 agent 模板即可调优。

设计意图：frontmatter 定义合理默认值，config.json `agents.<name>.maxTurns` 可选覆盖。

## When to Surface

**Trigger:** v1 发布后

This seed should be presented during `/gsd:new-milestone` when the milestone
scope matches any of these conditions:
- v2 或 post-v1 优化里程碑
- Agent 调优/性能优化相关工作
- 用户反馈 agent 运行时间不够或过长

## Scope Estimate

**Small** — config.json schema 加 `agents` 字段 + detent-tools spawn 读取覆盖值，几小时工作量。

## Breadcrumbs

Related code and decisions found in the current codebase:

- `CLAUDE.md` — 提到 agent frontmatter 支持 `maxTurns` 字段
- `.planning/research/STACK.md` — agent 技术栈文档
- `.claude/agents/` — Phase 3 将创建的 agent 模板目录（当前不存在）
- `.detent/config.json` — 已有 `model_budget` 等配置，`agents` 字段可自然扩展

## Notes

在 Phase 3 discuss-phase 中用户提出此想法。当前决策：Phase 3 用保守默认值（5-10 turns），maxTurns 可配置推迟到 MVP 完成后。
