---
name: detent-code
description: Run the Coding stage of the Detent pipeline -- orchestrates Coder/Evaluator adversarial loop
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

@.claude/skills/_shared/rules.md

# /detent:code -- Coding Stage

Run the Coding stage: orchestrate Coder/Evaluator adversarial loop for each implementation unit from the planning handoff. Implements the father model pattern: the skill reads only evaluator-verdict.json for routing decisions.

## Step 1: Read State and Resume Detection

Read current pipeline state:

```bash
node ./detent-tools.cjs state-read --dir .
```

Parse the JSON output. Check `pipeline_stage`:

- If `"planning"`: this is a fresh start from a successful /detent:plan. Proceed to Step 2.
- If `"coding"`: this is a RESUME after a crash or /clear. The state already has `current_unit`, `total_units`, `iteration_count` from the previous invocation. Skip Steps 2-4 and jump directly to Step 5 (outer unit loop) using the existing state values. Print: `[detent:code] Resuming from UNIT-<zero-padded current_unit+1> iteration <iteration_count>.`
- If neither `"planning"` nor `"coding"`: stop with message: "Pipeline stage is <actual>, but /detent:code expects planning or coding. Run /detent:plan first."

Read `reentry_depth` from the parsed state -- needed later for depth limit check.

## Step 2: Gate Check (Code Gate)

Read the current configuration:

```bash
node ./detent-tools.cjs config-read --dir .
```

Parse the JSON output and evaluate the code gate:

1. If `config.gates` is missing, warn: "config.gates not found -- treating code gate as enabled (safe default). Update config.json to configure gates." Treat gate as enabled.
2. Check `config.gates.code.enabled` -- if the field is missing, treat as enabled.
3. Check `config.mode`.

If `config.mode === "supervised"` AND gate is enabled:
  Use AskUserQuestion:

  > Code gate: Review the planning handoff in `.detent/plan/handoff.md` before proceeding to coding.
  >
  > Proceed? (proceed / revise / stop)

  Handle response:
  - "proceed" -- continue to next step
  - "revise" -- stop skill, leave `pipeline_stage` unchanged (edit the handoff or re-run /detent:plan, then retry /detent:code)
  - "stop" -- stop skill, leave `pipeline_stage` unchanged

If `config.mode === "autonomous"` OR gate is disabled: proceed without prompting.

## Step 3: Prepare Workspace

Clear any stale artifacts from previous runs, then create a fresh output directory (fresh starts ONLY -- skip this if resuming from "coding" pipeline_stage):

```bash
rm -rf .detent/code && mkdir -p .detent/code
```

This prevents stale verdict files from a prior run from being misread by the routing logic.

## Step 4: Count Units, Validate, and Initialize State

Count implementation units from the handoff:

```bash
UNIT_COUNT=$(grep -c '^### UNIT-' .detent/plan/handoff.md)
echo "Found $UNIT_COUNT implementation units"
```

**Fail-fast validation:** If UNIT_COUNT is 0, stop with error:
```
Error: No implementation units found in .detent/plan/handoff.md. Ensure J-Compile produced a valid handoff with ### UNIT-XX headings.
```

**Sequential numbering check:** Verify the first unit is UNIT-01:
```bash
grep '^### UNIT-' .detent/plan/handoff.md | head -1 | grep -q '^### UNIT-01'
```
If the first unit is not UNIT-01, print a warning but continue.

Initialize coding state:

```bash
node ./detent-tools.cjs state-write --dir . --pipeline_stage coding --total_units $UNIT_COUNT --current_unit 0 --iteration_count 0
```

## Step 5: Outer Unit Loop

Read state to get `current_unit` and `total_units`:

```bash
node ./detent-tools.cjs state-read --dir .
```

While `current_unit < total_units`: execute Steps 6-9 for the current unit.

Calculate UNIT_ID as zero-padded 2-digit number (1-indexed): if `current_unit` is 0, UNIT_ID is `UNIT-01`.

Emit progress: `[detent:code] Unit $UNIT_ID ($((current_unit+1))/$total_units): Starting...`

## Step 6: Inner Iteration Loop (per unit)

Read `iteration_count` from state.

While `iteration_count < 5`:

### Step 6a: Clear Stale Verdict and Manifest

```bash
rm -f .detent/code/evaluator-verdict.json
rm -f .detent/code/coder-manifest.json
```

This prevents the skill from reading a stale verdict from the previous iteration.

### Step 6b: Increment iteration_count BEFORE Spawn

Increment before spawning so a crash mid-spawn is recorded as an attempt:

```bash
node ./detent-tools.cjs state-write --dir . --iteration_count $((iteration_count + 1))
```

Read the updated `iteration_count` from state for the progress indicator.

### Step 6c: Spawn Coder

Emit progress: `[detent:code] Unit $UNIT_ID iteration $iteration_count/5: Spawning Coder...`

- **First iteration** (`iteration_count === 1`):
  ```bash
  node ./detent-tools.cjs spawn --dir . --agent coder --prompt "Read .detent/plan/handoff.md and execute $UNIT_ID."
  ```

- **Retry iterations** (`iteration_count > 1`): read the previous evaluator verdict issues and include them in the prompt:
  ```bash
  PREV_ISSUES=$(node -e "const v=JSON.parse(require('fs').readFileSync('.detent/code/evaluator-verdict.json','utf8')); console.log(JSON.stringify(v.issues))" 2>/dev/null || echo "[]")
  node ./detent-tools.cjs spawn --dir . --agent coder --prompt "Read .detent/plan/handoff.md and execute $UNIT_ID. Previous attempt failed. Evaluator feedback: $PREV_ISSUES"
  ```

If spawn exits non-zero:
  Report: "Coder agent failed (exit <code>). Artifacts preserved in .detent/code/. Pipeline stopped."
  List artifacts:
  ```bash
  ls -la .detent/code/ 2>/dev/null || echo "(no artifacts)"
  ```
  Leave `pipeline_stage` as "coding" (so re-invocation resumes). STOP.

**Validate coder-manifest.json:**

```bash
if [ ! -s .detent/code/coder-manifest.json ]; then
  echo "VALIDATION FAILED: coder-manifest.json is missing or empty"
  ls -la .detent/code/ 2>/dev/null || echo "(no artifacts)"
  # STOP
fi
```

If validation fails: report the failure and STOP.

### Step 6d: Spawn Evaluator

Emit progress: `[detent:code] Unit $UNIT_ID iteration $iteration_count/5: Spawning Evaluator...`

```bash
node ./detent-tools.cjs spawn --dir . --agent evaluator --prompt "Evaluate $UNIT_ID from .detent/plan/handoff.md. Check .detent/code/coder-manifest.json for files created."
```

If spawn exits non-zero:
  Report: "Evaluator agent failed (exit <code>). Artifacts preserved in .detent/code/. Pipeline stopped."
  List artifacts:
  ```bash
  ls -la .detent/code/ 2>/dev/null || echo "(no artifacts)"
  ```
  Leave `pipeline_stage` as "coding". STOP.

**Validate evaluator-verdict.json with parse guard:**

```bash
VERDICT_VALID=$(node -e "
  try {
    const v = JSON.parse(require('fs').readFileSync('.detent/code/evaluator-verdict.json', 'utf8'));
    if (!v.verdict || (v.verdict !== 'PASS' && v.verdict !== 'FAIL')) {
      console.log('INVALID');
    } else {
      console.log('VALID');
    }
  } catch(e) {
    console.log('INVALID');
  }
" 2>/dev/null)
```

If `VERDICT_VALID` is `INVALID`: print "WARNING: evaluator-verdict.json is missing, empty, or invalid JSON. Treating as FAIL." Create a synthetic FAIL verdict:

```bash
cat > .detent/code/evaluator-verdict.json << 'EOF'
{"verdict":"FAIL","issues":[{"file":"evaluator-verdict.json","line":0,"expected":"valid JSON verdict","got":"missing or unparseable output"}],"algedonic":false,"reentry_requested":false,"contradiction":null}
EOF
```

## Step 7: Verdict Routing (Father Model -- read ONLY evaluator-verdict.json)

Read the verdict:

```bash
cat .detent/code/evaluator-verdict.json
```

Parse JSON. Check fields in this exact order (algedonic before reentry per D-15):

### Step 7a: Algedonic Check

If verdict JSON contains `"algedonic": true`:
- Immediately halt. Do NOT check other fields.
- Use AskUserQuestion:

  > ALGEDONIC SIGNAL: A frozen constraint has been violated.
  >
  > Contradiction: <verdict.contradiction>
  >
  > Issues: <verdict.issues formatted as file:line expected/got>
  >
  > This requires human intervention. The pipeline is halted.
  >
  > Options: "acknowledged" (pipeline stops, investigate manually)

- After user responds: leave `pipeline_stage` as "coding" (re-invocation will resume). STOP.

### Step 7b: Reentry Check

If verdict JSON contains `"reentry_requested": true`:
- Read `reentry_depth` from state:
  ```bash
  node ./detent-tools.cjs state-read --dir .
  ```

- **If `reentry_depth >= 2` (depth limit reached per D-12):**
  Use AskUserQuestion:

  > Reentry depth limit reached (depth: <reentry_depth>).
  >
  > Evaluator contradiction: <verdict.contradiction>
  >
  > The pipeline has already rolled back <reentry_depth> times. Further automatic rollback is blocked.
  >
  > Options:
  > - "override" -- reset reentry_depth to 0 and execute the rollback anyway
  > - "stop" -- halt the pipeline for manual investigation

  If "override":
  ```bash
  node ./detent-tools.cjs state-write --dir . --reentry_depth 0
  ```
  Then proceed with reentry below.

  If "stop": leave `pipeline_stage` as "coding". STOP.

- **Execute reentry:**
  Generate constraint ID: `CONSTRAINT-CODE-R$((reentry_depth + 1))`

  1. Propose the contradiction:
  ```bash
  node ./detent-tools.cjs truth-propose --dir . --id CONSTRAINT-CODE-R$N --file constraint-ledger --source-agent evaluator --rationale "<verdict.contradiction>" --retained-goal "<extracted from contradiction context>"
  ```

  2. Freeze immediately with bypass:
  ```bash
  node ./detent-tools.cjs truth-freeze --dir . --id CONSTRAINT-CODE-R$N --file constraint-ledger --source code-contradiction
  ```

  3. Increment reentry_depth:
  ```bash
  node ./detent-tools.cjs state-write --dir . --reentry_depth $((reentry_depth + 1))
  ```

  4. Reset pipeline to discovery for full re-planning:
  ```bash
  node ./detent-tools.cjs state-write --dir . --pipeline_stage discovery
  rm -rf .detent/plan && mkdir -p .detent/plan
  ```

  5. Print: `[detent:code] Reentry triggered. Contradiction frozen as CONSTRAINT-CODE-R$N. Pipeline rolled back to discovery. Run /detent:plan to restart planning with the new constraint.`

  6. STOP.

### Step 7c: PASS

If `verdict.verdict === "PASS"`:
- Advance state FIRST, then git commit (crash-safe ordering: if crash happens between state-write and git commit, re-invocation skips to next unit; the un-committed code is still in the working tree):
  ```bash
  node ./detent-tools.cjs state-write --dir . --current_unit $((current_unit + 1)) --iteration_count 0
  ```

- Read coder-manifest.json to get list of files created/modified:
  ```bash
  FILES=$(node -e "const m=JSON.parse(require('fs').readFileSync('.detent/code/coder-manifest.json','utf8')); console.log([...(m.files_created||[]),...(m.files_modified||[])].join(' '))")
  ```

- Git commit using specific files from manifest (no blanket staging):
  ```bash
  git add $FILES
  git commit -m "feat(detent): $UNIT_ID -- <unit description from handoff.md>"
  ```

  If git commit fails: warn `"[detent:code] WARNING: git commit failed. Files remain staged. Continuing to next unit."` but do NOT halt.

- Emit: `[detent:code] $UNIT_ID PASSED. Committed and advancing to next unit.`
- Break inner iteration loop. Continue outer unit loop.

### Step 7d: FAIL

If `verdict.verdict === "FAIL"` (and no algedonic, no reentry_requested):
- Emit: `[detent:code] $UNIT_ID FAILED (iteration $iteration_count/5). Issues:`
- Print each issue: `  [<file>:<line>] expected: <expected>, got: <got>`
- Continue inner iteration loop (retry with feedback in Step 6c).

## Step 8: Iteration Exhaustion

If inner loop completes 5 iterations without PASS:
- Read the last evaluator-verdict.json for final feedback.
- Use AskUserQuestion:

  > Unit $UNIT_ID failed after 5 iterations.
  >
  > Last evaluator feedback:
  > <formatted issues from last verdict>
  >
  > Options:
  > - "retry" -- reset iteration_count to 0 and retry this unit
  > - "skip" -- mark this unit as skipped and advance to next unit
  > - "stop" -- halt the pipeline for manual intervention

  Handle:
  - "retry": `node ./detent-tools.cjs state-write --dir . --iteration_count 0`, restart inner loop for same unit.
  - "skip": `node ./detent-tools.cjs state-write --dir . --current_unit $((current_unit + 1)) --iteration_count 0`, continue outer loop.
  - "stop": leave `pipeline_stage` as "coding". STOP.

## Step 9: All Units Complete

After outer loop completes (all units PASS or skipped):
- Reset reentry_depth:
  ```bash
  node ./detent-tools.cjs state-write --dir . --pipeline_stage coding --reentry_depth 0
  ```

- Print completion summary:
  ```
  [detent:code] Coding complete. All $total_units units processed.
  
  Artifacts: .detent/code/
  Next: /detent:verify
  ```

## Step 10: Error Handling

At any point where an agent spawn fails (non-zero exit) OR output validation fails:

1. Report which agent failed and whether it was a spawn error or a validation error
2. List artifacts: `ls -la .detent/code/ 2>/dev/null || echo "(no artifacts)"`
3. Leave `pipeline_stage` as "coding" (so re-invocation resumes from current state)
4. STOP -- do not attempt to spawn subsequent agents
