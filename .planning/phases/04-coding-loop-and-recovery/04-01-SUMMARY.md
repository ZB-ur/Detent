---
phase: 04-coding-loop-and-recovery
plan: "01"
subsystem: cli-extensions-and-agent-templates
tags: [cli, agents, coding-loop, integer-fields, algedonic, reentry]
dependency_graph:
  requires: [03-03]
  provides: [04-02]
  affects: [detent-tools.cjs, .claude/agents/]
tech_stack:
  added: []
  patterns: [bash-heredoc-for-detent-writes, bypassMaturity-conditional, intFields-null-coercion]
key_files:
  created:
    - .claude/agents/coder.md
    - .claude/agents/evaluator.md
  modified:
    - detent-tools.cjs
    - .detent/playbooks/stage-playbook.md
    - test/run-tests.js
decisions:
  - "total_units and current_unit added to intFields with null support — supports unit progress tracking in state.json"
  - "NaN guard added to parseInt for all intFields — invalid values exit 1 with descriptive error"
  - "truth-freeze --source code-contradiction bypasses challenged_by maturity check — enables empirical contradiction freeze without adversarial review cycle"
  - "Evaluator maxTurns set to 15 (not 10) — complex test suites need room to run"
  - "Evaluator has explicit Algedonic Signal Detection section — machine-parseable algedonic: true field required in verdict JSON"
  - "coder-manifest.json written via Bash heredoc not Write tool — maintains .detent/ write-via-CLI invariant"
metrics:
  duration: "3min"
  completed_date: "2026-04-06"
  tasks: 2
  files: 5
---

# Phase 4 Plan 01: CLI Extensions and Agent Templates Summary

CLI integer field extensions for unit tracking, truth-freeze bypass for empirical contradictions, Coder/Evaluator agent templates with explicit algedonic detection, Stage C playbook quality standards, and 18 new tests validating all primitives (69 total, 0 failures).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extend detent-tools.cjs: total_units intField, NaN guard, truth-freeze --source bypass | 247e4c9 | detent-tools.cjs |
| 2 | Create Coder/Evaluator agent templates, extend stage-playbook, add Phase 4 tests | bc1905d | 4 files |

## What Was Built

### Task 1: CLI Extensions (detent-tools.cjs)

Three changes to the CLI:

1. **intFields expansion**: `current_unit` moved from `nullFields` to `intFields`; `total_units` added. Both fields now support integer values (stored as numbers, not strings) and `null` (via `value === 'null'` branch). This enables unit progress tracking: `--current_unit 0` stores integer `0`, `--current_unit null` resets to `null`.

2. **NaN guard**: `parseInt(value, 10)` result now checked with `isNaN(parsed)`. Invalid values (e.g., `--total_units abc`) exit 1 with `Error: Invalid integer value "abc" for field "total_units"`.

3. **truth-freeze --source code-contradiction bypass**: When `named.source === 'code-contradiction'`, the `challenged_by` maturity check is skipped. This allows the Coding stage to freeze empirical contradictions directly (without going through the D/G/H adversarial review cycle first). The `bypassMaturity` variable gates the check cleanly.

### Task 2: Agent Templates and Playbook

**coder.md** (`.claude/agents/coder.md`):
- Tools: `Read, Bash, Write` — Write is allowed for source files outside `.detent/`
- Explicit CRITICAL RULE: NEVER use Write inside `.detent/` — all `.detent/` writes via `detent-tools.cjs`
- Input: reads `.detent/plan/handoff.md` first; skill provides unit number in prompt
- Output: writes `coder-manifest.json` via Bash heredoc (`cat > .detent/code/coder-manifest.json << 'EOF'`)

**evaluator.md** (`.claude/agents/evaluator.md`):
- Tools: `Read, Bash` — no Write tool
- maxTurns: 15 (not 10 — complex test suites need room)
- Explicit **Algedonic Signal Detection** section: reads truth surface, checks each FROZEN entry, requires `algedonic: true` in JSON if any FROZEN constraint is violated
- Reentry detection: distinguishes planning-level contradictions (reentry) from coding bugs (FAIL + retry)
- Verdict schema always includes `algedonic` and `reentry_requested` fields (never omit)

**stage-playbook.md** extended with `## Stage C: Coding` section:
- 7 quality rules including algedonic-in-JSON requirement and reentry-vs-fail distinction

**test/run-tests.js** extended with 18 new tests (T52-T69):
- Agent template structure validation (T52-T62)
- CLI integer field tests including NaN guard and null coercion (T63-T66)
- truth-freeze bypass tests (T67-T68)
- Stage playbook check (T69)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files exist:
- `/Users/lddmay/AiCoding/Detent/.claude/agents/coder.md` — FOUND
- `/Users/lddmay/AiCoding/Detent/.claude/agents/evaluator.md` — FOUND
- `/Users/lddmay/AiCoding/Detent/.detent/playbooks/stage-playbook.md` — FOUND (extended)
- `/Users/lddmay/AiCoding/Detent/test/run-tests.js` — FOUND (extended, 69 tests)
- `/Users/lddmay/AiCoding/Detent/detent-tools.cjs` — FOUND (modified)

### Commits exist:
- 247e4c9 — FOUND (feat(04-01): extend CLI)
- bc1905d — FOUND (feat(04-01): add Coder/Evaluator)

### Tests: 69 passed, 0 failed

## Self-Check: PASSED
