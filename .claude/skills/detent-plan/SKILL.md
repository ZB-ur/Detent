---
name: detent-plan
description: Run the Planning stage of the Detent pipeline -- orchestrates D/G/H/J adversarial agents
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

@.claude/skills/_shared/rules.md

# /detent:plan -- Planning Stage

Run the Planning stage: orchestrate D-Critique -> G-Red -> G-Blue -> H-Review -> J-Compile adversarial agents. Implements the father model pattern: the skill reads only H-Review's verdict for routing decisions, never agent content.

## Step 1: Read and Validate State

Read current pipeline state:

```bash
node ./detent-tools.cjs state-read --dir .
```

Parse the JSON output. Verify `pipeline_stage` is `"discovery"` or `"planning"` (dual-entry: `"planning"` allows re-entry after a rejected retry).

If `pipeline_stage` is not `"discovery"` and not `"planning"`:
  Stop with message: "Pipeline stage is <actual>, but /detent:plan expects discovery or planning. Run /detent:discovery first, then retry /detent:plan."

Read `reentry_depth` from the parsed state -- you will need this value in the retry loop.

## Step 2: Gate Check (Plan Gate)

Read the current configuration:

```bash
node ./detent-tools.cjs config-read --dir .
```

Parse the JSON output and evaluate the plan gate:

1. If `config.gates` is missing, warn: "config.gates not found -- treating plan gate as enabled (safe default). Update config.json to configure gates." Treat gate as enabled.
2. Check `config.gates.plan.enabled` -- if the field is missing, treat as enabled.
3. Check `config.mode`.

If `config.mode === "supervised"` AND gate is enabled:
  Use AskUserQuestion:

  > Plan gate: Review the discovery output in `.detent/discovery/domain-model.md` before proceeding to planning.
  >
  > Proceed? (proceed / revise / stop)

  Handle response:
  - "proceed" -- continue to next step
  - "revise" -- stop skill, leave `pipeline_stage` unchanged (re-run /detent:discovery to update domain model, then retry /detent:plan)
  - "stop" -- stop skill, leave `pipeline_stage` unchanged

If `config.mode === "autonomous"` OR gate is disabled: proceed without prompting.

## Step 3: Prepare Workspace

Clear any stale artifacts from previous runs, then create a fresh output directory:

```bash
rm -rf .detent/plan && mkdir -p .detent/plan
```

This prevents stale artifacts from a prior iteration from being read by agents in a new run.

## Step 4: Agent Orchestration Loop

The orchestration loop runs up to 3 times (initial run + 2 retries). The variable `REENTRY_ITERATION` tracks the current iteration number (0 = first pass, 1 = first retry, 2 = second retry).

**NOTE on @ references in spawn prompts:** Per research, `@` file references may not expand inside `--prompt` strings passed to `claude -p`. If agents report they cannot find the referenced files, read the file contents via Bash and embed them directly in the prompt string instead of using `@` references.

**NOTE on reentry ID collision prevention:** On retry iterations, agents are instructed to use `-R<N>` suffixed IDs for any new truth-propose calls (e.g., DECISION-001-R1 on retry 1). This prevents ID collisions with PROPOSED entries from the prior iteration.

---

### Stage 4a: D-Critique

Emit progress indicator:

```bash
echo "[detent:plan] Stage 1/5: Dispatching D-Critique..."
```

Spawn D-Critique. On retry iterations, append the reentry instruction to the prompt:

- First pass (iteration 0):
```bash
node ./detent-tools.cjs spawn --dir . --agent d-critique --prompt "Read @.detent/truth-surface/constraint-ledger.md and produce your critique."
```

- Retry pass (iteration N > 0), append to the prompt: ` This is retry iteration <N>. Use -R<N> suffix for any new truth-propose IDs to avoid collision with prior iteration entries.`

If spawn exits non-zero:
  Report: "D-Critique agent failed (exit <code>). Artifacts preserved in .detent/plan/. Pipeline stopped."
  List existing artifacts with sizes:
  ```bash
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  ```
  STOP -- do not proceed to subsequent agents.

**Validate d-critique-output.md:**

```bash
if [ ! -s .detent/plan/d-critique-output.md ]; then
  echo "VALIDATION FAILED: d-critique-output.md is missing or empty"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP -- do not proceed to next agent
fi
if ! grep -q '^##' .detent/plan/d-critique-output.md; then
  echo "VALIDATION FAILED: d-critique-output.md has no section headings (possibly truncated from maxTurns)"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP -- do not proceed to next agent
fi
```

If validation fails: report the failure, list artifacts with sizes, and STOP.

---

### Stage 4b: G-Red

Emit progress indicator:

```bash
echo "[detent:plan] Stage 2/5: Dispatching G-Red..."
```

Spawn G-Red. On retry iterations, append the reentry suffix instruction:

- First pass (iteration 0):
```bash
node ./detent-tools.cjs spawn --dir . --agent g-red --prompt "Read @.detent/plan/d-critique-output.md @.detent/truth-surface/constraint-ledger.md and produce your attack."
```

- Retry pass (iteration N > 0): append ` This is retry iteration <N>. Use -R<N> suffix for any new truth-propose IDs.`

If spawn exits non-zero:
  Report: "G-Red agent failed (exit <code>). Artifacts preserved in .detent/plan/. Pipeline stopped."
  STOP.

**Validate g-red-output.md:**

```bash
if [ ! -s .detent/plan/g-red-output.md ]; then
  echo "VALIDATION FAILED: g-red-output.md is missing or empty"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP
fi
if ! grep -q '^##' .detent/plan/g-red-output.md; then
  echo "VALIDATION FAILED: g-red-output.md has no section headings (possibly truncated from maxTurns)"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP
fi
```

If validation fails: report the failure and STOP.

---

### Stage 4c: G-Blue

Emit progress indicator:

```bash
echo "[detent:plan] Stage 3/5: Dispatching G-Blue..."
```

Spawn G-Blue. On retry iterations, append the reentry suffix instruction:

- First pass (iteration 0):
```bash
node ./detent-tools.cjs spawn --dir . --agent g-blue --prompt "Read @.detent/plan/g-red-output.md @.detent/plan/d-critique-output.md @.detent/truth-surface/constraint-ledger.md and produce your defense."
```

- Retry pass (iteration N > 0): append ` This is retry iteration <N>. Use -R<N> suffix for any new truth-propose IDs.`

If spawn exits non-zero:
  Report: "G-Blue agent failed (exit <code>). Artifacts preserved in .detent/plan/. Pipeline stopped."
  STOP.

**Validate g-blue-output.md:**

```bash
if [ ! -s .detent/plan/g-blue-output.md ]; then
  echo "VALIDATION FAILED: g-blue-output.md is missing or empty"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP
fi
if ! grep -q '^##' .detent/plan/g-blue-output.md; then
  echo "VALIDATION FAILED: g-blue-output.md has no section headings (possibly truncated from maxTurns)"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP
fi
```

If validation fails: report the failure and STOP.

---

### Stage 4d: Truth-Freeze Gate (Supervised Mode)

Emit progress indicator:

```bash
echo "[detent:plan] Stage 3.5/5: Truth-freeze gate..."
```

Read config mode: `node ./detent-tools.cjs config-read --dir .`

Read the truth surface to find mature PROPOSED entries (those with `challenged_by` set to a non-null value):

```bash
node ./detent-tools.cjs truth-read --dir . --file constraint-ledger
```

Parse the output to identify entries where `status: PROPOSED` AND `challenged_by:` is NOT `null`.

**If `config.mode === "supervised"`:**

  Use AskUserQuestion to present each mature PROPOSED entry:

  > Truth surface freeze gate: The following entries have been proposed and challenged (mature):
  >
  > [List each entry: ID - rationale summary]
  >
  > Options:
  > - "all" -- freeze all listed entries
  > - "<ID1> <ID2> ..." -- freeze specific entries by ID (space-separated)
  > - "skip" -- leave all entries as PROPOSED (they remain visible but unfrozen)

  For each entry the user approves: `node ./detent-tools.cjs truth-freeze --dir . --id <ID> --file <file>`

  For skipped entries: leave as PROPOSED.

**If `config.mode === "autonomous"`:**

  Auto-freeze all mature PROPOSED entries (those with a non-null `challenged_by`):

  ```bash
  node ./detent-tools.cjs truth-freeze --dir . --id <ID> --file <file>
  ```

  Run this for each mature PROPOSED entry found.

---

### Stage 4e: H-Review

Emit progress indicator:

```bash
echo "[detent:plan] Stage 4/5: Dispatching H-Review..."
```

Spawn H-Review:

```bash
node ./detent-tools.cjs spawn --dir . --agent h-review --prompt "Read @.detent/plan/d-critique-output.md @.detent/plan/g-red-output.md @.detent/plan/g-blue-output.md @.detent/truth-surface/constraint-ledger.md and produce your verdict."
```

If spawn exits non-zero:
  Report: "H-Review agent failed (exit <code>). Artifacts preserved in .detent/plan/. Pipeline stopped."
  STOP.

**Validate h-review-verdict.json:**

```bash
if ! node -e "const v=JSON.parse(require('fs').readFileSync('.detent/plan/h-review-verdict.json','utf8')); if(!v.verdict) process.exit(1);" 2>/dev/null; then
  echo "VALIDATION FAILED: h-review-verdict.json is missing, empty, or invalid JSON (possibly truncated from maxTurns)"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP
fi
```

If validation fails: report the failure and STOP.

---

### Stage 4f: Read H-Review Verdict

Read the verdict JSON (this is the ONLY agent output the skill reads directly -- father model pattern):

```bash
cat .detent/plan/h-review-verdict.json
```

Parse the JSON to extract:
- `verdict` -- `"approved"` or `"rejected"`
- `reentry_stage` -- `"D"`, `"G"`, or `null`
- `reason` -- the explanation string

If JSON parse fails: report "H-Review verdict is not valid JSON -- cannot route." and STOP.

---

### Stage 4g: Handle Verdict

**If `verdict === "approved"`:** proceed to Stage 4h (J-Compile).

**If `verdict === "rejected"`:**

  Read current `reentry_depth` from state:
  ```bash
  node ./detent-tools.cjs state-read --dir .
  ```

  Parse `reentry_depth` from the state JSON.

  **If `reentry_depth >= 2`:**
    Use AskUserQuestion:

    > Planning pipeline has been rejected 2 or more times.
    >
    > H-Review reason: <reason>
    >
    > The plan has not reached approval after 2 retries. Manual intervention is required.
    >
    > Options:
    > - "retry" -- reset reentry_depth to 0 and restart from D-Critique
    > - "stop" -- stop the pipeline (pipeline_stage left unchanged)

    If user selects "retry":
      ```bash
      node ./detent-tools.cjs state-write --dir . --reentry_depth 0
      ```
      Clear the plan directory and restart the loop from Stage 4a.

    If user selects "stop": STOP skill. Leave `pipeline_stage` unchanged.

  **If `reentry_depth < 2`:**
    Increment reentry_depth:
    ```bash
    node ./detent-tools.cjs state-write --dir . --reentry_depth <current_depth_plus_1>
    ```

    Read the new REENTRY_ITERATION value (equals new reentry_depth).

    **If `reentry_stage === "D"` (restart from D-Critique):**
      Clear all plan artifacts:
      ```bash
      rm -rf .detent/plan && mkdir -p .detent/plan
      ```
      Print: "[detent:plan] H-Review rejected: <reason>. Restarting from D-Critique (retry <N>)..."
      Go back to Stage 4a. On re-spawn, append to the prompt: ` This is retry iteration <N>. Use -R<N> suffix for any new truth-propose IDs to avoid collision with prior iteration entries.`

    **If `reentry_stage === "G"` (restart from G-Red/Blue):**
      Clear only G-Red, G-Blue, and H-Review artifacts:
      ```bash
      rm -f .detent/plan/g-red-output.md .detent/plan/g-blue-output.md .detent/plan/h-review-verdict.json
      ```
      Print: "[detent:plan] H-Review rejected: <reason>. Restarting from G-Red (retry <N>)..."
      Go back to Stage 4b. On re-spawn, append to the prompt: ` This is retry iteration <N>. Use -R<N> suffix for any new truth-propose IDs to avoid collision with prior iteration entries.`

---

### Stage 4h: J-Compile

Emit progress indicator:

```bash
echo "[detent:plan] Stage 5/5: Dispatching J-Compile..."
```

Spawn J-Compile:

```bash
node ./detent-tools.cjs spawn --dir . --agent j-compile --prompt "Read @.detent/plan/d-critique-output.md @.detent/plan/g-red-output.md @.detent/plan/g-blue-output.md @.detent/plan/h-review-verdict.json @.detent/truth-surface/constraint-ledger.md and produce the code handoff."
```

If spawn exits non-zero:
  Report: "J-Compile agent failed (exit <code>). Artifacts preserved in .detent/plan/. Pipeline stopped."
  STOP.

**Validate handoff.md:**

```bash
if [ ! -s .detent/plan/handoff.md ]; then
  echo "VALIDATION FAILED: handoff.md is missing or empty"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP
fi
if ! grep -qE '^## Implementation Unit' .detent/plan/handoff.md; then
  echo "VALIDATION FAILED: handoff.md has no Implementation Unit section (possibly truncated from maxTurns)"
  ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
  # STOP
fi
```

If validation fails: report the failure and STOP.

---

## Step 5: Update State and Exit

On successful completion:

```bash
node ./detent-tools.cjs state-write --dir . --pipeline_stage planning --reentry_depth 0
```

Reset `reentry_depth` to 0 after a successful pipeline run.

Print completion summary:

```
[detent:plan] Planning complete. Adversarial pipeline: D -> G-Red -> G-Blue -> H -> J

Artifacts:
  .detent/plan/d-critique-output.md
  .detent/plan/g-red-output.md
  .detent/plan/g-blue-output.md
  .detent/plan/h-review-verdict.json
  .detent/plan/handoff.md

Next: /detent:code
```

---

## Step 6: Error Handling (per D-13)

At any point where an agent spawn fails (non-zero exit) OR output validation fails:

1. Report which agent failed and whether it was a spawn error or a validation error
2. List which artifacts exist in `.detent/plan/` with their file sizes:
   ```bash
   ls -la .detent/plan/ 2>/dev/null || echo "(no artifacts)"
   ```
3. Leave `pipeline_stage` unchanged (do NOT advance the state)
4. STOP -- do not attempt to spawn subsequent agents
