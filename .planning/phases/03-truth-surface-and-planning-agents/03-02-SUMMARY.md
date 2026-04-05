---
phase: 03-truth-surface-and-planning-agents
plan: "02"
subsystem: agent-templates
tags: [agents, playbooks, adversarial-planning, truth-surface]
dependency_graph:
  requires: []
  provides:
    - ".claude/agents/d-critique.md"
    - ".claude/agents/g-red.md"
    - ".claude/agents/g-blue.md"
    - ".claude/agents/h-review.md"
    - ".claude/agents/j-compile.md"
    - ".detent/playbooks/stage-playbook.md"
    - ".detent/playbooks/subagent-protocol.md"
    - ".detent/playbooks/handoff-quality-bar.md"
  affects:
    - ".claude/skills/detent-plan/SKILL.md"
tech_stack:
  added: []
  patterns:
    - "Claude Code .claude/agents/*.md native agent template format"
    - "Bash heredoc for all .detent/ writes — no Write tool on any agent"
    - "@ reference mechanism for playbooks in agent prompts"
key_files:
  created:
    - ".claude/agents/d-critique.md"
    - ".claude/agents/g-red.md"
    - ".claude/agents/g-blue.md"
    - ".claude/agents/h-review.md"
    - ".claude/agents/j-compile.md"
    - ".detent/playbooks/stage-playbook.md"
    - ".detent/playbooks/subagent-protocol.md"
    - ".detent/playbooks/handoff-quality-bar.md"
  modified: []
decisions:
  - "All five agents use Read+Bash only (no Write tool) — enforces single-mutation-point invariant from shared rules"
  - "H-Review verdict is machine-parseable JSON with exactly three fields: verdict, reentry_stage, reason"
  - "Playbook content migrated from ECL principles without direct copy per D-14"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-05"
  tasks_completed: 2
  files_created: 8
---

# Phase 03 Plan 02: Agent Templates and Playbooks Summary

Five Claude Code adversarial planning agent templates (D-Critique, G-Red, G-Blue, H-Review, J-Compile) and three playbook files with ECL-migrated quality standards — all wired to use Bash heredoc for .detent/ writes with no Write tool on any agent.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create five agent template files | 5518878 | d-critique.md, g-red.md, g-blue.md, h-review.md, j-compile.md |
| 2 | Create three playbook files | 1e6a7f7 | stage-playbook.md, subagent-protocol.md, handoff-quality-bar.md |

## What Was Built

### Agent Templates (`.claude/agents/`)

Five agent templates define the adversarial planning pipeline stages:

- **d-critique.md** — Attacks requirements against the truth surface; uses `truth-propose` CLI for mutations; writes structured critique to `.detent/plan/d-critique-output.md`; references both subagent-protocol and stage-playbook
- **g-red.md** — Adversarial attacker on D-Critique output; must disagree with at least one point; uses `truth-update` to mark challenged entries; writes to `.detent/plan/g-red-output.md`
- **g-blue.md** — Adversarial defender against G-Red attacks; acknowledges valid criticism; proposes mitigations; writes to `.detent/plan/g-blue-output.md`
- **h-review.md** — Binary coding-readiness judge; writes machine-parseable JSON verdict to `.detent/plan/h-review-verdict.json` via Bash heredoc; verdict has exactly three fields: `verdict`, `reentry_stage`, `reason`
- **j-compile.md** — Final stage; synthesizes debate into executable code handoff; writes to `.detent/plan/handoff.md`

All five agents:
- Have `tools: Read, Bash` (no Write tool — enforces shared rules single-mutation-point invariant)
- Have `model: inherit`
- Reference at least one playbook via `@` path
- Contain explicit "Do NOT use the Write tool" instruction
- Write output files via Bash heredoc

### Playbooks (`.detent/playbooks/`)

Three playbook files with quality standards:

- **stage-playbook.md** — Quality standards per pipeline stage (D/G/H/J); general principles; stage-specific behavioral requirements
- **subagent-protocol.md** — Agent identity, truth surface CLI commands, output rules, constraints; includes TRUTH-03 schema (retained-goal + discarded-options); explicit Bash-only write rule
- **handoff-quality-bar.md** — Required sections and implementation unit requirements for J-Compile output; quality checklist; rejection triggers for H-Review

## Decisions Made

1. **All five agents use Read+Bash only (no Write tool)** — Enforces the single-mutation-point invariant from `_shared/rules.md`. D-06 was clarified: J-Compile was originally noted as needing Write for the handoff document, but the shared rules prohibit Write on `.detent/` entirely, so Bash heredoc is used for all agents consistently.

2. **H-Review verdict is machine-parseable JSON with exactly three fields** — `verdict` (string: "approved"/"rejected"), `reentry_stage` (string "D"/"G" or null), `reason` (string). Explicitly templated in the agent body so the skill can parse it via `JSON.parse()` without ambiguity.

3. **Playbook content migrated from ECL principles without direct copy (per D-14)** — Reimplemented using Detent's architecture, CLI command syntax, and file conventions. ECL structure preserved conceptually.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] D-06 tool assignment clarification**
- **Found during:** Task 1
- **Issue:** D-06 in CONTEXT.md noted "J-Compile: Read + Write for handoff document" as a example, but the plan's action spec and shared rules clearly prohibit Write on `.detent/` files
- **Fix:** Applied Bash heredoc for J-Compile output (consistent with all other agents) per the plan's acceptance criteria and shared rules
- **Files modified:** `.claude/agents/j-compile.md`
- **Commit:** 5518878

## Known Stubs

None — all agent templates have complete, wired content. Playbooks have complete quality standards. No placeholder text or TODO items.

## Self-Check: PASSED

All 8 created files exist. Both task commits (5518878, 1e6a7f7) verified in git log.
