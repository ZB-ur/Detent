---
phase: 03-truth-surface-and-planning-agents
plan: 01
subsystem: cli
tags: [truth-surface, constraint-ledger, immutability, cli, node, write-file-atomic]

requires:
  - phase: 02-pipeline-skeleton
    provides: detent-tools.cjs CLI with setup, state-read/write, config-read/write, spawn commands

provides:
  - truth-propose CLI command — creates PROPOSED entries with full TRUTH-03 schema in truth surface .md files
  - truth-freeze CLI command — enforces maturity gate (challenged_by required) and immutability (FROZEN entries rejected)
  - truth-read CLI command — outputs truth surface file contents to stdout
  - truth-update CLI command — sets challenged_by field on PROPOSED entries (prerequisite for freezing)
  - setup creates .detent/playbooks/ directory and initializes frozen-decisions.md, constraint-ledger.md, domain-model.md with structural headers
  - 13 new tests (T24-T36) covering all truth surface commands and TRUTH-03 constraint-ledger entry schema

affects:
  - 03-02 (planning agents that will call truth-propose and truth-freeze)
  - 03-03 (skill orchestrator that coordinates truth surface usage)
  - all future phases using truth surface as constraint propagation mechanism

tech-stack:
  added: []
  patterns:
    - "Truth surface entries use Markdown + fenced YAML blocks — human-readable, CLI-parseable, git-diffable"
    - "Maturity gate pattern: truth-update sets challenged_by before truth-freeze is allowed — prevents premature freezing"
    - "FROZEN immutability enforced at CLI level: exit 1 on any write attempt to FROZEN entry"
    - "TRUTH-03 schema: every entry has retained_goal and discarded_options fields for constraint rationale traceability"
    - "Truth surface files auto-initialized by setup with structural headers — idempotent on re-run"
    - "Entry section parsing via indexOf('## id') + indexOf('\\n## ') — avoids regex complexity for multi-entry files"

key-files:
  created:
    - detent-tools.cjs (functions cmdTruthPropose, cmdTruthFreeze, cmdTruthRead, cmdTruthUpdate, truthFilePath helper)
    - test/run-tests.js (tests T24-T36 for truth surface commands)
  modified:
    - detent-tools.cjs (cmdSetup extended with playbooks/ dir + truth surface file initialization; cmdUsage extended)

key-decisions:
  - "retained_goal and discarded_options fields always present in every entry (empty string default) — schema consistency across all truth surface file types (TRUTH-03)"
  - "truth-update exposes challenged_by mutation as separate subcommand — decouples challenge tracking from freeze, allows agents to mark entries challenged without freezing"
  - "Entry section parsed via indexOf boundaries not regex — handles multi-entry files correctly without complex regex"
  - "Truth surface files only initialized by setup if missing — idempotent, preserves existing content on re-setup"

patterns-established:
  - "Truth surface mutation flow: truth-propose → truth-update (set challenged_by) → truth-freeze (immutable)"
  - "CLI single-mutation-point invariant: all truth surface writes go through detent-tools.cjs, never direct file writes from agent prompts"

requirements-completed:
  - TRUTH-01
  - TRUTH-02
  - TRUTH-03

duration: 25min
completed: 2026-04-05
---

# Phase 3 Plan 01: Truth Surface CLI Commands Summary

**Three truth surface commands (truth-propose, truth-freeze, truth-read) plus truth-update helper added to detent-tools.cjs, enforcing maturity-gated immutability and TRUTH-03 constraint-ledger entry schema with retained_goal and discarded_options fields**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-05T14:15:00Z
- **Completed:** 2026-04-05T14:40:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added truth-propose with full TRUTH-03 entry schema (id, status, source_agent, challenged_by, frozen_at, retained_goal, discarded_options) — every field present in every entry for schema consistency
- Added truth-freeze with dual guards: maturity gate (challenged_by != null required) and immutability gate (FROZEN entry rejected with exit 1)
- Added truth-read and truth-update (sets challenged_by field) completing the 4-command truth surface mutation interface
- Extended cmdSetup to create .detent/playbooks/ and initialize truth surface .md files with structural headers (idempotent)
- 36 total tests pass: 23 existing + 13 new (T24-T36 covering all truth surface commands, TRUTH-03 schema, duplicate ID rejection, maturity gate, immutability gate)

## Task Commits

1. **Task 1: truth-propose, truth-freeze, truth-read, truth-update + tests** - `4f8efee` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD flow — tests written first (RED: 13 failing), then implementation (GREEN: 36/36 passing)_

## Files Created/Modified

- `detent-tools.cjs` - Added cmdTruthPropose, cmdTruthFreeze, cmdTruthRead, cmdTruthUpdate functions; extended cmdSetup with playbooks/ dir and truth surface file initialization; extended cmdUsage with full option documentation
- `test/run-tests.js` - Added T24-T36 covering truth surface commands, TRUTH-03 schema validation, maturity gate, immutability gate, setup directory creation

## Decisions Made

- retained_goal and discarded_options always present in every entry (empty string default) — schema consistency means constraint-ledger entries look the same as frozen-decision entries, reducing parser complexity in downstream agents
- truth-update exposed as public subcommand rather than internal helper — agents need a way to mark entries as challenged without freezing, and this separates the challenge action from the freeze action cleanly
- Entry section parsed via indexOf boundaries (## id header to next ## header) rather than regex — correctly handles multi-entry files with no complex regex escaping needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — baseline tests passed at 23/23 before implementation. After adding new tests (RED: 13 failures), implementation brought all tests to 36/36 passing (GREEN).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Truth surface CLI is complete — agents in phase 03-02 can call truth-propose, truth-update, truth-freeze, and truth-read directly via detent-tools.cjs
- .detent/playbooks/ directory ready for agent playbook templates (phase 03-02)
- Truth surface .md files initialized with structural headers (frozen-decisions.md, constraint-ledger.md, domain-model.md)
- TRUTH-01, TRUTH-02, TRUTH-03 requirements fulfilled

---
*Phase: 03-truth-surface-and-planning-agents*
*Completed: 2026-04-05*
