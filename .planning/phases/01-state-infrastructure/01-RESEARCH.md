# Phase 1: State Infrastructure - Research

**Researched:** 2026-04-05
**Domain:** Node.js CJS CLI tool, JSON state persistence, Claude Code skills
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase. Follow CLAUDE.md technology stack (Node.js 22 LTS, CommonJS .cjs, write-file-atomic for atomic writes), ROADMAP success criteria, and GSD architecture patterns.

### Claude's Discretion
Everything in this phase. CLAUDE.md technology stack is the guide.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase, no discussion held.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | detent-tools.cjs CLI tool handles all state mutations via single entry point (state read/write, truth surface update, reentry request, config management) | CLI router pattern from GSD reference; write-file-atomic for atomicity; command dispatch table |
| ENG-02 | .detent/state.json persists session position (current stage, current unit, iteration count) and survives /clear boundaries | File system as session bridge pattern; write-file-atomic sync API; schema design in Architecture Patterns section |
| ENG-03 | .detent/config.json stores mode, model budget, locale, pipeline stage toggles, unit granularity, and language preference | JSON schema design; readable via `JSON.parse(fs.readFileSync(...))` outside any agent session |
| ENG-04 | /detent:setup skill initializes .detent/ directory structure, walks user through config questions, and persists config to target repo | Claude Code skill frontmatter pattern; `AskUserQuestion` tool; skill invokes detent-tools.cjs for all writes |
</phase_requirements>

---

## Summary

Phase 1 is a pure Node.js CLI + file-system phase with no external services. The deliverable is `detent-tools.cjs` (a CJS script at the project root) and the `.detent/` directory structure it manages in target repos, plus one Claude Code skill (`/detent:setup`) that drives the initial configuration wizard. Everything needed to build this phase is defined in CLAUDE.md and verified against the GSD reference implementation.

The architecture is a simplified version of GSD's `gsd-tools.cjs` pattern, scoped to the four state domains Detent owns: pipeline stage position, config, truth surface, and reentry signaling. Phase 1 does not implement the full truth surface (that is Phase 3) — it creates the empty directory structure and the CLI commands that Phase 2+ will call.

**Primary recommendation:** Build `detent-tools.cjs` as a single-file CJS CLI with a command dispatch table, `write-file-atomic` for all JSON writes, and `fs.readFileSync` for reads. Keep it under 400 lines in Phase 1 — only implement the four commands needed by ENG-01 through ENG-04.

---

## Project Constraints (from CLAUDE.md)

All of the following are binding for this phase:

| Directive | Source | Impact on Phase 1 |
|-----------|--------|-------------------|
| Node.js 22 LTS, CommonJS (.cjs) | CLAUDE.md Technology Stack | `detent-tools.cjs` must use `require()`, not `import`; `module.exports`, not `export` |
| `write-file-atomic` for atomic writes | CLAUDE.md Technology Stack | Use `writeFileAtomicSync` for all `.detent/*.json` writes |
| `chokidar` v4 (NOT v5) | CLAUDE.md Technology Stack | Phase 1 does not use chokidar; relevant from Phase 2 subprocess spawner onward |
| CLI tool as single state mutation point | CLAUDE.md Architecture | No agent or skill may write to `.detent/` directly — only via `detent-tools.cjs` |
| File system as state bridge | CLAUDE.md Architecture | `.detent/` directory survives `/clear`; each skill reads state at startup |
| GSD workflow enforcement | CLAUDE.md GSD Workflow | All edits must happen inside a GSD workflow; do not make direct edits outside `/gsd:execute-phase` |
| Skills in `.claude/skills/<name>/SKILL.md` | CLAUDE.md Technology Stack | `/detent:setup` lives at `.claude/skills/detent-setup/SKILL.md` |
| No API key — Claude Code subscription only | CLAUDE.md Constraints | Not directly relevant to Phase 1 CLI and file work |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v25.8.0 (installed; satisfies CLAUDE.md ≥22 LTS) | Runtime for `detent-tools.cjs` | Pre-installed; CJS synchronous startup; no install step |
| `write-file-atomic` | 7.0.1 (registry, Mar 2026) | Atomic writes to `.detent/state.json` and `.detent/config.json` | Rename-based atomicity; `writeFileAtomicSync` for sync CLI context; maintained by npm team |
| Native `fs` + JSON | Node.js built-in | Read `.detent/*.json` files | Synchronous read safe in CLI context; no extra dependency |
| Native `path`, `os` | Node.js built-in | Path construction, home directory | No extra dependency |

### Supporting (Phase 1 only — not needed for all phases)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chokidar` | 4.0.3 | File watching | Phase 2+ subprocess spawner; NOT needed in Phase 1 |
| `child_process` (built-in) | Node.js built-in | Spawn Claude subprocesses | Phase 2+ pipeline skeleton; NOT needed in Phase 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `write-file-atomic` sync | Manual `writeFileSync(tmp) + renameSync` | DIY version is fragile; missing signal-exit cleanup on crash; `write-file-atomic` handles all edge cases |
| `write-file-atomic` | `lowdb` | `lowdb` v7 is ESM-only; adds abstraction with no benefit for 2 JSON files |
| `write-file-atomic` | `fs.writeFileSync` (plain) | GSD itself uses plain writeFileSync — viable; CLAUDE.md explicitly chose write-file-atomic; both are acceptable for single-session M1 scope |

**Note on GSD pattern vs CLAUDE.md:** Inspection of the GSD reference implementation confirms it uses plain `fs.writeFileSync`, not `write-file-atomic`. The CLAUDE.md decision to use `write-file-atomic` is a deliberate upgrade for Detent's state files (state.json is more critical than GSD's Markdown STATE.md). Both approaches work for Phase 1 single-session scope; `write-file-atomic` is the right choice for correctness when M3 introduces parallel pipelines.

**Installation:**
```bash
# In the target repo where detent-tools.cjs lives
npm init -y  # Creates package.json with "type": "commonjs" (or omit type for CJS default)
npm install write-file-atomic@^7.0.1
```

**Version verification (confirmed):**
```
write-file-atomic: 7.0.1 (published 2026-03-19)
chokidar@4: 4.0.3 (CJS-compatible)
chokidar@5: 5.0.0 (ESM-only — DO NOT use)
```

---

## Architecture Patterns

### Recommended Project Structure

```
<target-repo>/
├── detent-tools.cjs          # Single CLI entry point — all state mutations
├── package.json              # { "type": "commonjs" } — signals CJS explicitly
├── node_modules/             # write-file-atomic and deps
└── .detent/                  # Created by /detent:setup in target repo
    ├── state.json            # Pipeline position, iteration count, reentry depth
    ├── config.json           # Mode, budget, locale, toggles, granularity
    ├── truth-surface/        # Empty dir in Phase 1; populated in Phase 3
    ├── raw/                  # Empty dir in Phase 1; stream-json artifacts in Phase 5
    └── logs/                 # Empty dir in Phase 1; behavior logs in Phase 5

<this-repo>/.claude/
└── skills/
    └── detent-setup/
        └── SKILL.md          # /detent:setup skill invocation
```

**Critical distinction:** `detent-tools.cjs` lives in the repo being harnessed (the target repo), not in Detent's own source tree. The Detent project ships `detent-tools.cjs` as a file users copy (or reference) into their repo — analogous to how GSD ships `gsd-tools.cjs` to `~/.claude/get-shit-done/bin/`.

For Phase 1, `detent-tools.cjs` lives at the Detent repo root and is developed/tested there. The deployment model (how users get it into their repo) is a Phase 2+ concern.

### Pattern 1: CLI Dispatch Table (from GSD reference)

**What:** A `main()` function parses `process.argv`, switches on the first positional argument, and calls a handler function for each command.

**When to use:** All `detent-tools.cjs` command routing.

**Example (adapted from GSD pattern):**
```javascript
// detent-tools.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const writeFileAtomicSync = require('write-file-atomic').sync;

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    process.stdout.write('Usage: node detent-tools.cjs <command> [args]\n');
    process.stdout.write('Commands: state-read, state-write, config-read, config-write, setup\n');
    process.exit(0);
  }

  const targetDir = args.find(a => a.startsWith('--dir='))?.slice(6) || process.cwd();

  switch (command) {
    case 'state-read':   return cmdStateRead(targetDir, args);
    case 'state-write':  return cmdStateWrite(targetDir, args);
    case 'config-read':  return cmdConfigRead(targetDir, args);
    case 'config-write': return cmdConfigWrite(targetDir, args);
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exit(1);
  }
}

main();
```

### Pattern 2: Atomic JSON Write (write-file-atomic sync API)

**What:** Use `writeFileAtomicSync` for all `.detent/*.json` writes. The sync variant is the correct choice for a CJS CLI tool — no async/await complexity, no hanging process.

**When to use:** Every mutation to `state.json` and `config.json`.

```javascript
// Source: npm info write-file-atomic@7.0.1 readme
const writeFileAtomicSync = require('write-file-atomic').sync;

function atomicWriteJson(filePath, data) {
  const json = JSON.stringify(data, null, 2) + '\n';
  writeFileAtomicSync(filePath, json, { encoding: 'utf8' });
}

// Usage:
const statePath = path.join(targetDir, '.detent', 'state.json');
atomicWriteJson(statePath, newState);
```

**Why sync matters:** `write-file-atomic`'s async variant requires `await` or callbacks. The CLI main function is synchronous for fast startup. The sync variant writes atomically (temp file + rename) and blocks until complete — correct for a CLI where the process exits immediately after the write.

### Pattern 3: State JSON Schema (day-one fields)

**What:** `.detent/state.json` must include specific fields from day one (per success criteria SC-4).

```json
{
  "schema_version": 1,
  "pipeline_stage": "idle",
  "current_unit": null,
  "iteration_count": 0,
  "reentry_depth": 0,
  "last_updated": "2026-04-05T00:00:00.000Z",
  "session_id": null
}
```

| Field | Type | Purpose | Required by |
|-------|------|---------|-------------|
| `schema_version` | integer | Forward compatibility guard | Good practice |
| `pipeline_stage` | string | Current pipeline position (`idle`, `discovery`, `planning`, `coding`, `verification`, `achieve`) | ENG-02, SC-4 |
| `current_unit` | string\|null | Current implementation unit name | ENG-02, SC-4 |
| `iteration_count` | integer | Coder/Evaluator iterations on current unit | ENG-02, SC-4 |
| `reentry_depth` | integer | Cross-stage rollback depth (max 2 per RECOV-04) | ENG-02, SC-4 |
| `last_updated` | ISO 8601 string | Audit trail | Good practice |
| `session_id` | string\|null | For future session continuity tracking | Forward compat |

**Critical:** `reentry_depth` must be in the schema from day one. PITFALLS.md documents that retrofitting this field after pipeline work begins requires a data migration. Design it in now.

### Pattern 4: Config JSON Schema

**What:** `.detent/config.json` must store all fields required by ENG-03 and be readable outside any agent session (pure `JSON.parse(fs.readFileSync(...))`).

```json
{
  "schema_version": 1,
  "mode": "supervised",
  "model_budget": "balanced",
  "locale": "zh-CN",
  "pipeline_stages": {
    "discovery": true,
    "planning": true,
    "coding": true,
    "verification": true,
    "achieve": true
  },
  "unit_granularity": "standard",
  "language": "zh-CN"
}
```

| Field | Values | Purpose | Required by |
|-------|--------|---------|-------------|
| `mode` | `"autonomous"` \| `"supervised"` | Gate behavior | ENG-03 |
| `model_budget` | `"quality"` \| `"balanced"` \| `"budget"` | Model selection hint | ENG-03 |
| `locale` | `"zh-CN"` \| `"en"` | Output language | ENG-03 |
| `pipeline_stages` | object of booleans | Toggle which stages run | ENG-03 |
| `unit_granularity` | `"fine"` \| `"standard"` \| `"coarse"` | Coding unit size | ENG-03 |
| `language` | same as locale | Redundant alias; downstream agents check `language` directly | ENG-03, convention |

### Pattern 5: Claude Code Skill Frontmatter for /detent:setup

**What:** The `/detent:setup` skill must use `AskUserQuestion` to walk the user through config questions and then call `detent-tools.cjs` for all file writes.

```yaml
---
name: detent-setup
description: Initialize .detent/ directory structure and configuration in the current repo
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---
```

**Setup flow (what the skill must do):**

1. Check if `.detent/` already exists — if yes, ask the user whether to reinitialize
2. Ask config questions (mode, model_budget, locale, unit_granularity) using `AskUserQuestion`
3. Call `node <path-to>/detent-tools.cjs setup --dir .` with answers as flags — this creates all directories and writes both JSON files
4. Print summary of what was created and how to invoke the first pipeline skill

**AskUserQuestion pattern:** Each config question should be a single `AskUserQuestion` call with clear options. Do not use `Bash` read prompts — `AskUserQuestion` is the correct Claude Code tool for interactive setup.

### Anti-Patterns to Avoid

- **Direct JSON writes in skills:** A skill using the `Write` tool to create `.detent/state.json` bypasses `detent-tools.cjs` and breaks the single-mutation-point invariant. All writes MUST go through the CLI.
- **ESM syntax in detent-tools.cjs:** Using `import`/`export` or top-level `await` in the `.cjs` file will break under Node.js's CJS loader. Use `require()` and synchronous code throughout.
- **No `reentry_depth` in Phase 1 schema:** Omitting this field now means a schema migration later. Include it initialized to `0` even though Phase 1 never writes a non-zero value.
- **Hardcoding the detent-tools path:** Skills should resolve the path to `detent-tools.cjs` dynamically (relative to the repo root or via an environment variable). Do not hardcode an absolute path.
- **write-file-atomic async in CLI:** Using the async `writeFileAtomic()` function in a synchronous CLI requires an event loop wrapper. Use `.sync` to avoid this complexity.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom temp-write + rename | `write-file-atomic` `.sync` | Handles POSIX rename atomicity, signal-exit cleanup on crash, cross-platform tmpfile naming, ownership preservation |
| CLI argument parsing | Custom flag parser | Pattern from GSD (`parseNamedArgs` helper, 30 lines) | Proven in production; handles `--flag value` and boolean flags; copy the pattern, not a library |
| JSON schema validation | JSON Schema library | Manual field presence check | For 2 files with stable schemas, a 5-line guard is sufficient; avoid adding `ajv` or `zod` in Phase 1 |

**Key insight:** Phase 1 is infrastructure that must have zero friction to install and use. Every added dependency is a failure mode. Keep the dependency list to `write-file-atomic` only.

---

## Common Pitfalls

### Pitfall 1: Missing `reentry_depth` in State Schema

**What goes wrong:** `state.json` omits `reentry_depth` in Phase 1. Phase 4 needs to increment it. Adding a new field to an existing JSON file after target repos have initialized their `.detent/` requires a migration step — every existing state.json is invalid.

**Why it happens:** `reentry_depth` is a Phase 4 concern; it's easy to defer. PITFALLS.md documents this explicitly ("Design state.json schema to include reentry_depth field from day one").

**How to avoid:** Include `reentry_depth: 0` in the initial state.json schema. Initialize to 0 always. Phase 4 increments it; Phase 1 just needs the field present.

**Warning signs:** If you find yourself asking "should I add reentry_depth later?" — no, add it now.

### Pitfall 2: write-file-atomic Async vs Sync Confusion

**What goes wrong:** Developer uses `writeFileAtomic()` (async/Promise) instead of `writeFileAtomicSync()` in a synchronous CLI entry point. Either: (a) the write silently never completes because the process exits before the Promise resolves, or (b) the developer wraps in an async main and introduces `await` in a `.cjs` file, which works but adds unnecessary complexity.

**Why it happens:** The default export and most examples for `write-file-atomic` use the async variant.

**How to avoid:** Import the sync variant explicitly:
```javascript
const writeFileAtomicSync = require('write-file-atomic').sync;
```

**Warning signs:** If state.json is empty after a `state-write` call, you used the async variant.

### Pitfall 3: detent-tools.cjs Path Resolution in Skills

**What goes wrong:** The `/detent:setup` skill hardcodes a path like `/Users/lddmay/AiCoding/Detent/detent-tools.cjs`. This works on one machine but fails on any other.

**Why it happens:** Skills run in the context of the current Claude Code session. The path to `detent-tools.cjs` must be resolved relative to the target repo, not the developer's home directory.

**How to avoid:** In the skill, use `node $(pwd)/detent-tools.cjs` or `node ./detent-tools.cjs` after confirming the skill's cwd is the target repo. Document the assumption.

**Warning signs:** If `/detent:setup` works when run from the Detent project directory but fails elsewhere, it's a path resolution bug.

### Pitfall 4: package.json `"type": "module"` Breaking CJS

**What goes wrong:** A `package.json` with `"type": "module"` in the same directory as `detent-tools.cjs` causes Node.js to treat all `.js` files as ESM but still allows `.cjs` files as CJS. If any `.js` helper files are added later, they become ESM and `require()` inside them fails.

**Why it happens:** Project scaffolding tools often default to `"type": "module"` in 2026.

**How to avoid:** Either omit `"type"` from `package.json` (defaults to CJS) or set `"type": "commonjs"` explicitly. Never set `"type": "module"` in the Detent repo.

**Warning signs:** Any `SyntaxError: Cannot use import statement in a module` error.

### Pitfall 5: Skill Writing to .detent/ Directly

**What goes wrong:** During `/detent:setup`, the skill uses the `Write` tool to create `.detent/config.json` instead of calling `detent-tools.cjs`. This bypasses the single-mutation-point invariant and creates a split code path for file creation.

**Why it happens:** `Write` is the easiest path; calling a subprocess is more steps.

**How to avoid:** The `detent-tools.cjs setup` command must handle all directory creation and file initialization. The skill only calls that command. The skill MUST NOT use `Write` on `.detent/` files.

---

## Code Examples

Verified patterns for Phase 1 implementation:

### write-file-atomic Sync Import and Usage
```javascript
// Source: npm info write-file-atomic@7.0.1 readme (verified 2026-04-05)
const writeFileAtomicSync = require('write-file-atomic').sync;

// Atomic JSON write
function writeJson(filePath, data) {
  writeFileAtomicSync(filePath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' });
}
```

### Safe Directory Creation (idempotent)
```javascript
// Source: Node.js fs docs — mkdirSync with recursive: true is idempotent
const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// Usage for .detent/ structure:
function initDetentDir(targetDir) {
  ensureDir(path.join(targetDir, '.detent'));
  ensureDir(path.join(targetDir, '.detent', 'truth-surface'));
  ensureDir(path.join(targetDir, '.detent', 'raw'));
  ensureDir(path.join(targetDir, '.detent', 'logs'));
}
```

### State JSON Read (outside agent session)
```javascript
// Source: Node.js fs docs — verified pattern
function readState(targetDir) {
  const statePath = path.join(targetDir, '.detent', 'state.json');
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;  // Not initialized yet
    throw new Error(`state.json read failed: ${e.message}`);
  }
}
```

### CLI Entry Point with Usage (success criteria SC-1)
```javascript
// detent-tools.cjs — minimal structure satisfying SC-1
'use strict';
const fs = require('fs');
const path = require('path');
const writeFileAtomicSync = require('write-file-atomic').sync;

function usage() {
  process.stdout.write([
    'Usage: node detent-tools.cjs <command> [--dir <path>]',
    '',
    'Commands:',
    '  setup            Initialize .detent/ in the target directory',
    '  state-read       Print current state.json as JSON',
    '  state-write      Update state.json fields (--field value pairs)',
    '  config-read      Print current config.json as JSON',
    '  config-write     Update config.json fields (--field value pairs)',
    '',
  ].join('\n'));
  process.exit(0);
}

const args = process.argv.slice(2);
if (!args[0]) usage();
```

### Claude Code Skill Frontmatter Pattern
```yaml
---
name: detent-setup
description: Initialize Detent in the current repo (.detent/ structure + config)
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

Run the Detent setup wizard:

1. Check if `.detent/` exists. If yes, ask user whether to reinitialize.
2. Ask: mode (autonomous/supervised), model_budget (quality/balanced/budget),
   locale (zh-CN/en), unit_granularity (fine/standard/coarse).
3. Call: `node ./detent-tools.cjs setup --mode <m> --budget <b> --locale <l> --granularity <g>`
4. Print summary.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `write-file-atomic` v6 (CJS, imurmurhash dep) | v7 (dropped imurmurhash dep, Node ≥20.17/≥22.9) | Feb–Mar 2026 | Simpler dependency tree; requires Node 20.17+ or 22.9+ |
| Polling file changes | `chokidar` event-driven watch | Stable since 2020 | Relevant Phase 2+ |
| Single `.cjs` monolith | Modular `lib/*.cjs` pattern (GSD) | Stable | Phase 1 can stay monolithic; split if >400 lines |

**Deprecated/outdated:**
- `chokidar` v5: ESM-only as of Nov 2025 — cannot be `require()`d in a `.cjs` file
- `write-file-atomic` v6 and below: Use v7 which removes the `imurmurhash` dependency

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime for detent-tools.cjs | Yes | v25.8.0 (satisfies >=22.9.0) | — |
| npm | Installing write-file-atomic | Yes | 11.11.0 | — |
| Claude Code CLI | /detent:setup skill invocation | Yes | 2.1.92 | — |
| Gemini CLI | Phase 5 observability (not Phase 1) | Yes | 0.35.3 | — |
| `write-file-atomic` npm package | Atomic JSON writes | Not yet installed | 7.0.1 (registry) | Manual writeFileSync+renameSync (suboptimal) |
| git | Version control of .detent/ files | Not checked (standard) | — | — |

**Missing dependencies with no fallback:**
- None that block Phase 1 execution. `write-file-atomic` needs a `npm install` step which Wave 0 must include.

**Missing dependencies with fallback:**
- `write-file-atomic` not yet installed — fallback is plain `writeFileSync` (acceptable for Phase 1 single-session scope, but `write-file-atomic` is the CLAUDE.md requirement).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `assert` module + manual test script (no test runner installed yet) |
| Config file | None yet — Wave 0 creates `test/run-tests.js` |
| Quick run command | `node test/run-tests.js` |
| Full suite command | `node test/run-tests.js` |

**Rationale for no test runner:** Phase 1 is a single CJS file with 4–5 commands. A test runner (Jest, Vitest) adds dependencies and ESM/CJS friction. The success criteria are verifiable with `node -e "..."` invocations. Wave 0 creates a minimal `test/run-tests.js` using `assert` that verifies each success criterion directly.

If the project adopts a test runner in a future phase, it should be `jest` with `testEnvironment: 'node'` and no transform (native CJS support).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENG-01 | `node detent-tools.cjs` with no args prints usage and exits 0 | smoke | `node detent-tools.cjs; echo $?` | ❌ Wave 0 |
| ENG-02 | `state-write` updates state.json and file persists (survives process exit) | unit | `node test/run-tests.js state-write` | ❌ Wave 0 |
| ENG-02 | state.json schema includes pipeline_stage, current_unit, iteration_count, reentry_depth | unit | `node test/run-tests.js state-schema` | ❌ Wave 0 |
| ENG-03 | config.json stores all required fields and is readable via `JSON.parse(fs.readFileSync(...))` | unit | `node test/run-tests.js config-schema` | ❌ Wave 0 |
| ENG-04 | `/detent:setup` creates .detent/, config.json, state.json, truth-surface/ in target dir | integration | Manual: invoke `/detent:setup` in a temp dir, verify files exist | ❌ Wave 0 (manual) |

### Sampling Rate

- **Per task commit:** `node detent-tools.cjs` (smoke: exits 0 with usage)
- **Per wave merge:** `node test/run-tests.js`
- **Phase gate:** Full test suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/run-tests.js` — covers ENG-01, ENG-02, ENG-03 (automated unit/smoke tests)
- [ ] `package.json` — created as part of project init, required before `npm install write-file-atomic`
- [ ] `npm install write-file-atomic@^7.0.1` — must run before any test that exercises writes

---

## Open Questions

1. **Where does detent-tools.cjs live in the target repo vs Detent project?**
   - What we know: Phase 1 develops it at the Detent repo root.
   - What's unclear: The deployment model (how users get it into their repo) is unspecified. Does the user `npm install detent`? Copy a file? Is Detent itself an npm package?
   - Recommendation: For Phase 1, treat it as a file at the repo root. Defer packaging decisions to Phase 2 or a dedicated phase. Add a note in the skill that `detent-tools.cjs` must be co-located with the repo.

2. **package.json type: commonjs vs no type field?**
   - What we know: Omitting `"type"` defaults to CJS. Setting `"type": "commonjs"` is explicit.
   - What's unclear: Whether other tools in the project expect ESM.
   - Recommendation: Set `"type": "commonjs"` explicitly in `package.json` to be unambiguous. This is a one-line declaration.

3. **Skill location: `.claude/skills/` vs `.claude/commands/`?**
   - What we know: CLAUDE.md references skills in `.claude/skills/<name>/SKILL.md`. Claude Code native skills use this path. GSD uses `.claude/commands/gsd/*.md` (slash commands, not skills).
   - What's unclear: Whether Detent should use the Skills API (`.claude/skills/`) or the Commands API (`.claude/commands/`). They have different invocation semantics.
   - Recommendation: Use the Skills API (`.claude/skills/detent-setup/SKILL.md`) per CLAUDE.md. Skills have richer frontmatter (context, agent delegation, disable-model-invocation). Commands are simpler prompt files. Phase 1 `/detent:setup` benefits from skill frontmatter to disable model invocation and specify allowed tools.

---

## Sources

### Primary (HIGH confidence)
- CLAUDE.md (project instructions) — technology stack, architecture constraints, CJS requirement
- `.planning/research/STACK.md` (project research, 2026-04-05) — verified Claude Code native APIs, write-file-atomic decision
- `.planning/research/ARCHITECTURE.md` (project research, 2026-04-05) — CLI-as-single-mutation-point pattern, component boundaries
- `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` (GSD reference, 130+ versions) — CLI dispatch table pattern, argument parsing
- `npm info write-file-atomic@7.0.1` (verified 2026-04-05) — v7 API including `.sync`, Node engine requirements, dependencies

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` (project research, 2026-04-05) — reentry_depth schema requirement, state race conditions
- `.planning/research/FEATURES.md` (project research, 2026-04-05) — MVP sequencing, table stakes features
- npm registry: `write-file-atomic@7.0.1` (published 2026-03-19), `chokidar@4.0.3` (CJS), `chokidar@5.0.0` (ESM-only) — version verification

### Tertiary (LOW confidence)
- None — all claims in this document are verified against primary or secondary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — write-file-atomic v7.0.1 version confirmed against npm registry; engine requirements verified; GSD CJS pattern confirmed by code inspection
- Architecture: HIGH — state.json and config.json schemas derived directly from REQUIREMENTS.md ENG-01/02/03 + ROADMAP success criteria; no speculation
- Pitfalls: HIGH — pitfalls 1-5 in this document are all directly derivable from verified technical facts (write-file-atomic sync API, CJS constraints, REQUIREMENTS.md schema requirements)

**Research date:** 2026-04-05
**Valid until:** 2026-07-05 (90 days — stable domain; Node.js and write-file-atomic are not fast-moving)
