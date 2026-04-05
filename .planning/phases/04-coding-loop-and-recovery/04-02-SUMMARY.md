---
phase: 04-coding-loop-and-recovery
plan: "02"
subsystem: coding-skill-orchestrator
tags: [skill, orchestrator, coding-loop, reentry, algedonic, crash-recovery, verdict-routing]
dependency_graph:
  requires: [04-01]
  provides: [04-03-or-next]
  affects: [.claude/skills/detent-code/SKILL.md, test/run-tests.js]
tech_stack:
  added: []
  patterns: [father-model, verdict-routing-order, crash-safe-state-write, manifest-based-git-commit, verdict-parse-guard]
key_files:
  created: []
  modified:
    - .claude/skills/detent-code/SKILL.md
    - test/run-tests.js
decisions:
  - "Verdict routing order: algedonic > reentry > PASS > FAIL -- algedonic is catastrophic halt, must be checked before reentry to prevent misrouting frozen-constraint violations as planning errors"
  - "State-write before git commit on PASS path -- crash-safe ordering: if crash between state-write and git commit, re-invocation skips to next unit and the un-committed code remains in working tree"
  - "iteration_count incremented BEFORE Coder spawn -- crash mid-spawn counts as an attempt, prevents infinite retry on broken agents"
  - "Resume detection accepts both 'planning' (fresh) and 'coding' (resume) pipeline_stage -- dual-entry mirrors /detent:plan pattern"
  - "rm -rf .detent/code only on fresh starts -- preserve existing artifacts when resuming from crash"
metrics:
  duration: "5min"
  completed_date: "2026-04-06"
  tasks: 2
  files: 2
---

# Phase 4 Plan 02: Coding Skill Orchestrator Summary

Complete rewrite of /detent:code SKILL.md from placeholder to full Coder/Evaluator adversarial loop orchestrator with nested unit/iteration loops, verdict routing (algedonic > reentry > PASS > FAIL), crash-safe state ordering, manifest-based git commits, parse guard for invalid verdict JSON, and 13 new tests (82 total, 0 failures).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Rewrite /detent:code SKILL.md as Coder/Evaluator orchestrator | 08166b2 | .claude/skills/detent-code/SKILL.md |
| 2 | Add 13 SKILL.md content tests for orchestrator (T70-T82) | ea63d04 | test/run-tests.js |

## What Was Built

### Task 1: /detent:code SKILL.md Complete Rewrite

The placeholder implementation (4 steps, no agents) was replaced with a full orchestrator (10 steps):

**Step 1: Resume Detection** -- Accepts both `"planning"` (fresh start from /detent:plan) and `"coding"` (resume after crash/clear). On resume, prints `[detent:code] Resuming from UNIT-XX iteration N.` and jumps directly to the outer unit loop using existing state values.

**Step 2: Gate Check** -- Follows exact /detent:plan gate pattern: config-read, check mode + gate enabled, AskUserQuestion if supervised.

**Step 3: Workspace Preparation** -- `rm -rf .detent/code && mkdir -p .detent/code` on fresh starts only. Skipped on resume to preserve existing artifacts.

**Step 4: Unit Counting** -- `grep -c '^### UNIT-'` on handoff.md. Fail-fast if count is 0 with descriptive error. Sequential numbering warning if first unit is not UNIT-01.

**Steps 5-8: Nested Loop** -- Outer loop iterates units (0-indexed `current_unit < total_units`). Inner loop iterates attempts (`iteration_count < 5`). Per iteration:
- Clear stale `evaluator-verdict.json` and `coder-manifest.json`
- Increment `iteration_count` BEFORE spawn (crash-safe)
- Spawn Coder with unit ID; on retry, embed previous verdict issues in prompt
- Validate `coder-manifest.json` (non-empty check)
- Spawn Evaluator with unit ID and manifest reference
- Validate `evaluator-verdict.json` with parse guard (missing/invalid JSON → synthetic FAIL)

**Step 7: Verdict Routing (father model)** -- Reads only `evaluator-verdict.json`, never agent output directly:
- **7a Algedonic** (`algedonic: true`): immediate halt, AskUserQuestion with contradiction + issues
- **7b Reentry** (`reentry_requested: true`): depth check (>= 2 → human escalation), then truth-propose + truth-freeze --source code-contradiction, reset pipeline_stage to discovery
- **7c PASS**: state-write FIRST (crash-safe), then extract files from `coder-manifest.json`, git add specific files, git commit with unit ID
- **7d FAIL**: print issues, continue inner loop

**Step 8: Iteration Exhaustion** -- After 5 failures: AskUserQuestion with last verdict, options: retry/skip/stop.

**Step 9: Completion** -- Reset reentry_depth to 0, print summary, hint `/detent:verify`.

### Task 2: 13 New Tests (T70-T82)

Tests validate all critical routing paths in the SKILL.md:

| Test | What It Validates |
|------|-------------------|
| T70 | spawn --dir . --agent coder present |
| T71 | spawn --dir . --agent evaluator present |
| T72 | evaluator-verdict.json referenced |
| T73 | algedonic index < reentry_requested index (D-15 order) |
| T74 | truth-freeze AND code-contradiction present |
| T75 | reentry_depth AND >= 2 present |
| T76 | VALIDATION FAILED present (output validation) |
| T77 | git commit AND UNIT- present |
| T78 | 5 iterations/failed after 5 AND AskUserQuestion |
| T79 | all spawn lines contain --agent |
| T80 | rm -f .detent/code/evaluator-verdict.json present |
| T81 | Resuming/resume AND "coding" pipeline_stage |
| T82 | files_created/files_modified AND no git add -A AND no git add . |

## Deviations from Plan

**1. [Rule 1 - Bug] Removed `git add -A` string from comment text**
- **Found during:** Task 1 acceptance criteria check
- **Issue:** The acceptance criteria for SKILL.md required `git add -A` to NOT appear in the file, but the plan's own action text included it as a comment explaining what NOT to do: `(NOT git add -A)`
- **Fix:** Replaced comment with `(no blanket staging)` to satisfy the test without losing the documentation intent
- **Files modified:** .claude/skills/detent-code/SKILL.md

## Self-Check

### Files exist:
- `/Users/lddmay/AiCoding/Detent/.claude/skills/detent-code/SKILL.md` -- FOUND (316 lines, complete orchestrator)
- `/Users/lddmay/AiCoding/Detent/test/run-tests.js` -- FOUND (extended, 82 tests)

### Commits exist:
- 08166b2 -- FOUND (feat(04-02): rewrite /detent:code as Coder/Evaluator orchestrator)
- ea63d04 -- FOUND (test(04-02): add 13 SKILL.md content tests for /detent:code orchestrator)

### Tests: 82 passed, 0 failed

## Self-Check: PASSED
