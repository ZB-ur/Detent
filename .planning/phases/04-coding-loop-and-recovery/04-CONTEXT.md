# Phase 4: Coding Loop and Recovery - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The Coder/Evaluator adversarial loop runs with machine-structured feedback, the reentry mechanism propagates contradictions as new frozen constraints, and the algedonic signal escalates to human when triggered. Delivers CODE-01 through CODE-04 (coding quality loop) and RECOV-01 through RECOV-04 (recovery and escalation).

</domain>

<decisions>
## Implementation Decisions

### Coder Agent Input Model
- **D-01:** Coder agent template uses `@.detent/plan/handoff.md` file reference for full handoff context. Skill sends only `--prompt "执行 UNIT-XX"` via cmdSpawn. Coder self-locates the unit, understands dependencies, and executes.
- **D-02:** Rationale: consistent with father model (skill doesn't parse handoff content), preserves inter-unit context (UNIT-02's interface visible when coding UNIT-03), handoff.md is J-Compile's compressed output so context window cost is acceptable.

### Evaluator Agent Design
- **D-03:** Evaluator outputs structured JSON: `{verdict: "PASS"|"FAIL", issues: [{file, line, expected, got}]}`. Machine-parseable, consistent with H-Review verdict pattern.
- **D-04:** Evaluator validates by running the project's test suite via Bash (node test/, npm test, etc.). Objective, repeatable verification. Not code review or static analysis.
- **D-05:** Evaluator agent template uses `@.detent/plan/handoff.md` for acceptance criteria reference + reads Coder's output files.

### Iteration Control
- **D-06:** Maximum 5 iterations per unit. On FAIL, Coder receives exact Evaluator JSON feedback and retries.
- **D-07:** After 5 failures: pipeline halts, displays last Evaluator feedback, user decides next step (fix manually / skip unit / trigger reentry). No automatic reentry on iteration exhaustion.

### Cross-Stage Reentry
- **D-08:** Only Evaluator can trigger reentry — single trigger point. Coder only codes, doesn't judge planning quality.
- **D-09:** All reentry rolls back to D-Critique (fixed target). New constraint gets full adversarial review (D → G-Red → G-Blue → H → J).
- **D-10:** Evaluator expresses reentry via JSON verdict extension: `{verdict: "FAIL", reentry_requested: true, contradiction: "description of planning-level contradiction"}`. Skill parses JSON for routing — consistent with father model.
- **D-11:** Skill injects contradiction as frozen constraint BEFORE restarting planning: calls `truth-propose` then `truth-freeze --source code-contradiction`. The `--source code-contradiction` flag bypasses maturity check (challenged_by requirement) because empirical contradictions from code execution are self-evidencing — they don't need adversarial validation.
- **D-12:** Reentry depth limit: max 2 rollbacks per pipeline run (consistent with RECOV-04). On depth breach, escalate to human instead of another rollback.

### Algedonic Signal
- **D-13:** Trigger condition: frozen constraint violated by agent output. This is the core guardian of constraint propagation.
- **D-14:** Routing: Skill checks agent output for algedonic flag, immediately halts pipeline, surfaces contradiction to human via AskUserQuestion — bypasses all normal gate logic.
- **D-15:** Algedonic signal is distinct from reentry: reentry = "planning was wrong, redo it"; algedonic = "something is fundamentally broken, human must intervene."

### Unit Progression & State
- **D-16:** Each unit PASS triggers immediate git commit with message containing unit number (e.g., `feat(detent): UNIT-03 — [description]`). Atomic commits enable fine-grained rollback.
- **D-17:** state.json tracks progress via `current_unit` (0-indexed) and `total_units` fields. Skill increments `current_unit` after each PASS + commit. Also resets `iteration_count` to 0 for new unit.
- **D-18:** `iteration_count` in state.json tracks current unit's retry count. Incremented on each Coder spawn, reset on unit advancement.

### Claude's Discretion
- Coder agent template internal structure (prompt sections, code style instructions)
- Evaluator agent template internal structure (how it runs tests, which test commands to try)
- Exact algedonic flag format in agent output (as long as Skill can detect it)
- Git commit message format details beyond unit number inclusion
- Error message text and formatting
- Agent maxTurns values within reasonable range (5-15)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Patterns
- `CLAUDE.md` — Technology stack, Claude Code spawn workaround (Issue #771), known issues
- `.planning/REQUIREMENTS.md` — CODE-01 through CODE-04, RECOV-01 through RECOV-04 acceptance criteria
- `.planning/ROADMAP.md` §Phase 4 — Success criteria (5 conditions that must be TRUE)

### Existing Code
- `detent-tools.cjs` — CLI with spawn command (cmdSpawn), state-read/write, truth-propose/truth-freeze; new commands extend this
- `.claude/skills/detent-code/SKILL.md` — Current placeholder skill to be replaced with real Coder/Evaluator orchestration
- `.claude/skills/detent-plan/SKILL.md` — Reference for sequential agent orchestration pattern (D → G → H → J)
- `.claude/skills/_shared/rules.md` — Shared pipeline rules
- `.claude/agents/h-review.md` — Reference for verdict JSON pattern (verdict/reentry_stage/reason)
- `.claude/agents/j-compile.md` — Produces handoff.md that Coder consumes
- `.detent/playbooks/stage-playbook.md` — Quality standards (needs Coding stage section added)
- `.detent/playbooks/handoff-quality-bar.md` — Handoff document quality criteria

### Prior Phase Context
- `.planning/phases/01-state-infrastructure/01-CONTEXT.md` — CLI architecture, write-file-atomic pattern
- `.planning/phases/02-pipeline-skeleton/02-CONTEXT.md` — Subprocess spawning, gate architecture, father model pattern
- `.planning/phases/03-truth-surface-and-planning-agents/03-CONTEXT.md` — Truth surface mutation model, agent template design, planning orchestration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cmdSpawn()` in detent-tools.cjs — handles child_process.spawn with stream-json, stdio workaround, JSONL parsing. Directly usable for Coder/Evaluator spawning.
- `truth-propose` and `truth-freeze` CLI commands — exist and work. Need `--source code-contradiction` flag added to truth-freeze for maturity bypass.
- state.json already has `iteration_count` and `reentry_depth` fields (initialized to 0 in Phase 1).
- H-Review verdict JSON pattern (`h-review-verdict.json`) — template for Evaluator verdict format.
- `/detent:plan` SKILL.md — sequential agent orchestration pattern with retry loop. Direct reference for `/detent:code` rewrite.

### Established Patterns
- Father model: skill orchestrates via cmdSpawn, reads only routing fields (verdict/reentry), never full agent output
- Single-mutation-point: all .detent/ writes through detent-tools.cjs
- Agent I/O via files + @-references: agents read input files, write output files, skill doesn't relay content
- Gate check: config-read → check mode + gate enabled → AskUserQuestion if supervised

### Integration Points
- `/detent:code` SKILL.md — complete rewrite from placeholder to Coder/Evaluator orchestrator
- `detent-tools.cjs` — add `--source` flag to truth-freeze for code-contradiction bypass
- state.json schema — add `current_unit` and `total_units` fields (extend state-write)
- `.claude/agents/` — two new agent templates: coder.md, evaluator.md
- `.detent/playbooks/stage-playbook.md` — add Coding stage quality standards
- `.detent/code/` — directory for Evaluator verdict files

</code_context>

<specifics>
## Specific Ideas

- `truth-freeze --source code-contradiction` bypasses maturity check — empirical contradictions from code execution are self-evidencing. The flag must still require `rationale` field but skips `challenged_by` requirement.
- Evaluator JSON verdict extends naturally: normal = `{verdict, issues[]}`, reentry = adds `{reentry_requested: true, contradiction: "..."}`. Skill checks `reentry_requested` field existence for routing — minimal parsing, consistent with H-Review pattern.
- Coder/Evaluator loop mirrors the Planning retry loop: attempt → judge → retry or advance. The skill structure can follow /detent:plan's pattern closely, substituting agent types and verdict format.
- Algedonic vs Reentry distinction: algedonic = "halt, human must look" (frozen constraint violated); reentry = "planning was wrong, redo with new constraint" (planning-level contradiction found during coding). Both are detected by Evaluator but routed differently.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-coding-loop-and-recovery*
*Context gathered: 2026-04-06*
