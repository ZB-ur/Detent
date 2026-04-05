---
phase: 02-pipeline-skeleton
plan: "01"
subsystem: detent-tools
tags: [spawn, gates, pipeline, cli, tests]
dependency_graph:
  requires: [01-state-infrastructure]
  provides: [spawn-command, gates-config, shared-pipeline-rules]
  affects: [02-02-PLAN.md, all-pipeline-skills]
tech_stack:
  added: [child_process.spawn]
  patterns: [stdin-inherit-workaround, jsonl-line-buffer, gates-config-schema, shared-rules-file]
key_files:
  created:
    - .claude/skills/_shared/rules.md
  modified:
    - detent-tools.cjs
    - test/run-tests.js
decisions:
  - "cmdSpawn uses stdio=['inherit','pipe','pipe'] per CLAUDE.md Claude Code spawn workaround (issue #771)"
  - "gates defaults all enabled (plan/code/deploy) for safe supervised mode out of the box"
  - "spawn --target flag allows binary override for testing without requiring live Claude CLI"
  - "shared rules.md @-referenced by all pipeline skills to enforce single-mutation-point invariant"
metrics:
  duration: "9 minutes"
  completed: "2026-04-05T12:56:14Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 02 Plan 01: Spawn Command, Gates Config, and Shared Rules Summary

**One-liner:** Added subprocess spawn command with JSONL line-buffer (stdin:inherit workaround), gates config schema (plan/code/deploy all enabled), and shared pipeline rules file for all five skills.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add spawn command and gates config to detent-tools.cjs with tests | 488075a | detent-tools.cjs, test/run-tests.js |
| 2 | Create shared pipeline rules file | d85c8a8 | .claude/skills/_shared/rules.md |

## What Was Built

### Task 1: Spawn Command + Gates Config (TDD)

**RED:** Added T13-T17 to test/run-tests.js covering gates schema validation, full 5-stage pipeline transitions, spawn-without-prompt error, JSONL forwarding, and exit code propagation. 4 tests failed as expected (T13, T15, T16, T17).

**GREEN:** Implemented two changes in detent-tools.cjs:

1. `cmdSpawn(named)` function — spawns a subprocess with `stdio: ['inherit', 'pipe', 'pipe']` (critical workaround for Claude Code Node.js spawn hang, issue #771). Buffers stdout into JSONL lines, parses each as JSON, re-emits to stdout. `--target` flag overrides the binary (defaults to `claude`) enabling mock testing without live CLI. `--prompt` is required; exits 1 with error message if missing.

2. Gates config field added to `cmdSetup` — after `language: locale` in the config object, adds:
   ```javascript
   gates: {
     plan: { enabled: true, description: '...' },
     code: { enabled: true, description: '...' },
     deploy: { enabled: true, description: '...' },
   }
   ```
   All three gates enabled by default for safe supervised operation.

All 17 tests pass.

### Task 2: Shared Pipeline Rules File

Created `.claude/skills/_shared/rules.md` with three sections:

- **CRITICAL RULES** — 6 rules including the core invariant: never use Write tool on `.detent/` files, always read state at start, always write state at end of successful completion.
- **Gate Check Pattern** — 5-step procedure for gate evaluation: read config, check mode + gate.enabled, prompt user in supervised mode (proceed/revise/stop), auto-proceed in autonomous mode, safe default when gates field missing.
- **Skill Exit Pattern** — 3-step exit sequence: state-write, print summary, print next-step hint.

## Verification

- `node test/run-tests.js` — 17 tests, 0 failures
- `grep -c 'cmdSpawn' detent-tools.cjs` — returns 2 (definition + switch case)
- Gates field verified in config-read output for fresh setup
- `.claude/skills/_shared/rules.md` exists with all required sections

## Decisions Made

1. **stdin:inherit workaround** — `stdio: ['inherit', 'pipe', 'pipe']` per CLAUDE.md constraint and Claude Code issue #771. This prevents the subprocess hang when spawning from Node.js.

2. **All gates enabled by default** — safer for supervised mode; users can disable individually via `config-write`. Aligns with two-mode design (PIPE-03).

3. **--target override for testing** — allows `spawn --target node --prompt mock.js` in tests without requiring live `claude` CLI. Enables deterministic CI testing.

4. **Shared rules via @-reference** — `rules.md` will be loaded via `@.claude/skills/_shared/rules.md` in each pipeline skill's SKILL.md, avoiding duplication while keeping rules in one place.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `/Users/lddmay/AiCoding/Detent/detent-tools.cjs` — FOUND
- `/Users/lddmay/AiCoding/Detent/test/run-tests.js` — FOUND
- `/Users/lddmay/AiCoding/Detent/.claude/skills/_shared/rules.md` — FOUND
- Commit 488075a — FOUND
- Commit d85c8a8 — FOUND
