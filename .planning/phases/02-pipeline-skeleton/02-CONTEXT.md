# Phase 2: Pipeline Skeleton - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

All five workflow skills exist (/detent:discovery, /detent:plan, /detent:code, /detent:verify, /detent:achieve) and the end-to-end pipeline runs — discovery through achieve — with two-mode gate behavior and session continuity, before any production agent templates are added. The subprocess spawner exists in detent-tools.cjs with extensible isolation layers.

</domain>

<decisions>
## Implementation Decisions

### Subprocess Spawning & Isolation
- Subprocess spawner lives in detent-tools.cjs as a `spawn` command — consistent with single-mutation-point pattern
- Start with 2 isolation layers: scoped workdir (mandatory) + extensible interface for adding layers later. Defer .git/HEAD block, empty plugin dir, and project-only settings until proven necessary — avoid building on unverified assumptions
- Invoke Claude Code via `child_process.spawn('claude', ['-p', '--output-format', 'stream-json', '--dangerously-skip-permissions'])` with `stdin: 'inherit'` per CLAUDE.md workaround for Issue #771
- Parse stream-json output line-by-line as JSONL with incomplete line buffering

### Gate Architecture
- Gates are data-driven in config.json — toggleable per-stage without code changes
- 3 critical gates at irreversible decision points (default enabled):
  - **Plan gate**: after discovery+planning, before coding — highest leverage, wrong direction wastes everything downstream
  - **Code gate**: after code generation, before commit — human reviews code, non-automatable judgment
  - **Deploy gate**: after verification passes, before merge/deploy — irreversible operation, must confirm
- Config supports defining additional gates (up to 10+), but only these 3 are enabled by default — avoids approval fatigue (POSIWID: design intent is quality assurance, actual effect of too many gates is false sense of security)
- In supervised mode: AskUserQuestion at gate points shows output summary, offers proceed/revise/stop
- In autonomous mode: same skill logic, but gate check reads `mode: autonomous` and auto-proceeds — no code fork

### Session Continuity & Skill Structure
- Each skill reads state.json at start and writes updated stage on exit — next skill picks up from last position (PIPE-04)
- Skills share common rules via @-reference to a shared file (e.g., .claude/skills/_shared/rules.md) — single source of truth for CRITICAL RULES (read state, validate init, single-mutation-point, error handling)
- State.json `pipeline_stage` field is the routing authority for which stage runs next. User invokes manually for Phase 2; future orchestrator may automate
- Each skill prints a next-step hint on exit (e.g., `✓ Discovery complete. Artifacts: .detent/domain-model.md\nNext: /detent:plan`) — this is UX, not routing logic
- Each skill produces stage-specific placeholder artifacts in .detent/ (e.g., discovery → domain-model.md draft, plan → handoff.md) — templates for Phase 2, real content in Phase 3+

### Claude's Discretion
- Internal skill structure details (step ordering, error message text, artifact formatting)
- Specific JSONL event types to parse from stream-json output
- Test approach for subprocess spawning (may need mocking or integration tests)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detent-tools.cjs` (266 lines) — CLI with 5 commands (setup, state-read, state-write, config-read, config-write), `parseArgs()` helper, atomic writes via `write-file-atomic`
- `.claude/skills/detent-setup/SKILL.md` — reference skill pattern with frontmatter, allowed-tools, step-by-step instructions, CRITICAL RULES block
- `test/run-tests.js` — 12 tests using built-in assert + child_process.execSync

### Established Patterns
- Single-mutation-point: all .detent/ writes go through detent-tools.cjs (Phase 1 decision, enforced in skill CRITICAL RULES)
- Skills use `.claude/skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`, `allowed-tools`)
- Write tool excluded from skills that touch .detent/
- CommonJS (.cjs), strict mode, no ESM

### Integration Points
- detent-tools.cjs needs new `spawn` command for subprocess management
- 5 new skills connect to existing state.json and config.json schemas
- config.json needs gate definitions added to schema (new `gates` field)
- Skills @-reference a shared rules file

</code_context>

<specifics>
## Specific Ideas

- Gate config structure should support per-stage enable/disable with sensible defaults (3 gates on, rest off)
- Subprocess spawner should be designed for extensibility — isolation layers as a configurable array, not hardcoded conditionals
- Each skill exit should follow a consistent pattern: update state.json → print completion summary → print next-step hint

</specifics>

<deferred>
## Deferred Ideas

- Additional isolation layers (plugin dir, project-only settings) — add when specific problems surface
- Automatic pipeline orchestration (auto-chaining skills) — Phase 2 is manual invocation, orchestration deferred
- Production agent template integration — Phase 3+
- Gemini CLI logging hooks — Phase 5

</deferred>
