# Detent

A control-theory-based harness framework for multi-agent orchestration in Claude Code.

**Detent** (n.) — A mechanical catch that holds something in a specific position until released by force. In engineering, detents are the precise gate mechanisms that ensure state transitions happen only when conditions are met.

## Core Concepts

- **Truth Surface** — Frozen constraints that propagate through the entire pipeline
- **Feedback Loops** — Coding-Evaluator iteration with algedonic signals
- **Gate Control** — Stage transitions governed by independent agent verdicts
- **Reentry** — Cross-stage rollback when planning-level contradictions surface during coding

## Architecture

```
Discovery → Planning (A-J) → Coding (unit × eval loop) → Verification → Achieve
```

## Status

M1: Engine — In Progress
