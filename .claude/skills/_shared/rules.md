# Shared Pipeline Rules

## CRITICAL RULES (all pipeline skills)

- NEVER use the Write tool on any file inside `.detent/` -- all writes go through `node ./detent-tools.cjs`
- If `detent-tools.cjs` exits non-zero, report the error and stop -- do not attempt manual recovery
- READ state.json at the start of EVERY skill invocation to get current pipeline position
- VALIDATE that pipeline_stage matches the expected entry state before doing any work
- WRITE pipeline_stage update at the END of successful completion -- not before
- Use `node ./detent-tools.cjs` (relative path) -- never hardcode absolute paths

## Gate Check Pattern

At any gate point in a pipeline skill:

1. Read config: `node ./detent-tools.cjs config-read --dir .`
2. Check `config.mode` and `config.gates.<gate_name>.enabled`
3. If `mode === "supervised"` AND gate is enabled:
   - Use AskUserQuestion to show output summary and ask: proceed / revise / stop
   - "proceed" -> continue to next step
   - "revise" -> stop skill, leave pipeline_stage unchanged (user re-runs current skill)
   - "stop" -> stop skill, leave pipeline_stage unchanged
4. If `mode === "autonomous"` OR gate is disabled -> proceed without prompting
5. If `gates` field is missing from config -> treat as gate enabled (safe default), warn user to update config

## Skill Exit Pattern

On successful completion of a pipeline skill:

1. Update state: `node ./detent-tools.cjs state-write --dir . --pipeline_stage <this_stage>`
2. Print completion summary with artifacts created
3. Print next-step hint: `Next: /detent:<next-skill>`
