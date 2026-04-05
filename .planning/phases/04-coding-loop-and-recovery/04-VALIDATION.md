---
phase: 4
slug: coding-loop-and-recovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in (node test/run-tests.js) |
| **Config file** | test/run-tests.js |
| **Quick run command** | `node test/run-tests.js` |
| **Full suite command** | `node test/run-tests.js && node test/run-e2e.js --stage plan --fixtures` |
| **Estimated runtime** | ~5 seconds (unit), ~10 seconds (with fixture E2E) |

---

## Sampling Rate

- **After every task commit:** Run `node test/run-tests.js`
- **After every plan wave:** Run `node test/run-tests.js && node test/run-e2e.js --stage plan --fixtures`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CODE-01 | unit | `node test/run-tests.js` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CODE-02 | unit | `node test/run-tests.js` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | CODE-03 | unit | `node test/run-tests.js` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | CODE-04 | unit | `node test/run-tests.js` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | RECOV-01 | unit | `node test/run-tests.js` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | RECOV-02 | unit | `node test/run-tests.js` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | RECOV-03 | unit | `node test/run-tests.js` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 2 | RECOV-04 | unit | `node test/run-tests.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/test-coding-loop.js` — unit tests for Coder/Evaluator loop, verdict parsing, iteration control
- [ ] `test/test-recovery.js` — unit tests for reentry mechanism, algedonic signal, depth limiting
- [ ] `test/test-state-units.js` — unit tests for current_unit/total_units state management

*Existing test infrastructure (test/run-tests.js) covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coder agent produces working code from handoff | CODE-01 | Requires live Claude Code subprocess | Run `/detent:code` on a test project with handoff.md |
| Evaluator runs test suite and returns structured verdict | CODE-03 | Requires live test execution in subprocess | Verify evaluator.md agent produces correct JSON verdict |
| Algedonic signal halts pipeline and surfaces to human | RECOV-03 | Requires AskUserQuestion interaction | Trigger algedonic condition and verify human prompt appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
