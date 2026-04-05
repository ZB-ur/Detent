<!-- GSD:project-start source:PROJECT.md -->
## Project

**Detent**

Detent is a control-theory-based harness framework for multi-agent orchestration in Claude Code. It provides a structured pipeline (Discovery → Planning → Coding → Verification → Achieve) that constrains AI agents through a persistent truth surface, enabling high-autonomy execution for simple tasks and human-gated supervision for complex ones. The framework is designed for solo developers who want reliable, quality-controlled AI-assisted software development.

**Core Value:** Constraint propagation through a truth surface that ensures every agent decision aligns with frozen requirements — the mechanism that turns chaotic multi-agent output into reliable software delivery.

### Constraints

- **Runtime:** Claude Code subscription only (no API key) — all agent orchestration via CLI subprocess with `-p --output-format stream-json --dangerously-skip-permissions`
- **Logging:** Must not intrude on core agent prompts — behavior logs generated asynchronously via Gemini CLI hook from stream-json + file artifacts
- **Architecture:** CLI tool as single source of truth for state mutations (following GSD pattern) — prevents race conditions
- **Session boundary:** Each skill = one Claude Code session, state bridged via .harness/ files across /clear boundaries
- **Context budget:** Full pipeline (Discovery→Achieve) cannot fit in one session — must be split across skills with file-based state persistence
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Context
## Recommended Stack
### Runtime
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22 LTS (active until Oct 2025, maintenance until Apr 2027) | Runtime for `harness-tools.cjs` and any spawned subprocesses | Pre-installed everywhere Claude Code runs; LTS guarantees; native require() ↔ ESM interop stabilised in v22; no install step needed |
| CommonJS (.cjs) | Node 22 built-in | Module format for `harness-tools.cjs` | Follows GSD's battle-tested pattern; CJS avoids ESM top-level-await surprises in a CLI context; explicit `.cjs` extension signals intent clearly |
### Claude Code Native Layer
| Component | Config location | Purpose | Key facts |
|-----------|----------------|---------|-----------|
| Skills (`SKILL.md`) | `.claude/skills/<name>/SKILL.md` | Workflow entry points (`/harness:setup`, `/harness:discovery`, etc.) | YAML frontmatter controls invocation; `disable-model-invocation: true` for user-triggered pipeline steps; `context: fork` + `agent:` field for subagent delegation; `$ARGUMENTS`, `$ARGUMENTS[N]`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}` substitutions available |
| Subagents (`agents/`) | `.claude/agents/<name>.md` | Specialised agent roles (D-Critique, G-Red/Blue, H-Review, J-Compile, Coder, Evaluator) | YAML frontmatter: `description`, `tools`, `model`, `permissionMode`, `maxTurns`, `hooks`, `skills`, `effort`; stored in project scope (`.claude/agents/`) so they travel with the repo |
| Hooks (`settings.json`) | `.claude/settings.json` | Async side effects (Gemini logging, state mutation audits) | 30+ lifecycle events; four hook types: `command`, `http`, `prompt`, `agent`; hook scoped to skill via skill frontmatter `hooks:` field; exit code 0 = proceed, 2 = block, other = non-blocking error |
| `CLAUDE.md` | `.claude/CLAUDE.md` (project) or `~/.claude/CLAUDE.md` (user) | Persistent context injected into every session | Keep it lean — it is injected unconditionally; reserve for invariants only |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `write-file-atomic` | 7.0.0 (Feb 2026, used by npm itself) | Atomic writes to `.harness/state.json`, `.harness/config.json`, truth surface files | Rename-based atomicity; prevents torn reads during concurrent tool calls; 1,598 dependents; maintained by npm team |
| Native `fs` + JSON | Node built-in | Read state files | Synchronous read is fine for CLI context; no library needed |
| File system as state bridge | — | Session continuity across `/clear` boundaries | `.harness/` directory survives Claude Code session resets; this is the deliberate architecture decision |
### Subprocess / Process Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js `child_process.spawn` | Built-in | Spawn `claude -p --output-format stream-json --dangerously-skip-permissions` | Native; handles streaming stdout line by line |
| `stdio: ["inherit", "pipe", "pipe"]` | — | Critical workaround for Claude Code Node.js spawn bug | Claude Code hangs when spawned with default pipe mode from Node.js (Issue #771, closed but still affects users as of June 2025); `stdin: "inherit"` prevents the hang |
| Line-by-line JSONL parsing | — | Parse stream-json events | Each `\n`-delimited line is a JSON event; buffer incomplete lines between `data` events |
- **Primary:** stream-json stdout for real-time events
- **Fallback:** `chokidar` file-watch on `~/.claude/projects/*/session.jsonl` as the backup event source
### File Watching (Dual-Channel Fallback)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `chokidar` | 4.x (stay on v4, NOT v5) | Watch `.harness/` state files and `session.jsonl` fallback | v5 (Nov 2025) is ESM-only and requires Node 20+; v4 is still CJS-compatible and the correct choice for a `.cjs` tool script |
### Gemini CLI Integration
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Gemini CLI (system-installed) | 0.35.3 (user's installed version) | Async behavior log generation from stream-json artifacts | Zero intrusion on core agent prompts; invoked via `PostToolUse`/`Stop` hooks; free tier sufficient for log generation |
# In a PostToolUse or Stop hook (async: true)
- `-p` / `--prompt`: activates headless mode
- `--output-format stream-json`: JSONL event stream
- stdin pipe: `cat file | gemini -p "..."` or `gemini -p "..." < file`
- exit codes: 0 = success, 1 = API error, 42 = validation error, 53 = turn limit exceeded
### Web UI (M3 — deferred)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fastify | 5.x (current) | HTTP server + WebSocket upgrade | 2-3x faster than Express; native TypeScript support; `@fastify/websocket` plugin for real-time; lower overhead than Express for a developer tool |
| Svelte 5 | 5.x (current) | Dashboard UI | 47KB bundle vs 156KB React; 60% faster DOM updates for real-time data; "runes" reactivity model is ideal for frequent state updates; compiled = no virtual DOM overhead; shadcn-svelte v1.0 available for component library |
| Vite 7 | 7.x (current, Rolldown-based) | Build tool | Ships with SvelteKit; faster builds with Rolldown integration |
| `ws` npm package | 8.x | WebSocket server | Raw WebSocket is sufficient for a single-developer tool; no need for Socket.IO's reconnection/namespace overhead; lower latency |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Module format | CJS (.cjs) | ESM | CJS has synchronous startup; GSD pattern proven over 130 versions; `chokidar` v4 CJS; avoids top-level-await complexity |
| State persistence | `write-file-atomic` + plain JSON | `lowdb` | `lowdb` v7 is ESM-only; overkill abstraction for simple state |
| State persistence | `write-file-atomic` + plain JSON | SQLite (`better-sqlite3`) | Schema is not relational; SQL query overhead for 3-5 small JSON files is unnecessary; adds binary dependency compilation |
| File watching | chokidar v4 | chokidar v5 | v5 is ESM-only |
| Web server (M3) | Fastify | Express | Express has no native TypeScript; 2-3x slower; no built-in schema validation |
| Web UI (M3) | Svelte 5 | React 19 | 3x larger bundle; slower real-time DOM updates |
| WebSocket (M3) | `ws` | Socket.IO | Unnecessary complexity for local single-developer tool |
| Process monitoring | `chokidar` file watch (fallback) | `tail -f` subprocess | `chokidar` is cross-platform, event-driven, not polling |
## Installation
# Core harness-tools dependencies
# M3 Web UI (defer to M3 phase)
## Known Issues and Workarounds
### Claude Code spawn from Node.js (MEDIUM confidence — issue closed but still reported)
### stream-json stdout flushing (LOW confidence on timeline — bugs open as of early 2026)
## Sources
- Claude Code Skills docs: https://code.claude.com/docs/en/skills (official, verified April 2026)
- Claude Code Subagents docs: https://code.claude.com/docs/en/sub-agents (official, verified April 2026)
- Claude Code Hooks docs: https://code.claude.com/docs/en/hooks (official, verified April 2026)
- Claude Code Issue #771 (spawn hang): https://github.com/anthropics/claude-code/issues/771
- Claude Code Issue #17248 (stream-json stdout stops): https://github.com/anthropics/claude-code/issues/17248
- Claude Code Issue #25670 (block-buffered pipe): https://github.com/anthropics/claude-code/issues/25629
- Gemini CLI headless mode: https://geminicli.com/docs/cli/headless/
- write-file-atomic npm: https://www.npmjs.com/package/write-file-atomic (v7.0.0, Feb 2026)
- chokidar GitHub: https://github.com/paulmillr/chokidar (v5 ESM-only confirmed Nov 2025)
- Node.js 22 LTS: https://nodesource.com/blog/Node.js-v22-Long-Term-Support-LTS
- Svelte 5 vs React 19 comparison: https://usama.codes/blog/svelte-5-vs-react-19-vs-vue-4-comparison
- Fastify vs Express 2025: https://betterstack.com/community/guides/scaling-nodejs/fastify-express/
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

### Testing

- **Unit tests:** `node test/run-tests.js` — fast, no external deps, run after every code change
- **E2E pipeline test:** `node test/run-e2e.js` — spawns real Claude Code sessions (~15-20 min)
  - Run after any phase that touches: `detent-tools.cjs`, `.claude/agents/`, `.claude/skills/detent-*`, `.detent/playbooks/`
  - Validates: agent output files exist, truth-update was called (challenged_by != null), freeze gate works, H-Review verdict is valid JSON, handoff.md has Implementation Units
  - If E2E fails, diagnose and fix before reporting phase complete — do not defer to user for manual testing
  - `--skip-spawn` flag validates existing artifacts without spawning agents (useful for quick re-checks)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
