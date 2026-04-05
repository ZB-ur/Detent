# Phase 3: Truth Surface and Planning Agents - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Constraint propagation becomes real — frozen decisions exist in `.detent/truth-surface/`, adversarial planning agent templates (D-Critique, G-Red, G-Blue, H-Review, J-Compile) are defined as `.claude/agents/*.md`, and the planning pipeline (D → G-Red → G-Blue → H → J) runs end-to-end within `/detent:plan`. Playbooks migrated from ECL provide quality standards and protocols.

Requirements: TRUTH-01, TRUTH-02, TRUTH-03, PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05

</domain>

<decisions>
## Implementation Decisions

### Truth Surface Mutation Model
- **D-01:** New detent-tools.cjs commands for truth surface: `truth-propose`, `truth-freeze`, `truth-read`. Maintains single-mutation-point pattern from Phase 1.
- **D-02:** Any agent can propose freezing (amplifier). CLI checks decision maturity before allowing freeze (attenuator) — entry must have `challenged_by` field (touched by D or G stage). In supervised mode, freeze requires human gate confirmation. In autonomous mode, mature entries freeze directly.
- **D-03:** FROZEN entries are immutable — `truth-propose` and `truth-freeze` hard-reject attempts to overwrite a FROZEN entry (CLI exits non-zero). No SUPERSEDED mechanism in Phase 3.
- **D-04:** Truth surface files use Markdown + YAML frontmatter format. Human-readable, CLI parses structured sections. Each decision entry has status (PROPOSED/FROZEN), rationale, challenged_by, and source agent fields.

### Agent Template Design
- **D-05:** Agent templates defined as `.claude/agents/*.md` with YAML frontmatter (description, tools, model, maxTurns). Claude Code native format, travels with the repo.
- **D-06:** Minimum privilege per agent — each agent gets only the tools required for its role (e.g., D-Critique: Read + Bash for truth-read; J-Compile: Read + Write for handoff document).
- **D-07:** Data flows via files — each agent writes output to `.detent/plan/` under a conventional filename, next agent reads it via `@` reference. Skill does not relay content between agents.
- **D-08:** Conservative maxTurns defaults (5-10 per agent, tuned by role complexity). Hardcoded in frontmatter for Phase 3; configurable maxTurns deferred to post-v1 (see SEED-001).

### Planning Pipeline Orchestration
- **D-09:** Single skill sequential dispatch — `/detent:plan` internally spawns D → G-Red → G-Blue → H → J in order using `cmdSpawn`. One skill manages the entire flow.
- **D-10:** G-Red runs first (attack), G-Blue runs second with Red's output as input (targeted defense). Sequential, not parallel — true adversarial interaction.
- **D-11:** H-Review rejection triggers rollback to H's specified `reentry_stage` (D or G). Planning re-runs from that stage. Maximum 2 retries, consistent with RECOV-04's reentry_depth limit. Exceeding 2 retries escalates to human.
- **D-12:** Skill is orchestrator only (father model pattern) — does NOT read agent full outputs into its own context. Only exception: reads H-Review's verdict field (approved/rejected + reentry_stage) for if/else routing. Agent outputs flow between agents via file `@` references, not through the skill.
- **D-13:** Any agent spawn failure stops the entire planning pipeline immediately. Intermediate artifacts are preserved in `.detent/plan/` for human inspection. Skill reports which agent failed and at what point.

### Playbook Migration (ECL → Detent)
- **D-14:** Principle migration — extract core principles from ECL's stage-playbook, subagent-protocol, and handoff-quality-bar. Reimplement using Detent's architecture. No direct code copy.
- **D-15:** Playbooks stored in `.detent/playbooks/` in the target repo. Created during `/detent:setup` alongside truth surface directory.
- **D-16:** Agents reference playbooks via `@.detent/playbooks/xxx.md` in their prompt templates. Same mechanism as shared rules.md.
- **D-17:** Fixed default playbook content for Phase 3. Users can manually edit files but no configuration interface. Sufficient for MVP.

### Claude's Discretion
- Specific tool assignments per agent (which tools each D/G/H/J agent gets)
- Internal file naming conventions for agent outputs in `.detent/plan/`
- Exact maxTurns value per agent within the 5-10 range
- Playbook internal structure and section organization
- H-Review verdict output format (as long as it's machine-parseable by the skill)
- Error message text and formatting

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Patterns
- `CLAUDE.md` — Technology stack (Node.js 22 LTS, CJS, write-file-atomic), Claude Code agent/skill/hook docs, known issues
- `.planning/REQUIREMENTS.md` — TRUTH-01 through TRUTH-03, PLAN-01 through PLAN-05 acceptance criteria
- `.planning/ROADMAP.md` §Phase 3 — Success criteria (5 conditions that must be TRUE)

### Existing Code
- `detent-tools.cjs` — CLI with existing commands (state-read/write, config-read/write, spawn); new truth-* commands extend this
- `.claude/skills/detent-plan/SKILL.md` — Current placeholder skill to be replaced with real orchestration
- `.claude/skills/_shared/rules.md` — Shared pipeline rules (single-mutation-point, gate check pattern, skill exit pattern)
- `.claude/skills/detent-setup/SKILL.md` — Reference for skill structure and frontmatter patterns

### Prior Phase Context
- `.planning/phases/01-state-infrastructure/01-CONTEXT.md` — CLI architecture decisions, write-file-atomic pattern
- `.planning/phases/02-pipeline-skeleton/02-CONTEXT.md` — Subprocess spawning (cmdSpawn), gate architecture, session continuity, skill structure decisions

### Seeds
- `.planning/seeds/SEED-001-maxturns-configurable.md` — Deferred: maxTurns config.json override (post-v1)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detent-tools.cjs` (326 lines) — CLI with spawn command, atomic writes, parseArgs helper. New truth-* commands extend this naturally.
- `.claude/skills/_shared/rules.md` — Shared rules pattern. Agent templates can reference playbooks the same way.
- `test/run-tests.js` — Existing test runner for CLI commands. Truth surface commands need similar tests.
- `cmdSpawn()` function — Already handles `child_process.spawn` with stream-json, stdio workaround, JSONL parsing. `/detent:plan` will call this for each agent.

### Established Patterns
- Single-mutation-point: all `.detent/` writes through detent-tools.cjs CLI commands
- Skills use `@` references for shared content (rules.md)
- Config-driven gates with supervised/autonomous mode branching
- State.json as routing authority for pipeline position
- Each skill reads state at start, writes state on exit

### Integration Points
- `detent-tools.cjs` needs new commands: `truth-propose`, `truth-freeze`, `truth-read`
- `.claude/agents/` directory needs to be created with 5 agent templates (D, G-Red, G-Blue, H, J)
- `/detent:plan` SKILL.md needs complete rewrite from placeholder to orchestrator
- `.detent/playbooks/` needs to be created during setup (update `/detent:setup`)
- `.detent/plan/` directory used by agents for intermediate file outputs
- config.json schema unchanged — gates already support the planning flow

</code_context>

<specifics>
## Specific Ideas

- Truth surface freeze gate uses a `canFreeze()` pattern: check `challenged_by` field exists (decision maturity), then apply mode-based gate (supervised = human confirm, autonomous = auto-proceed). Three rules: amplifier (any agent proposes) → attenuator (CLI checks maturity) → gate (mode-based confirmation).
- Skill is "father model" — orchestrates but doesn't think. Only reads H's verdict field for routing. Agent outputs flow agent-to-agent via files, never through the skill's context window.
- G-Red/Blue is sequential adversarial: Red produces attack points, Blue reads attack points and produces targeted defense. Not parallel independent analysis.
- Planning retry loop: H rejects → roll back to H's specified stage → re-run from there → H reviews again → max 2 retries then escalate.

</specifics>

<deferred>
## Deferred Ideas

- **maxTurns configurable via config.json** — Agent maxTurns defaults hardcoded in frontmatter; config.json override deferred to post-v1 (SEED-001 planted)
- **SUPERSEDED chain for frozen decisions** — Phase 3 uses hard reject only; audit trail via SUPERSEDED mechanism deferred
- **Playbook template variables** — Dynamic playbook content (e.g., `{{max_iterations}}`) deferred; fixed content for MVP
- **Parallel G-Red/Blue execution** — Current design is sequential for true adversarial interaction; parallel mode could be a future optimization

</deferred>

---

*Phase: 03-truth-surface-and-planning-agents*
*Context gathered: 2026-04-05*
