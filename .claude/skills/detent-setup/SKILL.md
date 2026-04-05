---
name: detent-setup
description: Initialize Detent in the current repo — creates .detent/ directory structure and configuration
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

# /detent:setup — Detent Initialization Wizard

This skill walks through configuration questions and initializes `.detent/` in the current repo by calling `detent-tools.cjs`. It never writes files directly — all mutations go through the CLI tool.

## CRITICAL RULES

- NEVER use the Write tool on any file inside `.detent/` — all writes go through `node ./detent-tools.cjs`
- If `detent-tools.cjs` exits non-zero, report the error and stop — do not attempt manual recovery
- Validate user input for each question — if the answer does not match expected values, ask again

## Step 1: Check Prerequisites

Verify that `detent-tools.cjs` exists in the current directory:

```bash
ls ./detent-tools.cjs
```

If the file is missing, tell the user: "detent-tools.cjs not found. Please ensure you are running this skill from the repo that contains detent-tools.cjs, and that it has been installed. Run `npm install` if node_modules is missing." Then stop.

Verify that `write-file-atomic` is installed:

```bash
node -e "require('write-file-atomic')"
```

If this fails, tell the user: "write-file-atomic is not installed. Run `npm install` in the repo root, then invoke /detent:setup again." Then stop.

## Step 2: Check for Existing .detent/ Directory

Check whether `.detent/` already exists:

```bash
test -d ./.detent && echo "EXISTS" || echo "NOT_FOUND"
```

If it exists, use `AskUserQuestion` to ask:

> A `.detent/` directory already exists. Reinitialize? This will overwrite `config.json` and `state.json`. (yes/no)

If the user answers "no" (or any answer that is not "yes"), stop with the message: "Setup cancelled."

Only proceed if the user explicitly answers "yes".

## Step 3: Ask Configuration Questions

Ask each question as a separate `AskUserQuestion` call. Validate the answer against the allowed values. If the answer does not match, ask again.

### Question 1: Pipeline Mode

Ask:

> Select pipeline mode:
> - **supervised** (recommended) — pauses at gates for your confirmation
> - **autonomous** — runs without stopping
>
> Enter: supervised or autonomous

Allowed values: `supervised`, `autonomous`
Default if unclear: `supervised`

### Question 2: Model Budget

Ask:

> Select model budget:
> - **quality** — uses strongest models (slower, more expensive)
> - **balanced** (recommended) — mix of strong and fast models
> - **budget** — uses fastest models (cheapest)
>
> Enter: quality, balanced, or budget

Allowed values: `quality`, `balanced`, `budget`
Default if unclear: `balanced`

### Question 3: Output Locale

Ask:

> Select locale for output language:
> - **en** — English
> - **zh-CN** — Chinese (Simplified)
>
> Enter: en or zh-CN

Allowed values: `en`, `zh-CN`
Default if unclear: `en`

### Question 4: Unit Granularity

Ask:

> Select coding unit granularity:
> - **fine** — small units, more iterations
> - **standard** (recommended) — balanced unit size
> - **coarse** — large units, fewer iterations
>
> Enter: fine, standard, or coarse

Allowed values: `fine`, `standard`, `coarse`
Default if unclear: `standard`

## Step 4: Run Setup Command

Execute via Bash (replace `<mode>`, `<budget>`, `<locale>`, `<granularity>` with the user's answers):

```bash
node ./detent-tools.cjs setup --dir . --mode <mode> --budget <budget> --locale <locale> --granularity <granularity>
```

Capture the output. Verify the JSON output contains `"ok": true`. If the exit code is non-zero or `"ok"` is not `true`, report the full error output and stop — do not attempt to manually create any files.

## Step 5: Verify and Summarize

Read the configuration that was written:

```bash
node ./detent-tools.cjs config-read --dir .
```

Read the state that was initialized:

```bash
node ./detent-tools.cjs state-read --dir .
```

Print a summary to the user:

```
Setup complete. The following were created:

Directories:
  .detent/
  .detent/truth-surface/
  .detent/raw/
  .detent/logs/

Files:
  .detent/config.json
  .detent/state.json

Configuration:
  mode:             <mode>
  model_budget:     <budget>
  locale:           <locale>
  unit_granularity: <granularity>

Next step: Run `/detent:discovery` to begin your first pipeline.
```
