---
phase: 1
slug: state-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Custom test runner (test/run-tests.js) using Node.js built-in assert + child_process |
| **Config file** | none |
| **Quick run command** | `node test/run-tests.js` |
| **Full suite command** | `node test/run-tests.js` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node test/run-tests.js`
- **After every plan wave:** Run `node test/run-tests.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | ENG-01 | unit | `node test/run-tests.js` | Plan 01-01 creates | ⬜ pending |
| 1-01-02 | 01 | 1 | ENG-02 | unit | `node test/run-tests.js` | Plan 01-01 creates | ⬜ pending |
| 1-01-03 | 01 | 1 | ENG-03 | unit | `node test/run-tests.js` | Plan 01-01 creates | ⬜ pending |
| 1-01-04 | 01 | 1 | ENG-01-04 | unit | `node test/run-tests.js` | Plan 01-01 creates | ⬜ pending |
| 1-02-01 | 02 | 2 | ENG-04 | integration | Manual: invoke `/detent:setup` | N/A (skill test) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note:** Plan 01-01 Task 2 is TDD — it creates `test/run-tests.js` as its first step (RED phase), then implements `detent-tools.cjs` (GREEN phase). No separate Wave 0 is needed because the test file is created within the same task that implements the code.

---

## Wave 0 Requirements

- [x] No Wave 0 needed — Plan 01-01 Task 2 creates test/run-tests.js as part of its TDD workflow (RED before GREEN)
- [ ] `npm install write-file-atomic@^7` — dependency for atomic writes (Plan 01-01 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /detent:setup walks through config questions | ENG-04 | Interactive skill invocation in Claude Code | Run `/detent:setup` in a test repo, verify .detent/ directory created with config.json, state.json, truth-surface/ |
| State survives /clear boundary | ENG-02 | Requires Claude Code session reset | Write state, run `/clear`, read state back |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed — TDD task creates tests inline)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
