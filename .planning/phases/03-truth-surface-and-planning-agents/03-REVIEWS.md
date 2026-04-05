---
phase: 3
reviewers: [gemini]
reviewed_at: 2026-04-05T00:00:00Z
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 3

## Gemini Review

This review covers the implementation plans for **Phase 3: Truth Surface and Planning Agents**. The plans (03-01 through 03-03) represent the core "engine" of the Detent framework, moving from simple state tracking to a structured, adversarial planning pipeline.

---

### **Plan 03-01: Truth Surface CLI Commands**
**Summary:** This plan establishes the "Legislative Branch" of the Detent framework. By implementing CRUD-like operations for the Truth Surface with strict immutability for frozen decisions, it ensures that once a requirement or architectural choice is "Frozen," it becomes a hard constraint for all downstream agents.

**Strengths:**
*   **Immutability Enforcement:** The `truth-freeze` logic correctly enforces the project's core "Frozen is Immutable" rule (D-03).
*   **Audit Trail:** The YAML block metadata (id, status, challenged_by, etc.) provides a high-fidelity audit trail for how a decision evolved.
*   **Atomic Safety:** Use of `writeFileAtomicSync` prevents state corruption during concurrent or interrupted writes.

**Concerns:**
*   **Dependency on YAML Parsing (MEDIUM):** The plan mentions YAML blocks. If `detent-tools.cjs` doesn't use a robust library like `js-yaml`, regex-based parsing of nested YAML structures in Markdown can be brittle.
*   **Overwrite Logic (LOW):** While `truth-freeze` prevents overwriting `FROZEN`, the plan should clarify if `truth-propose` allows updating an existing `PROPOSED` entry or if it always appends.

**Suggestions:**
*   **Validation Hook:** Add a simple validation step in `truth-freeze` to ensure the entry being frozen actually exists in the `PROPOSED` section of the correct file before moving it.
*   **Global ID Registry:** Consider a hidden `.detent/ids.json` or similar to ensure ID uniqueness across `constraint-ledger.md` and `domain-model.md`.

---

### **Plan 03-02: Agent Templates and Playbooks**
**Summary:** This plan defines the "Bureaucracy" and "Rules of Engagement." It separates the agent instructions (Templates) from the shared knowledge (Playbooks), enabling a modular system where agents can be upgraded without changing the core orchestration logic.

**Strengths:**
*   **Playbook Abstraction:** Referencing playbooks via `@` paths (D-16) is a clean way to maintain consistency across different agents.
*   **Heredoc Workaround:** Using Bash `heredoc` to `.detent/plan/` is a clever way to bypass "No Write tool" restrictions while maintaining a strict output boundary.
*   **Machine-Readable Verdicts:** H-Review's JSON output `{verdict, reentry_stage, reason}` is essential for the "Father Model" orchestration in Plan 03-03.

**Concerns:**
*   **Agent Prompt Drift (LOW):** Without a specific "Verifier" for agent prompts, there's a risk that D-Critique or G-Red might "soften" their attacks over time.
*   **Bash Tool Reliance (MEDIUM):** Agents rely heavily on the `Bash` tool to save state. If a session hits a `maxTurns` limit or fails mid-heredoc, the resulting file might be truncated.

**Suggestions:**
*   **Standardized Output Headers:** Mandate that all agents start their `heredoc` with a standard metadata header (Agent ID, Timestamp, Source Session) to aid in debugging the file-based data flow.
*   **Strict Template Validation:** The tests (T37-T46 in Plan 03-03) should specifically check for the presence of the `@` playbook references in the templates.

---

### **Plan 03-03: Skill Orchestrator Rewrite**
**Summary:** This is the "Executive Branch" plan. It transforms the `/detent:plan` skill into a high-level manager that dispatches agents, handles human gates for freezing, and manages the complex "Reentry" loop for rejected plans.

**Strengths:**
*   **Father Model Pattern:** The orchestrator remains "thin" by only reading the H-verdict JSON, preventing the orchestrator's context from becoming bloated with agent-level details.
*   **Adversarial Loop:** Sequential G-Red -> G-Blue ensures the plan is stress-tested before reaching the human/H-Review.
*   **Collision Prevention:** The `-RN` suffix for retry iterations (D-11) is a simple but effective way to prevent state overwrites during loops.

**Concerns:**
*   **Retry State Persistence (MEDIUM):** The plan mentions a "max 2 retries" limit. It's unclear where this counter is stored across different invocations of the `/detent:plan` skill. If it's just in the skill's local session memory, a session reset will wipe the counter.
*   **Orchestrator "Stalling" (HIGH):** Sequential dispatch of 5+ agents in a single Skill execution might hit `maxTurns` or time limits of the parent Claude Code session. If the parent stalls, the entire pipeline fails.

**Suggestions:**
*   **Stateful Counter:** Store the `retry_count` and `current_stage` in `.detent/state.json` (created in Phase 1) so the orchestrator can resume if the parent session is interrupted.
*   **Progress Indicators:** Have the orchestrator emit clear "Dispatching [Agent Name]..." status messages so a human observer knows exactly where the pipeline is.

---

### **Risk Assessment: MEDIUM**

**Justification:**
The logic for Truth Surface mutations and Agent definitions is solid (Low Risk). However, the **Orchestrator Rewrite (03-03)** introduces significant complexity regarding state management and session limits. The success of this phase hinges on the orchestrator's ability to reliably manage a long-running, multi-agent loop through file-based state without hitting "dead ends" where the retry counter is lost or the parent session times out.

**Recommended Action:**
Proceed with Wave 1 (03-01 & 03-02) in parallel as planned. Before starting Wave 2 (03-03), ensure `detent-tools.cjs` has a way to persist the "Retry Counter" in a file to make the orchestrator resilient to session restarts.

---

## Codex Review

*Codex CLI invocation failed (exit code 1, empty output). Review not available.*

---

## Consensus Summary

*Single reviewer — consensus analysis requires 2+ reviewers. Key findings from Gemini below.*

### Key Strengths
- Immutability enforcement and atomic writes are well-designed
- Father model pattern keeps orchestrator context lean
- File-based data flow between agents is clean and modular
- Machine-parseable H-Review verdict enables reliable routing

### Key Concerns
- **HIGH: Orchestrator session stalling** — Sequential dispatch of 5+ agents may hit parent session maxTurns/time limits
- **MEDIUM: Retry state persistence** — reentry_depth counter may be lost on session reset if only in skill memory (note: plans already use state.json for this)
- **MEDIUM: Regex-based YAML parsing** — Could be brittle without a proper parser library
- **MEDIUM: Truncated heredoc on maxTurns** — Agent hitting turn limit mid-write could produce incomplete output files

### Actionable Items for Replanning
1. Consider whether retry_count/current_stage should be checkpointed to state.json for session resilience (partially addressed — reentry_depth is already in state.json per Plan 03-03 Step 4g)
2. Add output file validation (size > 0, expected sections present) after each agent spawn to catch truncated outputs
3. Consider whether regex-based YAML parsing is sufficient or if js-yaml should be added as a dependency
