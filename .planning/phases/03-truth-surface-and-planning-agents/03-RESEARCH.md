# Phase 3: Truth Surface and Planning Agents - Research

**Researched:** 2026-04-05
**Domain:** Claude Code subagent templates, truth surface file design, adversarial planning pipeline orchestration, CLI mutation patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** New detent-tools.cjs commands for truth surface: `truth-propose`, `truth-freeze`, `truth-read`. Maintains single-mutation-point pattern from Phase 1.

**D-02:** Any agent can propose freezing (amplifier). CLI checks decision maturity before allowing freeze (attenuator) — entry must have `challenged_by` field. In supervised mode, freeze requires human gate confirmation. In autonomous mode, mature entries freeze directly.

**D-03:** FROZEN entries are immutable — `truth-propose` and `truth-freeze` hard-reject attempts to overwrite a FROZEN entry (CLI exits non-zero). No SUPERSEDED mechanism in Phase 3.

**D-04:** Truth surface files use Markdown + YAML frontmatter format. Human-readable, CLI parses structured sections. Each decision entry has status (PROPOSED/FROZEN), rationale, challenged_by, and source_agent fields.

**D-05:** Agent templates defined as `.claude/agents/*.md` with YAML frontmatter (description, tools, model, maxTurns). Claude Code native format, travels with the repo.

**D-06:** Minimum privilege per agent — each agent gets only the tools required for its role.

**D-07:** Data flows via files — each agent writes output to `.detent/plan/` under a conventional filename, next agent reads it via `@` reference. Skill does not relay content between agents.

**D-08:** Conservative maxTurns defaults (5-10 per agent). Hardcoded in frontmatter for Phase 3. Configurable maxTurns deferred to post-v1 (SEED-001).

**D-09:** Single skill sequential dispatch — `/detent:plan` internally spawns D → G-Red → G-Blue → H → J in order using `cmdSpawn`. One skill manages the entire flow.

**D-10:** G-Red runs first (attack), G-Blue runs second with Red's output as input (targeted defense). Sequential, not parallel.

**D-11:** H-Review rejection triggers rollback to H's specified `reentry_stage` (D or G). Maximum 2 retries. Exceeding 2 retries escalates to human.

**D-12:** Skill is orchestrator only (father model pattern) — does NOT read agent full outputs into its own context. Only exception: reads H-Review's verdict field (approved/rejected + reentry_stage) for routing.

**D-13:** Any agent spawn failure stops the entire planning pipeline immediately. Intermediate artifacts preserved in `.detent/plan/` for human inspection.

**D-14:** Principle migration from ECL — extract core principles from stage-playbook, subagent-protocol, handoff-quality-bar. No direct code copy.

**D-15:** Playbooks stored in `.detent/playbooks/` in the target repo. Created during `/detent:setup`.

**D-16:** Agents reference playbooks via `@.detent/playbooks/xxx.md` in their prompt templates.

**D-17:** Fixed default playbook content for Phase 3. Users can manually edit but no configuration interface.

### Claude's Discretion

- Specific tool assignments per agent (which tools each D/G/H/J agent gets)
- Internal file naming conventions for agent outputs in `.detent/plan/`
- Exact maxTurns value per agent within the 5-10 range
- Playbook internal structure and section organization
- H-Review verdict output format (as long as it's machine-parseable by the skill)
- Error message text and formatting

### Deferred Ideas (OUT OF SCOPE)

- maxTurns configurable via config.json (SEED-001 — post-v1)
- SUPERSEDED chain for frozen decisions
- Playbook template variables (dynamic content like `{{max_iterations}}`)
- Parallel G-Red/Blue execution
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRUTH-01 | `.detent/truth-surface/` directory stores constraint-ledger.md, frozen-decisions.md, and domain-model.md | File format design section; CLI command design for truth-propose/freeze/read |
| TRUTH-02 | Frozen decisions are immutable once committed; downstream agents check alignment before executing | CLI hard-reject pattern; `canFreeze()` gate logic |
| TRUTH-03 | Constraint ledger tracks retained_goal, discarded options, and rationale for each frozen decision | Markdown+frontmatter schema design for constraint-ledger.md |
| PLAN-01 | D-Critique agent template: attacks false requirements against truth surface | Agent frontmatter format; tool selection (Read + Bash for truth-read) |
| PLAN-02 | G-Red/Blue agent templates: adversarial pair for plan robustness | Sequential spawn pattern; file I/O between agents |
| PLAN-03 | H-Review agent template: judges coding-readiness, rejects with reentry_stage | Machine-parseable verdict format; reentry loop pattern in skill |
| PLAN-04 | J-Compile agent template: generates executable code handoff | Tool selection (Read + Write); handoff document schema |
| PLAN-05 | Playbook migration from ECL: stage-playbook, subagent-protocol, handoff-quality-bar | Playbook directory setup in detent-tools.cjs; @-reference mechanism in agent prompts |
</phase_requirements>

---

## Summary

Phase 3 implements two distinct but tightly coupled systems: (1) a truth surface CLI layer on top of the existing `.detent/` state infrastructure, and (2) five Claude Code agent templates wired into a revised `/detent:plan` skill. Both systems extend already-proven patterns from Phases 1 and 2 rather than introducing new dependencies.

The truth surface work is primarily a CLI extension problem. Three new commands (`truth-propose`, `truth-freeze`, `truth-read`) write to and read from Markdown files with YAML frontmatter. The `truth-freeze` command implements a `canFreeze()` gate that checks decision maturity (`challenged_by` field exists) before proceeding. The immutability guarantee is enforced by checking entry status at write time and exiting non-zero if the entry is already FROZEN. This is all synchronous Node.js file I/O following the exact same write-file-atomic pattern established in Phase 1.

The agent template work requires understanding Claude Code's `.claude/agents/*.md` format — documented, verified against official docs. Each agent template is a Markdown file with YAML frontmatter controlling `tools`, `model`, `maxTurns`, and `description`. The `/detent:plan` skill becomes a sequential orchestrator: it calls `cmdSpawn` for each agent in turn, passing each agent a `--prompt` that includes `@` references to prior agents' output files. The skill reads only H-Review's verdict field (one JSON key) for routing; all other agent outputs flow agent-to-agent via files.

**Primary recommendation:** Build the CLI commands first (truth surface), then build the agent templates, then wire them together in the `/detent:plan` skill rewrite. The three parts are independently testable and only depend on each other at integration time.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22 LTS (v25.8.0 on this machine) | Runtime for detent-tools.cjs extensions | Pre-installed, existing runtime |
| `write-file-atomic` | 7.0.0 (installed, verified) | Atomic writes for truth surface .md files | Already a dependency; prevents torn reads |
| Native `fs` + Node `path` | Built-in | Read truth surface Markdown files for CLI | No new dependency needed |
| `.claude/agents/*.md` | Claude Code native | Agent template format | Travels with repo, Claude Code native format |

### No New Dependencies Required

All Phase 3 work extends the existing detent-tools.cjs CLI (326 lines, one external dep: `write-file-atomic`) and creates new `.claude/agents/*.md` files. No new npm packages are needed.

**Version verification:**
```bash
node -e "console.log(require('./node_modules/write-file-atomic/package.json').version)"
# → 7.0.0 (confirmed installed)
node --version
# → v25.8.0 (exceeds LTS 22 requirement)
```

---

## Architecture Patterns

### Recommended Project Structure (additions from Phase 3)

```
.claude/
└── agents/                          # NEW: Claude Code agent templates
    ├── d-critique.md                # D stage: critique requirements vs truth surface
    ├── g-red.md                     # G stage: attack the plan
    ├── g-blue.md                    # G stage: defend against the attack
    ├── h-review.md                  # H stage: judge coding-readiness
    └── j-compile.md                 # J stage: generate code handoff
.detent/
├── truth-surface/                   # EXISTS (created by setup): truth surface files
│   ├── constraint-ledger.md         # NEW: retained_goal, discarded options, rationale
│   ├── frozen-decisions.md          # NEW: FROZEN/PROPOSED decision entries
│   └── domain-model.md              # NEW: domain concepts and constraints
├── plan/                            # EXISTS (created by detent-plan): agent outputs
│   ├── d-critique-output.md         # D agent output
│   ├── g-red-output.md              # G-Red agent output
│   ├── g-blue-output.md             # G-Blue agent output
│   ├── h-review-verdict.json        # H agent verdict (JSON for machine parsing)
│   └── handoff.md                   # J agent output (replaces placeholder)
└── playbooks/                       # NEW: quality standards for agents
    ├── stage-playbook.md
    ├── subagent-protocol.md
    └── handoff-quality-bar.md
detent-tools.cjs                     # MODIFIED: +truth-propose, +truth-freeze, +truth-read
```

### Pattern 1: Truth Surface File Format (Markdown + YAML Entry Blocks)

**What:** Each truth surface file stores decision entries as Markdown sections. CLI parses the file to find entries by ID and check their status field.

**When to use:** For all three truth surface files (constraint-ledger.md, frozen-decisions.md, domain-model.md).

**Key insight from D-04:** Entry metadata must be machine-parseable by the CLI, but the files must also be human-readable. Using a YAML frontmatter block per entry (embedded in Markdown) satisfies both. The CLI uses a regex or line-scan parser to locate entries by ID and read their `status` field.

**Example entry schema (one entry in frozen-decisions.md):**

```markdown
## DECISION-001: Use write-file-atomic for all state writes

```yaml
id: DECISION-001
status: FROZEN
source_agent: d-critique
challenged_by: g-red
frozen_at: 2026-04-05T10:00:00Z
```

**Retained goal:** Prevent torn reads during concurrent CLI calls.
**Rationale:** Rename-based atomicity is the only safe approach on all platforms.
**Discarded options:** Direct fs.writeFileSync (torn reads under concurrent access).
```

The CLI locates an entry by scanning for `## ` + id header, then reads the YAML block below it.

### Pattern 2: `canFreeze()` Gate Logic in `truth-freeze` Command

**What:** Before marking an entry FROZEN, the CLI checks two conditions: (1) entry exists and has `challenged_by` field (decision maturity), (2) mode-based gate (supervised = human confirm not applicable in CLI; autonomous = proceed).

**Key insight from D-02:** The gate in `truth-freeze` is simpler than the gate in pipeline skills because CLI commands don't have `AskUserQuestion`. The supervised-mode human gate must be handled by the *calling skill* before invoking `truth-freeze`. The CLI's job is only to enforce the maturity check (has `challenged_by`).

**Revised `canFreeze()` flow:**
```
truth-freeze --dir . --id DECISION-001
  1. Read truth surface file
  2. Find entry by id
  3. If entry not found → exit 1 "Entry not found"
  4. If entry.status === "FROZEN" → exit 1 "Already FROZEN (immutable)"
  5. If !entry.challenged_by → exit 1 "Not mature: missing challenged_by field"
  6. Set entry.status = "FROZEN", entry.frozen_at = now
  7. Write file atomically
  8. Exit 0
```

The `/detent:plan` skill handles the supervised-mode human confirmation gate *before* calling `truth-freeze`.

### Pattern 3: Agent Template Frontmatter (Verified Against Official Docs)

**What:** Each agent is a `.claude/agents/<name>.md` file with YAML frontmatter and Markdown body.

**Source:** Official Claude Code docs at https://code.claude.com/docs/en/sub-agents (verified April 2026)

**Required fields:** `name`, `description`
**Key optional fields:** `tools` (allowlist), `model`, `maxTurns`

**Verified frontmatter fields for Phase 3 agents:**

```yaml
---
name: d-critique
description: Critiques requirements against the truth surface, attacking false assumptions. Invoked by /detent:plan orchestrator.
tools: Read, Bash
model: inherit
maxTurns: 7
---
```

**Tool notes (from official docs):**
- `tools` is an allowlist — agent cannot use any tool not listed
- `Bash` enables `node ./detent-tools.cjs truth-read` calls
- `Write` must be granted explicitly if an agent writes output files
- Subagents do NOT inherit parent conversation tools unless `tools` field is omitted
- Agents receive only their system prompt + basic env details (working directory), NOT the full Claude Code system prompt

**Critical constraint:** Subagents cannot spawn other subagents (official docs: "subagents cannot spawn other subagents"). This means the `/detent:plan` skill (running as the main conversation) must be the one calling `cmdSpawn` for each agent — agents cannot chain each other.

### Pattern 4: Sequential Agent Orchestration in `/detent:plan` Skill

**What:** The skill calls `cmdSpawn` five times in sequence. Each spawn invocation passes a `--prompt` built from `@` file references pointing to prior agents' outputs.

**When to use:** D-13 requires immediate stop on any agent failure, with artifact preservation.

**Flow:**

```
Step 1: State check (pipeline_stage === "discovery")
Step 2: Gate check (plan gate, supervised mode)
Step 3: mkdir -p .detent/plan
Step 4: Spawn D-Critique  → output: .detent/plan/d-critique-output.md
Step 5: Spawn G-Red       → reads d-critique-output.md via @ ref
                          → output: .detent/plan/g-red-output.md
Step 6: Spawn G-Blue      → reads g-red-output.md via @ ref
                          → output: .detent/plan/g-blue-output.md
Step 7: Spawn H-Review    → reads d, g-red, g-blue outputs
                          → output: .detent/plan/h-review-verdict.json
Step 8: Read H verdict    (only content the skill reads from agent output)
Step 9: If rejected:
          reentry_depth++
          If reentry_depth > 2: escalate to human, stop
          Else: go back to step 4 or 5 per reentry_stage
Step 10: Spawn J-Compile  → reads all prior outputs
                          → output: .detent/plan/handoff.md (replaces placeholder)
Step 11: State write: pipeline_stage = "planning"
```

**H-Review verdict format (Claude's discretion — recommended):**

```json
{
  "verdict": "rejected",
  "reentry_stage": "D",
  "reason": "Requirements R-03 contradicts frozen decision DECISION-001"
}
```

JSON is machine-parseable by the skill. The skill reads this file and parses `verdict` and `reentry_stage` fields only.

### Pattern 5: `@` File Reference in Agent Prompts

**What:** When the skill builds the `--prompt` string for each subsequent agent, it uses `@path/to/file` references. Claude Code resolves `@` references and injects file contents into the prompt.

**Example prompt for G-Red agent:**
```
@.detent/plan/d-critique-output.md
@.detent/truth-surface/frozen-decisions.md
@.detent/playbooks/subagent-protocol.md

You are G-Red. Attack the D-Critique output above...
```

**Alternative approach** (if `@` refs in spawn prompts behave differently): The skill could use `cat` in a bash pre-step to read file contents and embed them directly in the `--prompt` string. This is the fallback if `@` ref expansion doesn't work in the `--prompt` context.

**Confidence on `@` refs in cmdSpawn prompts:** MEDIUM — the `@` reference mechanism is confirmed to work in skill content and conversation context. Whether it resolves correctly when passed as a `--prompt` string to `claude -p` needs validation at execution time.

### Anti-Patterns to Avoid

- **Skill reading full agent outputs into context:** Violates D-12 (father model pattern). Only read H's verdict field. Large agent outputs would bloat the skill's context window.
- **Agent writing to `.detent/` directly:** All `.detent/` state mutations go through `detent-tools.cjs`. Agents that need to update truth surface call `node ./detent-tools.cjs truth-propose` via Bash — they never use Write tool on `.detent/` files.
- **Parallel G-Red/Blue spawn:** Deferred by D-10. Sequential ensures Blue reads Red's actual output, not an independent analysis.
- **Hard-coding agent prompt content in skill SKILL.md:** Agents receive their instructions through their own `.claude/agents/*.md` system prompts, not through the spawn prompt. The spawn prompt provides *context* (file references, discovery output); the agent template provides *role definition*.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes for truth surface | Custom lock file mechanism | `writeFileAtomicSync` (already installed) | Already handles rename-based atomicity; 1,598 dependents; maintained by npm team |
| Markdown entry parser for truth surface | Complex regex parser | Line-scan: find `## ID` header, read YAML block | Truth surface files have predictable structure; simple line scan is sufficient and avoids parser dependencies |
| Agent orchestration framework | Custom agent registry / message bus | Claude Code `.claude/agents/` + `cmdSpawn` | Claude Code native; `cmdSpawn` already exists; file-based data flow is the established pattern |
| Retry/reentry loop | External state machine | `reentry_depth` counter in `state.json` + in-skill loop | Already have `reentry_depth` field in state.json since Phase 1; use it |
| H-Review verdict parsing | XML/YAML parser | JSON.parse on `.detent/plan/h-review-verdict.json` | JSON is simplest machine-parseable format; Node.js parses it natively |

**Key insight:** The project has deliberately minimized dependencies (one external dep: `write-file-atomic`). Phase 3 adds zero new npm packages.

---

## Common Pitfalls

### Pitfall 1: `truth-freeze` Called Without Prior `truth-propose`

**What goes wrong:** Agent calls `truth-freeze` on an ID that doesn't exist in the file. CLI must handle "entry not found" case cleanly.

**Why it happens:** Agents may assume a decision already exists in the truth surface when it doesn't yet.

**How to avoid:** `truth-freeze` checks for entry existence before attempting to freeze. Exit 1 with clear error message: "Entry DECISION-XXX not found. Call truth-propose first."

**Warning signs:** Test coverage for this case in `test/run-tests.js`.

### Pitfall 2: H-Review Verdict Not Machine-Parseable

**What goes wrong:** H-Review writes a prose verdict or a format the skill can't parse. Skill breaks trying to read `reentry_stage`.

**Why it happens:** Agent models tend toward natural language output. Without explicit format constraints in the agent's system prompt, verdict format will be inconsistent.

**How to avoid:** J-Compile and H-Review agent prompts must explicitly instruct the agent to write output to `.detent/plan/h-review-verdict.json` as valid JSON with exactly these fields: `verdict`, `reentry_stage`, `reason`. Include a JSON template in the agent's system prompt.

**Warning signs:** Skill exits with JSON parse error on h-review-verdict.json.

### Pitfall 3: `@` File Reference Resolution in `cmdSpawn` Prompts

**What goes wrong:** The `@` file reference mechanism works in conversation context but may not resolve when passed as `--prompt` to `claude -p`.

**Why it happens:** `claude -p "..."` treats the prompt as a raw string. `@` reference expansion may be a conversation-context feature only.

**How to avoid:** Test `@` ref behavior in spawn prompts during the first integration test. Prepare fallback: pre-read files in skill via Bash and embed content in the prompt string directly (via a helper function in the skill or in detent-tools.cjs).

**Confidence:** MEDIUM — needs validation at execution time.

### Pitfall 4: Reentry Loop Without `reentry_depth` Increment

**What goes wrong:** H-Review rejects twice with the same contradiction. Skill loops indefinitely without escalating.

**Why it happens:** Easy to forget to increment `reentry_depth` in state.json at the start of each reentry.

**How to avoid:** `/detent:plan` must call `node ./detent-tools.cjs state-write --reentry_depth <n+1>` at the beginning of each reentry pass, before re-running agents. Check `reentry_depth >= 2` before spawning. Add a test that simulates H rejection at reentry_depth = 2.

### Pitfall 5: Agent Template `tools` Field Syntax

**What goes wrong:** Agent frontmatter uses wrong tool names or syntax, causing Claude Code to reject the agent definition or grant no tools.

**Why it happens:** Tool names are case-sensitive in Claude Code. Using `bash` instead of `Bash`, `read` instead of `Read` will silently fail or error.

**How to avoid (verified from official docs):** Tool names are capitalized: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`. The `tools` field accepts a comma-separated string or YAML list.

**Correct:**
```yaml
tools: Read, Bash
# or
tools:
  - Read
  - Bash
```

### Pitfall 6: Truth Surface File Created by Agents vs. CLI

**What goes wrong:** D-Critique or another agent creates `.detent/truth-surface/*.md` files using the Write tool directly, bypassing detent-tools.cjs.

**Why it happens:** Agents with `Write` tool access will default to using Write unless explicitly prohibited by their system prompt.

**How to avoid:** D-Critique and other agents that interact with the truth surface must receive `Bash` (not `Write`) as their tool for truth surface mutations. Their system prompts must state: "Do not use the Write tool on .detent/ files. Use `node ./detent-tools.cjs truth-propose` via Bash." Truth surface files are initialized by `/detent:setup` (via cmdSetup) — they exist before any agent runs.

---

## Code Examples

Verified patterns from existing codebase and official sources:

### Truth Surface Command Structure (extending detent-tools.cjs pattern)

```javascript
// Source: existing detent-tools.cjs pattern (Phase 1)
// New command follows same structure

function cmdTruthPropose(targetDir, named) {
  requireInit(targetDir);
  const id = named.id;
  const file = named.file; // e.g., 'frozen-decisions'
  const status = named.status || 'PROPOSED';
  const rationale = named.rationale || '';
  const sourceAgent = named['source-agent'] || 'unknown';

  if (!id || !file) {
    process.stderr.write('Error: --id and --file required for truth-propose\n');
    process.exit(1);
  }

  const filePath = path.join(detentDir(targetDir), 'truth-surface', `${file}.md`);
  const content = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8')
    : `# ${file}\n\n`;

  // Check if entry already exists
  if (content.includes(`## ${id}`)) {
    process.stderr.write(`Error: Entry ${id} already exists. Use a unique ID.\n`);
    process.exit(1);
  }

  const entry = `\n## ${id}\n\n\`\`\`yaml\nid: ${id}\nstatus: ${status}\nsource_agent: ${sourceAgent}\nchallenged_by: null\n\`\`\`\n\n${rationale}\n`;
  writeFileAtomicSync(filePath, content + entry, { encoding: 'utf8' });
  process.stdout.write(JSON.stringify({ ok: true, id }) + '\n');
}

function cmdTruthFreeze(targetDir, named) {
  requireInit(targetDir);
  const id = named.id;
  const file = named.file;

  if (!id || !file) {
    process.stderr.write('Error: --id and --file required for truth-freeze\n');
    process.exit(1);
  }

  const filePath = path.join(detentDir(targetDir), 'truth-surface', `${file}.md`);
  if (!fs.existsSync(filePath)) {
    process.stderr.write(`Error: File ${file}.md not found\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check entry exists
  if (!content.includes(`## ${id}`)) {
    process.stderr.write(`Error: Entry ${id} not found. Call truth-propose first.\n`);
    process.exit(1);
  }

  // Check already FROZEN (immutable, D-03)
  // Parse status from YAML block following the entry header
  const entryMatch = content.match(new RegExp(`## ${id}[\\s\\S]*?status: (\\w+)`));
  if (entryMatch && entryMatch[1] === 'FROZEN') {
    process.stderr.write(`Error: Entry ${id} is already FROZEN (immutable).\n`);
    process.exit(1);
  }

  // Check maturity (D-02): challenged_by must not be null
  const challengedByMatch = content.match(new RegExp(`## ${id}[\\s\\S]*?challenged_by: (\\S+)`));
  if (!challengedByMatch || challengedByMatch[1] === 'null') {
    process.stderr.write(`Error: Entry ${id} is not mature (missing challenged_by). Cannot freeze.\n`);
    process.exit(1);
  }

  // Update status to FROZEN
  const updated = content.replace(
    new RegExp(`(## ${id}[\\s\\S]*?status: )\\w+`),
    `$1FROZEN`
  ).replace(
    new RegExp(`(## ${id}[\\s\\S]*?frozen_at: )null`),
    `$1${new Date().toISOString()}`
  );

  writeFileAtomicSync(filePath, updated, { encoding: 'utf8' });
  process.stdout.write(JSON.stringify({ ok: true, id, status: 'FROZEN' }) + '\n');
}
```

### Agent Template: D-Critique (Minimum Viable Structure)

```markdown
---
name: d-critique
description: Critiques requirements against the truth surface for /detent:plan pipeline. Attacks false assumptions and proposes constraints. Invoked only by the detent-plan orchestrator.
tools: Read, Bash
model: inherit
maxTurns: 7
disable-model-invocation: true
---

You are D-Critique, the first stage of the Detent adversarial planning pipeline.

@.detent/playbooks/subagent-protocol.md
@.detent/playbooks/stage-playbook.md

## Your Role

Critique the requirements provided to you. Attack false assumptions. Identify at least one requirement that may contradict or be incompletely specified against the truth surface.

## Input Files

Read these files before producing your critique:
- `.detent/truth-surface/frozen-decisions.md` — frozen constraints you must respect
- `.detent/truth-surface/constraint-ledger.md` — retained goals and discarded options
- `.detent/discovery/domain-model.md` — domain model from discovery stage

## Your Task

1. Read all input files above
2. Identify at least one requirement that deserves challenge (attack at least one)
3. For each challenged requirement, check alignment with frozen decisions
4. If a gap or contradiction exists, propose it via: `node ./detent-tools.cjs truth-propose --dir . --id <ID> --file frozen-decisions --source-agent d-critique --rationale "<rationale>"`

## Output

Write your structured critique to `.detent/plan/d-critique-output.md`. Include:
- Each requirement examined
- Which requirements you are challenging and why
- Proposed new constraints (IDs of entries you proposed to truth surface)
- Open questions for G-Red to attack

Do NOT use the Write tool on `.detent/` files. Use Bash for truth surface mutations.
```

### H-Review Verdict JSON Template (in agent system prompt)

```markdown
## Output Format

Write your verdict as valid JSON to `.detent/plan/h-review-verdict.json`. Use exactly this structure:

{
  "verdict": "approved",
  "reentry_stage": null,
  "reason": "All requirements are consistent with frozen decisions. Handoff is ready."
}

If rejecting:

{
  "verdict": "rejected",
  "reentry_stage": "D",
  "reason": "REQ-03 contradicts DECISION-001. Return to D-stage for re-critique."
}

Valid values for `reentry_stage`: "D" or "G". Set to null when approving.
Do not add any fields. Do not wrap in markdown code fences.
```

### Sequential Spawn Pattern in `/detent:plan` Skill (pseudocode)

```bash
# Step 1: Spawn D-Critique
node ./detent-tools.cjs spawn --dir . --prompt "$(cat <<'PROMPT'
@.detent/discovery/domain-model.md
Run as the d-critique subagent for this planning session.
PROMPT
)"

# Check exit code — stop immediately if non-zero (D-13)
if [ $? -ne 0 ]; then
  echo "D-Critique agent failed. Artifacts preserved in .detent/plan/"
  exit 1
fi

# Step 2: Spawn G-Red (reads D output via @)
node ./detent-tools.cjs spawn --dir . --prompt "$(cat <<'PROMPT'
@.detent/plan/d-critique-output.md
@.detent/truth-surface/frozen-decisions.md
Run as the g-red subagent for this planning session.
PROMPT
)"
```

**Note on `@` refs in spawn prompts:** If `@` reference expansion does not work inside a `--prompt` string passed to `claude -p`, the fallback is: read the file content in Bash beforehand and embed it directly in the prompt string. Test this at execution time.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Task tool name | Renamed to Agent tool (v2.1.63) | v2.1.63 | `Task(...)` still works as alias |
| subagents cannot spawn subagents | Still true as of April 2026 | — | `/detent:plan` must be the spawn orchestrator |
| `tools` field as YAML list | Also accepts comma-separated string | Current | Either syntax works |

**Deprecated/outdated:**
- Using `Task` in `tools` field to restrict spawnable subagents: The field is now `Agent(agent_type)` syntax. `Task(...)` still works as alias but `Agent(...)` is preferred.

---

## Open Questions

1. **`@` reference resolution in `claude -p` prompts**
   - What we know: `@` refs resolve in conversation context and skill content
   - What's unclear: Whether `@path` in a `--prompt` string passed to `claude -p` expands on the spawned agent's side or is treated as a literal string
   - Recommendation: In Wave 1, add an explicit integration test for this before implementing the full pipeline. Fallback: pre-read files in skill and embed content in prompt string directly.

2. **`.detent/plan/` directory initialization**
   - What we know: Phase 2's `/detent:plan` stub creates `.detent/plan/handoff.md` via `mkdir -p` + `cat`
   - What's unclear: Should the plan directory be cleared at the start of each `/detent:plan` run, or should artifacts accumulate?
   - Recommendation: Clear `.detent/plan/` at start of `/detent:plan` execution (before spawning D). This prevents stale artifacts from a previous run confusing agents. Add to Wave 0 plan.

3. **Truth surface file initialization content**
   - What we know: `/detent:setup` must create `.detent/playbooks/` and initialize truth surface .md files
   - What's unclear: Should initialized .md files be blank or have a structural header?
   - Recommendation: Initialize with a structural header (# frozen-decisions, ## Instructions section). Blank files will confuse agents that `@`-reference them.

4. **H-Review gate placement relative to `reentry_depth` check**
   - What we know: Max 2 retries per D-11, escalate on breach
   - What's unclear: Should the skill check `reentry_depth >= 2` before or after reading H's verdict?
   - Recommendation: Check reentry_depth BEFORE spawning H (fail fast). If already at limit, skip to human escalation without another H pass.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | detent-tools.cjs runtime | ✓ | v25.8.0 | — |
| `write-file-atomic` | Truth surface atomic writes | ✓ | 7.0.0 | — |
| `claude` CLI | `/detent:plan` cmdSpawn | ✓ | `/opt/homebrew/bin/claude` | — |
| `.claude/agents/` directory | Agent templates | ✗ (dir doesn't exist yet) | — | Create in Wave 0 |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies with fallback:**
- `.claude/agents/` directory does not exist yet. Must be created as part of Wave 0 setup (not a blocker — it's part of the deliverable).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `assert` + custom test runner |
| Config file | `test/run-tests.js` (the runner IS the test file) |
| Quick run command | `node test/run-tests.js` |
| Full suite command | `node test/run-tests.js` |

Current suite: 23 tests, all passing.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRUTH-01 | `setup` creates `.detent/truth-surface/` dir | unit | `node test/run-tests.js` (T2) | ✅ |
| TRUTH-01 | `truth-propose` creates entry in named file | unit | `node test/run-tests.js` | ❌ Wave 0 |
| TRUTH-01 | `truth-read` returns file contents | unit | `node test/run-tests.js` | ❌ Wave 0 |
| TRUTH-02 | `truth-freeze` rejects overwrite of FROZEN entry | unit | `node test/run-tests.js` | ❌ Wave 0 |
| TRUTH-02 | `truth-freeze` rejects entry without `challenged_by` | unit | `node test/run-tests.js` | ❌ Wave 0 |
| TRUTH-03 | `constraint-ledger.md` entry has `retained_goal` and `rationale` | unit | `node test/run-tests.js` | ❌ Wave 0 |
| PLAN-01 | `.claude/agents/d-critique.md` exists with correct frontmatter | unit | `node test/run-tests.js` | ❌ Wave 0 |
| PLAN-02 | `.claude/agents/g-red.md` and `g-blue.md` exist | unit | `node test/run-tests.js` | ❌ Wave 0 |
| PLAN-03 | `.claude/agents/h-review.md` exists; verdict template in body | unit | `node test/run-tests.js` | ❌ Wave 0 |
| PLAN-04 | `.claude/agents/j-compile.md` exists | unit | `node test/run-tests.js` | ❌ Wave 0 |
| PLAN-05 | `.detent/playbooks/` created by `setup` | unit | `node test/run-tests.js` | ❌ Wave 0 |
| PLAN-05 | All 3 playbook files exist after `setup` | unit | `node test/run-tests.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node test/run-tests.js`
- **Per wave merge:** `node test/run-tests.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/run-tests.js` — add T24-T35 covering truth-propose, truth-freeze, truth-read, and agent file existence checks
- [ ] `.claude/agents/` directory — created as part of agent template task, not test infrastructure

*(Existing `test/run-tests.js` already covers: setup creates .detent/truth-surface/ (T2). New truth-* CLI tests follow same `test()` + `runAllowError()` pattern already established in the file.)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| Runtime: Node.js 22 LTS, CJS (.cjs) | detent-tools.cjs remains CJS; no ESM |
| All agent orchestration via CLI subprocess with `-p --output-format stream-json --dangerously-skip-permissions` | cmdSpawn already implements this; Phase 3 uses it unchanged |
| `stdio: ["inherit", "pipe", "pipe"]` for spawn (issue #771 workaround) | cmdSpawn already has this; must not be changed |
| CLI tool as single source of truth for state mutations | All `.detent/` writes through detent-tools.cjs; agents use Bash to call CLI |
| Write excluded from skill allowed-tools | `/detent:plan` skill must NOT include Write in allowed-tools |
| Session boundary: each skill = one Claude Code session | `/detent:plan` orchestrates all 5 agents; state preserved in `.detent/` files |
| `chokidar` v4 (stay on v4, not v5) | Not relevant Phase 3 (no file watching added) |
| `write-file-atomic` 7.0.0 | Already installed; all truth surface writes use it |
| Agent templates: `description`, `tools`, `model`, `maxTurns`, `hooks`, `skills`, `effort` supported in frontmatter | All confirmed against official docs; verified April 2026 |
| Gemini CLI hooks for async logging: deferred to Phase 5 | No hook changes in Phase 3 |

---

## Sources

### Primary (HIGH confidence)

- Official Claude Code subagents docs: https://code.claude.com/docs/en/sub-agents — verified April 2026. All agent frontmatter fields, tool names, model aliases, `maxTurns`, scope priority.
- Official Claude Code skills docs: https://code.claude.com/docs/en/skills — verified April 2026. `context: fork`, `agent:` field, `@` reference mechanism, `allowed-tools` field syntax.
- Existing `detent-tools.cjs` (326 lines) — current CLI patterns for parseArgs, readJson, writeJson, requireInit, cmdSpawn.
- Existing `test/run-tests.js` (23 tests) — established test patterns for new truth-* command tests.
- `.planning/phases/03-truth-surface-and-planning-agents/03-CONTEXT.md` — all locked decisions (D-01 through D-17).

### Secondary (MEDIUM confidence)

- Official docs confirm: subagents cannot spawn other subagents. Source: "subagents cannot spawn other subagents" in Plan built-in agent description. This is the architectural reason why `/detent:plan` skill must be the spawn orchestrator.

### Tertiary (LOW confidence)

- `@` file reference expansion behavior inside `--prompt` strings passed to `claude -p`: Not explicitly documented for this use case. Confirmed to work in skill content and conversation context; behavior in headless mode (`-p`) prompts needs execution-time validation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing tools verified installed
- Architecture: HIGH — agent frontmatter format verified against official docs; CLI patterns follow proven Phase 1/2 approach
- Pitfalls: HIGH for CLI patterns; MEDIUM for `@` ref behavior in spawn prompts (needs execution-time validation)
- Agent template design: HIGH — frontmatter format fully documented; tool names verified

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable Claude Code APIs; agent frontmatter format unlikely to change in 30 days)
