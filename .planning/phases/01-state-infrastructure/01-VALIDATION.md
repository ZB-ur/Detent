---
phase: 1
slug: state-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node --test) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node --test tests/` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | ENG-01 | unit | `node --test tests/cli-usage.test.cjs` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | ENG-02 | unit | `node --test tests/state-write.test.cjs` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | ENG-03 | unit | `node --test tests/config.test.cjs` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | ENG-04 | integration | `node --test tests/setup-skill.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/cli-usage.test.cjs` — stubs for ENG-01 (CLI usage output)
- [ ] `tests/state-write.test.cjs` — stubs for ENG-02 (atomic state write + persistence)
- [ ] `tests/config.test.cjs` — stubs for ENG-03 (config schema fields)
- [ ] `tests/setup-skill.test.cjs` — stubs for ENG-04 (setup skill integration)
- [ ] `npm install write-file-atomic@^7` — dependency for atomic writes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /detent:setup walks through config questions | ENG-04 | Interactive skill invocation in Claude Code | Run `/detent:setup` in a test repo, verify .detent/ directory created with config.json, state.json, truth-surface/ |
| State survives /clear boundary | ENG-02 | Requires Claude Code session reset | Write state, run `/clear`, read state back |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
