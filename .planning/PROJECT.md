# Detent

## What This Is

Detent is a control-theory-based harness framework for multi-agent orchestration in Claude Code. It provides a structured pipeline (Discovery → Planning → Coding → Verification → Achieve) that constrains AI agents through a persistent truth surface, enabling high-autonomy execution for simple tasks and human-gated supervision for complex ones. The framework is designed for solo developers who want reliable, quality-controlled AI-assisted software development.

## Core Value

Constraint propagation through a truth surface that ensures every agent decision aligns with frozen requirements — the mechanism that turns chaotic multi-agent output into reliable software delivery.

## Requirements

### Validated

- [x] CLI tool (detent-tools.cjs) as single point for all state mutations — Validated in Phase 1-2
- [x] Truth surface persistence (.detent/truth-surface/) with constraint ledger and frozen decisions — Validated in Phase 3
- [x] State management (.detent/state.json) with session continuity across /clear boundaries — Validated in Phase 1
- [x] Config system (.detent/config.json) with mode and pipeline toggles — Validated in Phase 1
- [x] Agent prompt templates for Planning stages (D-Critique, G-Red/Blue, H-Review, J-Compile) — Validated in Phase 3
- [x] Playbook migration from ECL (stage-playbook, subagent-protocol, handoff-quality-bar) — Validated in Phase 3
- [x] Agent prompt templates for Coding stage (Coder, Evaluator) — Validated in Phase 4
- [x] Coding-Evaluator iteration loop with max iteration limit — Validated in Phase 4
- [x] Reentry mechanism for cross-stage rollback when planning-level contradictions surface during coding — Validated in Phase 4
- [x] Algedonic signal system for urgent escalation to human — Validated in Phase 4

### Active

- [ ] 5 workflow skills: /detent:setup, /detent:discovery, /detent:plan, /detent:code, /detent:verify, /detent:achieve
- [ ] Web UI Layer 1: pipeline configuration (repo-level, one-time setup)
- [ ] Web UI Layer 2: runtime dashboard with real-time monitoring of multiple parallel pipelines
- [ ] Process management: spawn/monitor Claude Code instances via stream-json + file watch dual channel

### Out of Scope

- Claude API direct integration — user has Claude Code subscription only, no API key
- Replacing GSD — Detent is a separate framework with different goals (control-theory harness vs project management)
- Multi-user collaboration — designed for solo developer workflow
- Custom LLM provider support — Claude Code only for M1/M2, Web UI may expand later

## Context

- **Theoretical foundation:** Beer's Viable System Model (VSM), specifically System 3* (audit/algedonic) and recursion theorem
- **Engineering reference:** GSD framework patterns (skill/agent/CLI/state architecture, session boundary management)
- **Semantic reference:** ECL framework (constraint ledger, stage A-J planning pipeline, truth surface concept)
- **Evaluator design:** Anthropic's SWE-bench research — coding↔evaluator adversarial loop with specific, technical feedback
- **User environment:** macOS, Claude Code CLI with Opus 4.6 (1M context), Gemini CLI 0.35.3 available locally
- **Language:** User prefers Chinese (zh-CN) for all output and documentation

## Constraints

- **Runtime:** Claude Code subscription only (no API key) — all agent orchestration via CLI subprocess with `-p --output-format stream-json --dangerously-skip-permissions`
- **Logging:** Must not intrude on core agent prompts — behavior logs generated asynchronously via Gemini CLI hook from stream-json + file artifacts
- **Architecture:** CLI tool as single source of truth for state mutations (following GSD pattern) — prevents race conditions
- **Session boundary:** Each skill = one Claude Code session, state bridged via .harness/ files across /clear boundaries
- **Context budget:** Full pipeline (Discovery→Achieve) cannot fit in one session — must be split across skills with file-based state persistence

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GSD's skill/agent/CLI architecture pattern | Battle-tested over 130 versions, fits Claude Code's native capabilities | — Pending |
| Gemini CLI for async log generation | Zero intrusion on core agent prompt, cost-effective, available locally | — Pending |
| Two-mode design (autonomous/supervised) | Simple tasks need no human intervention, complex tasks need gates — same pipeline, different gate behavior | — Pending |
| File system as state bridge between sessions | Claude Code sessions are ephemeral, .harness/ directory survives /clear | — Pending |
| stream-json + file watch dual channel for Web UI | stream-json for real-time progress, file watch for persistent state/artifacts | — Pending |
| Project name: Detent | Mechanical catch that holds state until released — maps to gate control in the pipeline | — Pending |
| Three milestones: M1 Engine → M2 Agents → M3 Web UI | M1 delivers usable CLI first, M2 adds quality loop, M3 adds visualization — each milestone is independently valuable | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after Phase 3 completion — truth surface CLI, agent templates, and planning orchestrator all verified*
