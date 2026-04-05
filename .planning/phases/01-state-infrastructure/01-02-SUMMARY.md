---
phase: 01-state-infrastructure
plan: "02"
subsystem: infra
tags: [claude-code, skill, setup, AskUserQuestion, detent-setup]

# Dependency graph
requires:
  - detent-tools.cjs CLI (01-01) — setup/config-read/state-read commands
provides:
  - /detent:setup skill invocable in Claude Code
  - 4-question configuration wizard via AskUserQuestion
  - prerequisite guard (detent-tools.cjs + write-file-atomic presence check)
  - reinitialize guard (AskUserQuestion if .detent/ already exists)
  - single-mutation-point enforcement (Write excluded from allowed-tools)
affects: [02-pipeline-skeleton, 03-planning-agents]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Claude Code skill YAML frontmatter (name, description, allowed-tools)
    - AskUserQuestion for interactive config collection
    - Skill delegates all file writes to CLI tool (never uses Write on .detent/)
    - Prerequisite check pattern (ls + node -e require) before proceeding

key-files:
  created:
    - .claude/skills/detent-setup/SKILL.md
  modified: []

key-decisions:
  - "Write excluded from skill allowed-tools — enforces single-mutation-point invariant at the Claude Code tool permission level"
  - "node ./detent-tools.cjs (relative path) — avoids hardcoded absolute paths that break on other machines"
  - "Separate AskUserQuestion call per config question — clearer UX than bundling all questions"

requirements-completed: [ENG-04]

# Metrics
duration: 7min
completed: 2026-04-05
---

# Phase 01 Plan 02: /detent:setup Skill Summary

**Claude Code skill that walks users through 4 configuration questions via AskUserQuestion and initializes .detent/ by delegating all file writes to detent-tools.cjs — Write tool excluded from allowed-tools to enforce single-mutation-point invariant**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-04T20:10:21Z
- **Completed:** 2026-04-05T03:10:31Z
- **Tasks:** 2 (Task 1: create skill; Task 2: checkpoint auto-approved)
- **Files modified:** 1 (.claude/skills/detent-setup/SKILL.md)

## Accomplishments

- `.claude/skills/detent-setup/SKILL.md` (158 lines) with complete frontmatter and instructions
- Frontmatter: `name: detent-setup`, `allowed-tools: [Read, Bash, AskUserQuestion]` — Write intentionally excluded
- 5-step setup flow: prerequisite checks → reinitialize guard → 4 config questions → setup command → verify+summarize
- All config questions use `AskUserQuestion` with explicit allowed values and defaults
- CRITICAL RULES section included verbatim: never Write to `.detent/`, stop on non-zero exit, validate input

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /detent:setup skill** - `dc4fdf6` (feat)
2. **Task 2: Checkpoint** - auto-approved (no commit needed)

## Files Created/Modified

- `.claude/skills/detent-setup/SKILL.md` — Skill definition: frontmatter with name/description/allowed-tools, 5-step setup wizard instructions, CRITICAL RULES block, prerequisite checks, 4 AskUserQuestion config questions, detent-tools.cjs invocation, verify+summarize step

## Decisions Made

- **Write excluded from allowed-tools:** The skill permission boundary enforces the single-mutation-point invariant at the Claude Code level — a skill cannot accidentally write to `.detent/` even if the author forgets the rule
- **Relative path `./detent-tools.cjs`:** Pitfall 3 from RESEARCH.md — hardcoded absolute paths break on other machines; relative path assumes skill runs in the repo root
- **Separate AskUserQuestion per question:** Each config question gets its own `AskUserQuestion` call; bundling would obscure which question received invalid input

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None for skill creation. To use the skill after setup:
- Run `/detent:setup` in a repo that has `detent-tools.cjs` and `node_modules/write-file-atomic`
- Answer 4 configuration questions
- Verify `.detent/` was created with correct structure

## Next Phase Readiness

- `/detent:setup` skill is the user-facing entry point for the Detent framework
- Phase 01 (state-infrastructure) is now complete — both plans executed
- Phase 02 can build pipeline skeleton skills that assume `.detent/` exists and was initialized by `/detent:setup`

## Known Stubs

None — the skill is fully wired to `detent-tools.cjs` commands. No hardcoded empty values or placeholders.

## Self-Check: PASSED

All created files verified present. All task commits verified in git history.

---
*Phase: 01-state-infrastructure*
*Completed: 2026-04-05*
