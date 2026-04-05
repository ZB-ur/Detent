---
phase: 03-truth-surface-and-planning-agents
plan: "03"
subsystem: orchestration
tags: [skill, agent, spawn, truth-surface, adversarial-planning, sequential-orchestration]

# Dependency graph
requires:
  - phase: 03-01
    provides: detent-tools.cjs truth-propose/truth-freeze/truth-read/truth-update commands
  - phase: 03-02
    provides: D-Critique, G-Red, G-Blue, H-Review, J-Compile agent templates with playbooks
provides:
  - Sequential agent orchestration skill for D -> G-Red -> G-Blue -> H -> J pipeline
  - Output validation after each agent spawn (missing/empty/truncated detection)
  - Supervised-mode truth-freeze gate between G-Blue and H-Review
  - H-Review rejection routing with reentry_depth limit and human escalation
  - Structure tests T37-T47 validating agent templates and skill files
affects: [03, detent-plan, detent-setup, testing, future-pipeline-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Father model pattern: orchestrating skill reads only H-Review verdict JSON, never agent content"
    - "Output validation after each spawn: checks file exists + non-empty + expected structural marker"
    - "Reentry ID collision prevention: -RN suffix on truth-propose IDs during retry iterations"
    - "Progress indicators: [detent:plan] Stage N/5: Dispatching <agent>... before each spawn"
    - "Dual-entry state guard: skill accepts both discovery and planning pipeline_stage"

key-files:
  created:
    - .planning/phases/03-truth-surface-and-planning-agents/03-03-SUMMARY.md
  modified:
    - .claude/skills/detent-plan/SKILL.md
    - .claude/skills/detent-setup/SKILL.md
    - test/run-tests.js

key-decisions:
  - "Father model pattern applied: /detent:plan reads only h-review-verdict.json for routing, never agent content files"
  - "Output validation catches truncated agent outputs before they corrupt downstream agents (maxTurns guard)"
  - "Supervised truth-freeze gate placed between G-Blue and H-Review per D-02 design decision"
  - "Reentry uses -RN ID suffix to prevent truth-propose ID collisions across retry iterations"

patterns-established:
  - "Pattern: validate agent output files after every spawn (exists + non-empty + structural marker)"
  - "Pattern: emit progress indicator [skill:name] Stage N/total: Dispatching <agent>... before each spawn"
  - "Pattern: father model -- orchestrating skill only reads the verdict/decision file from the subagent chain"
  - "Pattern: dual-entry guard accepts both prior stage and current stage pipeline_stage values"

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 3 Plan 03: Planning Skill Orchestrator Summary

**Sequential adversarial agent orchestrator (D -> G-Red -> G-Blue -> H -> J) with per-spawn output validation, supervised truth-freeze gate, reentry loop with depth limit, and 11 new structure tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T15:34:32Z
- **Completed:** 2026-04-05T15:37:26Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- Complete rewrite of `/detent:plan` SKILL.md from placeholder to full sequential orchestrator spawning all 5 agents in the correct order
- Output validation after each agent spawn catches truncated files (maxTurns guard) before they corrupt downstream agents
- Supervised-mode truth-freeze gate after G-Blue with AskUserQuestion per D-02; auto-freeze in autonomous mode
- H-Review rejection routing to reentry_stage (D or G) with reentry_depth limit (max 2) and human escalation
- Added 11 new structure tests (T37-T47) validating agent templates, skill files, tool constraints, and output validation presence
- All 47 tests pass including existing 36 + new 11

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite /detent:plan SKILL.md as sequential agent orchestrator** - `4ec2815` (feat)
2. **Task 2: Update /detent:setup skill and add structure tests** - `028e018` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `.claude/skills/detent-plan/SKILL.md` - Complete rewrite: sequential orchestrator spawning D/G-Red/G-Blue/H/J, output validation, truth-freeze gate, retry loop
- `.claude/skills/detent-setup/SKILL.md` - Updated Step 5 summary to include `.detent/playbooks/` and truth surface files; added verification step
- `test/run-tests.js` - Added T37-T47 structure tests for agent templates, skill content, and output validation presence

## Decisions Made

- Father model pattern applied: `/detent:plan` reads only `h-review-verdict.json` for routing, never agent content files -- preserves clean separation between orchestrator and agent output
- Output validation catches truncated agent outputs before they corrupt downstream agents -- maxTurns can truncate heredoc writes, leaving empty or incomplete files
- Supervised truth-freeze gate placed between G-Blue and H-Review per D-02 -- after the debate but before the verdict, so H-Review sees frozen (immutable) constraints
- Reentry uses `-RN` ID suffix to prevent truth-propose ID collisions across retry iterations -- prior PROPOSED entries remain in the surface as superseded history

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03 complete: truth surface CLI (Plan 01), agent templates (Plan 02), and planning skill orchestrator (Plan 03) all delivered
- 47/47 tests pass
- `/detent:plan` is ready for end-to-end integration testing once a live Claude Code session is available
- Remaining open question from research: `@` file references may not expand in `--prompt` strings passed to `claude -p` (Pitfall 3, MEDIUM confidence) -- skill includes fallback note, validation in live testing required

---
*Phase: 03-truth-surface-and-planning-agents*
*Completed: 2026-04-05*

## Self-Check: PASSED
