---
phase: 3
slug: truth-surface-and-planning-agents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js assert + Bash verification scripts |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node .harness/test/run-quick.cjs` |
| **Full suite command** | `node .harness/test/run-full.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node .harness/test/run-quick.cjs`
- **After every plan wave:** Run `node .harness/test/run-full.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TRUTH-01 | integration | `node -e "require('./.harness/detent-tools.cjs'); /* verify truth-propose */"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | TRUTH-02 | integration | `node -e "require('./.harness/detent-tools.cjs'); /* verify truth-freeze */"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | TRUTH-03 | integration | `node -e "require('./.harness/detent-tools.cjs'); /* verify truth-read */"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | PLAN-01 | unit | `grep -q "name: D-Critique" .claude/agents/d-critique.md` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | PLAN-02 | unit | `grep -q "name: G-Red" .claude/agents/g-red.md` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | PLAN-03 | unit | `grep -q "name: G-Blue" .claude/agents/g-blue.md` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 2 | PLAN-04 | unit | `grep -q "name: H-Review" .claude/agents/h-review.md` | ❌ W0 | ⬜ pending |
| 03-02-05 | 02 | 2 | PLAN-05 | unit | `grep -q "name: J-Compile" .claude/agents/j-compile.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.harness/test/run-quick.cjs` — quick validation runner
- [ ] `.harness/test/run-full.cjs` — full suite runner
- [ ] Truth surface test fixtures — sample constraint-ledger, frozen-decisions, domain-model

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FROZEN decision cannot be overwritten | TRUTH-02 | Requires attempting agent override | Run agent with prompt to change a FROZEN decision; verify it refuses |
| G-Red produces genuine attack (not agreement) | PLAN-02 | Requires semantic analysis | Read G-Red output; verify it contradicts D-Critique on at least one point |
| J-Compile output is actionable without clarification | PLAN-05 | Requires human judgment | Read J-Compile output; attempt to implement from it alone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
