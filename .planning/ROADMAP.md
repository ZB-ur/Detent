# Roadmap: Detent

## Overview

Detent is a control-theory harness framework for multi-agent orchestration in Claude Code. The roadmap follows the architectural dependency chain mandated by the 7-layer build order: state infrastructure must exist before skills can call it, skills must exist before agent templates can run in them, agent templates must produce stable artifacts before an evaluator can judge them, and the full pipeline must run reliably before a monitoring dashboard is worth building. Three milestones correspond to three delivery boundaries: M1 Engine (working pipeline skeleton), M2 Agents (full constraint propagation and quality mechanisms), M3 Web UI (visibility layer).

## Milestones

- **M1 Engine** - Phases 1-2 (state infrastructure + pipeline skeleton)
- **M2 Agents** - Phases 3-5 (truth surface, adversarial agents, coding loop, observability)
- **M3 Web UI** - Phase 6 (visibility and configuration layer)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: State Infrastructure** - CLI tool, .detent/ schemas, and setup skill — the foundation everything else writes to
- [x] **Phase 2: Pipeline Skeleton** - Five workflow skills and two-mode gate architecture — end-to-end pipeline that proves session bridging before agents exist (completed 2026-04-05)
- [x] **Phase 3: Truth Surface and Planning Agents** - Constraint ledger, frozen decisions, and adversarial planning agent templates (D/G/H/J) (completed 2026-04-06)
- [ ] **Phase 4: Coding Loop and Recovery** - Coder/Evaluator adversarial loop, cross-stage reentry, algedonic signal routing
- [ ] **Phase 5: Observability** - Gemini CLI async behavior logging, raw JSONL capture, locale-aware outputs
- [ ] **Phase 6: Web UI** - Pipeline configuration page and real-time runtime dashboard with multi-pipeline support

## Phase Details

### Phase 1: State Infrastructure
**Goal**: The detent-tools.cjs CLI and .detent/ directory structure exist, are correct, and can be called by any downstream skill
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04
**Success Criteria** (what must be TRUE):
  1. Running `node detent-tools.cjs` in a target repo without arguments prints usage and exits cleanly
  2. `/detent:setup` walks the user through config questions and creates .detent/config.json, .detent/state.json, and .detent/truth-surface/ in the target repo
  3. Calling detent-tools.cjs state-write with valid JSON atomically updates .detent/state.json and survives a /clear boundary (file persists with correct content)
  4. .detent/state.json schema includes pipeline stage, current unit, iteration count, and reentry_depth fields from day one
  5. .detent/config.json stores mode, model budget, locale, pipeline stage toggles, and unit granularity — and is readable outside any agent session
**Plans:** 2/2 plans executed
Plans:
- [x] 01-01-PLAN.md — detent-tools.cjs CLI with all commands, package.json, test suite
- [x] 01-02-PLAN.md — /detent:setup skill with interactive config wizard

### Phase 2: Pipeline Skeleton
**Goal**: All five workflow skills exist and the end-to-end pipeline runs — discovery through achieve — with two-mode gate behavior and session continuity, before any production agent templates are added
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04
**Success Criteria** (what must be TRUE):
  1. Invoking `/detent:discovery` through `/detent:achieve` in sequence completes without error, with each skill reading .detent/state.json at start and updating it on completion
  2. In supervised mode, the pipeline pauses at defined gate points and resumes correctly after human confirmation
  3. In autonomous mode, the same pipeline runs without pausing at any gate
  4. After a /clear boundary mid-pipeline, invoking the next skill resumes from the correct state position (not from the beginning)
  5. The subprocess spawner applies scoped working directory isolation with an extensible interface for adding further isolation layers (additional layers deferred to Phase 3+) — confirmed by running a pipeline and observing no 50K token re-injection overhead
**Plans:** 2/2 plans complete
Plans:
- [x] 02-01-PLAN.md — spawn command, gates config, shared rules, infrastructure tests
- [x] 02-02-PLAN.md — five pipeline workflow skills with gate checks and structure tests

### Phase 3: Truth Surface and Planning Agents
**Goal**: Constraint propagation is real — frozen decisions exist in .detent/truth-surface/, agent templates for all planning stages are defined, and the adversarial planning pipeline (D → G-Red/Blue → H → J) runs end-to-end
**Depends on**: Phase 2
**Requirements**: TRUTH-01, TRUTH-02, TRUTH-03, PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05
**Success Criteria** (what must be TRUE):
  1. .detent/truth-surface/ contains constraint-ledger.md (single truth surface file) with FROZEN/PROPOSED status; a decision marked FROZEN cannot be overwritten by any agent
  2. The D-Critique agent template, when invoked with a requirements set, produces a structured critique that attacks at least one requirement against the truth surface
  3. The G-Red agent template produces a genuine attack against D-Critique's output (not agreement); the G-Blue agent template produces a defense; both outputs are structured and actionable
  4. The H-Review agent template judges coding-readiness and emits either an approval or a rejection with an explicit reentry_stage field
  5. The J-Compile agent template produces an executable code handoff document that a Coder agent can act on without further clarification
**Plans:** 3/3 plans complete
Plans:
- [x] 03-01-PLAN.md — Truth surface CLI commands (truth-propose, truth-freeze, truth-read) + tests
- [x] 03-02-PLAN.md — Five agent templates (D/G-Red/G-Blue/H/J) + three playbook files
- [x] 03-03-PLAN.md — /detent:plan skill rewrite as sequential agent orchestrator + setup updates
**UI hint**: no

### Phase 4: Coding Loop and Recovery
**Goal**: The Coder/Evaluator adversarial loop runs with machine-structured feedback, the reentry mechanism propagates contradictions as new frozen constraints, and the algedonic signal escalates to human when triggered
**Depends on**: Phase 3
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04, RECOV-01, RECOV-02, RECOV-03, RECOV-04
**Success Criteria** (what must be TRUE):
  1. The Coder agent executes one implementation unit at a time; when the Evaluator returns FAIL with `[file:line] expected X, got Y` feedback, the Coder retries with that exact feedback — up to 5 iterations
  2. On PASS, the unit is git committed and .detent/state.json advances to the next unit automatically
  3. When any agent raises an algedonic signal, the pipeline immediately halts and surfaces the contradiction to the human — bypassing all normal gate logic
  4. A cross-stage reentry triggered by the Evaluator rolls back to the specified Planning substage and injects the contradiction as a new frozen constraint in constraint-ledger.md
  5. When reentry_depth reaches 2, further reentry triggers human escalation instead of another rollback
**Plans:** 1/2 plans executed
Plans:
- [x] 04-01-PLAN.md — CLI extensions (total_units intField, truth-freeze --source bypass), Coder/Evaluator agent templates, playbook extension, Phase 4 tests
- [ ] 04-02-PLAN.md — /detent:code skill rewrite as Coder/Evaluator orchestrator with iteration loop, verdict routing, reentry, algedonic handling

### Phase 5: Observability
**Goal**: Every pipeline run produces structured behavior logs asynchronously without intruding on core agent prompts, and all outputs respect the locale setting
**Depends on**: Phase 4
**Requirements**: OBS-01, OBS-02, OBS-03
**Success Criteria** (what must be TRUE):
  1. After any pipeline stage completes, .detent/raw/ contains a JSONL file for that stage capturing stream-json output and tool call records — without any logging code inside agent prompt templates
  2. Running the Gemini CLI hook against a raw JSONL file produces a structured behavior log in .detent/logs/ — confirming the async side-channel works end-to-end
  3. When locale is set to zh-CN in .detent/config.json, all user-facing outputs (logs, truth surface documents, stage artifacts) are rendered in Chinese
**Plans**: TBD

### Phase 6: Web UI
**Goal**: A local web dashboard lets the user configure pipelines visually and monitor one or more running pipelines in real time — with dual-channel state reconciliation ensuring stream-json and file-watch never corrupt persistent state
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Opening the dashboard shows a pipeline configuration page where the user can toggle stages, edit config values, and associate a repo — with changes persisting to .detent/config.json via detent-tools.cjs
  2. A running pipeline shows real-time progress (current stage, current unit, iteration count) updating in the browser without page refresh
  3. Two parallel pipelines running simultaneously each appear as independent rows in the dashboard with isolated state — neither pipeline's state bleeds into the other
  4. If the stream-json channel stops mid-session, the dashboard falls back to file-watch on .detent/ and continues displaying correct state
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. State Infrastructure | M1 Engine | 2/2 | Complete |  |
| 2. Pipeline Skeleton | M1 Engine | 2/2 | Complete   | 2026-04-05 |
| 3. Truth Surface and Planning Agents | M2 Agents | 3/3 | Complete | 2026-04-06 |
| 4. Coding Loop and Recovery | M2 Agents | 1/2 | In Progress|  |
| 5. Observability | M2 Agents | 0/? | Not started | - |
| 6. Web UI | M3 Web UI | 0/? | Not started | - |
