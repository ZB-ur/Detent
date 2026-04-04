# Technology Stack

**Project:** Detent
**Researched:** 2026-04-05
**Overall confidence:** HIGH (Claude Code native APIs verified from official docs; Node.js ecosystem choices verified via npm + official sources)

---

## Context

Detent is a CLI harness framework that runs *inside* Claude Code. It does not run standalone. This constraint shapes every stack decision: no external API keys, no framework overhead, tight coupling to Claude Code's native skill/agent/hook system, and a CJS tool script as the single mutable-state authority.

---

## Recommended Stack

### Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22 LTS (active until Oct 2025, maintenance until Apr 2027) | Runtime for `harness-tools.cjs` and any spawned subprocesses | Pre-installed everywhere Claude Code runs; LTS guarantees; native require() ↔ ESM interop stabilised in v22; no install step needed |
| CommonJS (.cjs) | Node 22 built-in | Module format for `harness-tools.cjs` | Follows GSD's battle-tested pattern; CJS avoids ESM top-level-await surprises in a CLI context; explicit `.cjs` extension signals intent clearly |

**What NOT to use:** Do not use ESM (`type: "module"` in package.json) for the harness-tools script. Claude Code spawns it as a subprocess; CJS has deterministic synchronous startup with no module graph resolution delay. ESM would require additional flags and adds fragility.

### Claude Code Native Layer

| Component | Config location | Purpose | Key facts |
|-----------|----------------|---------|-----------|
| Skills (`SKILL.md`) | `.claude/skills/<name>/SKILL.md` | Workflow entry points (`/harness:setup`, `/harness:discovery`, etc.) | YAML frontmatter controls invocation; `disable-model-invocation: true` for user-triggered pipeline steps; `context: fork` + `agent:` field for subagent delegation; `$ARGUMENTS`, `$ARGUMENTS[N]`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}` substitutions available |
| Subagents (`agents/`) | `.claude/agents/<name>.md` | Specialised agent roles (D-Critique, G-Red/Blue, H-Review, J-Compile, Coder, Evaluator) | YAML frontmatter: `description`, `tools`, `model`, `permissionMode`, `maxTurns`, `hooks`, `skills`, `effort`; stored in project scope (`.claude/agents/`) so they travel with the repo |
| Hooks (`settings.json`) | `.claude/settings.json` | Async side effects (Gemini logging, state mutation audits) | 30+ lifecycle events; four hook types: `command`, `http`, `prompt`, `agent`; hook scoped to skill via skill frontmatter `hooks:` field; exit code 0 = proceed, 2 = block, other = non-blocking error |
| `CLAUDE.md` | `.claude/CLAUDE.md` (project) or `~/.claude/CLAUDE.md` (user) | Persistent context injected into every session | Keep it lean — it is injected unconditionally; reserve for invariants only |

**Frontmatter fields used by Detent skills (HIGH confidence, verified from official docs):**

```yaml
name: harness-discovery
description: Run the Detent discovery phase...
disable-model-invocation: true   # user-triggered only
context: fork                    # isolated subagent
agent: general-purpose           # or custom agent name
allowed-tools: Read Grep Glob Bash
effort: high
hooks:
  PostToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: node .harness/bin/harness-tools.cjs log-tool-use
          async: true
```

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `write-file-atomic` | 7.0.0 (Feb 2026, used by npm itself) | Atomic writes to `.harness/state.json`, `.harness/config.json`, truth surface files | Rename-based atomicity; prevents torn reads during concurrent tool calls; 1,598 dependents; maintained by npm team |
| Native `fs` + JSON | Node built-in | Read state files | Synchronous read is fine for CLI context; no library needed |
| File system as state bridge | — | Session continuity across `/clear` boundaries | `.harness/` directory survives Claude Code session resets; this is the deliberate architecture decision |

**What NOT to use:** Do not use `lowdb` for Detent's state. `lowdb` v7+ is ESM-only and adds unnecessary abstraction. The state schema is simple enough that `JSON.parse(fs.readFileSync(...))` + `write-file-atomic` is the correct tool. `lowdb` would force ESM or a CJS fork.

**What NOT to use:** Do not use `proper-lockfile` unless concurrent multi-process writes become a real scenario. For M1/M2 (single Claude Code session per pipeline), `write-file-atomic` is sufficient. Add `proper-lockfile` only in M3 when multiple parallel pipelines write simultaneously.

### Subprocess / Process Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js `child_process.spawn` | Built-in | Spawn `claude -p --output-format stream-json --dangerously-skip-permissions` | Native; handles streaming stdout line by line |
| `stdio: ["inherit", "pipe", "pipe"]` | — | Critical workaround for Claude Code Node.js spawn bug | Claude Code hangs when spawned with default pipe mode from Node.js (Issue #771, closed but still affects users as of June 2025); `stdin: "inherit"` prevents the hang |
| Line-by-line JSONL parsing | — | Parse stream-json events | Each `\n`-delimited line is a JSON event; buffer incomplete lines between `data` events |

**Known issue — stream-json stdout flushing (MEDIUM confidence):** Issues #17248 and #25670 document that `--output-format stream-json` stdout can stop mid-session and is block-buffered when piped (as of early 2026, both open/duplicated, no official fix timeline). Detent MUST implement a dual-channel strategy:

- **Primary:** stream-json stdout for real-time events
- **Fallback:** `chokidar` file-watch on `~/.claude/projects/*/session.jsonl` as the backup event source

This dual-channel approach is already a stated architectural decision in PROJECT.md; it is now verified as necessary, not optional.

### File Watching (Dual-Channel Fallback)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `chokidar` | 4.x (stay on v4, NOT v5) | Watch `.harness/` state files and `session.jsonl` fallback | v5 (Nov 2025) is ESM-only and requires Node 20+; v4 is still CJS-compatible and the correct choice for a `.cjs` tool script |

**Why NOT chokidar v5:** v5 went ESM-only. The harness-tools.cjs is explicitly CommonJS. Pin to `chokidar@^4`.

### Gemini CLI Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Gemini CLI (system-installed) | 0.35.3 (user's installed version) | Async behavior log generation from stream-json artifacts | Zero intrusion on core agent prompts; invoked via `PostToolUse`/`Stop` hooks; free tier sufficient for log generation |

**Invocation pattern:**

```bash
# In a PostToolUse or Stop hook (async: true)
gemini -p "Analyze this agent turn and emit a structured behavior log" \
  --output-format stream-json \
  < .harness/artifacts/turn-${SESSION_ID}.json \
  >> .harness/logs/behavior.jsonl
```

**Gemini CLI headless flags (HIGH confidence, verified from official docs):**
- `-p` / `--prompt`: activates headless mode
- `--output-format stream-json`: JSONL event stream
- stdin pipe: `cat file | gemini -p "..."` or `gemini -p "..." < file`
- exit codes: 0 = success, 1 = API error, 42 = validation error, 53 = turn limit exceeded

**What NOT to use:** Do not pass Gemini CLI prompt content via Claude's main context window. Always invoke via hooks with `async: true` so the Gemini call is fire-and-forget and does not block the pipeline.

### Web UI (M3 — deferred)

These are the M3 recommendations, not needed for M1/M2. Include here so the roadmap can plan ahead.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fastify | 5.x (current) | HTTP server + WebSocket upgrade | 2-3x faster than Express; native TypeScript support; `@fastify/websocket` plugin for real-time; lower overhead than Express for a developer tool |
| Svelte 5 | 5.x (current) | Dashboard UI | 47KB bundle vs 156KB React; 60% faster DOM updates for real-time data; "runes" reactivity model is ideal for frequent state updates; compiled = no virtual DOM overhead; shadcn-svelte v1.0 available for component library |
| Vite 7 | 7.x (current, Rolldown-based) | Build tool | Ships with SvelteKit; faster builds with Rolldown integration |
| `ws` npm package | 8.x | WebSocket server | Raw WebSocket is sufficient for a single-developer tool; no need for Socket.IO's reconnection/namespace overhead; lower latency |

**Why NOT React for M3:** React 19 at 156KB vs Svelte 5 at 47KB. For a developer-facing monitoring dashboard with frequent real-time updates (new events every few seconds), Svelte's compiled reactivity is measurably better. The ecosystem size argument for React does not apply here — the dashboard is not a consumer product.

**Why NOT Express for M3:** Fastify is 2-3x faster and has native TypeScript. The dashboard is a local dev tool; Fastify's schema-based validation is a better DX for the JSON-heavy API surface.

**Why NOT Socket.IO for M3:** Socket.IO adds reconnection, namespaces, and fallback transports that are unnecessary for a local tool where the client and server are on the same machine. The `ws` package provides raw WebSocket with lower latency.

---

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

---

## Installation

```bash
# Core harness-tools dependencies
npm install write-file-atomic        # ^7.0.0 — atomic state writes
npm install chokidar@^4              # ^4.x — CJS-compatible, NOT v5

# M3 Web UI (defer to M3 phase)
npm install fastify @fastify/websocket ws
npm install -D svelte vite @sveltejs/vite-plugin-svelte
```

---

## Known Issues and Workarounds

### Claude Code spawn from Node.js (MEDIUM confidence — issue closed but still reported)

**Issue:** Claude Code hangs when spawned via `child_process.exec()` or default `spawn()` from Node.js (Issue #771).

**Workaround:**
```javascript
const { spawn } = require('child_process');
const proc = spawn('claude', [
  '--print', prompt,
  '--output-format', 'stream-json',
  '--dangerously-skip-permissions'
], {
  stdio: ['inherit', 'pipe', 'pipe']  // stdin: inherit is the critical fix
});
```

### stream-json stdout flushing (LOW confidence on timeline — bugs open as of early 2026)

**Issues:** #17248 (stdout stops mid-session), #25670 (block-buffered when piped).

**Mitigation:** Dual-channel architecture (stream-json primary + `session.jsonl` file-watch fallback). This is mandatory, not optional.

---

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
