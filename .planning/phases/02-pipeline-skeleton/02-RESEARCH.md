# Phase 2: Pipeline Skeleton - Research

**Researched:** 2026-04-05
**Domain:** Claude Code skills, Node.js subprocess spawning, gate architecture, session continuity
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Subprocess Spawning & Isolation**
- Subprocess spawner lives in detent-tools.cjs as a `spawn` command — consistent with single-mutation-point pattern
- Start with 2 isolation layers: scoped workdir (mandatory) + extensible interface for adding layers later. Defer .git/HEAD block, empty plugin dir, and project-only settings until proven necessary
- Invoke Claude Code via `child_process.spawn('claude', ['-p', '--output-format', 'stream-json', '--dangerously-skip-permissions'])` with `stdin: 'inherit'` per CLAUDE.md workaround for Issue #771
- Parse stream-json output line-by-line as JSONL with incomplete line buffering

**Gate Architecture**
- Gates are data-driven in config.json — toggleable per-stage without code changes
- 3 critical gates at irreversible decision points (default enabled): Plan gate (before coding), Code gate (after generation, before commit), Deploy gate (after verification, before merge/deploy)
- Config supports defining additional gates (up to 10+), but only 3 are enabled by default
- In supervised mode: AskUserQuestion at gate points shows output summary, offers proceed/revise/stop
- In autonomous mode: same skill logic, gate check reads `mode: autonomous` and auto-proceeds — no code fork

**Session Continuity & Skill Structure**
- Each skill reads state.json at start and writes updated stage on exit — next skill picks up from last position (PIPE-04)
- Skills share common rules via @-reference to a shared file (e.g., .claude/skills/_shared/rules.md)
- State.json `pipeline_stage` field is the routing authority for which stage runs next
- Each skill prints a next-step hint on exit (e.g., `Discovery complete. Artifacts: .detent/domain-model.md\nNext: /detent:plan`)
- Each skill produces stage-specific placeholder artifacts in .detent/ (e.g., discovery → domain-model.md draft, plan → handoff.md)

### Claude's Discretion
- Internal skill structure details (step ordering, error message text, artifact formatting)
- Specific JSONL event types to parse from stream-json output
- Test approach for subprocess spawning (may need mocking or integration tests)

### Deferred Ideas (OUT OF SCOPE)
- Additional isolation layers (plugin dir, project-only settings) — add when specific problems surface
- Automatic pipeline orchestration (auto-chaining skills) — Phase 2 is manual invocation
- Production agent template integration — Phase 3+
- Gemini CLI logging hooks — Phase 5
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | 5-stage sequential pipeline: Discovery → Planning (A-J) → Coding (unit × eval) → Verification → Achieve | Skill frontmatter pattern from Phase 1 + state.json `pipeline_stage` routing authority |
| PIPE-02 | One workflow skill per stage: /detent:discovery, /detent:plan, /detent:code, /detent:verify, /detent:achieve | Claude Code skill structure pattern documented below; @-reference shared rules |
| PIPE-03 | Two-mode operation: autonomous mode auto-approves all gates; supervised mode pauses at key gates for human confirmation | AskUserQuestion tool + config.json gates array + mode-check pattern |
| PIPE-04 | Each skill reads .detent/state.json at start and updates it on completion, enabling cross-session continuity | detent-tools.cjs state-read/state-write commands already built; skill read-on-start / write-on-exit pattern |
</phase_requirements>

---

## Summary

Phase 2 builds the five workflow skills and the subprocess spawner, and wires them together through config.json gates and state.json routing. The core infrastructure (detent-tools.cjs with atomic state/config writes, package.json, 12 passing tests) is complete from Phase 1. Phase 2 adds to that foundation without touching existing commands.

The most technically specific decisions are: (1) how the `spawn` command structures its subprocess invocation and JSONL line-buffer, (2) how gates are stored in config.json and evaluated in skills, and (3) how the @-reference shared rules file is structured to be included by all five skills without duplication. All three are well-defined by the decisions in CONTEXT.md. The subprocess spawner workaround (stdin: 'inherit') is a known, documented technique for Claude Code issue #771.

Phase 2 produces placeholder skills — real agent behavior (discovery of actual requirements, real planning subagents) belongs to Phase 3+. The success criterion is that all five skills run in sequence without error, gate logic branches correctly by mode, and state persists across /clear boundaries.

**Primary recommendation:** Build the `spawn` command and gate evaluation logic first, then clone the detent-setup skill structure five times with stage-specific state transitions. Wire the shared rules file via @-reference last, after all five skills work individually.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| Node.js 22 LTS, CommonJS (.cjs) | spawn command in detent-tools.cjs uses `require('child_process')` — no ESM |
| `write-file-atomic` for atomic writes | Existing pattern; no new writes bypass it |
| `chokidar` v4 (NOT v5) | Not needed for Phase 2 (no file watching required yet) |
| CLI tool as single state mutation point | Skill steps call `node ./detent-tools.cjs state-write` — never use Write tool on .detent/ |
| File system as state bridge | state.json pipeline_stage survives /clear; each skill reads it at step 1 |
| Skills in `.claude/skills/<name>/SKILL.md` | Five new skills: detent-discovery, detent-plan, detent-code, detent-verify, detent-achieve |
| No API key — Claude Code subscription only | spawn command must use `claude` binary, not API |
| `stdin: 'inherit'` workaround for Issue #771 | Required in all spawn calls; documented in CLAUDE.md stack table |
| GSD workflow enforcement | All edits via /gsd:execute-phase |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `child_process.spawn` | Node 22 built-in | Spawn `claude -p --output-format stream-json --dangerously-skip-permissions` | Native; no install; handles streaming stdout line by line |
| Node.js built-in `readline` or manual line-buffer | Node 22 built-in | JSONL line-by-line parsing from stdout | readline.Interface can wrap stdout stream; manual buffer is also viable (30 lines) |
| `write-file-atomic` | 7.0.1 (installed) | Atomic writes remain unchanged | Already installed and in use |
| Claude Code `AskUserQuestion` | Claude Code 2.1.92 | Gate prompts in supervised mode | Native tool; no subprocess; correct tool for interactive prompts in skills |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chokidar` 4.x | 4.0.3 | File watching (fallback channel) | Not needed in Phase 2; defer to Phase 5/6 |
| `child_process.execSync` | Node 22 built-in | Synchronous command execution in skills via Bash tool | Already used in test/run-tests.js; useful for short-lived state-read/state-write calls from skills |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual JSONL line buffer | `readline.createInterface` | readline is cleaner API; manual buffer is 25 lines and has no import needed. Either works. Manual buffer gives finer control over buffering behavior during subprocess stalls. |
| `AskUserQuestion` at gates | Bash `read` prompt | `AskUserQuestion` is the Claude Code-native interactive prompt; Bash `read` is unreliable inside skill context. Use AskUserQuestion. |
| config.json `gates` array | Hardcoded gate checks in each skill | Data-driven gates in config allow toggle without skill edits. Required by locked decision. |

**Installation:** No new packages needed. Phase 1 already installed `write-file-atomic`. All spawn/readline/child_process are Node built-ins.

---

## Architecture Patterns

### Recommended Project Structure After Phase 2

```
detent-tools.cjs              # +spawn command added
.claude/
└── skills/
    ├── _shared/
    │   └── rules.md          # NEW: shared CRITICAL RULES @-referenced by all skills
    ├── detent-setup/
    │   └── SKILL.md          # Existing (Phase 1)
    ├── detent-discovery/
    │   └── SKILL.md          # NEW
    ├── detent-plan/
    │   └── SKILL.md          # NEW
    ├── detent-code/
    │   └── SKILL.md          # NEW
    ├── detent-verify/
    │   └── SKILL.md          # NEW
    └── detent-achieve/
        └── SKILL.md          # NEW
.detent/                      # Existing (Phase 1 setup)
    ├── state.json            # pipeline_stage transitions through skills
    ├── config.json           # +gates array added
    ├── discovery/
    │   └── domain-model.md   # NEW placeholder artifact
    ├── plan/
    │   └── handoff.md        # NEW placeholder artifact
    ├── code/
    │   └── units.md          # NEW placeholder artifact
    ├── verify/
    │   └── report.md         # NEW placeholder artifact
    └── achieve/
        └── summary.md        # NEW placeholder artifact
```

### Pattern 1: Skill Read-on-Start / Write-on-Exit

**What:** Every pipeline skill follows a strict open/close bracket around its work: read state.json first, validate stage, do work, update state.json last.

**When to use:** All five pipeline skills, every time.

**Example:**
```markdown
## Step 1: Read and Validate State

```bash
node ./detent-tools.cjs state-read --dir .
```

Verify `pipeline_stage` is `"idle"` (for discovery) or the expected preceding stage.
If wrong stage, stop: "Pipeline stage is <X>, but this skill expects <Y>. Run /detent:<correct-skill> instead."

## Step N (Last): Update State and Print Next-Step Hint

```bash
node ./detent-tools.cjs state-write --dir . --pipeline_stage <this_stage>
```

Print:
```
<Stage> complete. Artifacts: .detent/<stage>/<artifact>.md
Next: /detent:<next-skill>
```
```

### Pattern 2: Gate Evaluation in Supervised Mode

**What:** Gates are checked by reading config.json's `gates` array, finding the entry for the current gate point, then branching on mode.

**When to use:** Discovery-to-Plan gate (before plan step), Plan-to-Code gate, Verify-to-Achieve gate.

**Example gate check in skill:**
```markdown
## Step N: Gate Check — Plan Gate

Read config:
```bash
node ./detent-tools.cjs config-read --dir .
```

Check `config.mode` and `config.gates`. Find the gate entry for `"plan"` in the gates array.
If `config.mode === "supervised"` AND the plan gate is enabled (`gates.plan.enabled === true`):
  Use AskUserQuestion:
  > Plan gate: Review the discovery output in .detent/discovery/domain-model.md before proceeding to planning.
  > Proceed? (yes / revise / stop)
  - "yes" → continue
  - "revise" → stop skill, leave pipeline_stage unchanged so user can re-run
  - "stop" → stop skill, update pipeline_stage to "paused"

If `config.mode === "autonomous"` OR gate is disabled: proceed without prompting.
```

### Pattern 3: spawn Command in detent-tools.cjs

**What:** A new `spawn` command added to detent-tools.cjs that launches a Claude Code subprocess with the correct flags and the stdin:inherit workaround. Returns an exit code and optionally streams output.

**When to use:** Called by skills when they need to delegate to a subprocess agent (Phase 3+). In Phase 2, the spawn command is built and tested but skills do not call it yet — it is infrastructure for Phase 3.

**Implementation pattern:**
```javascript
// In detent-tools.cjs — cmdSpawn function
function cmdSpawn(named) {
  const { spawn } = require('child_process');
  
  const prompt = named.prompt;
  if (!prompt) {
    process.stderr.write('Error: --prompt required for spawn command\n');
    process.exit(1);
  }
  
  const targetDir = named.dir ? path.resolve(named.dir) : process.cwd();
  
  // Isolation layer 1: scoped working directory
  const spawnOptions = {
    cwd: targetDir,
    stdio: ['inherit', 'pipe', 'pipe'],  // Critical: stdin inherit prevents Issue #771 hang
    env: { ...process.env }
  };
  
  // Extensible isolation interface: additional layers added here in Phase 3+ if needed
  // e.g. spawnOptions.env.CLAUDE_PLUGIN_DIR = emptyPluginDir;
  
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    prompt
  ];
  
  const child = spawn('claude', args, spawnOptions);
  
  // JSONL line-buffer: parse stream-json events line by line
  let lineBuffer = '';
  
  child.stdout.on('data', (chunk) => {
    lineBuffer += chunk.toString('utf8');
    let newlineIndex;
    while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
      const line = lineBuffer.slice(0, newlineIndex).trim();
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
      if (line) {
        try {
          const event = JSON.parse(line);
          // Forward relevant events to stdout for callers
          process.stdout.write(JSON.stringify(event) + '\n');
        } catch (e) {
          // Non-JSON line (Claude Code startup messages) — ignore
        }
      }
    }
  });
  
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
```

### Pattern 4: config.json Gates Schema

**What:** The existing `config.json` schema needs a `gates` object added by detent-tools.cjs setup (or a new `config-add-gates` migration command, or just added to the existing `setup` command defaults).

**When to use:** Read by all pipeline skills to determine gate behavior.

**Schema addition:**
```json
{
  "schema_version": 1,
  "mode": "supervised",
  "model_budget": "balanced",
  "locale": "en",
  "pipeline_stages": { ... },
  "unit_granularity": "standard",
  "language": "en",
  "gates": {
    "plan": { "enabled": true, "description": "Before coding — review discovery + plan" },
    "code": { "enabled": true, "description": "After code generation — review before commit" },
    "deploy": { "enabled": true, "description": "After verification — review before merge/deploy" }
  }
}
```

**Implementation note:** The `setup` command in detent-tools.cjs should include gates in its default config. Existing repos initialized in Phase 1 (without gates field) need config-write calls to add the gates field. The planner should include a Wave 0 task to update the setup command's default config.

### Pattern 5: Shared Rules File (@-reference)

**What:** A single `.claude/skills/_shared/rules.md` file containing the CRITICAL RULES block shared by all pipeline skills. Each skill @-references it instead of duplicating the text.

**When to use:** All five pipeline skills include this at the top of their SKILL.md.

**@-reference syntax in SKILL.md:**
```markdown
---
name: detent-discovery
description: Run the Discovery stage of the Detent pipeline
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

@.claude/skills/_shared/rules.md

# /detent:discovery — Discovery Stage
...
```

**Shared rules content:**
```markdown
# Shared Pipeline Rules

## CRITICAL RULES (all pipeline skills)

- NEVER use the Write tool on any file inside `.detent/` — all writes go through `node ./detent-tools.cjs`
- If `detent-tools.cjs` exits non-zero, report the error and stop — do not attempt manual recovery
- READ state.json at the start of EVERY skill invocation to get current pipeline position
- VALIDATE that pipeline_stage matches the expected entry state before doing any work
- WRITE pipeline_stage update at the END of successful completion — not before
- Use `node ./detent-tools.cjs` (relative path) — never hardcode absolute paths
```

**Verification on @-reference:** Claude Code's skill system supports `@path/to/file` references in SKILL.md content to include shared context. This is confirmed in CLAUDE.md's technology stack table (skill frontmatter has `$ARGUMENTS`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}` substitutions). The @-reference pattern is used throughout the GSD skill system as of Claude Code 2.x.

### Pattern 6: Pipeline Stage Transitions (state.json routing)

**What:** The canonical sequence of `pipeline_stage` values and their transitions.

```
idle → discovery → planning → coding → verification → achieve → complete
                                    ↑ paused (gate stop)
```

| Stage Value | Set by | Entry skill | Exit hint |
|-------------|--------|-------------|-----------|
| `idle` | setup | /detent:discovery | "Run /detent:discovery" |
| `discovery` | /detent:discovery | /detent:plan | "Run /detent:plan" |
| `planning` | /detent:plan | /detent:code | "Run /detent:code" |
| `coding` | /detent:code | /detent:verify | "Run /detent:verify" |
| `verification` | /detent:verify | /detent:achieve | "Run /detent:achieve" |
| `achieve` | /detent:achieve | — | "Pipeline complete." |
| `paused` | gate stop | Resume the last skill | "Resume with /detent:<last>" |

**Critical rule:** A skill only advances `pipeline_stage` on successful completion. If the skill exits due to a gate stop or error, it leaves `pipeline_stage` at the previous value so re-invocation works correctly.

### Anti-Patterns to Avoid

- **Gate logic hardcoded in skill prose:** Gates must be data-driven (config.json) so they can be toggled without editing skills. Hardcoding "if supervised mode, ask question here" in every skill creates maintenance drift. Read the config, check the gate.
- **Skill writing pipeline_stage before completing work:** If the skill updates pipeline_stage to "discovery" then fails mid-way, the next skill will try to run from an incomplete state. Write the stage update as the LAST action after all artifacts are confirmed.
- **@-reference to absolute path in shared rules:** `@/Users/lddmay/.claude/skills/_shared/rules.md` will break on other machines. Use a repo-relative path: `@.claude/skills/_shared/rules.md`.
- **spawn with `stdio: 'pipe'` on stdin:** Results in Claude Code hanging indefinitely (Issue #771). Always use `stdio: ['inherit', 'pipe', 'pipe']`.
- **Parsing stream-json without buffering:** `data` events from stdout may contain partial lines (split mid-JSON object). Always buffer and split on `\n` before parsing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive prompts in skills | Custom Bash `read` loop | `AskUserQuestion` | AskUserQuestion is the Claude Code native interactive tool; Bash read may not work in skill context |
| JSONL event parsing | Custom regex parser | Simple `indexOf('\n')` line-split + `JSON.parse` | JSONL is newline-delimited JSON; no library needed for line splitting |
| Gate enable/disable toggle | Skill-level conditionals | config.json gates object | Config-driven approach means changing mode doesn't require skill edits |
| Subprocess lifecycle management | Process manager (pm2, forever) | Direct `child_process.spawn` | Claude Code subprocesses are short-lived per pipeline stage; no daemon needed in Phase 2 |
| Shared skill rules | Copy-paste into each skill | @-reference to shared file | Single source of truth; one edit propagates to all skills |

**Key insight:** This phase is about plumbing, not intelligence. The complexity budget should go into correct subprocess wiring and gate logic — not into fancy process management or parsing libraries that add dependencies.

---

## Common Pitfalls

### Pitfall 1: Claude Code spawn hangs with default stdio
**What goes wrong:** `child_process.spawn('claude', [...], { stdio: 'pipe' })` — Claude Code hangs waiting for stdin that never comes.
**Why it happens:** Claude Code has a stdin dependency not present in normal CLI tools. GitHub Issue #771 (closed but still reproduced as of June 2025, Claude Code 2.1.92).
**How to avoid:** Always use `stdio: ['inherit', 'pipe', 'pipe']` — stdin inherits from parent process, stdout/stderr are piped.
**Warning signs:** Subprocess never emits any output; parent process hangs after spawn call.

### Pitfall 2: Incomplete JSONL lines crash JSON.parse
**What goes wrong:** A `data` event fires with a partial JSON line (e.g., `{"type":"assistant","cont`). Calling `JSON.parse` on partial data throws `SyntaxError`. If uncaught, the spawn command crashes mid-stream.
**Why it happens:** TCP/pipe buffering splits data at arbitrary byte boundaries, not at newlines.
**How to avoid:** Accumulate all `data` chunks in a `lineBuffer` string. Only call `JSON.parse` on complete lines (terminated by `\n`). Leave incomplete trailing content in the buffer.
**Warning signs:** `SyntaxError: Unexpected end of JSON input` in spawn output.

### Pitfall 3: Gate config missing from existing repos
**What goes wrong:** config.json was initialized in Phase 1 without the `gates` field. Skills that read `config.gates.plan.enabled` get `undefined` and either crash or silently treat all gates as disabled.
**Why it happens:** The gates schema is new in Phase 2. Phase 1 setup did not include it.
**How to avoid:** Skills that read gates must handle missing `gates` field gracefully: treat a missing field as "gate enabled" (safe default) and warn the user that they should run `config-write` to add the gates config. The planner should also include updating the `setup` command defaults so new repos get the gates field automatically.
**Warning signs:** Gate check always skips even in supervised mode.

### Pitfall 4: pipeline_stage written too early
**What goes wrong:** A skill writes `pipeline_stage: discovery` at step 2, then fails at step 5. The next invocation of `/detent:plan` runs because it sees `discovery` stage — but the discovery artifact is incomplete.
**Why it happens:** Developer writes state update as a "checkpoint" rather than a completion marker.
**How to avoid:** `state-write --pipeline_stage` is the LAST command in any successful skill. Before that, the old stage value acts as a re-entry guard.
**Warning signs:** Next skill runs successfully but produces output based on incomplete artifacts.

### Pitfall 5: @-reference path breaks on non-standard cwd
**What goes wrong:** `@.claude/skills/_shared/rules.md` resolves relative to the cwd when the skill runs — if the user invoked the skill from a subdirectory, the path resolves wrong.
**Why it happens:** Claude Code resolves @-references relative to the project root (where .claude/ lives), not cwd. This is documented behavior but easy to misremember.
**How to avoid:** The @-reference path `.claude/skills/_shared/rules.md` is relative to the project root (the directory containing `.claude/`). Use this form consistently. Verify by running `/detent:discovery` from different directories and confirming shared rules are applied.
**Warning signs:** Skills run without CRITICAL RULES appearing to be enforced; Write tool writes to .detent/ directly.

### Pitfall 6: AskUserQuestion blocked by wrong allowed-tools
**What goes wrong:** The skill's YAML frontmatter does not include `AskUserQuestion` in `allowed-tools`. Gate checkpoint silently skips because the tool is unavailable, or the skill errors.
**Why it happens:** Copy-paste from detent-setup which does include AskUserQuestion — but easy to miss when trimming allowed-tools.
**How to avoid:** All five pipeline skills must include `AskUserQuestion` in `allowed-tools`. Gate logic in supervised mode depends on it.
**Warning signs:** Gate check is reached in supervised mode but no prompt appears; pipeline auto-proceeds.

### Pitfall 7: 50K token re-injection (DEFERRED but must be tracked)
**What goes wrong:** Even with Phase 2's 2-layer isolation, the ~/.claude/CLAUDE.md and user-level settings may still inject 50K tokens per subprocess turn in production.
**Why it happens:** The 4-layer isolation decision was deferred. 2-layer isolation (scoped workdir + extensible interface) is the Phase 2 choice.
**How to avoid for Phase 2:** The subprocess spawner is built with an extensible isolation interface. The Phase 2 tests do not need to validate full token isolation — that is a Phase 3+ concern. Document the `spawn` command's isolation array design so layers 3 and 4 can be added as named properties without restructuring.
**Warning signs:** Token count per subprocess turn exceeds 10K before actual prompt content.

---

## Code Examples

### spawn command — child_process.spawn invocation
```javascript
// Source: CLAUDE.md Technology Stack table + GitHub Issue #771 workaround
// Critical: stdio[0] must be 'inherit' to prevent Claude Code hang
const { spawn } = require('child_process');

const child = spawn('claude', [
  '-p',
  '--output-format', 'stream-json',
  '--dangerously-skip-permissions',
  prompt
], {
  cwd: targetDir,               // Isolation layer 1: scoped working directory
  stdio: ['inherit', 'pipe', 'pipe'],  // stdin inherit = Issue #771 fix
  env: { ...process.env }
  // Isolation interface: additional env/flag overrides added here for layers 3+
});
```

### JSONL line-buffer pattern
```javascript
// Source: Node.js streams documentation pattern
let lineBuffer = '';

child.stdout.on('data', (chunk) => {
  lineBuffer += chunk.toString('utf8');
  let newlineIndex;
  while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
    const line = lineBuffer.slice(0, newlineIndex).trim();
    lineBuffer = lineBuffer.slice(newlineIndex + 1);
    if (line.length > 0) {
      try {
        const event = JSON.parse(line);
        // Handle event: forward, log, or extract content
        process.stdout.write(JSON.stringify(event) + '\n');
      } catch (_) {
        // Non-JSON output from Claude Code startup — safely ignore
      }
    }
  }
});
```

### Gate check pattern in skill (Markdown)
```markdown
## Step 3: Plan Gate Check

Read config:
```bash
node ./detent-tools.cjs config-read --dir .
```

Parse the output. Check `mode` and `gates.plan.enabled`.

**Supervised mode with gate enabled** (`mode === "supervised"` AND `gates.plan.enabled === true`):

Use AskUserQuestion:
> Plan gate: Discovery is complete. Review .detent/discovery/domain-model.md before planning begins.
> Options:
> - **proceed** — continue to planning
> - **revise** — stop here, re-run /detent:discovery with different inputs
> - **stop** — stop pipeline (stage remains "discovery")
>
> Enter: proceed, revise, or stop

If "proceed": continue.
If "revise" or "stop": stop skill. Do NOT update pipeline_stage.

**Autonomous mode OR gate disabled**: proceed immediately without prompting.
```

### config.json gates write (adding gates to existing repo)
```bash
# Add gates to existing config (for repos initialized in Phase 1)
node ./detent-tools.cjs config-write --dir . \
  --gates.plan.enabled true \
  --gates.code.enabled true \
  --gates.deploy.enabled true
```

Note: config-write already supports dot-notation for nested fields (Phase 1 implementation, lines 204-228 of detent-tools.cjs).

### Pipeline stage state transitions
```bash
# Discovery skill — last step
node ./detent-tools.cjs state-write --dir . --pipeline_stage discovery

# Plan skill — last step  
node ./detent-tools.cjs state-write --dir . --pipeline_stage planning

# Code skill — last step
node ./detent-tools.cjs state-write --dir . --pipeline_stage coding

# Verify skill — last step
node ./detent-tools.cjs state-write --dir . --pipeline_stage verification

# Achieve skill — last step
node ./detent-tools.cjs state-write --dir . --pipeline_stage achieve
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Skill uses Write tool on state files | Skill calls detent-tools.cjs (established Phase 1) | Phase 1 complete | Single-mutation-point invariant enforced |
| Skills copy-paste shared rules | @-reference to shared file | Phase 2 (new) | One edit propagates to all skills |
| Gates hardcoded in skill logic | Data-driven gates in config.json | Phase 2 (new) | Toggle gates without editing skills |

**Deprecated/outdated:**
- `chokidar` v5: ESM-only — cannot be required in .cjs (confirmed from Phase 1 research)
- `write-file-atomic` v6 and below: v7 required for Node 22.9+ (installed as v7.0.1)

---

## Open Questions

1. **Does config-write support nested gates object creation (not just update)?**
   - What we know: config-write supports dot-notation for nested field updates (Phase 1, lines 204-228). It reads the config, traverses dot-notation, writes.
   - What's unclear: If `config.gates` does not exist yet, the traversal at `parts.length - 1` will try to set a property on `undefined` before the null check creates it. The null check at line 211-213 handles this: `if (typeof obj[parts[i]] !== 'object' || obj[parts[i]] === null) { obj[parts[i]] = {}; }` — this creates missing intermediate objects.
   - Recommendation: config-write can create nested `gates` objects from scratch. Verify in Wave 0 with a test case: `config-write --gates.plan.enabled true` on a config that lacks a `gates` field entirely.

2. **@-reference path resolution: project root or skill directory?**
   - What we know: Claude Code resolves `@path` in skill content relative to the project root (the directory where `.claude/` lives). `${CLAUDE_SKILL_DIR}` is the substitution for the skill's own directory.
   - What's unclear: The exact resolution semantics are not verified against official docs for this specific use case.
   - Recommendation: Test `@.claude/skills/_shared/rules.md` in the first skill (detent-discovery). If it fails to resolve, use `@${CLAUDE_SKILL_DIR}/../_shared/rules.md` as a fallback. Document the working form.

3. **Placeholder artifact format for Phase 2 skills**
   - What we know: Decision says "placeholder artifacts in .detent/" (e.g., domain-model.md). Format is at Claude's discretion.
   - What's unclear: Whether to use Bash `echo >` from the skill (Write tool is excluded), or add a new `artifact-init` command to detent-tools.cjs.
   - Recommendation: Add a lightweight `artifact-write` command to detent-tools.cjs that takes `--file <relative-path> --content <text>`. This keeps the single-mutation-point invariant consistent and skills don't need the Write tool. Alternative: document that Phase 2 placeholder artifacts are created by the skill via the Bash tool using `node ./detent-tools.cjs` — but that requires a new command. Simplest approach: include artifact creation as part of each stage's setup command, or document that placeholder content is written via a new `artifact-init` command.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | detent-tools.cjs spawn command | Yes | v25.8.0 | — |
| npm | No new packages needed | Yes | 11.11.0 | — |
| Claude Code CLI (`claude` binary) | spawn command target | Yes | 2.1.92 | — |
| `write-file-atomic` | Existing atomic writes | Yes (installed) | 7.0.1 | — |
| `child_process` (built-in) | spawn command | Yes (Node built-in) | — | — |
| `.detent/` directory | Skill invocations | Requires prior setup | — | Run /detent:setup first |

**Missing dependencies with no fallback:** None — all required components are available.

**Missing dependencies with fallback:** None.

**Pre-condition:** `/detent:setup` must have been run in the target repo before any pipeline skill can execute. Skills should check for `.detent/` at step 1 and fail with a clear message if missing.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `assert` + `child_process.execSync` (established in Phase 1) |
| Config file | None — script-based test runner in `test/run-tests.js` |
| Quick run command | `node test/run-tests.js` |
| Full suite command | `node test/run-tests.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | pipeline_stage transitions through all 5 stages in sequence | unit | `node test/run-tests.js` (new tests added to existing file) | ❌ Wave 0 |
| PIPE-02 | All 5 skills exist at correct paths | smoke | `ls .claude/skills/detent-{discovery,plan,code,verify,achieve}/SKILL.md` | ❌ Wave 0 |
| PIPE-03 | spawn command runs without hanging (stdin:inherit verified) | integration | `node test/run-tests.js spawn-smoke` (spawns echo, verifies exit) | ❌ Wave 0 |
| PIPE-03 | Gate auto-proceeds when mode=autonomous | unit | `node test/run-tests.js gate-autonomous` (test config read + branch logic) | ❌ Wave 0 |
| PIPE-03 | config.json gates field is readable and structured correctly | unit | `node test/run-tests.js gates-schema` | ❌ Wave 0 |
| PIPE-04 | state-write after each stage persists across process boundaries | unit | `node test/run-tests.js state-continuity` (already covered in Phase 1 T6) | ✅ T6 |

**Note on subprocess integration test:** Testing the full spawn command against the real `claude` binary is a manual integration test (not automated) because it requires an active Claude Code subscription session. The automated test for spawn should use a mock target — spawn a known-good command (e.g., `node -e "console.log('{\"type\":\"result\"}')"`) to verify the JSONL line-buffer works, then document that real-Claude testing requires manual invocation.

### Sampling Rate
- **Per task commit:** `node test/run-tests.js` (full suite, ~12 existing tests + new ones)
- **Per wave merge:** `node test/run-tests.js`
- **Phase gate:** Full suite green + manual run of `/detent:discovery` through `/detent:achieve` in sequence

### Wave 0 Gaps

- [ ] `test/run-tests.js` — add T13: spawn command smoke test (mock subprocess target)
- [ ] `test/run-tests.js` — add T14: gates schema test (verify config-write creates gates correctly)
- [ ] `test/run-tests.js` — add T15: gate-autonomous test (config mode=autonomous → no AskUserQuestion path)
- [ ] `test/run-tests.js` — add T16: pipeline_stage transition sequence test (all 5 stages via state-write)
- [ ] Update `detent-tools.cjs setup` defaults to include `gates` field in new config.json

---

## Sources

### Primary (HIGH confidence)
- `/Users/lddmay/AiCoding/Detent/detent-tools.cjs` (Phase 1 implementation, inspected directly) — exact API for state-write, config-write, parseArgs, cmdConfigWrite dot-notation
- `/Users/lddmay/AiCoding/Detent/.claude/skills/detent-setup/SKILL.md` (Phase 1 reference skill) — exact frontmatter format, AskUserQuestion usage, CRITICAL RULES pattern
- `/Users/lddmay/AiCoding/Detent/.planning/phases/01-state-infrastructure/01-RESEARCH.md` — Phase 1 research findings, confirmed stack versions
- `CLAUDE.md` Technology Stack table — subprocess spawn pattern, stdin:inherit workaround, Issue #771 reference
- `CLAUDE.md` — `$ARGUMENTS`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}` substitutions in skill frontmatter
- `/Users/lddmay/AiCoding/Detent/.planning/research/PITFALLS.md` — Pitfall 1 (50K token re-injection), Pitfall 5 (state race conditions), phase mapping table

### Secondary (MEDIUM confidence)
- `CLAUDE.md` source links: Claude Code Skills docs (https://code.claude.com/docs/en/skills, verified April 2026), Hooks docs, Subagents docs — used for @-reference semantics and skill frontmatter
- GitHub Issue #771 (https://github.com/anthropics/claude-code/issues/771) — stdin:inherit workaround

### Tertiary (LOW confidence)
- @-reference path resolution semantics (project root vs skill dir) — not directly verified against a code example; behavior described from CLAUDE.md skill docs context. Flagged as Open Question 2.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are Node.js built-ins or already installed; no new packages needed
- Architecture: HIGH — patterns derived directly from Phase 1 implementation (detent-tools.cjs lines 194-228 for dot-notation, SKILL.md structure) and locked decisions in CONTEXT.md
- Pitfalls: HIGH for subprocess hang (documented issue #771, CLAUDE.md), MEDIUM for @-reference path resolution (documented behavior but not code-verified for this exact use case)
- Gate architecture: HIGH — config.json dot-notation writes are verified from existing cmdConfigWrite implementation; AskUserQuestion is verified from Phase 1 SKILL.md

**Research date:** 2026-04-05
**Valid until:** 2026-07-05 (90 days — Node.js built-ins and Claude Code 2.x skill API are stable)
