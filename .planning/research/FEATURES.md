# Feature Landscape

**Domain:** AI agent orchestration harness framework (control-theory based, solo developer, Claude Code)
**Researched:** 2026-04-05
**Confidence:** MEDIUM-HIGH — ecosystem is young (harness engineering as a term entered mainstream early 2026), patterns verified across multiple sources

---

## What "Harness Engineering" Means in 2026

Harness engineering is the discipline of designing the systems, constraints, and feedback loops that wrap around AI agents to make them reliable in production. It entered mainstream use in early 2026. The key insight from every production deployment: **the framework abstracts the easy parts; the hard problems — when to escalate to human, how to handle tool failures, what recovery path when a 40-step pipeline fails at step 32 — are yours to solve regardless of which framework you use.**

Detent is a harness, not an orchestration framework. This distinction matters for feature prioritization. Orchestration frameworks (LangGraph, CrewAI, AutoGen) route agents to tasks. A harness constrains agent behavior, surfaces truth, and gates execution quality. These are different products.

---

## Table Stakes

Features users expect. Missing = the framework feels like a toy, not a tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Pipeline stage structure** | Every mature harness follows a defined sequence (plan → act → verify); unstructured execution is demo-grade | Medium | Discovery→Planning→Coding→Verification→Achieve is the Detent-specific instantiation; the pattern itself is table stakes |
| **Session state persistence** | Agent sessions die; state must survive. Context windows are finite — full pipeline can't fit in one. | Medium | `.harness/` directory as state bridge is the right approach; file-system persistence is standard |
| **CLI tool as state mutation point** | Single source of truth prevents race conditions when multiple agents write state | Low-Medium | Well-established pattern (GSD reference confirms this); prevents the "two agents writing the same file" problem |
| **Human-in-the-loop gates** | High-stakes decisions (architecture, destructive ops) require human approval; baked-in gates distinguish harnesses from autonomous chaos | Medium | Must be first-class, not bolted on; gate behavior must be configurable (autonomous vs supervised mode) |
| **Iteration loop with max-cap** | Coder↔Evaluator loops without hard stop burn tokens and stall. Max iteration limit is table stakes for production use. | Low | Research confirms 2-3 iterations typically converge; cap of 3-5 covers most cases |
| **Agent prompt templates** | Reusable, versioned prompts for each pipeline role (planner, coder, evaluator, reviewer) prevent prompt drift and enable improvement | Medium | Each stage needs a distinct prompt contract; templates enable role separation |
| **Rollback / reentry mechanism** | When planning-level contradictions surface during coding, must roll back to the right stage — not abort and restart from zero | High | This is genuinely hard; LangGraph's "time travel" is the nearest analog in mainstream frameworks; for file-based state it requires explicit stage checkpoints |
| **Error escalation (algedonic signal)** | Critical failures must bypass the normal hierarchy and reach the human immediately, not queue behind routine status updates | Low-Medium | VSM System 3* pattern; implementation is a priority interrupt, not a polling mechanism |
| **Observability / execution log** | Humans need to see what agents did, why, and where it failed. Without this, debugging is impossible. | Medium | Must be async (non-intrusive); Gemini CLI hook is the right architecture for zero-core-prompt-intrusion |
| **Two-mode operation (autonomous/supervised)** | Solo developer runs simple tasks unattended and complex tasks with gates; forcing one mode on both is wrong | Low | Same pipeline, different gate behavior — implemented as config, not separate code paths |
| **Config system** | Harness behavior (mode, model budget, locale, pipeline toggles) must be inspectable and editable outside agent sessions | Low | `.harness/config.json` is the right approach |

---

## Differentiators

Features that distinguish Detent. Not universally expected in harness frameworks, but represent competitive advantage and the core value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Truth surface with constraint ledger** | Frozen decisions propagate constraints through the pipeline — every downstream agent decision is checked against the established truth surface, not guessing from context | High | This is Detent's defining feature. No mainstream framework has formal constraint propagation across pipeline stages. LangGraph has state, but state is mutable and doesn't enforce frozen decisions. Detent treats certain decisions as immutable once committed. |
| **Stage-specific agent roles (D-Critique, G-Red/Blue, H-Review, J-Compile)** | Named roles with defined responsibilities create accountability and reviewable outputs at each planning substage; adversarial framing (Red/Blue) surfaces contradictions before coding | High | Borrowed from ECL; the adversarial planning loop is differentiating vs single-agent planning approaches |
| **Adversarial coding loop (Coder + Evaluator)** | Two-agent adversarial pattern following Anthropic's SWE-bench research; evaluator provides specific technical feedback rather than approval/rejection binary | High | Research confirms: LangChain improved agent performance from 52.8% to 66.5% by changing only the harness. An adversarial evaluator is the highest-ROI harness improvement per engineering hour. |
| **Cross-stage rollback on late contradiction** | When the Coding stage discovers that a planning-level decision was wrong, the framework routes back to the correct planning substage rather than continuing with bad constraints — preserves work done after the contradiction point | Very High | This is novel. Most harnesses either abort or continue regardless. Cross-stage rollback with checkpoint resume is the VSM recursion theorem applied to a coding pipeline. |
| **Async behavior logging via external LLM (Gemini CLI)** | Zero intrusion on core agent prompts; behavior log generated from stream-json artifacts by a separate model — core agent context stays focused on the task | Medium | The non-intrusion property is differentiating. Most observability solutions instrument the agent prompts directly (adding to context), which degrades agent performance. |
| **Multiple parallel pipeline monitoring (Web UI Layer 2)** | Real-time dashboard for multiple concurrent pipeline instances; stream-json + file watch dual channel for live progress without polling overhead | High | No mainstream solo-developer harness has multi-pipeline visualization. This targets the "drain the backlog overnight" use case. |
| **Control-theory formalism (VSM)** | Provides principled basis for where human oversight sits, what constitutes an algedonic signal, and how recursion works — prevents ad-hoc gate placement and "just add a human in the loop" hand-waving | Low (conceptual), Medium (implementation) | VSM System 3* maps directly to the audit/algedonic function. Most frameworks lack theoretical grounding for their oversight placement decisions. |

---

## Anti-Features

Things to deliberately NOT build. Either they don't belong in Detent, create complexity without value, or are explicitly out of scope.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Generic LLM provider support** | Abstraction layer for multiple LLMs adds complexity with no benefit for a Claude-Code-only tool; provider abstractions become the hardest thing to maintain | Hard-code Claude Code subprocess invocation; if expansion needed in M3+, add it then with real requirements |
| **Framework-as-a-service / API layer** | Detent is a local CLI harness, not a hosted service; adding a service layer increases attack surface, deployment complexity, and operational burden for a solo developer tool | Keep everything local; web UI talks to local process, not a cloud service |
| **Generic workflow DSL** | Tempting to make the pipeline stages configurable via a workflow language; adds indirection and a new language to learn with no payoff for a fixed 5-stage pipeline | Use code, not config, for the pipeline structure; config is for behavior (mode/budget/toggles), not pipeline shape |
| **Multi-user collaboration features** | Claude Code subscription model, session isolation, and file-based state are all built for solo use; multi-user adds coordination complexity that breaks the architecture | Explicitly out of scope; document this as a design decision, not a gap |
| **Plugin system / extension hooks** | Plugin systems require stable internal APIs, versioning, documentation, and backwards compatibility — a huge tax on a v1 product | Build what Detent needs; generalize later if the need is real |
| **Built-in code execution sandbox** | Harness frameworks that include their own sandboxed execution environments (Kaji-style) solve a different problem; Claude Code's `--dangerously-skip-permissions` already handles execution | Delegate execution to Claude Code; don't own that surface |
| **Context management complexity** | Sophisticated context summarization, dynamic tool scoping per step, and context window optimization are real production problems — but premature for v1 | Address when context limits actually cause failures; don't pre-optimize |
| **Auto-healing / self-modification of the harness** | "Agentic flywheel" where agents recommend harness improvements is powerful but requires stable evaluations and production data to work — a v3 concern | Harness is human-maintained; agents operate within it, not on it |
| **Chat-based interaction model** | Conversational agent interfaces (AutoGen-style GroupChat) optimize for exploratory dialogue; Detent optimizes for deterministic pipeline execution | Skill invocations are explicit commands, not conversations; `/harness:code` not "hey, write the code" |
| **Framework-level MCP server management** | MCP is the tool connectivity standard; managing MCP servers inside the harness adds framework-level complexity for something Claude Code already handles | Use MCP as Claude Code provides it; don't wrap it |

---

## Feature Dependencies

```
Pipeline stage structure
  → Session state persistence (stages are useless without state surviving /clear)
  → CLI tool as state mutation point (state needs single writer)
  → Agent prompt templates (each stage needs a prompt contract)

Truth surface / constraint ledger
  → Session state persistence (constraints must persist)
  → Pipeline stage structure (constraints are scoped to stages)

Adversarial coding loop
  → Agent prompt templates (Coder and Evaluator need distinct prompts)
  → Iteration loop with max-cap (loop must terminate)
  → Observability / execution log (must observe loop iterations)

Cross-stage rollback
  → Session state persistence (need stage checkpoints to roll back to)
  → Truth surface (rollback triggered by constraint violation)
  → Pipeline stage structure (know which stage to roll back to)

Algedonic signal system
  → Human-in-the-loop gates (escalation goes to the same human attention channel)
  → Observability / execution log (signal must be logged, not just fired)

Web UI Layer 2 (runtime dashboard)
  → Observability / execution log (dashboard reads the log)
  → Process management / stream-json monitoring (needs live process data)
  → Web UI Layer 1 (configuration UI prerequisite)

Async behavior logging (Gemini CLI hook)
  → Observability / execution log (logging IS the observability feature)
  → No dependency on core agent prompts (by design)
```

---

## MVP Recommendation

**Phase 1 (M1 Engine): Build the pipeline skeleton reliably.**

Prioritize:
1. CLI tool + state management (without this, nothing else works)
2. Pipeline stage structure with session bridging (prove the 5-stage flow works end-to-end)
3. Config system + two-mode operation (autonomous/supervised)
4. Basic human-in-the-loop gates (block/continue at stage boundaries)
5. Algedonic signal system (urgent escalation must be in M1, not deferred)

Defer:
- Truth surface / constraint ledger — validates in M2 once stages are stable; implementing constraints on an unstable pipeline creates rework
- Adversarial Coder/Evaluator loop — requires stable Coding stage first
- Cross-stage rollback — requires stable constraint ledger to know what triggered rollback
- Web UI — M3; the dashboard is only useful once pipelines run reliably enough to warrant monitoring
- Async Gemini logging — useful but non-blocking; implement after core pipeline works

**Phase 2 (M2 Agents): Add the quality mechanisms that make Detent's constraint propagation real.**

Add:
- Truth surface + constraint ledger
- Full agent prompt templates (all planning substages + Coder + Evaluator)
- Adversarial coding loop with max-cap
- Cross-stage rollback on contradiction
- Async behavior logging via Gemini CLI hook

**Phase 3 (M3 Web UI): Add visibility.**

Add:
- Web UI Layer 1: pipeline configuration
- Web UI Layer 2: real-time runtime dashboard
- Multi-pipeline monitoring

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes | HIGH | Multiple sources converge on same features; confirmed by harness engineering literature and production framework comparisons |
| Differentiators | MEDIUM | Truth surface / constraint ledger is novel — no mainstream analog found; adversarial evaluator loop confirmed by SWE-bench research; cross-stage rollback is inferred from design, not externally validated |
| Anti-features | MEDIUM | Based on design intent in PROJECT.md + ecosystem research on what creates accidental complexity; some are explicit PROJECT.md constraints |
| MVP sequencing | MEDIUM | Logical dependency order; actual phase boundaries should be validated during M1 execution |

---

## Sources

- [Harness Engineering — Martin Fowler](https://martinfowler.com/articles/harness-engineering.html) (feedforward/feedback controls, humans-on-the-loop pattern)
- [Humans and Agents in Software Engineering Loops — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html) (harness as the primary control mechanism)
- [Agent Harness Complete Guide — harness-engineering.ai](https://harness-engineering.ai/blog/agent-harness-complete-guide/) (6 foundational components, anti-patterns including context rot, tool explosion, silent failures)
- [The State of AI Agent Frameworks in 2026 — Fordel Studios](https://fordelstudios.com/research/state-of-ai-agent-frameworks-2026) (LangGraph/CrewAI/AutoGen production reality)
- [Agent Engineering: Harness Patterns, IMPACT Framework — MorphLLM](https://www.morphllm.com/agent-engineering) (IMPACT framework: Intent/Memory/Planning/Authority/Control Flow/Tools)
- [What Is Harness Engineering? Complete Guide 2026 — NxCode](https://www.nxcode.io/resources/news/what-is-harness-engineering-complete-guide-2026) (5 pillars; Vercel improved results by removing 80% of tools)
- [Planner-Generator-Evaluator Pattern — MindStudio](https://www.mindstudio.ai/blog/planner-generator-evaluator-pattern-gan-inspired-ai-coding) (adversarial evaluator loop; 2-3 iterations convergence)
- [Evaluator Reflect-Refine Loop Patterns — AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/evaluator-reflect-refine-loop-patterns.html) (generator-evaluator-optimizer loop structure)
- [Orchestrate teams of Claude Code sessions — Official Claude Code Docs](https://code.claude.com/docs/en/agent-teams) (agent team primitives, task list, mailbox, hooks: TeammateIdle/TaskCreated/TaskCompleted)
- [LangGraph Production Multi-Agent System — MarkAICode](https://markaicode.com/langgraph-production-agent/) (checkpointing, error recovery, observability)
- [Top 9 AI Agent Frameworks March 2026 — Shakudo](https://www.shakudo.io/blog/top-9-ai-agent-frameworks) (ecosystem overview, framework comparison)
- [Demystifying Evals for AI Agents — Anthropic Engineering](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (evaluation patterns for coding agents)
