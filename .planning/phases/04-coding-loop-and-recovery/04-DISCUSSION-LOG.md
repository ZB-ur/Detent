# Phase 4: Coding Loop and Recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 04-coding-loop-and-recovery
**Areas discussed:** Coder/Evaluator Loop, Cross-Stage Reentry, Algedonic Signal, Unit Progression & State

---

## Coder/Evaluator Loop

### Coder Input Model

| Option | Description | Selected |
|--------|-------------|----------|
| 逐单元派发 | skill 每次从 handoff.md 提取当前 UNIT-XX 内容，通过 --prompt 发给 Coder | |
| 整体 handoff + 单元指针 | Coder 读取完整 handoff.md，skill 通过提示词指定当前 UNIT-XX | |
| 文件 @-引用 | Coder agent 模板用 @.detent/plan/handoff.md 引用整体文件，skill 只发"执行 UNIT-XX" | ✓ |

**User's choice:** 文件 @-引用
**Notes:** 与 father model 一致（skill 不解析内容）；保留跨单元上下文；handoff.md 是 J-Compile 压缩产物不会太大。

### Evaluator Feedback Format

| Option | Description | Selected |
|--------|-------------|----------|
| 结构化 JSON | verdict(PASS/FAIL) + issues[] 每项含 file:line + expected/got | ✓ |
| 结构化 Markdown | Markdown 表格输出 | |
| 自由文本 + 关键标记 | 自由文本反馈，用 [file:line] 标记格式 | |

**User's choice:** 结构化 JSON
**Notes:** 机器可解析，与 H-Review verdict 模式一致。

### Evaluator Verification Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 运行测试套件 | Evaluator 通过 Bash 运行项目测试，检查退出码 + 输出 | ✓ |
| 代码审查 + 静态分析 | Evaluator 读代码、检查验收条件、运行 lint | |
| 混合：测试 + 审查 | 先运行测试，再检查验收条件 | |

**User's choice:** 运行测试套件
**Notes:** 客观可重复验证。

### Iteration Exhaustion (5 failures)

| Option | Description | Selected |
|--------|-------------|----------|
| 直接上报人类 | 暂停管道，展示最后 Evaluator 反馈，用户决定 | ✓ |
| 自动触发 reentry | 视为规划级问题，自动回退到 Planning | |
| 标记失败并继续 | 记录失败，跳到下一个单元 | |

**User's choice:** 直接上报人类
**Notes:** 无自动 reentry on exhaustion。

---

## Cross-Stage Reentry

### Reentry Trigger Authority

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 Evaluator | Evaluator 发现规划级矛盾时触发 | ✓ |
| Evaluator + Coder | 两者都可触发 | |
| 仅 Skill 层判断 | Agent 只报告，skill 决定 | |

**User's choice:** 仅 Evaluator
**Notes:** 单一触发点，简单可控。

### Reentry Target Stage

| Option | Description | Selected |
|--------|-------------|----------|
| 固定回 D-Critique | 所有 reentry 都回 D 重新开始 | ✓ |
| Evaluator 指定目标阶段 | 类似 H-Review 的 reentry_stage 字段 | |
| 始终回 G-Red/Blue | 跳过 D，直接重新对抗 | |

**User's choice:** 固定回 D-Critique
**Notes:** 新约束得到完整对抗审查。

### Reentry Request Format

| Option | Description | Selected |
|--------|-------------|----------|
| JSON verdict 扩展 | Evaluator JSON 增加 reentry_requested + contradiction 字段 | ✓ |
| 单独 reentry 文件 | 写 .detent/code/reentry-request.json | |
| 通过 CLI 命令 | 调用 detent-tools.cjs reentry-request | |

**User's choice:** JSON verdict 扩展
**Notes:** Skill 解析 JSON 即可路由，与 H-Review 模式一致。

### Contradiction Injection Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Skill 在回退前注入 | Skill 调用 truth-propose + truth-freeze 后再重启规划 | ✓ |
| D-Critique 读取后自行处理 | 矛盾作为文件传给 D，D 决定是否 propose/freeze | |

**User's choice:** Skill 在回退前注入
**Notes:** 时序保证（规划开始前约束已冻结）；单突变点（通过 detent-tools.cjs）；实证矛盾不需对抗验证。需 `truth-freeze --source code-contradiction` 豁免路径跳过成熟度检查。

---

## Algedonic Signal

### Trigger Condition

| Option | Description | Selected |
|--------|-------------|----------|
| 冻结约束被违反 | Agent 产出直接违反 FROZEN 约束 | ✓ |
| 任何 agent 显式声明 | Agent 用 ALGEDONIC: 标记声明紧急问题 | |
| 两者结合 | 自动检测 + agent 主动声明 | |

**User's choice:** 冻结约束被违反
**Notes:** 约束传播的核心守护。

### Signal Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Skill 解析 + 立即暂停 | Skill 检查 agent 输出中的报警标志，立即停管道 + AskUserQuestion | ✓ |
| 写入 state.json 由下次读取触发 | 写 algedonic_signal 到 state.json | |

**User's choice:** Skill 解析 + 立即暂停
**Notes:** 绕过所有正常门控直接上报人类。

---

## Unit Progression & State

### Git Commit Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 每单元一个 commit | UNIT-XX PASS 后立即 git commit | ✓ |
| 所有单元完成后批量提交 | 等所有单元 PASS 后一次性 commit | |
| Claude 自决 | 留给实现时决定 | |

**User's choice:** 每单元一个 commit
**Notes:** 原子提交，细粒度回滚，message 含单元号。

### State Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| unit_index + unit_total | state.json 增加 current_unit 和 total_units 字段 | ✓ |
| 单元状态数组 | state.json 存 units: [{id, status, iterations}] | |
| 外部进度文件 | 单独的 .detent/code/progress.json | |

**User's choice:** unit_index + unit_total
**Notes:** 简单递增，元数据已在 handoff.md 中。

---

## Claude's Discretion

- Coder/Evaluator agent 模板内部结构
- 报警标志的具体格式
- Git commit message 格式细节
- Agent maxTurns 值
- 错误消息文本

## Deferred Ideas

None — discussion stayed within phase scope.
