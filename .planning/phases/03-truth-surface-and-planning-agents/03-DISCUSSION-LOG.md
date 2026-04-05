# Phase 3: Truth Surface and Planning Agents - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 03-truth-surface-and-planning-agents
**Areas discussed:** Truth surface mutation model, Agent template design, Planning pipeline orchestration, Playbook migration from ECL
**Language:** Mandarin (zh-CN) per user request

---

## Truth Surface Mutation Model

### 写入方式

| Option | Description | Selected |
|--------|-------------|----------|
| CLI 命令 (推荐) | 新增 detent-tools.cjs 命令（truth-propose, truth-freeze, truth-read），保持单一变更点模式 | ✓ |
| 结构化 JSON + CLI | 内部 JSON 存储，CLI 读写，对外渲染为 Markdown | |
| Markdown 直写 + 校验 | Agent 直接写 Markdown，CLI 校验格式和 FROZEN 完整性 | |

**User's choice:** CLI 命令
**Notes:** 保持与 Phase 1 建立的单一变更点模式一致

### 冻结权限

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 H-Review | 只有 H-Review 在判定 coding-readiness 时能冻结 | |
| D-Critique + H-Review | 两个不同阶段各有冻结权 | |
| 任何 agent + 门控确认 | 任何 agent 提议冻结，supervised 模式需人工确认 | ✓ |

**User's choice:** 任何 agent + 门控确认
**Notes:** 用户提供了完整设计：三条规则——(1) amplifier: 任何 agent 可提议冻结；(2) attenuator: CLI 检查决策成熟度（必须有 challenged_by）；(3) gate: supervised 模式加人工确认。逻辑是"不是谁能冻结，而是决策经历了什么"。提供了 canFreeze() 伪代码。

### 不可变性

| Option | Description | Selected |
|--------|-------------|----------|
| CLI 硬拒绝 (推荐) | FROZEN 条目遇到覆写请求直接报错退出 | ✓ |
| SUPERSEDED 链 | 允许标记旧 FROZEN 为 SUPERSEDED 并链接新条目 | |
| 你来决定 | Claude 自行选择 | |

**User's choice:** CLI 硬拒绝
**Notes:** None

### 存储格式

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown + frontmatter | 每个决策是 Markdown section，状态元数据放 YAML frontmatter | ✓ |
| JSON 文件 | 纯 JSON，CLI 提供渲染命令 | |
| 你来决定 | Claude 自行选择 | |

**User's choice:** Markdown + frontmatter
**Notes:** None

---

## Agent Template Design

### Agent 格式

| Option | Description | Selected |
|--------|-------------|----------|
| .claude/agents/*.md (推荐) | Claude Code 原生 agent 格式，YAML frontmatter + Markdown prompt | ✓ |
| 提示词存在 detent-tools | Agent 提示词作为字符串存在 CLI 中 | |
| 混合方案 | agents/*.md 存角色定义，CLI 存运行时参数 | |

**User's choice:** .claude/agents/*.md
**Notes:** None

### 工具权限

| Option | Description | Selected |
|--------|-------------|----------|
| 最小权限 (推荐) | 每个 agent 只给必要工具 | ✓ |
| 统一权限集 | 所有 agent 用相同工具集 | |
| 你来决定 | Claude 按职责分配 | |

**User's choice:** 最小权限
**Notes:** None

### 数据流

| Option | Description | Selected |
|--------|-------------|----------|
| 文件传递 (推荐) | 每个 agent 写入 .detent/plan/ 下约定文件，下一个 agent 读取 | ✓ |
| Prompt 注入 | 上一个 agent 输出拼进下一个 prompt | |
| 你来决定 | Claude 选择 | |

**User's choice:** 文件传递
**Notes:** None

### maxTurns 限制

| Option | Description | Selected |
|--------|-------------|----------|
| 保守默认 (推荐) | 5-10 turns，按角色微调 | ✓ |
| 宽松限制 | 20+ turns | |
| 你来决定 | Claude 按职责分配 | |

**User's choice:** 保守默认
**Notes:** 用户追问 maxTurns 是否可在 setup 时调整。讨论后决定 MVP 用固定默认值，可配置性推迟到 v1 发布后。已植入 SEED-001。

---

## Planning Pipeline Orchestration

### 编排方式

| Option | Description | Selected |
|--------|-------------|----------|
| 单 skill 顺序调度 (推荐) | /detent:plan 内部顺序 spawn D→G-Red/Blue→H→J | ✓ |
| 多 skill 管线 | 每个 agent 阶段独立 skill | |
| 你来决定 | Claude 选择 | |

**User's choice:** 单 skill 顺序调度
**Notes:** None

### Red/Blue 运行顺序

| Option | Description | Selected |
|--------|-------------|----------|
| 顺序：Red 先攻击，Blue 再防御 (推荐) | Red 输出攻击点，Blue 读取后针对性防御 | ✓ |
| 并行：同时运行 | 两个 agent 同时拿到 D 输出，独立产出 | |
| 你来决定 | Claude 选择 | |

**User's choice:** 顺序
**Notes:** None

### H-Review 拒绝处理

| Option | Description | Selected |
|--------|-------------|----------|
| 回退到指定阶段 (推荐) | H 指定回退到 D 或 G，从该阶段重新运行 | ✓ |
| 从头重跑 D→G→H | 不管原因，整个 planning 重新开始 | |
| 你来决定 | Claude 选择 | |

**User's choice:** 回退到指定阶段
**Notes:** None

### 重试上限

| Option | Description | Selected |
|--------|-------------|----------|
| 2 次 (推荐) | 与 RECOV-04 一致，超过升级给人 | ✓ |
| 3 次 | 多一次机会 | |
| 你来决定 | Claude 选择 | |

**User's choice:** 2 次
**Notes:** None

### Context 窗口管理

| Option | Description | Selected |
|--------|-------------|----------|
| Skill 只做调度 (推荐) | Skill 不读 agent 完整输出，只看状态字段 | ✓ |
| Skill 参与综合判断 | Skill 读取每个 agent 输出做分析 | |
| 你来决定 | Claude 选择 | |

**User's choice:** Skill 只做调度
**Notes:** 用户补充关键架构决策——"这就是 father model pattern 在 Detent 里的表达"。唯一例外：H 的 verdict 解析必须在 skill 里做（读一个字段做 if/else，不是综合分析）。Agent 写文件，下一个 agent 用 @ 引用文件。Skill 只看状态字段，不看内容。

### 错误处理

| Option | Description | Selected |
|--------|-------------|----------|
| 停止并报告 (推荐) | 任何 agent 失败即停止，保留中间产物 | ✓ |
| 重试一次 | 失败 agent 自动重试一次 | |
| 你来决定 | Claude 选择 | |

**User's choice:** 停止并报告
**Notes:** None

---

## Playbook Migration (ECL → Detent)

### 迁移策略

| Option | Description | Selected |
|--------|-------------|----------|
| 原则迁移，不复制代码 (推荐) | 提取 ECL 核心原则，用 Detent 架构重新实现 | ✓ |
| 直接移植 | 尽可能复制 ECL playbook，只改接口适配 | |
| 你来决定 | Claude 判断 | |

**User's choice:** 原则迁移
**Notes:** None

### 存放位置

| Option | Description | Selected |
|--------|-------------|----------|
| .detent/playbooks/ (推荐) | 和真相表面并列，存在目标仓库 | ✓ |
| .claude/agents/ 内嵌 | 直接写进 agent 模板中 | |
| 你来决定 | Claude 选择 | |

**User's choice:** .detent/playbooks/
**Notes:** None

### 使用方式

| Option | Description | Selected |
|--------|-------------|----------|
| Agent prompt 里 @ 引用 (推荐) | Agent 模板里用 @.detent/playbooks/xxx.md 引用 | ✓ |
| CLI 注入到 prompt | detent-tools spawn 自动拼接 playbook 内容 | |
| 你来决定 | Claude 选择 | |

**User's choice:** @ 引用
**Notes:** None

### 可配置性

| Option | Description | Selected |
|--------|-------------|----------|
| 固定默认 (推荐) | Phase 3 提供固定内容，用户可手动编辑但无配置界面 | ✓ |
| 模板 + 变量 | 支持变量替换，从 config.json 读值 | |
| 你来决定 | Claude 选择 | |

**User's choice:** 固定默认
**Notes:** None

---

## Claude's Discretion

- 每个 agent 的具体工具分配
- .detent/plan/ 下的文件命名约定
- 每个 agent 在 5-10 范围内的具体 maxTurns 值
- Playbook 内部结构和章节组织
- H-Review verdict 输出格式（只要 skill 能机器解析）
- 错误信息文本和格式

## Deferred Ideas

- maxTurns 可配置 → SEED-001（v1 发布后）
- SUPERSEDED 链 → 后续版本考虑
- Playbook 模板变量 → MVP 后考虑
- G-Red/Blue 并行执行 → 未来优化
