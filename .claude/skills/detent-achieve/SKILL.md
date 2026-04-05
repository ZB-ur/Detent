---
name: detent-achieve
description: Run the Achieve stage of the Detent pipeline
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

@.claude/skills/_shared/rules.md

# /detent:achieve -- Achieve Stage

Run the Achieve stage: finalize the pipeline run and produce the achievement summary. This is a placeholder implementation -- real merge and deploy actions are added in Phase 4+.

## Step 1: Read and Validate State

Read current pipeline state:

```bash
node ./detent-tools.cjs state-read --dir .
```

Parse the JSON output. Verify `pipeline_stage` is `"verification"`.

If `pipeline_stage` is not `"verification"`:
  Stop with message: "Pipeline stage is <actual>, but /detent:achieve expects verification. Run /detent:verify first, then retry /detent:achieve."

## Step 2: Gate Check (Deploy Gate)

Read the current configuration:

```bash
node ./detent-tools.cjs config-read --dir .
```

Parse the JSON output and evaluate the deploy gate:

1. If `config.gates` is missing, warn: "config.gates not found -- treating deploy gate as enabled (safe default). Update config.json to configure gates." Treat gate as enabled.
2. Check `config.gates.deploy.enabled` -- if the field is missing, treat as enabled.
3. Check `config.mode`.

If `config.mode === "supervised"` AND gate is enabled:
  Use AskUserQuestion:

  > Deploy gate: Verification passed. Review `.detent/verify/report.md` before finalizing.
  >
  > Proceed? (proceed / revise / stop)

  Handle response:
  - "proceed" -- continue to next step
  - "revise" -- stop skill, leave `pipeline_stage` unchanged (re-run /detent:verify if needed, then retry /detent:achieve)
  - "stop" -- stop skill, leave `pipeline_stage` unchanged

If `config.mode === "autonomous"` OR gate is disabled: proceed without prompting.

## Step 3: Create Stage Artifacts

Create the achieve output directory and placeholder summary:

```bash
mkdir -p .detent/achieve
cat > .detent/achieve/summary.md << 'ARTIFACT'
# Achievement Summary

> Placeholder -- real summary generated in Phase 4+

Status: complete
ARTIFACT
```

Verify the artifact was created:

```bash
test -f .detent/achieve/summary.md && echo "Created" || echo "FAILED"
```

If the output is "FAILED", stop with message: "Failed to create .detent/achieve/summary.md"

## Step 4: Update State and Exit

```bash
node ./detent-tools.cjs state-write --dir . --pipeline_stage achieve
```

Print:

```
Pipeline complete. Artifacts: .detent/achieve/summary.md
```
