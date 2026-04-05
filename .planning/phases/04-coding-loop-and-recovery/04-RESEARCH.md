# Phase 4: Coding Loop and Recovery - Research

**Researched:** 2026-04-06
**Domain:** Claude Code agent orchestration, adversarial loop control, cross-stage reentry, algedonic signaling
**Confidence:** HIGH

## Summary

Phase 4 implements the Coder/Evaluator adversarial loop that turns the J-Compile handoff into committed code. The core mechanism mirrors the existing `/detent:plan` retry loop — spawn an agent, parse its structured JSON output for routing, retry or advance — but operates at the unit level instead of the pipeline level. The skill orchestrates two new agents (`coder.md`, `evaluator.md`) in a tight loop: Coder executes one unit, Evaluator runs the test suite and returns a machine-parseable verdict, the skill routes on `verdict` and `reentry_requested` fields.

Two novel mechanisms extend beyond the planning loop: (1) cross-stage reentry, where the Evaluator can signal a planning-level contradiction that causes the skill to inject a new frozen constraint via `truth-freeze --source code-contradiction` (bypassing the `challenged_by` maturity check) and restart `/detent:plan`; and (2) algedonic escalation, where any frozen-constraint violation immediately halts the pipeline and surfaces the issue to the human via `AskUserQuestion`. The reentry depth limit (max 2) mirrors the planning retry cap already tracked in `state.json`.

All implementation changes are additive extensions to existing patterns: `cmdStateWrite` needs `total_units` added to its int field set; `cmdTruthFreeze` needs a `--source code-contradiction` bypass flag; the `/detent:code` skill needs a complete rewrite from placeholder to real orchestrator; two agent templates need to be created; and a Coding stage section needs to be added to `stage-playbook.md`. No existing commands need modification beyond these targeted additions.

**Primary recommendation:** Implement in five ordered units: (1) CLI extensions (`total_units` field + `truth-freeze --source` bypass), (2) Coder agent template, (3) Evaluator agent template, (4) `/detent:code` skill rewrite, (5) playbook addition + unit tests.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Coder Agent Input Model**
- D-01: Coder agent template uses `@.detent/plan/handoff.md` file reference for full handoff context. Skill sends only `--prompt "执行 UNIT-XX"` via cmdSpawn. Coder self-locates the unit, understands dependencies, and executes.
- D-02: Rationale: consistent with father model (skill doesn't parse handoff content), preserves inter-unit context (UNIT-02's interface visible when coding UNIT-03), handoff.md is J-Compile's compressed output so context window cost is acceptable.

**Evaluator Agent Design**
- D-03: Evaluator outputs structured JSON: `{verdict: "PASS"|"FAIL", issues: [{file, line, expected, got}]}`. Machine-parseable, consistent with H-Review verdict pattern.
- D-04: Evaluator validates by running the project's test suite via Bash (node test/, npm test, etc.). Objective, repeatable verification. Not code review or static analysis.
- D-05: Evaluator agent template uses `@.detent/plan/handoff.md` for acceptance criteria reference + reads Coder's output files.

**Iteration Control**
- D-06: Maximum 5 iterations per unit. On FAIL, Coder receives exact Evaluator JSON feedback and retries.
- D-07: After 5 failures: pipeline halts, displays last Evaluator feedback, user decides next step (fix manually / skip unit / trigger reentry). No automatic reentry on iteration exhaustion.

**Cross-Stage Reentry**
- D-08: Only Evaluator can trigger reentry — single trigger point. Coder only codes, doesn't judge planning quality.
- D-09: All reentry rolls back to D-Critique (fixed target). New constraint gets full adversarial review (D → G-Red → G-Blue → H → J).
- D-10: Evaluator expresses reentry via JSON verdict extension: `{verdict: "FAIL", reentry_requested: true, contradiction: "description of planning-level contradiction"}`. Skill parses JSON for routing — consistent with father model.
- D-11: Skill injects contradiction as frozen constraint BEFORE restarting planning: calls `truth-propose` then `truth-freeze --source code-contradiction`. The `--source code-contradiction` flag bypasses maturity check (challenged_by requirement) because empirical contradictions from code execution are self-evidencing — they don't need adversarial validation.
- D-12: Reentry depth limit: max 2 rollbacks per pipeline run (consistent with RECOV-04). On depth breach, escalate to human instead of another rollback.

**Algedonic Signal**
- D-13: Trigger condition: frozen constraint violated by agent output. This is the core guardian of constraint propagation.
- D-14: Routing: Skill checks agent output for algedonic flag, immediately halts pipeline, surfaces contradiction to human via AskUserQuestion — bypasses all normal gate logic.
- D-15: Algedonic signal is distinct from reentry: reentry = "planning was wrong, redo it"; algedonic = "something is fundamentally broken, human must intervene."

**Unit Progression & State**
- D-16: Each unit PASS triggers immediate git commit with message containing unit number (e.g., `feat(detent): UNIT-03 — [description]`). Atomic commits enable fine-grained rollback.
- D-17: state.json tracks progress via `current_unit` (0-indexed) and `total_units` fields. Skill increments `current_unit` after each PASS + commit. Also resets `iteration_count` to 0 for new unit.
- D-18: `iteration_count` in state.json tracks current unit's retry count. Incremented on each Coder spawn, reset on unit advancement.

### Claude's Discretion
- Coder agent template internal structure (prompt sections, code style instructions)
- Evaluator agent template internal structure (how it runs tests, which test commands to try)
- Exact algedonic flag format in agent output (as long as Skill can detect it)
- Git commit message format details beyond unit number inclusion
- Error message text and formatting
- Agent maxTurns values within reasonable range (5-15)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CODE-01 | Coder agent executes one implementation unit at a time, producing complete runnable code | D-01, D-02: Coder self-locates unit from handoff.md via @-reference; skill sends unit ID only |
| CODE-02 | Evaluator agent tests each unit via structured criteria and returns PASS/FAIL with specific technical feedback (`[file:line] expected X, got Y`) | D-03, D-04, D-05: Evaluator outputs `{verdict, issues[{file,line,expected,got}]}` JSON, validates via test suite |
| CODE-03 | On FAIL, Coder receives Evaluator feedback and retries (max 5 iterations per unit) | D-06, D-07: iteration_count in state.json tracks retries; 5-failure halt with user decision gate |
| CODE-04 | On PASS, unit is git committed and pipeline advances to next unit | D-16, D-17, D-18: git commit with unit number, state-write increments current_unit, resets iteration_count |
| RECOV-01 | Algedonic signal: any agent can flag a critical contradiction that bypasses normal flow and escalates to human | D-13, D-14, D-15: algedonic flag in agent output detected by skill, triggers AskUserQuestion halt |
| RECOV-02 | Cross-stage reentry: Evaluator or Verification stage can trigger rollback to a specific Planning substage | D-08, D-09, D-10: Evaluator-only trigger, always rolls back to D-Critique |
| RECOV-03 | Reentry carries the specific contradiction as a new frozen constraint, preventing the same error from recurring | D-11: truth-propose + truth-freeze --source code-contradiction before restarting planning |
| RECOV-04 | Reentry depth limit (max 2 rollbacks per pipeline run) with escalation to human on breach | D-12: reentry_depth already tracked in state.json; check before executing rollback |
</phase_requirements>

---

## Standard Stack

### Core (all pre-existing, no new installs)
| Library/Tool | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Node.js + child_process | 22 LTS | cmdSpawn already wraps Claude subprocess | Established in Phase 2 |
| `write-file-atomic` | 7.0.0 | All .detent/ JSON writes | Single external dep in detent-tools.cjs |
| `claude -p --output-format stream-json --dangerously-skip-permissions` | system-installed | Spawn Coder and Evaluator agents | Established in Phase 2; Issue #771 workaround (stdio: ['inherit','pipe','pipe']) already implemented |
| `git` CLI | system-installed | Atomic commits per unit PASS | Available in every dev environment; no Node.js lib needed |

### No New Dependencies
Phase 4 adds no npm dependencies. All mechanics (agent spawning, state mutation, truth surface writes, JSON output parsing) reuse Phase 1–3 infrastructure.

**Installation:**
```bash
# No new packages required
```

**Version verification:** All packages already installed and verified in Phases 1–3.

---

## Architecture Patterns

### Pattern 1: Coder/Evaluator Loop (mirrors /detent:plan retry loop)

The coding loop is structurally identical to the planning retry loop in `/detent:plan`, with different agent types and verdict schema.

**Planning loop (reference):**
```
loop up to 3 times:
  spawn D-Critique → spawn G-Red → spawn G-Blue → truth-freeze gate → spawn H-Review
  read h-review-verdict.json
  if approved: spawn J-Compile → exit loop
  if rejected: increment reentry_depth, restart loop
```

**Coding loop (new, same structure):**
```
loop over units (current_unit..total_units):
  loop up to 5 times (iteration_count):
    spawn Coder with "执行 UNIT-XX"
    spawn Evaluator
    read .detent/code/evaluator-verdict.json
    if algedonic: halt, AskUserQuestion
    if reentry_requested: truth-propose + truth-freeze --source code-contradiction, restart planning
    if verdict == PASS: git commit, increment current_unit, reset iteration_count, break inner loop
    if verdict == FAIL: increment iteration_count, continue inner loop
  if 5 failures: AskUserQuestion (fix manually / skip / trigger reentry)
```

**What:** Nested loop — outer iterates units, inner retries single unit up to 5 times.
**When to use:** Always — this is the single execution path for the coding stage.

### Pattern 2: Father Model — Skill reads only verdict JSON, never agent content

Established in Phase 3 for H-Review. Evaluator follows the same pattern:

```
# Evaluator writes to .detent/code/evaluator-verdict.json
# Skill reads ONLY that file for routing
cat .detent/code/evaluator-verdict.json
# Parse: verdict, issues[], reentry_requested, contradiction, algedonic
```

The skill NEVER reads Coder's implementation files. The Evaluator reads them, runs tests, and surfaces findings as structured JSON.

### Pattern 3: truth-freeze --source code-contradiction (new bypass flag)

The existing `cmdTruthFreeze` enforces `challenged_by != null` maturity check. Empirical contradictions from code execution are self-evidencing — they don't need adversarial challenge because the test suite itself is the challenger.

The `--source code-contradiction` flag bypasses the `challenged_by` check:

```bash
# Normal freeze (requires maturity): 
node ./detent-tools.cjs truth-freeze --dir . --id CONSTRAINT-R1 --file constraint-ledger

# Bypass freeze for code-contradiction:
node ./detent-tools.cjs truth-freeze --dir . --id CONSTRAINT-R1 --file constraint-ledger --source code-contradiction
```

Implementation: in `cmdTruthFreeze`, check `if (named.source === 'code-contradiction') { skip challengedBy check }`.

### Pattern 4: Reentry Sequence (D-11)

When Evaluator signals `reentry_requested: true`:

```bash
# 1. Check reentry_depth — escalate to human if >= 2
node ./detent-tools.cjs state-read --dir .

# 2. Propose the contradiction as a new constraint
node ./detent-tools.cjs truth-propose --dir . --id CONSTRAINT-CODE-R<N> --file constraint-ledger \
  --source-agent evaluator --rationale "<contradiction text>" \
  --retained-goal "<what the code revealed is actually needed>"

# 3. Freeze immediately (bypassing maturity check)
node ./detent-tools.cjs truth-freeze --dir . --id CONSTRAINT-CODE-R<N> --file constraint-ledger \
  --source code-contradiction

# 4. Increment reentry_depth
node ./detent-tools.cjs state-write --dir . --reentry_depth <N+1>

# 5. Reset pipeline stage to planning entry point
node ./detent-tools.cjs state-write --dir . --pipeline_stage discovery

# 6. Clear plan artifacts
rm -rf .detent/plan && mkdir -p .detent/plan

# 7. Notify user / invoke /detent:plan
```

Note on step 5: `/detent:plan` accepts `pipeline_stage: "discovery"` or `"planning"` as entry states. Rolling back to `"discovery"` (rather than `"planning"`) ensures D-Critique starts fresh with the new constraint visible.

### Pattern 5: state.json total_units field (new)

`total_units` is needed so the outer unit loop knows when to stop. It is set once when the skill starts, by parsing `handoff.md` for `## UNIT-XX:` headings.

```bash
# Count units in handoff (skill does this at start of coding loop)
grep -c '^### UNIT-' .detent/plan/handoff.md
```

Then write to state:
```bash
node ./detent-tools.cjs state-write --dir . --total_units 5 --current_unit 0
```

`state-write` needs `total_units` added to `intFields` set. `current_unit` is already handled as a `nullFields` entry — it needs to also accept integer values (change to `intFields` or handle both).

### Recommended Project Structure (new files this phase)

```
detent-tools.cjs           # modify: total_units intField, truth-freeze --source bypass
.claude/agents/
├── coder.md               # NEW: Coder agent template
└── evaluator.md           # NEW: Evaluator agent template
.claude/skills/
└── detent-code/SKILL.md   # REWRITE: full Coder/Evaluator orchestrator
.detent/playbooks/
└── stage-playbook.md      # EXTEND: add Coding stage section
.detent/code/              # runtime artifact directory (created by skill at start)
└── evaluator-verdict.json # runtime output from Evaluator agent
test/run-tests.js          # EXTEND: add Phase 4 unit tests (T52+)
```

### Anti-Patterns to Avoid

- **Skill parsing Coder implementation files:** Father model requires the skill read only `evaluator-verdict.json`. Skill must not inspect generated source files directly.
- **Coder agent receiving prose feedback:** The skill must pass the raw Evaluator JSON issues array back to the Coder, not a prose summary. Machine-to-machine feedback preserves precision.
- **Auto-reentry on iteration exhaustion:** D-07 explicitly prohibits automatic reentry when 5 iterations fail. Human must decide. Only the Evaluator's explicit `reentry_requested` field triggers the cross-stage mechanism.
- **Algedonic treated as reentry:** These are separate paths. Algedonic = immediate halt + human. Reentry = inject constraint + restart planning. The skill must check for `algedonic` flag before checking `reentry_requested`.
- **Writing to .detent/ via Write tool:** All .detent/ writes go through `detent-tools.cjs`. The coding skill, like all skills, uses only Read, Bash, AskUserQuestion.
- **Hardcoded absolute paths:** Use `node ./detent-tools.cjs` (relative), consistent with all Phase 1–3 patterns.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent subprocess management | Custom spawn wrapper | Existing `cmdSpawn()` in detent-tools.cjs | Already handles stdio workaround (Issue #771), stream-json parsing, --agent flag, exit code propagation |
| State persistence between iterations | In-memory variables | `state-write/state-read` CLI commands | State must survive /clear boundaries; in-memory state is lost |
| Truth surface mutation | Direct file writes | `truth-propose` + `truth-freeze` CLI commands | Ensures atomic writes, maturity checks, ID collision prevention |
| JSON output routing | Manual string parsing | `JSON.parse()` on known verdict schema | Consistent with H-Review pattern; structured output is machine-parseable |
| Git operations | Custom git library | `git add -A && git commit -m "..."` via Bash | No Node.js git library needed; CLI is sufficient; keeps deps minimal |
| Unit count parsing | Custom handoff parser | `grep -c '^### UNIT-'` on handoff.md | Handoff format is defined by J-Compile template; grep on known heading format is reliable |

**Key insight:** Every novel mechanism in Phase 4 (iteration loop, reentry, algedonic) is a routing decision made by the skill based on JSON fields from agent output. The complexity is in the routing logic, not in new infrastructure.

---

## Common Pitfalls

### Pitfall 1: current_unit vs total_units integer type mismatch
**What goes wrong:** `state-write` handles `current_unit` via `nullFields` set (accepts the string "null"), not `intFields` (converts to integer). Writing `--current_unit 0` may store the string "0" instead of integer 0.
**Why it happens:** Phase 1 designed `current_unit` as a nullable field (null = not yet started). Phase 4 uses it as a 0-indexed integer counter.
**How to avoid:** In `cmdStateWrite`, move `current_unit` and add `total_units` to the `intFields` set. Keep null handling: if value === 'null', store null; otherwise parseInt.
**Warning signs:** `JSON.parse(state).current_unit + 1` returns "01" (string concat) instead of 1.

### Pitfall 2: Evaluator verdict file not cleared between units
**What goes wrong:** If Evaluator fails to write `evaluator-verdict.json` (e.g., maxTurns exhausted), the skill reads the stale verdict from the previous unit's run and incorrectly concludes PASS.
**Why it happens:** File persists across iterations/units; validation only checks existence, not freshness.
**How to avoid:** Before each Evaluator spawn, delete the previous verdict: `rm -f .detent/code/evaluator-verdict.json`. After spawn, validate the file exists AND is newer than spawn start time (or simply delete-before-spawn pattern, consistent with Phase 3's `rm -rf .detent/plan` before retry).
**Warning signs:** Pipeline marks a unit PASS immediately without Evaluator running any tests.

### Pitfall 3: @-reference expansion in spawn prompts
**What goes wrong:** `@.detent/plan/handoff.md` in a `--prompt` string may not expand inside Claude Code subprocess. This was flagged as a known issue in `/detent:plan` SKILL.md.
**Why it happens:** Claude Code's `@` file reference expansion applies to interactive session context, not `--prompt` argument strings.
**How to avoid:** The existing SKILL.md note says: "if agents report they cannot find the referenced files, read the file contents via Bash and embed them directly." For Coder/Evaluator, use the same approach — embed handoff.md content in prompt if @-reference fails. **However**, the current planning agents DO use @-references and worked in UAT. Monitor during Phase 4 UAT. Agent template instructions should tell the agent to read the file explicitly as a fallback.
**Warning signs:** Coder agent asks "where is the handoff file?" or completes a unit that doesn't match any unit in handoff.md.

### Pitfall 4: reentry_depth not reset after successful coding stage
**What goes wrong:** If reentry_depth reaches 1 during coding and the next planning + coding run succeeds, reentry_depth remains 1. The next pipeline run starts with 1 depth already consumed.
**Why it happens:** `/detent:plan` resets `reentry_depth` to 0 after successful planning completion (existing behavior). But `/detent:code` triggers re-entry by calling `/detent:plan` implicitly — the depth is incremented, then the entire plan runs, then code runs again. On success of the full coding loop, reentry_depth should be reset.
**How to avoid:** At successful completion of `/detent:code` (all units PASS), write `reentry_depth 0` to state. This mirrors `/detent:plan`'s reset on successful completion.
**Warning signs:** A fresh pipeline run starts with `reentry_depth > 0`.

### Pitfall 5: Algedonic signal buried in long agent output
**What goes wrong:** Coder or Evaluator output is long. Skill checks only the verdict JSON file for routing. If the algedonic flag is embedded in prose output (not the verdict file), the skill misses it.
**Why it happens:** Unclear contract about where algedonic flag is expressed.
**How to avoid:** Algedonic flag MUST be in the evaluator-verdict.json file (or a dedicated `.detent/code/algedonic-signal.json` file), not in prose. The skill ONLY reads the verdict file. The Evaluator agent template must be explicit: "if a frozen constraint is violated, set `algedonic: true` in your verdict JSON, do not just describe it in prose."
**Warning signs:** Human reviews Evaluator output and sees a frozen constraint violation described in prose, but pipeline continued.

### Pitfall 6: Git commit failing on untracked files
**What goes wrong:** `git add -A && git commit` fails if there are untracked files the skill didn't expect (e.g., test output files, .DS_Store).
**Why it happens:** `git add -A` stages everything including generated artifacts.
**How to avoid:** Use `git add <specific files from unit's Files list>` rather than `git add -A`. The Evaluator knows which files were created (Coder's output). Alternatively, verify .gitignore covers generated artifacts. The Coder agent template should log which files it created so the skill can pass exact paths to `git add`.
**Warning signs:** Git commit fails with "nothing to commit" (wrong path) or includes unwanted files.

---

## Code Examples

### Evaluator verdict JSON schema (from decisions D-03, D-10)

Standard PASS verdict:
```json
{
  "verdict": "PASS",
  "issues": []
}
```

FAIL with feedback:
```json
{
  "verdict": "FAIL",
  "issues": [
    {"file": "detent-tools.cjs", "line": 219, "expected": "intFields contains total_units", "got": "total_units not in intFields set"}
  ]
}
```

FAIL with reentry request (D-10):
```json
{
  "verdict": "FAIL",
  "reentry_requested": true,
  "contradiction": "handoff.md specifies UNIT-03 modifies state-write to accept total_units as integer, but state-write cmdStateWrite intFields set was never updated in UNIT-01 — UNIT-01 acceptance criteria missed this field",
  "issues": [
    {"file": "detent-tools.cjs", "line": 219, "expected": "intFields.has('total_units') === true", "got": "intFields only contains iteration_count and reentry_depth"}
  ]
}
```

FAIL with algedonic signal:
```json
{
  "verdict": "FAIL",
  "algedonic": true,
  "contradiction": "FROZEN constraint DECISION-001 (CJS module format required) is violated: UNIT-02 created detent-tools.mjs using ESM syntax",
  "issues": [
    {"file": "detent-tools.mjs", "line": 1, "expected": "'use strict'; (CJS)", "got": "import { writeFileAtomicSync } from ...  (ESM — violates DECISION-001)"}
  ]
}
```

### truth-freeze --source code-contradiction (new CLI invocation)
```bash
# Source: detent-tools.cjs cmdTruthFreeze (to be extended)
node ./detent-tools.cjs truth-freeze --dir . --id CONSTRAINT-CODE-R1 \
  --file constraint-ledger \
  --source code-contradiction
# Skips challenged_by maturity check because empirical contradiction is self-evidencing
```

### state-write with total_units (new field)
```bash
# Source: detent-tools.cjs cmdStateWrite (intFields extension)
node ./detent-tools.cjs state-write --dir . --total_units 5 --current_unit 0 --iteration_count 0
```

### /detent:code unit loop skeleton (SKILL.md pattern)
```
# Step N: Initialize coding state
COUNT=$(grep -c '^### UNIT-' .detent/plan/handoff.md)
node ./detent-tools.cjs state-write --dir . --total_units $COUNT --current_unit 0 --iteration_count 0

# Step N+1: Outer unit loop
CURRENT=$(node ./detent-tools.cjs state-read --dir . | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).current_unit))")
TOTAL=$(node ./detent-tools.cjs state-read --dir . | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).total_units))")

# while CURRENT < TOTAL: execute iteration loop for UNIT-$(CURRENT+1 zero-padded)
```

### Evaluator output write pattern (agent template, Bash heredoc)
```bash
# Evaluator agent writes verdict via Bash heredoc (same pattern as H-Review)
cat > .detent/code/evaluator-verdict.json << 'EOF'
{
  "verdict": "PASS",
  "issues": []
}
EOF
```

### Skill verdict routing (father model, consistent with /detent:plan)
```bash
# Read verdict JSON (ONLY file the skill reads from agent output)
cat .detent/code/evaluator-verdict.json
# Skill: JSON.parse, check .algedonic first, then .reentry_requested, then .verdict
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder /detent:code (creates units.md stub, no agents) | Real Coder/Evaluator orchestrator with retry loop | Phase 4 | Skill becomes the primary coding execution path |
| truth-freeze requires challenged_by (maturity check) | truth-freeze accepts --source code-contradiction to bypass maturity check | Phase 4 | Empirical contradictions from tests can be frozen immediately |
| state.json has current_unit (null) but no total_units | state.json tracks both current_unit (0-indexed int) and total_units (int) | Phase 4 | Outer unit loop can terminate correctly |
| state.json schema_version: 1 | Remains schema_version: 1 (additive field, backwards compatible) | Phase 4 | No migration needed; new fields initialized at coding stage start |

**Not deprecated:**
- Everything from Phases 1–3 is reused directly. No removals.

---

## Open Questions

1. **Coder agent writing files via Bash heredoc vs Write tool**
   - What we know: All planning agents use `tools: Read, Bash` (no Write). This enforces single-mutation-point for .detent/ files.
   - What's unclear: Coder agent must write source code files (not .detent/ files). Should it use the Write tool or Bash heredoc? Write tool is more reliable for large files; Bash heredoc has length limits. The no-Write restriction was specifically about .detent/ mutation, not all files.
   - Recommendation: Coder agent should have `tools: Read, Bash, Write` — but the Write restriction in rules.md applies only to `.detent/` files. The agent template should explicitly state: "Use Write for source files; never use Write on .detent/ files." Claude's Discretion per CONTEXT.md section.

2. **@-reference expansion reliability (carry-forward from Phase 3)**
   - What we know: Phase 3 UAT passed with @-references in spawn prompts. SKILL.md includes a fallback note.
   - What's unclear: Whether @-reference in `--prompt "执行 UNIT-03, see @.detent/plan/handoff.md"` expands reliably.
   - Recommendation: Design Coder/Evaluator agent templates to read handoff.md explicitly via Bash (`cat .detent/plan/handoff.md`) as their first step, rather than relying on @-expansion. This is more reliable and consistent with explicit file reading.

3. **Git working directory for commit**
   - What we know: `cmdSpawn` sets `cwd: targetDir`. The coding skill runs in the project root.
   - What's unclear: Whether git commit is invoked inside the skill (after evaluator-verdict.json is read) or inside the Coder agent. The skill has Bash access; git operations in the skill are cleaner and more auditable.
   - Recommendation: Git commit happens in the skill, not in any agent. Skill reads Evaluator verdict → PASS → `git add [files] && git commit -m "feat(detent): UNIT-XX — [description]"` via Bash. Files list comes from handoff.md unit definition (skill parses it for the specific unit's Files field).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | detent-tools.cjs | ✓ | 22 LTS | — |
| `claude` CLI | cmdSpawn (Coder/Evaluator agents) | ✓ | system-installed | --target flag for testing |
| `git` | Atomic commit per unit PASS | ✓ | system-installed | — |
| `write-file-atomic` npm | detent-tools.cjs | ✓ | 7.0.0 (Phase 1) | — |
| `grep` | Unit count from handoff.md | ✓ | system (POSIX) | Node.js fs.readFileSync + regex |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in assert + custom runner |
| Config file | none — `test/run-tests.js` is self-contained |
| Quick run command | `node test/run-tests.js` |
| Full suite command | `node test/run-tests.js` (same; no separate slow/fast split for unit tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CODE-01 | coder.md agent file exists in .claude/agents/ | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-01 | coder.md has tools: Read, Bash, Write | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-01 | coder.md contains handoff.md reference | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-01 | coder.md does NOT have Write on .detent/ | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-02 | evaluator.md agent file exists in .claude/agents/ | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-02 | evaluator.md has tools: Read, Bash (no Write) | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-02 | evaluator.md references evaluator-verdict.json | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-03 | /detent:code SKILL.md contains iteration_count logic | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-03 | /detent:code SKILL.md contains max 5 iteration guard | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-04 | /detent:code SKILL.md contains git commit with unit number | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-04 | state-write accepts total_units as integer | unit | `node test/run-tests.js` | ❌ Wave 0 |
| CODE-04 | state-write accepts current_unit as integer (not only null) | unit | `node test/run-tests.js` | ❌ Wave 0 |
| RECOV-01 | /detent:code SKILL.md checks algedonic field before reentry | unit | `node test/run-tests.js` | ❌ Wave 0 |
| RECOV-01 | /detent:code SKILL.md contains AskUserQuestion for algedonic | unit | `node test/run-tests.js` | ❌ Wave 0 |
| RECOV-02 | /detent:code SKILL.md contains reentry_requested routing | unit | `node test/run-tests.js` | ❌ Wave 0 |
| RECOV-03 | truth-freeze accepts --source code-contradiction flag | unit | `node test/run-tests.js` | ❌ Wave 0 |
| RECOV-03 | truth-freeze --source code-contradiction bypasses challenged_by check | unit | `node test/run-tests.js` | ❌ Wave 0 |
| RECOV-04 | /detent:code SKILL.md checks reentry_depth before triggering rollback | unit | `node test/run-tests.js` | ❌ Wave 0 |
| RECOV-04 | /detent:code SKILL.md escalates to human when reentry_depth >= 2 | unit | `node test/run-tests.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node test/run-tests.js`
- **Per wave merge:** `node test/run-tests.js` (all tests must pass)
- **Phase gate:** Full suite green (51 existing + new Phase 4 tests) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/run-tests.js` — extend with T52–T70 (Phase 4 assertions listed above)
- [ ] `.claude/agents/coder.md` — create Coder agent template
- [ ] `.claude/agents/evaluator.md` — create Evaluator agent template

*(Note: test file already exists at `test/run-tests.js` — extend, do not replace. All 51 existing tests must continue to pass.)*

---

## Implementation Units (Recommended Order)

The planner should use this ordering to avoid forward dependencies:

1. **CLI extensions** — Add `total_units` to `cmdStateWrite` intFields; add `--source code-contradiction` bypass to `cmdTruthFreeze`. Unit tests for both changes. This must be first — all subsequent units depend on these CLI primitives.

2. **Coder agent template** (`.claude/agents/coder.md`) — Reads handoff.md, executes a single unit, writes source files using Write tool, reports which files were created. Unit tests: file existence, tools frontmatter.

3. **Evaluator agent template** (`.claude/agents/evaluator.md`) — Reads handoff.md acceptance criteria, reads Coder's files, runs test suite, writes `evaluator-verdict.json` via Bash heredoc. Unit tests: file existence, verdict JSON reference, no Write in tools.

4. **/detent:code SKILL.md rewrite** — Complete replacement of placeholder. Implements: state read/validate, unit count parsing, outer/inner loops, Coder spawn, Evaluator spawn, verdict routing (algedonic → reentry → PASS/FAIL), git commit, state advancement, 5-failure gate, reentry depth check. Unit tests: SKILL.md content assertions for all routing paths.

5. **Playbook extension + test coverage** — Add Coding stage section to `stage-playbook.md`. Run `node test/run-tests.js` to confirm all tests pass (51 existing + new Phase 4 tests).

---

## Sources

### Primary (HIGH confidence)
- `/Users/lddmay/AiCoding/Detent/.planning/phases/04-coding-loop-and-recovery/04-CONTEXT.md` — All locked decisions (D-01 through D-18), canonical code references
- `/Users/lddmay/AiCoding/Detent/detent-tools.cjs` — Full CLI implementation; `cmdStateWrite` intFields/nullFields, `cmdTruthFreeze` maturity check logic, `cmdSpawn` implementation
- `/Users/lddmay/AiCoding/Detent/.claude/skills/detent-plan/SKILL.md` — Reference orchestration pattern (father model, retry loop, output validation)
- `/Users/lddmay/AiCoding/Detent/.claude/agents/h-review.md` — Verdict JSON pattern reference for Evaluator design
- `/Users/lddmay/AiCoding/Detent/.claude/agents/j-compile.md` — Handoff.md format (UNIT-XX structure that Coder/Evaluator consume)
- `/Users/lddmay/AiCoding/Detent/test/run-tests.js` — Full test suite (51 tests passing); test patterns for Phase 4 additions

### Secondary (MEDIUM confidence)
- `/Users/lddmay/AiCoding/Detent/.planning/STATE.md` — Phase 3 UAT learnings: agents must be mandated (not optional) to call CLI commands; @-reference reliability in spawn prompts is uncertain

### Tertiary (LOW confidence)
- None — all findings grounded in existing codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all reuses existing Phase 1–3 infrastructure, no new dependencies
- Architecture patterns: HIGH — coding loop mirrors planning loop which was UAT-validated; verdict JSON pattern is proven; state management is established
- Pitfalls: HIGH for integer type issues (grounded in actual cmdStateWrite code); MEDIUM for @-reference issue (observed in Phase 3 but worked around successfully)
- CLI extension design: HIGH — `cmdTruthFreeze` maturity check code is directly readable; bypass is a single conditional

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable codebase; no fast-moving external dependencies)
