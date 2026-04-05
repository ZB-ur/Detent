---
phase: 2
slug: pipeline-skeleton
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Custom test runner (test/run-tests.js) using Node.js built-in assert + child_process |
| **Config file** | none |
| **Quick run command** | `node test/run-tests.js` |
| **Full suite command** | `node test/run-tests.js` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node test/run-tests.js`
- **After every plan wave:** Run `node test/run-tests.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | PIPE-02 | unit | `node test/run-tests.js` | Extends existing | ⬜ pending |
| 2-01-02 | 01 | 1 | PIPE-01,PIPE-04 | unit | `node test/run-tests.js` | Extends existing | ⬜ pending |
| 2-02-01 | 02 | 2 | PIPE-03 | unit | `node test/run-tests.js` | Extends existing | ⬜ pending |
| 2-02-02 | 02 | 2 | PIPE-01 | integration | `node test/run-tests.js` | Extends existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note:** Phase 2 extends the existing test/run-tests.js from Phase 1. New test cases are added for spawn command, skill structure, gate logic, and session continuity.

---

## Wave 0 Requirements

- [ ] No new dependencies needed — all Node.js built-ins + already-installed write-file-atomic
- [ ] Extend test/run-tests.js with new test sections for Phase 2 functionality

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /detent:discovery through /detent:achieve runs end-to-end | PIPE-01 | Requires live Claude Code session with 5 skill invocations | Run each skill in sequence in a test repo, verify state.json updates at each step |
| Supervised mode pauses at gates with AskUserQuestion | PIPE-03 | Interactive gate prompts cannot be automated | Set mode=supervised, run pipeline, verify gates pause at Plan/Code/Deploy points |
| Autonomous mode auto-proceeds at all gates | PIPE-03 | Requires live pipeline run | Set mode=autonomous, run pipeline, verify no pauses |
| State survives /clear boundary mid-pipeline | PIPE-04 | Requires Claude Code session reset | Run /detent:discovery, /clear, run /detent:plan, verify it reads correct state |
| @-reference shared rules resolve correctly | PIPE-02 | Requires Claude Code skill invocation | Invoke any /detent: skill, verify shared rules are loaded |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
