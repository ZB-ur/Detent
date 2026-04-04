# Project Research Summary

**Project:** Detent
**Domain:** AI agent orchestration harness framework (control-theory based, Claude Code native)
**Researched:** 2026-04-05
**Confidence:** HIGH (stack verified from official docs; pitfalls from peer-reviewed sources; architecture from production post-mortems)

---

## Executive Summary

Detent is a harness framework, not an orchestration framework — this distinction is the most important research finding. Orchestration frameworks (LangGraph, CrewAI, AutoGen) route agents to tasks. A harness constrains agent behavior, surfaces truth, and gates execution quality. Every mainstream harness engineering source (Fowler, MAST taxonomy, harness-engineering.ai) converges on the same architectural conclusion: the framework must be a fixed 5-stage sequential pipeline with a single-authority state bus, not a dynamic graph. Detent's Discovery → Planning → Coding → Verification → Achieve structure is the right instantiation of this pattern.

The recommended approach is to build in three discrete milestones driven by dependency order, not feature priority. M1 establishes the state infrastructure and pipeline skeleton (nothing else is possible without this). M2 adds the quality mechanisms — truth surface constraint propagation, adversarial planning agents, the Coder/Evaluator loop — which are Detent's core differentiators. M3 adds the Web UI visibility layer, which is only useful once pipelines run reliably enough to warrant monitoring. This sequencing is validated by both the architecture's component dependency chain and the feature research's explicit MVP recommendation.

The single highest-priority risk is the 50K token re-injection problem: every Claude Code subprocess invocation without explicit isolation consumes 50K+ tokens in overhead before any work occurs. This is a M1 blocker that must be solved in the subprocess spawner before any meaningful pipeline work can happen. The second major risk is error compounding across pipeline stages — in a 5-stage pipeline where each stage is 85% accurate, end-to-end success falls to 44%. The truth surface constraint ledger (frozen decisions propagated forward as inviolable inputs) is the structural answer to this, and it must be solid in M1/M2 before agents rely on it.

---

## Key Findings

### Recommended Stack

Detent runs inside Claude Code, not standalone. This single constraint eliminates most technology choices: no external API keys, no framework overhead, CommonJS (not ESM) for the tool script, and the file system as the sole durable state bridge between sessions. The core stack is intentionally minimal — Node.js 22 LTS with `write-file-atomic` and `chokidar v4` are the only required npm dependencies for M1/M2.

Two known Claude Code bugs must be treated as hard constraints, not soft preferences: (1) spawning Claude Code from Node.js requires `stdin: "inherit"` to avoid a hang (Issue #771); (2) `--output-format stream-json` stdout is block-buffered when piped and can stop mid-session (Issues #17248, #25670), making the dual-channel fallback (stream-json primary + `session.jsonl` file-watch via chokidar) mandatory rather than optional.

**Core technologies:**

- Node.js 22 LTS: runtime — pre-installed everywhere Claude Code runs, CJS/ESM interop stable, no install step
- CommonJS (.cjs): module format for harness-tools.cjs — synchronous startup, no top-level-await fragility, GSD pattern battle-tested at 130+ versions
- `write-file-atomic` 7.0.0: atomic state writes — rename-based atomicity prevents torn reads; used by npm itself
- `chokidar` 4.x: file watching — CJS-compatible (v5 went ESM-only); cross-platform inotify/kqueue abstraction for session.jsonl fallback
- Claude Code Skills / Subagents / Hooks: native orchestration layer — YAML frontmatter controls invocation, isolation, delegation, and side-effect hooks
- Gemini CLI (system-installed): async behavior logging — invoked via `PostToolUse`/`Stop` hooks with `async: true`; zero intrusion on core agent prompts

**M3 stack (deferred):**

- Fastify 5.x + `@fastify/websocket`: HTTP/WebSocket server — 2-3x faster than Express, native TypeScript, schema validation
- Svelte 5: dashboard UI — 47KB vs React's 156KB, compiled reactivity ideal for high-frequency state updates
- `ws` 8.x: raw WebSocket — no Socket.IO overhead for a local single-developer tool

**Do NOT use:** ESM for harness-tools.cjs, `lowdb` (ESM-only v7), `proper-lockfile` before M3, chokidar v5, React, Express, Socket.IO.

---

### Expected Features

Detent's table stakes match what every production harness provides. Its differentiators are novel — particularly the truth surface constraint ledger, which has no direct analog in any mainstream framework.

**Must have (table stakes):**

- Pipeline stage structure (Discovery → Planning → Coding → Verification → Achieve) — unstructured execution is demo-grade
- Session state persistence across `/clear` boundaries — context windows cannot hold the full pipeline
- CLI tool as single state mutation point — prevents race conditions and provides audit trail
- Human-in-the-loop gates — first-class, configurable, not bolted on; block at stage boundaries in supervised mode
- Iteration loop with max-cap (3-5 iterations) — adversarial loop without hard stop burns tokens and stalls
- Algedonic signal system — urgent escalation bypasses the normal hierarchy to reach the human immediately
- Two-mode operation (autonomous/supervised) — same pipeline, different gate behavior, implemented as config
- Config system (`.harness/config.json`) — inspectable and editable outside agent sessions

**Should have (differentiators):**

- Truth surface with constraint ledger — frozen decisions propagate constraints through the pipeline; no mainstream framework has formal constraint propagation across stages
- Stage-specific agent roles (D-Critique, G-Red/Blue, H-Review, J-Compile) — adversarial framing surfaces contradictions before coding
- Adversarial Coder/Evaluator loop — LangChain improved SWE-bench performance from 52.8% to 66.5% by changing only the harness; the evaluator is the highest-ROI mechanism
- Cross-stage rollback on late contradiction — when Coding discovers a Planning-level contradiction, roll back to the correct substage rather than abort or continue with bad constraints
- Async behavior logging via Gemini CLI hook — zero intrusion on core agent prompts; behavior log generated from stream-json artifacts

**Defer (M3):**

- Web UI Layer 1 (pipeline configuration)
- Web UI Layer 2 (real-time runtime dashboard, multi-pipeline monitoring)

**Anti-features (explicitly out of scope):**

- Generic LLM provider support (Claude Code only, by design)
- Generic workflow DSL (code, not config, for pipeline structure)
- Multi-user collaboration features
- Plugin system
- Built-in code execution sandbox (delegate to Claude Code)

---

### Architecture Approach

Detent is a sequential pipeline harness with a single-authority state bus. The architecture follows the Pipes and Filters pattern adapted for AI agents: each pipeline stage is an isolated Claude Code session, `.harness/` is the durable state bridge between sessions, and `harness-tools.cjs` is the single point through which all state mutations flow. The VSM (Viable System Model) provides the theoretical grounding: harness-tools.cjs is System 2 (coordination), stage gates are System 3 (control), the algedonic signal is System 3* (audit), the truth surface is System 4 (intelligence), and config.json is System 5 (policy).

**Major components:**

1. `harness-tools.cjs` — single authority for all state mutations; serializes writes; exposes read/write CLI API; enforces gate logic, iteration caps, and algedonic signals
2. Skill files (`.claude/commands/harness/*.md`) — workflow definitions for each pipeline stage; assemble agent context from state/truth-surface at spawn time; never own state mutations
3. Agent prompt templates (`.claude/agents/`) — static cognitive role definitions (D-Critique, G-Red/Blue, H-Review, J-Compile, Coder, Evaluator); no state awareness; dynamic context injected by skills at spawn time
4. `.harness/state.json` — pipeline position, stage, session continuity, iteration counts, reentry depth; written only by harness-tools.cjs
5. `.harness/truth-surface/` — constraint ledger with explicit FROZEN / PROPOSED / SUPERSEDED sections; stage artifacts; the "single source of truth" for requirements
6. `.harness/config.json` — mode, model budget, locale, pipeline toggles; read by skills; enforced by harness-tools.cjs
7. Gemini CLI hook — async side-channel observability; reads stream-json output; writes structured behavior logs to `.harness/logs/`

**Key patterns:**

- Single-Authority State Bus: harness-tools.cjs is the only writer; agents propose, the harness commits
- File System as Session Bridge: all durable state lives in `.harness/`; survives `/clear`
- Context Injection at Spawn Time: skills assemble full context (state + truth-surface + config) and pass it via `-p` flag; agent templates never read files directly
- Async Observability via Side Channel: Gemini CLI hook reads stream-json; no logging inside agent prompts
- Dual-Mode Gate Architecture: gate logic lives entirely in harness-tools.cjs; agent templates are mode-agnostic
- Frozen Constraint Propagation: once frozen, constraints are inviolable; contradictions trigger reentry, not silent override

**Build order (from architecture dependency analysis):**

Layer 1 (state infrastructure) → Layer 2 (pipeline skeleton, skills without agents) → Layer 3 (truth surface and constraint ledger) → Layer 4 (planning agent templates) → Layer 5 (Coder/Evaluator loop) → Layer 6 (observability side channel) → Layer 7 (Web UI, M3)

---

### Critical Pitfalls

1. **50K token re-injection per subprocess turn** — Every Claude Code subprocess without explicit isolation re-injects the full global configuration on every turn; 5-turn sessions burn 250K tokens in overhead alone. Mitigation: enforce 4-layer isolation in harness-tools.cjs subprocess spawner (scoped working directory, `.git/HEAD` to block CLAUDE.md traversal, empty plugin dir, project-only settings). This is an M1 blocker.

2. **Error compounding across pipeline stages** — At 85% per-stage accuracy, a 5-stage pipeline achieves only ~44% end-to-end success because errors compound rather than cancel. Mitigation: the constraint ledger must carry discrete structured artifacts (JSON constraints, explicit decisions) between stages — not prose summaries; G-Red/Blue adversarial planning is the structural prevention at the Planning stage.

3. **Coding/Evaluator loop non-convergence** — Vague evaluator feedback produces superficial code changes or sycophantic convergence; Spotify Engineering documented this directly. Mitigation: evaluator output schema must be machine-structured (`[file:line] expected X, got Y`); evaluator requires a deterministic finish line (tests pass, types check, linter clean) before LLM semantic review.

4. **Context window exhaustion without managed compaction** — Long agent sessions silently degrade or lose task specification when the context window fills. Mitigation: proactive compaction triggered at 70% budget; truth surface files serve as the persistent re-injection source; never rely on conversation history alone for constraint knowledge.

5. **Reentry mechanism triggering indefinite rollback** — Rollback without carrying forward the specific contradiction causes Planning to reproduce the same contradiction, triggering rollback again. Mitigation: every reentry must pass the specific contradiction as a new frozen input to Planning; state.json must include a `reentry_depth` field from M1; maximum 2 rollbacks before immediate human escalation.

---

## Implications for Roadmap

Based on combined research, the three-milestone structure is the correct phase organization. Phase boundaries are driven by hard architectural dependencies, not arbitrary feature groupings.

### Phase 1: M1 Engine — State Infrastructure and Pipeline Skeleton

**Rationale:** The harness-tools.cjs CLI tool and .harness/ directory structure are prerequisites for everything else. No skill can call the CLI if it doesn't exist. No agent can persist state if the schema isn't defined. The 50K token re-injection problem must be solved here or it poisons every subsequent phase.

**Delivers:** A working end-to-end pipeline skeleton that proves session bridging, autonomous/supervised mode toggling, and algedonic signal routing — before any production-quality agent templates exist.

**Addresses from FEATURES.md:** Pipeline stage structure, session state persistence, CLI tool as state mutation point, human-in-the-loop gates, algedonic signal system, two-mode operation, config system.

**Avoids from PITFALLS.md:** 50K token re-injection (subprocess spawner with 4-layer isolation), state race conditions (CLI-as-single-mutation-point enforced from day one), reentry counter missing (state.json schema includes `reentry_depth` from the start), algedonic vs. audit confusion (signal schema defined before implementation).

**Key deliverables:**
- `harness-tools.cjs` with atomic state reads/writes, gate logic, algedonic signal raising, iteration counter, reentry counter
- `.harness/` directory structure and schemas (state.json, config.json, truth-surface layout)
- Skill files for all 5 pipeline stages (skeleton, not full agent templates)
- Session-continuity mechanism (skills read .harness/ at startup, inject into agent context)
- Subprocess spawner with 4-layer isolation

### Phase 2: M2 Agents — Quality Mechanisms and Constraint Propagation

**Rationale:** The pipeline skeleton from M1 proves the architecture works. M2 adds the mechanisms that make Detent's constraint propagation real — the truth surface, adversarial planning agents, and the Coder/Evaluator loop. These are Detent's core differentiators and require a stable pipeline to build on.

**Delivers:** A fully-featured pipeline with constraint propagation, adversarial planning, an adversarial coding loop, cross-stage rollback, and async observability — the complete Detent value proposition.

**Addresses from FEATURES.md:** Truth surface with constraint ledger, stage-specific agent roles (D-Critique, G-Red/Blue, H-Review, J-Compile), adversarial Coder/Evaluator loop with max-cap, cross-stage rollback on contradiction, async behavior logging via Gemini CLI hook, full agent prompt templates.

**Avoids from PITFALLS.md:** Error compounding (truth surface carries structured artifacts between stages), Coder/Evaluator non-convergence (machine-structured evaluator output schema), context exhaustion (proactive compaction at 70%, truth surface as re-injection source), hallucinated consensus (G-Red must be genuinely adversarial against D-Critique), agent drift (role boundaries re-injected at decision points), verification that only checks self-consistency (requirements traceability step against frozen ledger).

**Key deliverables:**
- Truth surface FROZEN/PROPOSED/SUPERSEDED structure in harness-tools.cjs
- Full agent prompt templates: D-Critique, G-Red, G-Blue, H-Review, J-Compile, Coder, Evaluator
- Complete `/harness:discovery` and `/harness:plan` skills with all planning substages
- Adversarial Coder/Evaluator loop with machine-structured feedback schema
- Cross-stage rollback mechanism with contradiction-as-new-constraint propagation
- `/harness:verify` and `/harness:achieve` skills
- Gemini CLI hook integration for async behavior logging

### Phase 3: M3 Web UI — Visibility Layer

**Rationale:** The dashboard is only useful once pipelines run reliably enough to monitor. Building M3 before M2 is complete produces a dashboard with nothing worth displaying. M3 depends on the file-based state API being stable, the stream-json format being finalized, and the pipeline running reliably.

**Delivers:** Real-time dashboard for monitoring one or more parallel pipeline instances; pipeline configuration UI.

**Addresses from FEATURES.md:** Web UI Layer 1 (pipeline configuration), Web UI Layer 2 (real-time runtime dashboard), multi-pipeline monitoring.

**Avoids from PITFALLS.md:** Dual-channel race condition (stream-json = transient display authority; file system = persistent state authority; never update persistent state from stream-json events alone), shared state corruption in parallel pipelines (per-pipeline isolated subdirectory under .harness/, never shared mutable state).

**Key deliverables:**
- Fastify 5.x + `@fastify/websocket` server
- Svelte 5 dashboard with dual-channel state reconciliation
- Web UI Layer 1: config editor writing to .harness/config.json via harness-tools.cjs
- Web UI Layer 2: real-time progress view (stream-json) + persistent state view (file watch)
- Process manager for parallel pipeline spawning with `--pipeline-id` namespacing

### Phase Ordering Rationale

- Layer dependencies drive the order: harness-tools.cjs and state schemas must exist before skills can call them; truth surface structure must be defined before agent templates can write to it; agent templates must produce stable artifacts before the evaluator can evaluate them; the full pipeline must run reliably before a dashboard is worth building.
- The `--pipeline-id` parameter should be designed into harness-tools.cjs in M1 even though M3 is when parallel pipelines are introduced — retrofitting it later would require a breaking schema change.
- The reentry counter and escalation threshold belong in the M1 state schema, not M2, because adding them later requires migrating existing state files.
- Gemini CLI hook goes in M2 (not M1) because it adds observability to an already-running pipeline; implementing it before the pipeline exists produces logs of nothing.

### Research Flags

Phases likely needing deeper research during planning:

- **M2 — Agent prompt templates:** The adversarial planning structure (D-Critique → G-Red/Blue → H-Review → J-Compile) is novel with limited implementation precedent. The exact prompt contract for each role, the output format of the constraint ledger, and the specifics of G-Red's adversarial stance against D-Critique all need careful design. Recommend `/gsd:research-phase` before finalizing M2 agent template tasks.
- **M2 — Cross-stage rollback:** The reentry mechanism with contradiction-as-frozen-input is novel; no mainstream framework implements this exact pattern. The state transitions, artifact unfreezing logic, and rollback depth logic need detailed design before implementation.
- **M1 — Subprocess isolation:** The 4-layer isolation approach is directionally correct per STACK.md, but exact flags and workarounds for Claude Code subprocess spawning need validation against the current Claude Code version at implementation time (bugs #771, #17248, #25670 have shifting status).

Phases with standard patterns (skip research-phase):

- **M1 — State infrastructure:** CJS tool with write-file-atomic and chokidar is a well-documented pattern (GSD reference, 130+ versions). File-based state with atomic writes is standard Node.js practice.
- **M1 — Skill files and hooks:** Claude Code Skills/Hooks documentation is verified and comprehensive. YAML frontmatter fields, hook types, and exit code semantics are documented and stable.
- **M3 — Web UI:** Fastify + Svelte 5 + ws is a well-documented stack. The architecture (read-only dashboard over file-watch + stream-json) is straightforward given stable M1/M2 state APIs.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Claude Code Skills/Subagents/Hooks verified from official docs April 2026; Node.js 22, write-file-atomic, chokidar v4 verified from npm + GitHub; M3 stack (Fastify/Svelte/ws) verified from official sources |
| Features | MEDIUM-HIGH | Table stakes confirmed by multiple harness engineering sources; differentiators (truth surface, cross-stage rollback) are novel with no direct external validation — design intent from PROJECT.md is sound but implementation correctness is unproven |
| Architecture | HIGH | Core patterns (single-authority state bus, pipes-and-filters, context injection at spawn) verified across peer-reviewed (arXiv 2603.05344) and production sources; VSM mapping has solid theoretical grounding with MEDIUM confidence on software implementation precedent |
| Pitfalls | HIGH | Token re-injection verified with DEV article + issue tracker; error compounding math from peer-reviewed MAST taxonomy (1,600+ annotated traces); loop non-convergence from Spotify Engineering (production system); context exhaustion from MAST FM-1.4 |

**Overall confidence:** HIGH for M1 decisions; MEDIUM for M2 agent design specifics; MEDIUM for M3 (deferred, less urgent).

### Gaps to Address

- **Evaluator output schema:** The research confirms the evaluator must produce machine-structured feedback (`[file:line] expected X, got Y`), but the exact schema — how it maps to harness-tools.cjs commands, how the judge layer validates actionability — needs design during M2 planning.
- **Truth surface file format:** Research confirms the FROZEN/PROPOSED/SUPERSEDED structure conceptually, but the exact file layout (one file per stage? one combined ledger? JSON vs Markdown?) needs a design decision before M2 implementation.
- **Reentry depth limit:** Research recommends maximum 2 rollbacks before escalation, but this is inferred from general agent literature; the right threshold for Detent's specific pipeline may differ and should be validated during early M2 runs.
- **Gemini CLI version stability:** STACK.md identifies user's installed version as 0.35.3; headless flags (`-p`, `--output-format stream-json`) are verified, but Gemini CLI is under active development and flags may shift. Validate at M2 implementation time.
- **stream-json format stability:** The dual-channel fallback is mandatory, but the exact session.jsonl schema that chokidar watches is not documented in the research. Requires Claude Code source inspection or empirical testing in M1.

---

## Sources

### Primary (HIGH confidence)

- Claude Code Skills docs: https://code.claude.com/docs/en/skills — YAML frontmatter, invocation, substitution variables
- Claude Code Subagents docs: https://code.claude.com/docs/en/sub-agents — agent YAML fields, scope, permissions
- Claude Code Hooks docs: https://code.claude.com/docs/en/hooks — hook types, lifecycle events, exit codes
- MAST failure taxonomy (arXiv 2503.13657): https://arxiv.org/html/2503.13657v1 — 14 failure modes, 1,600+ annotated traces
- arXiv 2603.05344v2: https://arxiv.org/html/2603.05344v2 — terminal coding agent architecture, context exhaustion, instruction fade-out
- write-file-atomic npm: https://www.npmjs.com/package/write-file-atomic — v7.0.0, Feb 2026
- Gemini CLI headless mode: https://geminicli.com/docs/cli/headless/ — `-p`, `--output-format stream-json`, exit codes

### Secondary (MEDIUM confidence)

- Harness Engineering — Martin Fowler: https://martinfowler.com/articles/harness-engineering.html — feedforward/feedback controls, humans-on-the-loop
- Spotify Engineering: https://engineering.atspotify.com/2025/12/feedback-loops-background-coding-agents-part-3 — loop non-convergence, production numbers
- Cogent — When AI Agents Collide: https://cogentinfo.com/resources/when-ai-agents-collide-multi-agent-orchestration-failure-playbook-for-2026 — loops, deadlocks, hallucinated consensus
- Azure Architecture Center (AI Agent Orchestration Patterns): https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns — updated 2026-03-07
- VSM application — Tim Kellogg: https://timkellogg.me/blog/2026/01/09/viable-systems — software VSM implementation
- Claude Code Issue #771: https://github.com/anthropics/claude-code/issues/771 — Node.js spawn hang, stdin:inherit workaround
- Claude Code Issue #17248: https://github.com/anthropics/claude-code/issues/17248 — stream-json stdout stops mid-session
- DEV Community (50K token re-injection): https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma — reproducible measurements

### Tertiary (MEDIUM-LOW confidence)

- chokidar GitHub (v5 ESM-only confirmed): https://github.com/paulmillr/chokidar — v4 vs v5 module format
- Svelte 5 vs React 19: https://usama.codes/blog/svelte-5-vs-react-19-vs-vue-4-comparison — bundle size, reactivity benchmarks
- Fastify vs Express 2025: https://betterstack.com/community/guides/scaling-nodejs/fastify-express/ — throughput comparison
- Agent drift quantification (arXiv 2601.04170): https://arxiv.org/abs/2601.04170 — 42% degradation, single study, directionally correct

---

*Research completed: 2026-04-05*
*Ready for roadmap: yes*
