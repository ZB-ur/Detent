---
phase: 4
reviewers: [gemini, claude]
reviewed_at: 2026-04-06
plans_reviewed: [04-01-PLAN.md, 04-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 4

## Gemini Review

The implementation plans for Phase 4 provide a robust and highly structured approach to the Coding stage of the Detent pipeline. **Plan 04-01** correctly establishes the necessary CLI extensions and agent templates, ensuring that the "father model" (the skill orchestrator) has the primitives it needs for state management and empirical truth-freezing. **Plan 04-02** transforms the `/detent:code` skill into a sophisticated orchestrator that manages the Coder/Evaluator adversarial loop with clear routing logic for algedonic signals, cross-stage reentry, and automated unit progression. The heavy emphasis on state-driven iteration and machine-structured feedback (JSON verdicts) aligns perfectly with the project's core value of constraint propagation.

### Strengths
- **Adversarial Integrity:** The separation of concerns between the Coder (with `Write` tool) and Evaluator (read-only, `Bash` for testing) prevents "marking one's own homework" and ensures the Evaluator acts as a strict quality gate.
- **Robust Recovery Logic:** The specific routing order (Algedonic > Reentry > PASS > FAIL) ensures that critical system-level contradictions are handled before implementation-level bugs.
- **Empirical Contradiction Handling:** The `--source code-contradiction` bypass in `truth-freeze` is an elegant solution to the "maturity requirement" problem for planning errors discovered during implementation.
- **State-Driven Orchestration:** Using `current_unit`, `total_units`, and `iteration_count` in `state.json` makes the pipeline resilient to session interruptions and provides clear visibility into progress.
- **Comprehensive Testing:** The addition of 27 new tests (16 in Wave 1, 11 in Wave 2) to an already substantial test suite (51 existing) demonstrates a strong commitment to validation and regression prevention.
- **Unit Isolation:** Implementing one unit at a time with mandatory git commits on `PASS` ensures that the project state evolves incrementally and safely.

### Concerns
- **Orchestrator Complexity (MEDIUM):** The rewrite of `SKILL.md` in Plan 04-02 results in a very large and complex shell-script-heavy document. Claude Code's ability to execute long, multi-step `Bash` blocks reliably across many turns can sometimes be brittle. A single `Bash` syntax error or a failed grep/parse could halt the entire loop.
- **Evaluator Resource Limits (LOW):** The Evaluator is limited to 10 turns. For complex test suites or environments that require significant setup, this might be tight.
- **Git State Dependency (LOW):** The `PASS` condition triggers a `git commit`. If the workspace has uncommitted changes *unrelated* to the current unit, the commit might include noise or fail if there are conflicts.
- **Handoff Parsing (LOW):** Counting units via `grep -c '^### UNIT-'` assumes a very specific markdown structure in `handoff.md`. If the Planner (Phase 3) deviates from this formatting, the Coder will find 0 units and halt.

### Suggestions
- **Modularize Orchestrator Logic:** Consider moving some of the complex routing logic (e.g., parsing the verdict JSON and determining the next step) into a small helper script or expanding `detent-tools.cjs` to handle "verdict-routing" logic.
- **Atomic Git Commits:** In Plan 04-02, Task 1, Step 7c, ensure the `git commit` uses the specific files from `coder-manifest.json` rather than `git add -A`.
- **Evaluator Breadcrumbs:** In `evaluator.md`, instruct the agent to append its full test log to a temporary file (e.g., `.detent/logs/evaluator-last-run.log`) before writing the JSON verdict.
- **Total Units Validation:** Add a check in `SKILL.md` to ensure `total_units` is saved to state *before* entering the loop, and a sanity check that `total_units > 0`.

### Risk Assessment: LOW
The plans are extremely detailed, grounded in research, and address all specified requirements and user decisions. The fail-safe mechanisms (algedonic signal, reentry depth limit, human gates) effectively mitigate the risks of autonomous loop-de-loop or runaway costs.

---

## Claude Review

### Plan 04-01 Assessment

A well-scoped foundation wave that extends the existing CLI tool with two new integer fields, adds a maturity bypass for empirical contradictions, creates two agent templates following established patterns, and extends the playbook. The 16-test target is reasonable for the surface area introduced.

**Strengths:**
- Follows established patterns — Coder/Evaluator templates mirror existing agent structure
- Clean separation — CLI changes are orthogonal to agent template creation
- Evaluator has no Write tool — correct security boundary
- Coder outputs coder-manifest.json — enables precise git commits
- intFields null handling is pragmatic

**Concerns:**
- **HIGH: coder-manifest.json write location unclear** — If coder-manifest.json lives in `.detent/code/`, the Coder must use Bash heredoc, not Write. Plan should specify the exact write mechanism.
- **MEDIUM: parseInt without NaN guard** — `parseInt(value, 10)` returns NaN for non-numeric strings. Should add validation.
- **MEDIUM: total_units = 0 edge case** — If handoff.md has no `### UNIT-` headers, total_units would be 0. Skill should fail fast.
- **LOW: 16 tests may be light** — Content assertions don't test runtime behavior.

**Risk: LOW**

### Plan 04-02 Assessment

This is the critical plan — it implements the entire Coder/Evaluator adversarial loop. The 10-step structure is well-sequenced, and the verdict routing order correctly implements D-15. The nested loop design is the right architecture. However, several edge cases around state consistency and error recovery need attention.

**Strengths:**
- Verdict routing order is correct and explicit (D-15)
- Iteration count incremented BEFORE Coder spawn (D-18)
- Workspace prep prevents stale artifacts
- Reentry injects frozen constraint BEFORE rollback
- Completion resets reentry_depth

**Concerns:**
- **HIGH: State consistency on skill crash** — If orchestrator crashes mid-unit, no clean recovery path specified. Can `/detent:code` be re-invoked and resume from state.json's current_unit/iteration_count? If iteration_count was incremented but Coder never spawned, re-invocation wastes an iteration.
- **HIGH: Race condition between state-write and git commit** — On PASS: if skill crashes between commit and state-write, the unit is committed but state still points to it. Re-invocation would re-execute an already-committed unit.
- **MEDIUM: Evaluator verdict file parsing** — What if the Evaluator fails to produce valid JSON? Need a parse guard.
- **MEDIUM: Reentry rollback mechanism** — Does D-Critique re-run obliterate previous planning work? Constraint-ledger gets new entry but plan doesn't specify handoff.md regeneration.
- **MEDIUM: Algedonic signal detection mechanism** — How does the Evaluator detect frozen constraint violations? Need explicit instructions for when to set `algedonic: true` vs just `verdict: "FAIL"`.
- **MEDIUM: Git commit scope** — Commit only manifest files or all changes? If Coder modifies files not in manifest, changes would be lost.
- **LOW: Unit counting fragility** — `grep -c '^### UNIT-'` is brittle against format variations.
- **LOW: Evaluator maxTurns = 10 may be tight**

**Suggestions:**
- Add explicit resume semantics at step 1 for crash recovery
- Reorder state-write before git commit on PASS path
- Add verdict parsing guard (treat unparseable as FAIL)
- Clarify algedonic detection in evaluator.md
- Use explicit file paths from coder-manifest.json for git add
- Validate unit counting with sequential numbering check

**Risk: MEDIUM** — Core loop design is sound but crash/resume and algedonic detection need specification.

---

## Consensus Summary

### Agreed Strengths
- **Verdict routing order (algedonic > reentry > PASS > FAIL)** — Both reviewers confirm this is correct and critical for system integrity
- **Evaluator has no Write tool** — Both highlight this as the right security boundary
- **State-driven orchestration** — Both agree the integer fields and state tracking make the pipeline resilient
- **Adversarial separation** — Both note the Coder/Evaluator split prevents self-evaluation
- **Comprehensive testing** — Both view 27 new tests as appropriate coverage
- **Established patterns** — Both confirm the plans follow existing project architecture

### Agreed Concerns
1. **Git commit scope and ordering (MEDIUM-HIGH)** — Both reviewers flag that the git commit strategy needs explicit file scoping (use coder-manifest.json files, not `git add -A`) and both note potential issues if commit/state-write ordering isn't handled carefully
2. **Evaluator maxTurns may be tight (LOW)** — Both reviewers note 10 turns could be insufficient for complex test suites
3. **Unit counting fragility (LOW)** — Both note `grep -c '^### UNIT-'` is brittle against format variations in handoff.md
4. **total_units = 0 validation (LOW-MEDIUM)** — Both suggest fail-fast validation when handoff.md has no units

### Divergent Views
- **Crash/resume semantics** — Claude flags this as HIGH priority, suggesting explicit resume logic at startup. Gemini doesn't raise this, possibly assuming session-level recovery is handled by the framework.
- **Algedonic detection mechanism** — Claude flags the lack of explicit instructions for when Evaluator should set `algedonic: true` vs `verdict: "FAIL"` as MEDIUM. Gemini doesn't raise this concern.
- **Orchestrator complexity** — Gemini raises concern about SKILL.md becoming too large and shell-heavy. Claude doesn't flag this, focusing more on specific correctness properties.
- **NaN guard on parseInt** — Claude specifically flags missing validation. Gemini doesn't mention this.
- **Overall risk** — Gemini rates LOW, Claude rates MEDIUM. The delta is driven by Claude's focus on crash recovery and algedonic specification gaps.
