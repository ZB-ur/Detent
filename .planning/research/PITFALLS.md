# Domain Pitfalls: AI Agent Orchestration Harness

**Domain:** Multi-agent orchestration harness framework (Claude Code / control-theory pipeline)
**Project:** Detent
**Researched:** 2026-04-05
**Research confidence:** HIGH for orchestration/context pitfalls (peer-reviewed sources), MEDIUM for VSM/algedonic specifics (limited software implementation precedent)

---

## Critical Pitfalls

Mistakes that cause rewrites, silent data corruption, or complete pipeline failure.

---

### Pitfall 1: Subprocess Token Re-Injection at 50K Per Turn

**What goes wrong:** Every Claude Code subprocess invocation without explicit isolation re-injects the full global configuration — `~/CLAUDE.md`, all plugins, all MCP server tool descriptions, and user-level settings — on every single turn. A 5-turn coding session consumes 250K tokens in overhead alone before any work occurs.

**Why it happens:** Claude Code traverses upward from the working directory to find CLAUDE.md files, loads all enabled plugins, and reads user-level settings. The subprocess has no way to know it should skip this unless explicitly told.

**Consequences:** Model budget exhausted on infrastructure overhead, not work. Autonomous mode burns budget silently. In a full Discovery→Achieve pipeline, cumulative injection cost can exceed meaningful token budget before M2 is reached.

**Prevention:**
- Use 4-layer isolation for every spawned subprocess:
  1. Set working directory to a scoped workspace path, not home directory
  2. Create `.git/HEAD` in the workspace to block upward CLAUDE.md traversal
  3. Point `--plugin-dir` to an empty directory
  4. Use `--setting-sources project,local` to exclude user-level settings
- Use stream-json mode (`--output-format stream-json`) for iterative loops — the process stays alive, injecting the system prompt only once; subsequent messages flow via stdin

**Detection:** Log token counts per subprocess turn. Any turn exceeding 10K tokens before the actual prompt is a re-injection symptom. The Gemini async log hook should monitor this from stream-json output.

**Phase mapping:** M1 (Engine) — must be solved before any meaningful work can be done. The harness-tools.cjs subprocess spawner is the right place to enforce isolation.

---

### Pitfall 2: Error Compounding Across Pipeline Stages

**What goes wrong:** In a 5-stage pipeline (Discovery → Planning → Coding → Verification → Achieve) where each agent achieves 85% step accuracy, the end-to-end success rate is approximately 44%. At 90% per step, it drops to 59%. Small errors do not stay small — each stage's output becomes the next stage's input, and mistakes compound rather than cancel.

**Why it happens:** Downstream agents treat upstream output as ground truth. A misinterpreted requirement in Discovery becomes a wrong constraint in Planning, wrong code in Coding, wrong test in Verification. No stage challenges the validity of what it received.

**Consequences:** The coding stage builds the wrong thing correctly. Verification passes the wrong implementation. The truth surface accumulates wrong constraints that look valid.

**Prevention:**
- The constraint ledger (truth surface) must be the explicit artifact that survives stage transitions — not implicit assumptions embedded in prose summaries
- Each stage transition should include a validation step: "does this output satisfy the inputs I received?" (not just "is this output self-consistent?")
- The G-Red/Blue planning agent (adversarial) is the right structural answer — red team challenges the constraint ledger at the Planning stage before it freezes
- Never pass full conversation history to the next stage — extract discrete, structured artifacts (JSON constraints, explicit decisions) rather than compressing narrative

**Detection:** Cross-stage contradiction: a frozen constraint in the ledger contradicts a requirement discovered later. The reentry mechanism is the response, but prevention is better.

**Phase mapping:** M1 (constraint ledger schema and handoff format) directly addresses this. M2 (Coding↔Evaluator loop) must not repeat the pattern within a stage.

---

### Pitfall 3: Context Window Exhaustion Without Managed Compaction

**What goes wrong:** Long-running agent sessions accumulate context until they hit the window ceiling. At exhaustion, the agent either truncates from the front (losing task specification), crashes, or silently degrades quality. The MAST research found "Loss of conversation history" (FM-1.4) is one of the 14 primary multi-agent failure modes.

**Why it happens:** Teams treat the 1M context window as "infinite" and skip context management. Lazy compaction (waiting until the window fills) causes quality degradation at exactly the moment the agent is deepest into a complex task.

**Consequences:** The agent reverts to earlier task states, re-does completed work (step repetition, FM-1.3), or loses constraint knowledge mid-coding. In Detent's pipeline, this is most dangerous in the Coding stage where the coder accumulates tool call results.

**Prevention:**
- Implement staged compaction proactively — clear old tool results as soon as they are no longer needed (not after the window fills)
- Use event-driven system reminders to re-inject key constraints at decision points, counteracting instruction fade-out
- The truth surface files in `.harness/truth-surface/` serve as the persistent re-injection source — the agent can be given a compact constraint summary at any point without relying on conversation history
- Never rely on conversation history alone to maintain task state — all decisions go into files that survive compaction

**Detection:** Monitor token count in stream-json output. Inject a context check when usage exceeds 70% of budget. If the agent references a constraint that contradicts the frozen ledger, compaction has caused instruction fade-out.

**Phase mapping:** M1 (state management) must define what survives compaction. M2 (Coding agent) must implement proactive compaction in the coding session skill.

---

### Pitfall 4: Coding↔Evaluator Loop Non-Convergence

**What goes wrong:** The adversarial coding loop fails to converge: the evaluator gives vague or inconsistent feedback, the coder makes irrelevant changes, and the loop iterates to its maximum without improvement. Spotify's engineering team documented this pattern directly — "catching 0-2 canaries per iteration with no convergence."

**Why it happens:** Two root causes:
1. The evaluator uses probabilistic LLM judgment for pass/fail decisions that should be deterministic (test runs, linter output, type checker)
2. The evaluator gives general feedback ("improve code quality") instead of specific, actionable feedback with precise failure location and expected vs. actual behavior

The SWE-bench research Detent cites explicitly requires specific, technical evaluator feedback. "Make it better" does not converge.

**Consequences:** Max iteration limit hit without improvement. Human escalation triggered for tasks that should be automatic. Or worse: the coder makes superficial changes that satisfy the evaluator's wording but not the actual requirement (sycophantic convergence).

**Prevention:**
- The evaluator must have a machine-verifiable "finish line": tests pass, types check, linter clean — not LLM opinion
- Reserve LLM evaluation for semantic concerns (does this match the specification?) but structure its output as specific, located feedback: `[file:line] expected X, got Y`
- Implement a judge layer that checks whether evaluator feedback is actionable before passing it to the coder
- The max iteration limit is necessary but not sufficient — log why each iteration failed to converge so the exit condition can be improved

**Detection:** Track whether each iteration makes progress on the evaluator's specific complaints. If iteration N+1 fails for the same reason as iteration N, the loop is not converging — escalate before hitting max.

**Phase mapping:** Core M2 design decision. The evaluator agent prompt template is the critical artifact. Get specificity requirements right before building the loop.

---

### Pitfall 5: State File Race Conditions in Parallel Execution

**What goes wrong:** Multiple concurrent agents read then write to the same state file (`.harness/state.json`, truth surface files) without locking. The second writer overwrites the first's changes. In web UI Layer 2 (multiple parallel pipelines), this becomes acute.

**Why it happens:** File systems do not provide ACID guarantees. Read-modify-write sequences on JSON files are not atomic. The GSD pattern uses the CLI tool as single source of truth to prevent this, but any deviation from that pattern (direct file writes in agent prompts, parallel CLI calls) introduces the race.

**Consequences:** Constraint ledger corruption. Stage transitions lost. Algedonic signals suppressed by stale state. Partial writes leave JSON files malformed, causing parse failures across all consumers.

**Prevention:**
- The harness-tools.cjs CLI is the single mutation point — agents never write to `.harness/` directly, only via CLI commands
- All state mutations are append-only where possible (constraint ledger as append-only log, not mutable object)
- For M3 parallel pipelines, each pipeline gets an isolated subdirectory under `.harness/` — never shared mutable state between pipelines
- Write to temp files first, then rename (atomic on POSIX systems) — avoids partial write corruption

**Detection:** If state.json is malformed on read, a write race occurred. If a constraint disappears from the ledger between stages, an overwrite occurred. Add a checksum to state.json and verify on every read.

**Phase mapping:** M1 must establish the CLI-as-single-source-of-truth pattern before any agent uses it. M3 must enforce pipeline isolation before enabling parallel execution.

---

### Pitfall 6: Reentry Mechanism Triggering Indefinite Rollback

**What goes wrong:** The reentry mechanism (cross-stage rollback when planning contradictions surface during coding) triggers, rolls back to Planning, Planning produces output that re-surfaces the same contradiction, coding detects it again, rollback triggers again. Infinite reentry loop consuming budget with no progress.

**Why it happens:** The rollback does not carry forward the specific contradiction that triggered it. The Planning stage operates on the same inputs as before, produces the same output, and the cycle repeats. Rollback without constraint propagation is a loop.

**Consequences:** Budget exhausted, human escalation triggered for structural reasons rather than task complexity. The algedonic signal fires but the escalation message is "stuck in reentry loop" rather than "specific contradiction found."

**Prevention:**
- Every reentry must include the specific contradiction as a new, frozen input to the Planning stage — the contradiction becomes a constraint that Planning cannot ignore
- Limit reentry depth: maximum 2 rollbacks to Planning per pipeline run. Third contradiction → immediate human escalation with full context
- Log each reentry with: which coding artifact triggered it, what the specific contradiction was, which Planning decisions are implicated
- The algedonic signal content must distinguish "reentry loop" from "genuine complexity" — different human action required for each

**Detection:** If reentry triggers more than once for the same contradiction text (normalized), the loop is active. The CLI tool should enforce a reentry counter in state.json and escalate on threshold breach.

**Phase mapping:** M2 feature, but the reentry counter and escalation path must be designed in M1 state schema to avoid retrofitting.

---

## Moderate Pitfalls

Issues that degrade quality or require rework but do not cause catastrophic failure.

---

### Pitfall 7: Agent Drift — Behavioral Degradation Over Extended Sessions

**What goes wrong:** Agents operating in long sessions progressively deviate from their role specification. The MAST taxonomy calls this FM-1.2 (disobey role specification) and FM-2.3 (task derailment). Research quantifies this as up to 42% task success rate reduction over 500 interactions. Concretely: a Coder agent begins making architectural decisions that should belong to Planning.

**Why it happens:** Role boundaries are stated once in the system prompt. As conversation history grows, the initial instruction loses relative prominence — instruction fade-out. The model "drifts" toward whatever the most recent context suggests.

**Prevention:**
- Agent prompt templates must re-state role boundaries at key decision points, not just at session start
- Use event-driven reminders injected from harness-tools.cjs at stage boundaries within a session
- The truth surface provides a stable reference: any agent output that contradicts the frozen constraint ledger is a drift indicator, not a valid decision

**Phase mapping:** M2 (agent prompt templates). The re-injection pattern should be designed into the template structure, not patched in afterward.

---

### Pitfall 8: Hallucinated Consensus — Agents Agreeing on Wrong Output

**What goes wrong:** Multiple planning agents (D-Critique, G-Red/Blue, H-Review, J-Compile) converge on a plausible but factually incorrect constraint. Because all agents agree, no contradiction flag surfaces. The false constraint freezes into the ledger and propagates forward.

**Why it happens:** Multi-agent voting does not increase factual accuracy — it increases confidence in whatever the dominant position is. If all agents share the same training data bias, they share the same hallucination tendency. Agreement is not verification.

**Prevention:**
- External grounding sources must be introduced for factual claims: project files, existing codebase, explicit requirements documents — not agent agreement
- G-Red should be specifically adversarial against D-Critique's output, not just a second opinion. If Red and Blue never disagree, the adversarial structure is cosmetic
- Any constraint sourced from LLM reasoning (not from a file or user statement) should be marked with lower confidence in the ledger

**Phase mapping:** M2 (agent prompt design for G-Red/Blue). The adversarial structure is the prevention mechanism — design it to actually conflict, not just review.

---

### Pitfall 9: Silent Termination — Agents Stopping Without Signaling Failure

**What goes wrong:** An agent encounters an error condition, produces no output, and exits without triggering any escalation. The pipeline stalls. MAST FM-3.1 (premature termination) and FM-1.5 (unaware of termination conditions) both contribute to this.

**Why it happens:** Agents do not have explicit "I am stuck and cannot proceed" signaling by default. The natural LLM behavior when confused is to produce something plausible, not to explicitly fail. Silent failure is harder to detect than loud failure.

**Consequences:** The pipeline hangs at a stage with no output, consuming compute, while the human has no visibility into what happened or why.

**Prevention:**
- Every agent session must have an explicit termination contract: success artifact produced, OR escalation signal written, OR explicit failure output — never silent exit
- harness-tools.cjs should detect timeout (no output after N seconds/tokens) and write a failure record to state.json automatically, not relying on agent self-reporting
- The algedonic channel is specifically for this: something wrong that management needs to know about NOW, not in the next scheduled review

**Phase mapping:** M1 (algedonic signal system). The signal contract must be defined before any agent is deployed.

---

### Pitfall 10: Verification That Only Checks Self-Consistency

**What goes wrong:** The Verification stage checks whether the code is internally consistent (tests pass, types check) but not whether it satisfies the original requirements from the truth surface. MAST FM-3.3 (incorrect verification) — the check is present but validates the wrong thing.

**Why it happens:** Writing tests is easier than writing tests against requirements. Tests tend to verify what the code does, not what it was supposed to do. If the coder implemented the wrong thing correctly, tests will pass.

**Prevention:**
- Verification must explicitly reference frozen constraints from the truth surface, not just run the test suite
- Include a requirements-traceability step: for each constraint in the ledger, identify which test or artifact provides evidence of satisfaction
- The Evaluator agent in M2 is already designed to compare against specification — this same pattern should extend to the Verification stage

**Phase mapping:** M1 (Verification stage design) and M2 (Evaluator agent prompt). Establish the traceability pattern early.

---

## Minor Pitfalls

Issues that cause friction or inefficiency but are recoverable without rework.

---

### Pitfall 11: Misidentifying Algedonic Signals vs. Audit Findings

**What goes wrong:** Post-hoc analysis (RCA, quality review) is implemented as an algedonic signal, flooding the human with non-urgent alerts. The human learns to ignore all signals. When a genuine emergency occurs, the signal is missed.

**Why it happens:** VSM System 3* (audit) and the algedonic channel serve different functions. Audit is scheduled, retrospective, analytical. Algedonic is real-time, pain/pleasure, requires immediate response. Software implementations frequently collapse them.

**Prevention:**
- Algedonic signals must be binary (pain/pleasure) and immediate — "pipeline is stuck" or "coding succeeded ahead of schedule"
- Audit outputs go to the log file, not the algedonic channel
- The signal schema must include a timestamp and urgency classification. Retrospective reports are never urgency:HIGH

**Phase mapping:** M1 (algedonic signal system design). Schema and routing before implementation.

---

### Pitfall 12: Dual-Channel Race Between stream-json and File Watch

**What goes wrong:** The Web UI uses both stream-json stdout parsing and file watch for state updates. If stream-json reflects a state change before the file write completes, the UI shows inconsistent state (stream says "coding complete," file says "coding in progress"). The reverse also occurs.

**Why it happens:** Two independent channels with different latencies. stream-json is real-time, file watch has inotify/kqueue delay plus file write time.

**Prevention:**
- stream-json is the authoritative source for progress events (what is happening now)
- File system is the authoritative source for persistent state (what has been decided/produced)
- UI must reconcile by treating stream-json as transient display and file system as ground truth — never update persistent state from stream-json events alone

**Phase mapping:** M3 (Web UI). Design the channel semantics before building the dashboard.

---

### Pitfall 13: Prompt Drift From Inconsistent Template Versions

**What goes wrong:** Agent prompt templates are updated in one place but not propagated to all skills that use them. Different stages use different versions of the same template, producing inconsistent agent behavior across the pipeline.

**Why it happens:** Templates are duplicated into skill files rather than referenced from a single source. Common in rapid iteration.

**Prevention:**
- All agent prompt templates live in a single `agents/` directory and are loaded by reference into skills — never duplicated
- Treat template changes as breaking changes: version them, test across all consumers before deployment

**Phase mapping:** M2 (agent prompt templates). Enforce single-source template ownership before adding the second template.

---

## Phase-Specific Warnings

| Phase / Topic | Likely Pitfall | Mitigation |
|---|---|---|
| M1: subprocess spawner | 50K token re-injection (Pitfall 1) | 4-layer isolation enforced in harness-tools.cjs |
| M1: state schema | Reentry counter missing (Pitfall 6) | Design state.json schema to include reentry_depth field from day one |
| M1: algedonic signal | Confusing audit with algedonic (Pitfall 11) | Define schema with urgency classification before implementation |
| M1: CLI-as-single-mutation-point | Race conditions if any agent writes directly (Pitfall 5) | No direct file writes in any agent prompt; all mutations via CLI |
| M2: Evaluator prompt | Vague feedback, loop non-convergence (Pitfall 4) | Evaluator output schema: file, line, expected, actual — machine-structured |
| M2: Coder session | Context exhaustion mid-task (Pitfall 3) | Proactive compaction triggered at 70% budget, truth surface as re-injection source |
| M2: Planning agents (G-Red/Blue) | Hallucinated consensus (Pitfall 8) | G-Red must be adversarial against D-Critique output by design |
| M2: agent templates | Prompt drift / role creep (Pitfall 7) | Re-inject role boundary at decision points, not just session start |
| M2: verification stage | Self-consistency only (Pitfall 10) | Requirements traceability step against frozen ledger |
| M3: Web UI | Dual-channel race condition (Pitfall 12) | stream-json = transient display; file system = ground truth |
| M3: parallel pipelines | Shared state corruption (Pitfall 5) | Per-pipeline isolated subdirectory, never shared mutable state |

---

## Confidence Assessment

| Area | Confidence | Source |
|---|---|---|
| Token re-injection (Pitfall 1) | HIGH | Direct Claude Code issue tracker + DEV article with reproducible measurements |
| Error compounding math | HIGH | Multiple peer-reviewed sources, consistent across MAST, Galileo, Cogent |
| Context window failure modes | HIGH | MAST taxonomy (1,600+ annotated traces, kappa=0.88) |
| Coding loop non-convergence | HIGH | Spotify Engineering blog (production system, specific numbers) |
| State race conditions | MEDIUM | General distributed systems knowledge + LangGraph/SagaLLM research |
| Reentry loop pattern | MEDIUM | General agent literature; specific Detent reentry design is novel |
| VSM algedonic implementation | MEDIUM | Theory is solid; software implementation precedent is limited |
| Agent drift quantification | MEDIUM | Single paper (arXiv 2601.04170), numbers directionally correct but context-specific |

---

## Sources

- MAST failure taxonomy: [Why Do Multi-Agent LLM Systems Fail? (arXiv 2503.13657)](https://arxiv.org/html/2503.13657v1)
- Error compounding / "Bag of Agents": [Towards Data Science](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- Context loss mechanisms: [Galileo: Multi-Agent LLM Systems Fail](https://galileo.ai/blog/multi-agent-llm-systems-fail)
- Coding agent feedback loop convergence: [Spotify Engineering: Feedback Loops Background Coding Agents](https://engineering.atspotify.com/2025/12/feedback-loops-background-coding-agents-part-3)
- CLI scaffolding lessons (instruction fade-out, lazy compaction): [arXiv 2603.05344 OpenDev](https://arxiv.org/html/2603.05344v2)
- Orchestration failure playbook (loops, deadlocks, hallucinated consensus): [Cogent: When AI Agents Collide](https://cogentinfo.com/resources/when-ai-agents-collide-multi-agent-orchestration-failure-playbook-for-2026)
- Agent drift quantification: [arXiv 2601.04170](https://arxiv.org/abs/2601.04170)
- Claude Code subprocess 50K token waste: [DEV Community](https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma)
- Claude Code subprocess Node.js spawn bug: [GitHub Issue #771](https://github.com/anthropics/claude-code/issues/771)
- SagaLLM transactional patterns: [VLDB 2025](https://www.vldb.org/pvldb/vol18/p4874-chang.pdf)
- Human-in-the-loop escalation patterns: [Galileo: Human-in-the-Loop Agent Oversight](https://galileo.ai/blog/human-in-the-loop-agent-oversight)
- Multi-agent production failure rates: [Composio: Why AI Agent Pilots Fail](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap)
