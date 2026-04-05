# Requirements: Detent

**Defined:** 2026-04-05
**Core Value:** Constraint propagation through a truth surface that ensures every agent decision aligns with frozen requirements

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Engine

- [x] **ENG-01**: detent-tools.cjs CLI tool handles all state mutations via single entry point (state read/write, truth surface update, reentry request, config management)
- [x] **ENG-02**: .detent/state.json persists session position (current stage, current unit, iteration count) and survives /clear boundaries
- [x] **ENG-03**: .detent/config.json stores mode (autonomous/supervised), model budget (quality/balanced/budget), locale (zh-CN/en), pipeline stage toggles, unit granularity, and language preference
- [x] **ENG-04**: /detent:setup skill initializes .detent/ directory structure, walks user through config questions, and persists config to target repo

### Pipeline

- [x] **PIPE-01**: 5-stage sequential pipeline: Discovery → Planning (A-J) → Coding (unit × eval) → Verification → Achieve
- [x] **PIPE-02**: One workflow skill per stage: /detent:discovery, /detent:plan, /detent:code, /detent:verify, /detent:achieve
- [x] **PIPE-03**: Two-mode operation: autonomous mode auto-approves all gates; supervised mode pauses at key gates for human confirmation
- [x] **PIPE-04**: Each skill reads .detent/state.json at start and updates it on completion, enabling cross-session continuity

### Planning Agents

- [x] **PLAN-01**: Stage D agent template: independent Critique that attacks false requirements against truth surface
- [x] **PLAN-02**: Stage G agent templates: Red (attack) and Blue (defend) adversarial pair for plan robustness
- [x] **PLAN-03**: Stage H agent template: Review agent that judges coding-readiness and can reject with reentry_stage
- [x] **PLAN-04**: Stage J agent template: Compile agent that generates executable code handoff from approved plan
- [x] **PLAN-05**: Playbook migration from ECL: stage-playbook, subagent-protocol, handoff-quality-bar adapted for Detent

### Truth Surface

- [ ] **TRUTH-01**: .detent/truth-surface/ directory stores constraint-ledger.md, frozen-decisions.md, and domain-model.md
- [ ] **TRUTH-02**: Frozen decisions are immutable once committed; downstream agents check alignment before executing
- [ ] **TRUTH-03**: Constraint ledger tracks retained_goal, discarded options, and rationale for each frozen decision

### Coding Quality Loop

- [ ] **CODE-01**: Coder agent executes one implementation unit at a time, producing complete runnable code
- [ ] **CODE-02**: Evaluator agent tests each unit via structured criteria and returns PASS/FAIL with specific technical feedback (format: `[file:line] expected X, got Y`)
- [ ] **CODE-03**: On FAIL, Coder receives Evaluator feedback and retries (max 5 iterations per unit)
- [ ] **CODE-04**: On PASS, unit is git committed and pipeline advances to next unit

### Recovery & Escalation

- [ ] **RECOV-01**: Algedonic signal: any agent can flag a critical contradiction that bypasses normal flow and escalates to human
- [ ] **RECOV-02**: Cross-stage reentry: Evaluator or Verification stage can trigger rollback to a specific Planning substage (A/B/C/E/G/H)
- [ ] **RECOV-03**: Reentry carries the specific contradiction as a new frozen constraint, preventing the same error from recurring
- [ ] **RECOV-04**: Reentry depth limit (max 2 rollbacks per pipeline run) with escalation to human on breach

### Observability

- [ ] **OBS-01**: Hook captures stream-json output + tool call records to .detent/raw/ as JSONL per stage
- [ ] **OBS-02**: Gemini CLI asynchronously generates structured behavior logs from raw JSONL to .detent/logs/
- [ ] **OBS-03**: All user-facing outputs (logs, truth surface, stage artifacts) respect locale setting from config

### Web UI

- [ ] **UI-01**: Layer 1: pipeline configuration page — visual stage toggle, config editing, repo association, persist to .detent/config.json
- [ ] **UI-02**: Layer 2: runtime dashboard — real-time pipeline progress, stage status, unit/iteration tracking per pipeline
- [ ] **UI-03**: Multiple parallel pipelines: spawn/monitor independent Claude Code instances via `-p --output-format stream-json`
- [ ] **UI-04**: Dual channel: stream-json for real-time progress + file watch (.detent/) for persistent state/artifacts/logs

## v2 Requirements

### Advanced Observability

- **OBS-04**: Behavior log diffing — compare logs across pipeline runs to detect prompt regression
- **OBS-05**: Evaluator few-shot calibration from accumulated human review data

### Advanced Recovery

- **RECOV-05**: Auto-healing: detect recurring failure patterns and suggest playbook modifications
- **RECOV-06**: Partial rollback: preserve work done after contradiction point during reentry

### Ecosystem

- **ECO-01**: Shareable pipeline templates (export/import .detent/config.json + playbooks)
- **ECO-02**: Pipeline analytics dashboard with historical metrics

## Out of Scope

| Feature | Reason |
|---------|--------|
| Generic LLM provider support | Claude Code only; abstraction layer adds complexity with no benefit |
| Multi-user collaboration | Solo developer tool; session isolation and file-based state designed for single user |
| Plugin/extension system | Requires stable internal APIs and versioning; premature for v1 |
| Workflow DSL | Fixed 5-stage pipeline; config for behavior, not pipeline shape |
| Built-in code execution sandbox | Claude Code's --dangerously-skip-permissions handles execution |
| Auto-healing harness self-modification | Requires stable evaluations and production data; v3 concern |
| Chat-based interaction model | Skill invocations are explicit commands, not conversations |
| Framework-level MCP server management | Claude Code already handles MCP; don't wrap it |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 1 | Complete |
| ENG-02 | Phase 1 | Complete |
| ENG-03 | Phase 1 | Complete |
| ENG-04 | Phase 1 | Complete |
| PIPE-01 | Phase 2 | Complete |
| PIPE-02 | Phase 2 | Complete |
| PIPE-03 | Phase 2 | Complete |
| PIPE-04 | Phase 2 | Complete |
| TRUTH-01 | Phase 3 | Pending |
| TRUTH-02 | Phase 3 | Pending |
| TRUTH-03 | Phase 3 | Pending |
| PLAN-01 | Phase 3 | Complete |
| PLAN-02 | Phase 3 | Complete |
| PLAN-03 | Phase 3 | Complete |
| PLAN-04 | Phase 3 | Complete |
| PLAN-05 | Phase 3 | Complete |
| CODE-01 | Phase 4 | Pending |
| CODE-02 | Phase 4 | Pending |
| CODE-03 | Phase 4 | Pending |
| CODE-04 | Phase 4 | Pending |
| RECOV-01 | Phase 4 | Pending |
| RECOV-02 | Phase 4 | Pending |
| RECOV-03 | Phase 4 | Pending |
| RECOV-04 | Phase 4 | Pending |
| OBS-01 | Phase 5 | Pending |
| OBS-02 | Phase 5 | Pending |
| OBS-03 | Phase 5 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |
| UI-03 | Phase 6 | Pending |
| UI-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 31 total (note: file previously said 27 — actual count is 31)
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after roadmap creation — traceability populated*
