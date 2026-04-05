# Architecture Patterns

**Domain:** AI agent orchestration harness framework (control-theory-based, CLI-first)
**Project:** Detent
**Researched:** 2026-04-05
**Confidence:** HIGH (multiple verified sources including academic, official framework docs, and production system post-mortems)

---

## Recommended Architecture

Detent is a **sequential pipeline harness** with a **single-authority state bus**. It follows the Pipes and Filters cloud design pattern adapted for AI agents: each pipeline stage is an isolated Claude Code session, the `.harness/` directory is the durable state bridge between sessions, and `harness-tools.cjs` is the single point through which all state mutations flow.

The VSM (Viable System Model) maps onto this architecture as follows:

- **System 1 (Operations):** Individual agent sessions (Coder, Evaluator, D-Critique, etc.) executing tool calls
- **System 2 (Coordination):** `harness-tools.cjs` as the conflict-resolution authority — serializes mutations, prevents races
- **System 3 (Control):** Pipeline stage gates (autonomous vs. supervised mode toggles); constraint ledger enforcement
- **System 3\* (Audit):** Algedonic signal system — bypasses normal processing to escalate directly to human when actuality deviates from capability
- **System 4 (Intelligence):** Truth surface — frozen decisions and constraint ledger that carry environmental intelligence across stages
- **System 5 (Policy):** Config system (`config.json`) — mode selection, model budget, pipeline toggles; defines system identity and behavior

---

## Component Boundaries

| Component | Responsibility | Input From | Output To |
|-----------|---------------|------------|-----------|
| **harness-tools.cjs** | Single authority for all state mutations; serializes writes; exposes read/write CLI API | Skill invocations, agent subprocess hooks | `.harness/state.json`, `.harness/truth-surface/`, `.harness/config.json` |
| **Skill files** (`.claude/commands/harness/*.md`) | Workflow definitions; define what each pipeline stage does, which agents to spawn, what gates apply | Human invocation (`/harness:setup`, etc.) | Agent subprocess spawns; calls to harness-tools.cjs |
| **Agent prompt templates** | Stage-specific agent personas; contain goals, constraints, output format; no state awareness | Skill files inject context at spawn time | Artifacts written to `.harness/truth-surface/` or coding workspace |
| **`.harness/state.json`** | Pipeline position, current stage, session continuity data, iteration counts | harness-tools.cjs writes only | Skills read at startup; agents read indirectly via skill-injected context |
| **`.harness/truth-surface/`** | Constraint ledger; frozen decisions; stage artifacts; the "single source of truth" for requirements | Agent outputs written via harness-tools.cjs | All subsequent agents receive this as context; reentry rollback mechanism reads it |
| **`.harness/config.json`** | Mode (autonomous/supervised), model budget, locale, pipeline toggles | Human setup (Layer 1 Web UI or direct edit) | Skills read to configure gate behavior; harness-tools.cjs enforces budget limits |
| **Gemini CLI hook** | Async behavior log generation; zero-intrusion observability | stream-json output from Claude Code subprocess + file artifacts | Log files in `.harness/logs/` |
| **Web UI Layer 1** (future) | Pipeline configuration (repo-level, one-time setup) | Human browser interaction | Writes to `.harness/config.json` via harness-tools.cjs |
| **Web UI Layer 2** (future) | Real-time dashboard; monitors multiple parallel pipelines | stream-json (real-time progress) + file watch `.harness/` (persistent state) | Read-only display; no state mutations |
| **Process manager** (future M3) | Spawn and monitor Claude Code instances | Web UI Layer 2 commands | Claude Code subprocess via `-p --output-format stream-json --dangerously-skip-permissions` |

---

## Data Flow

### Core Execution Flow (Per Stage)

```
Human invokes /harness:[stage]
         |
         v
Skill file reads .harness/state.json        <- session continuity
         |
         v
Skill file reads .harness/config.json       <- mode, budget, toggles
         |
         v
Skill file reads .harness/truth-surface/    <- frozen requirements, prior decisions
         |
         v
Skill assembles agent context (template + injected state)
         |
         v
Claude Code subprocess spawned
(-p --output-format stream-json --dangerously-skip-permissions)
         |
         +---> stream-json stdout --> Gemini CLI hook --> .harness/logs/  [async, no intrusion]
         |
         v
Agent executes (tool calls, reasoning, artifact generation)
         |
         v
Agent calls harness-tools.cjs to commit outputs
         |
         v
harness-tools.cjs validates + writes:
  .harness/truth-surface/[stage]-artifacts
  .harness/state.json (stage advance)
         |
         v
[Supervised mode: GATE — human approval required]
[Autonomous mode: auto-advance]
         |
         v
Next stage or terminal state
```

### Coding-Evaluator Iteration Loop

```
Coder agent executes
         |
         v
harness-tools.cjs writes code artifacts + increments iteration count
         |
         v
Evaluator agent reviews (adversarial, SWE-bench inspired)
         |
         +-- PASS --> harness-tools.cjs writes PASS, advance pipeline
         |
         +-- FAIL (iteration < max) --> specific technical feedback written to truth-surface
         |                              Coder re-spawned with feedback as context
         |
         +-- FAIL (iteration >= max) --> Algedonic signal: escalate to human
```

### Algedonic Signal Flow (System 3\*)

```
Any stage detects capability/actuality deviation
(planning contradiction, max iterations exceeded, constraint violation)
         |
         v
harness-tools.cjs writes ALERT to .harness/state.json
(bypasses normal stage-advance logic)
         |
         v
Human notified immediately (CLI output, future: Web UI Layer 2 alert)
         |
         v
Human decides: continue / rollback / modify constraints
         |
         v
[Rollback path]: harness-tools.cjs resets state to prior stage
truth-surface constraints updated
```

### Reentry / Cross-Stage Rollback

```
Planning contradiction detected during Coding stage
         |
         v
harness-tools.cjs reads constraint ledger from truth-surface
         |
         v
Contradiction recorded; algedonic signal raised
         |
         v
State rolled back to appropriate Planning sub-stage
         |
         v
Affected truth-surface artifacts unfrozen, marked for revision
         |
         v
Pipeline resumes from rollback point
```

### Web UI Data Channels (Layer 2, Future)

```
Claude Code subprocess
         |
         +-- stdout (stream-json) --> SSE / WebSocket stream --> Dashboard real-time view
         |
         +-- file writes to .harness/ --> File watcher --> Dashboard state view
```

Two-channel design: stream-json for in-flight progress, file watch for authoritative state. This separation means the dashboard never risks corrupting state — it is read-only from both channels.

---

## Patterns to Follow

### Pattern 1: Single-Authority State Bus

**What:** One executable (`harness-tools.cjs`) owns all state mutations. All other components read state but only write via this CLI tool.

**Why:** Prevents race conditions when multiple agent subprocesses could theoretically write simultaneously. Mirrors GSD's battle-tested pattern (130+ versions). State transitions are atomic and auditable.

**Example:**
```bash
# Agent writes output via tool, never directly
node harness-tools.cjs write-artifact --stage plan --file constraints.md --content "..."
node harness-tools.cjs advance-stage --from plan --to code
node harness-tools.cjs raise-algedonic --reason "max iterations exceeded"
```

### Pattern 2: File System as Session Bridge

**What:** Each skill invocation is one Claude Code session. State crosses the `/clear` boundary via `.harness/` files, not in-context memory.

**Why:** Claude Code sessions are ephemeral. The LLM has no memory between sessions. Files are the only durable medium available without an API key.

**Implementation:** Skills read all required context at startup from `.harness/`, inject it into the agent prompt. The agent treats this injected context as authoritative.

### Pattern 3: Context Injection at Spawn Time

**What:** Agent templates are static documents. Dynamic context (current stage, frozen decisions, iteration count, mode) is injected by the skill at subprocess spawn time.

**Why:** Separates concerns — agent prompts define cognitive role, skills define orchestration logic. Avoids coupling agent templates to state format.

**Boundary:** Agent templates never read `.harness/` directly. Skills prepare the full context string and pass it to the agent via the `-p` flag.

### Pattern 4: Async Observability via Side Channel

**What:** Gemini CLI processes stream-json output from Claude Code subprocess independently. No logging hooks inside agent prompts.

**Why:** Any logging inside the core agent prompt would consume context budget and potentially alter behavior. Side-channel logging (Gemini CLI reading stream-json) is zero-intrusion.

**Implementation:** Gemini CLI hook runs as a parallel process watching stdout of Claude Code subprocess, generates structured behavior logs, writes to `.harness/logs/`.

### Pattern 5: Dual-Mode Gate Architecture

**What:** The same pipeline runs in two modes. In supervised mode, `harness-tools.cjs` pauses and emits a gate prompt before advancing stage. In autonomous mode, it auto-advances.

**Why:** Simple tasks need no human intervention. Complex tasks need human judgment at stage boundaries. The gate is a configuration toggle, not an architectural difference.

**Boundary:** Gate logic lives entirely in `harness-tools.cjs`. Skills and agent templates are mode-agnostic.

### Pattern 6: Frozen Constraint Propagation

**What:** Once a decision is frozen in the truth surface, all subsequent stages receive it as inviolable context. Contradictions trigger reentry, not silent override.

**Why:** This is the core control-theory mechanism — constraint propagation prevents downstream agents from undoing upstream decisions. Aligns with VSM System 4 (intelligence surface that informs all operations).

**Boundary:** Only harness-tools.cjs can freeze or unfreeze constraints. Agents propose; the harness commits.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Agent Direct State Write

**What:** Agent calls a file write tool to update `.harness/state.json` or truth-surface files directly, bypassing `harness-tools.cjs`.

**Why bad:** Removes atomicity guarantees. Creates race conditions if future parallel pipelines are introduced. Makes state history unauditable.

**Instead:** Agent writes output to a staging area; harness-tools.cjs validates and commits.

### Anti-Pattern 2: Monolithic Skill (Single-Session Pipeline)

**What:** One `/harness:run-all` skill that runs the entire Discovery → Achieve pipeline in a single Claude Code session.

**Why bad:** Context budget will not accommodate the full pipeline. Session length increases failure probability. Cannot resume from mid-pipeline failure.

**Instead:** One skill per stage. Each skill is independently resumable. State persistence makes mid-pipeline recovery possible.

### Anti-Pattern 3: Logging Inside Agent Prompts

**What:** Adding `<log>` directives or structured output requirements to agent prompt templates for observability.

**Why bad:** Consumes context budget. Alters agent behavior (model responds differently when asked to format output). Couples observability to agent cognitive layer.

**Instead:** Parse stream-json output via Gemini CLI hook. Agent prompts focus exclusively on the cognitive task.

### Anti-Pattern 4: Hard-Coded Mode in Agent Templates

**What:** Agent templates contain `IF supervised THEN ask human` logic.

**Why bad:** Mixes orchestration concerns into cognitive layer. Makes agents harder to test. Mode changes require template edits across all agents.

**Instead:** Mode is enforced entirely by `harness-tools.cjs` gate logic. Agents are always mode-agnostic.

### Anti-Pattern 5: Truth Surface as Append-Only Log

**What:** Treating the truth surface as a log of everything that happened, rather than a ledger of what is currently frozen/authoritative.

**Why bad:** Agents receive large, noisy context. No clear signal about which decisions are frozen vs. exploratory. Rollback becomes ambiguous.

**Instead:** Truth surface has explicit sections: `FROZEN` (inviolable), `PROPOSED` (under review), `SUPERSEDED` (rolled back). harness-tools.cjs manages section transitions.

---

## Suggested Build Order (Phase Dependencies)

This order is derived from component dependency chains — each layer depends on the layer below it being stable.

### Layer 1: State Infrastructure (Must be first)
**Components:** `harness-tools.cjs` core, `.harness/` directory structure, `state.json` schema, `config.json` schema

**Why first:** Everything else depends on state being readable and writable. CLI tool must exist before skills can call it. Schema must be stable before agents are designed around it.

**Dependencies:** None. Pure Node.js CLI, no external services.

### Layer 2: Pipeline Skeleton (Skills without Agents)
**Components:** `/harness:setup` skill, `/harness:discovery` skill skeleton, stage-advance logic in harness-tools.cjs, session-continuity mechanism

**Why second:** Validates the session-bridging pattern before investing in agent templates. A skill that reads state, does nothing, and writes state proves the architecture. Catch schema issues early.

**Dependencies:** Layer 1 complete and stable.

### Layer 3: Truth Surface and Constraint Ledger
**Components:** `.harness/truth-surface/` structure, freeze/propose/supersede transitions in harness-tools.cjs, reentry mechanism (rollback to prior stage)

**Why third:** Must exist before Planning agents are designed — they write to the truth surface. Constraint propagation is the core value mechanism; it must be solid before agents rely on it.

**Dependencies:** Layer 1 (state management), Layer 2 (stage structure).

### Layer 4: Planning Agent Templates (A-J Pipeline)
**Components:** D-Critique, G-Red/Blue, H-Review, J-Compile agent prompt templates; full `/harness:discovery` and `/harness:plan` skills; gate logic in supervised/autonomous modes

**Why fourth:** Agent templates are designed around the truth surface structure established in Layer 3. Gate logic is implemented here.

**Dependencies:** Layers 1-3.

### Layer 5: Coding-Evaluator Loop
**Components:** Coder agent template, Evaluator agent template, iteration counter in harness-tools.cjs, max-iteration algedonic signal, `/harness:code` skill

**Why fifth:** The adversarial loop is independent of Planning agents but needs the truth surface (Evaluator checks against frozen constraints) and algedonic signal infrastructure.

**Dependencies:** Layers 1-3 (truth surface, algedonic signal). Layer 4 not strictly required but its outputs are Coder's inputs in practice.

### Layer 6: Observability Side Channel
**Components:** Gemini CLI hook, stream-json parsing, `.harness/logs/` structure, `/harness:verify` and `/harness:achieve` skills

**Why sixth:** Logging does not block pipeline function. Adding it after the pipeline skeleton is proven keeps complexity out of early phases. Verify/Achieve are the final pipeline stages.

**Dependencies:** All prior layers for full utility; stream-json format stable by Layer 4.

### Layer 7: Web UI (Future Milestone)
**Components:** Layer 1 (config UI), Layer 2 (real-time dashboard), process manager for parallel pipeline spawning

**Why last:** Entirely dependent on the file-based state API being stable. The Web UI is a read/display layer over existing `.harness/` structures plus minimal config-write access.

**Dependencies:** All prior layers fully stable. stream-json format finalized.

---

## Scalability Considerations

| Concern | At 1 pipeline (M1/M2 target) | At N parallel pipelines (M3 target) |
|---------|------------------------------|--------------------------------------|
| State contention | Not an issue — sequential | harness-tools.cjs must namespace state per pipeline instance |
| Log volume | Flat files sufficient | `.harness/logs/[pipeline-id]/` partitioning; consider rotation |
| Dashboard | Not applicable | stream-json per-process + file watch per `.harness/[pipeline-id]/` |
| Context budget | Per-stage isolation prevents overflow | No change — already session-isolated |
| Algedonic signals | Single queue, human monitors one | Multi-pipeline alert aggregation needed in Web UI Layer 2 |

Note: M1/M2 scope (single pipeline, single developer) does not need to solve multi-pipeline state. Design `harness-tools.cjs` with a `--pipeline-id` parameter from the start to avoid a breaking refactor when M3 introduces parallelism.

---

## Sources

- [AI Agent Orchestration Patterns — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) (updated 2026-03-07, HIGH confidence)
- [Building Effective AI Coding Agents for the Terminal — arXiv 2603.05344v2](https://arxiv.org/html/2603.05344v2) (HIGH confidence, peer-reviewed)
- [Harness Architecture and Agent Modes — Mastra/DeepWiki](https://deepwiki.com/mastra-ai/mastra/16.1-harness-architecture-and-agent-modes) (MEDIUM confidence)
- [What is an Agent Harness — Parallel.ai](https://parallel.ai/articles/what-is-an-agent-harness) (MEDIUM confidence)
- [Viable Systems: How to Build a Fully Autonomous Agent — Tim Kellogg](https://timkellogg.me/blog/2026/01/09/viable-systems) (MEDIUM confidence, VSM application)
- [The Levels of Agentic Coding — Tim Kellogg](https://timkellogg.me/blog/2026/01/20/agentic-coding-vsm) (MEDIUM confidence)
- [Human-in-the-Loop Approval Gate Patterns — MachineLearningMastery](https://machinelearningmastery.com/building-a-human-in-the-loop-approval-gate-for-autonomous-agents/) (MEDIUM confidence)
- [Agent Orchestration Patterns: Swarm vs Mesh vs Hierarchical — GuruSup](https://gurusup.com/blog/agent-orchestration-patterns) (MEDIUM confidence)
- [Viable System Model — Wikipedia](https://en.wikipedia.org/wiki/Viable_system_model) (HIGH confidence, foundational reference)
