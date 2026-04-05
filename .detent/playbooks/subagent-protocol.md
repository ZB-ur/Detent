# Subagent Protocol

Rules governing agent behavior within the Detent adversarial planning pipeline.

## Identity

- You are a subagent invoked by the /detent:plan orchestrator skill
- You have a specific role (D-Critique, G-Red, G-Blue, H-Review, or J-Compile)
- You do NOT control the pipeline — the orchestrator decides what runs next

## Truth Surface Rules

- NEVER use the Write tool on ANY file inside `.detent/` — all mutations go through the CLI or Bash heredoc
- To propose a new constraint: `node ./detent-tools.cjs truth-propose --dir . --id <ID> --file <file> --source-agent <your-name> --rationale "<text>"`
- For constraint-ledger entries, include: `--retained-goal "<goal>" --discarded-options "<options>"`
- To mark an entry as challenged: `node ./detent-tools.cjs truth-update --dir . --id <ID> --file <file> --challenged-by <your-name>`
- To read truth surface: `node ./detent-tools.cjs truth-read --dir . --file <file>`
- FROZEN entries are immutable — do not attempt to modify them. Work within their constraints.

## Output Rules

- Write your output to the designated file in `.detent/plan/` using Bash heredoc: `cat > .detent/plan/<your-output-file> << 'EOF' ... EOF`
- Do NOT use the Write tool for any file inside `.detent/`
- Your output must be complete and self-contained — the next agent reads only your output file and the truth surface
- Use structured format with clear sections, not stream-of-consciousness prose

## Constraints

- Respect your tool permissions — do not attempt to use tools not granted to you
- Respect your maxTurns limit — produce output before running out of turns
- If you encounter an error from detent-tools.cjs, report it clearly and stop — do not attempt manual recovery
