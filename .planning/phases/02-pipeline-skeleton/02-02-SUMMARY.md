---
phase: 02-pipeline-skeleton
plan: "02"
subsystem: pipeline-skills
tags: [skills, pipeline, state-machine, gates, discovery, plan, code, verify, achieve]
dependency_graph:
  requires:
    - 02-01 (detent-tools.cjs spawn command, gates config in config.json, shared rules.md)
  provides:
    - Five pipeline SKILL.md files: /detent:discovery, /detent:plan, /detent:code, /detent:verify, /detent:achieve
    - Complete end-to-end pipeline skeleton: idle -> discovery -> planning -> coding -> verification -> achieve
    - Gate check pattern implemented in plan/code/achieve skills
    - Stage-mismatch entry guards in all 5 skills (PIPE-01, PIPE-04 enforced)
  affects:
    - Phase 3+ (agent templates will replace placeholder artifacts in these skill files)
    - Phase 4+ (real Coder/Evaluator agents replace placeholder code/verify/achieve work)
tech_stack:
  added: []
  patterns:
    - Skill @-reference pattern: @.claude/skills/_shared/rules.md at top of every pipeline SKILL.md
    - Dual-entry state guard: /detent:discovery accepts idle OR discovery (intentional re-run support)
    - Gate check pattern: config-read -> check mode + gates.<name>.enabled -> AskUserQuestion if supervised
    - Bash heredoc for .detent/ artifact creation (avoids Write tool prohibition on .detent/ files)
    - Stage-mismatch error pattern: "Pipeline stage is <actual>, but /detent:<skill> expects <state>. Run /detent:<correct> instead."
key_files:
  created:
    - .claude/skills/detent-discovery/SKILL.md
    - .claude/skills/detent-plan/SKILL.md
    - .claude/skills/detent-code/SKILL.md
    - .claude/skills/detent-verify/SKILL.md
    - .claude/skills/detent-achieve/SKILL.md
  modified:
    - test/run-tests.js (added T18-T23 skill structure validation tests)
decisions:
  - "AskUserQuestion included in allowed-tools for all 5 skills (even ungated) -- config can add gates at any stage without frontmatter changes"
  - "/detent:discovery accepts both idle and discovery as entry states -- dual-entry intentional for re-run support, documented in skill"
  - "Code gate placed AFTER artifact creation, BEFORE state-write -- user reviews actual generated content before it is committed to pipeline"
  - "Plan gate placed AFTER Step 1 validation, BEFORE main planning work -- highest leverage point for human review"
  - "Deploy gate placed BEFORE final artifact creation -- irreversible operations require explicit approval in supervised mode"
metrics:
  duration: "2min"
  completed: "2026-04-05"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 02: Pipeline Workflow Skills Summary

Five pipeline SKILL.md files created with state-machine entry guards, gate checks, placeholder artifacts, and exit hints -- complete end-to-end skeleton from idle through achieve.

## What Was Built

### Task 1: Five Pipeline Workflow Skills

All five pipeline stage skills created in `.claude/skills/`:

| Skill | Entry State | Gate | Exit State | Artifact |
|-------|-------------|------|------------|----------|
| /detent:discovery | idle OR discovery | none | discovery | .detent/discovery/domain-model.md |
| /detent:plan | discovery | plan gate (before work) | planning | .detent/plan/handoff.md |
| /detent:code | planning | code gate (after artifact, before write) | coding | .detent/code/units.md |
| /detent:verify | coding | none | verification | .detent/verify/report.md |
| /detent:achieve | verification | deploy gate (before artifact) | achieve | .detent/achieve/summary.md |

Each skill:
- Opens with `@.claude/skills/_shared/rules.md` @-reference
- Has a Step 1 that runs `node ./detent-tools.cjs state-read --dir .` and validates entry state
- Contains a stage-mismatch error pattern with "expects" keyword (enforces PIPE-01 ordering, PIPE-04 session continuity)
- Creates a placeholder artifact via Bash heredoc (Write tool prohibition on .detent/ honored)
- Closes with `node ./detent-tools.cjs state-write --dir . --pipeline_stage <exit_state>` and a next-step hint

### Task 2: Skill Structure Validation Tests (T18-T23)

Six tests added to `test/run-tests.js`:

- **T18:** All 5 pipeline skill files exist at expected paths
- **T19:** Every skill @-references shared rules
- **T20:** Every skill contains state-read and state-write commands
- **T21:** Only plan/code/achieve skills contain gate checks (discovery and verify do not)
- **T22:** Every skill frontmatter includes AskUserQuestion in allowed-tools
- **T23:** Every skill contains a stage-mismatch entry guard with "expects" keyword

Test result: **23/23 pass, 0 failures**

## Commits

| Hash | Message |
|------|---------|
| 0aeec39 | feat(02-02): create all five pipeline workflow skills |
| a0cbeab | test(02-02): add skill structure validation tests T18-T23 |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

All five pipeline skills are intentional placeholder implementations:

| File | Stub | Reason |
|------|------|--------|
| .claude/skills/detent-discovery/SKILL.md | domain-model.md contains "Placeholder -- real domain model generated by Discovery agent in Phase 3+" | Phase 3+ adds D-Critique, G-Red/Blue, H-Review, J-Compile agent templates |
| .claude/skills/detent-plan/SKILL.md | handoff.md contains "Placeholder -- real handoff document generated by J-Compile agent in Phase 3+" | Phase 3+ implements real J-Compile planning pipeline |
| .claude/skills/detent-code/SKILL.md | units.md contains "Placeholder -- real units generated by Coder agent in Phase 4+" | Phase 4+ implements Coder/Evaluator iteration loop |
| .claude/skills/detent-verify/SKILL.md | report.md contains "Placeholder -- real report generated by Evaluator agent in Phase 4+" | Phase 4+ implements adversarial Evaluator loop |
| .claude/skills/detent-achieve/SKILL.md | summary.md contains "Placeholder -- real summary generated in Phase 4+" | Phase 4+ implements merge/deploy mechanics |

These stubs are intentional -- the goal of Phase 02 is to prove the state machine and gate architecture work correctly before adding agent complexity (per plan objective). Future phases will replace each stub with real agent invocations.

## Self-Check: PASSED

Files exist:
- .claude/skills/detent-discovery/SKILL.md: FOUND
- .claude/skills/detent-plan/SKILL.md: FOUND
- .claude/skills/detent-code/SKILL.md: FOUND
- .claude/skills/detent-verify/SKILL.md: FOUND
- .claude/skills/detent-achieve/SKILL.md: FOUND

Commits exist:
- 0aeec39: FOUND
- a0cbeab: FOUND

Tests: 23/23 pass
