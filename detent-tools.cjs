'use strict';

const fs = require('fs');
const path = require('path');
const writeFileAtomicSync = require('write-file-atomic').sync;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse named args from argv array.
 * --key value pairs → { key: value }
 * Positional args (no leading --) collected as _args array.
 */
function parseArgs(argv) {
  const named = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        named[key] = next;
        i += 2;
      } else {
        named[key] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { named, positional };
}

/** Atomically write JSON data to filePath. */
function writeJson(filePath, data) {
  writeFileAtomicSync(filePath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' });
}

/** Read and parse a JSON file. Returns null if file does not exist. */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`Failed to read ${filePath}: ${e.message}`);
  }
}

/** Resolve the .detent/ directory path within a given targetDir. */
function detentDir(targetDir) {
  return path.join(targetDir, '.detent');
}

/** Resolve the state.json path. */
function statePath(targetDir) {
  return path.join(detentDir(targetDir), 'state.json');
}

/** Resolve the config.json path. */
function configPath(targetDir) {
  return path.join(detentDir(targetDir), 'config.json');
}

/** Ensure .detent/ is initialized; exit 1 with error if not. */
function requireInit(targetDir) {
  if (!fs.existsSync(detentDir(targetDir))) {
    process.stderr.write(`Error: .detent/ not initialized in ${targetDir}. Run 'setup' first.\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdUsage() {
  process.stdout.write([
    'Usage: node detent-tools.cjs <command> [--dir <path>] [options]',
    '',
    'Commands:',
    '  setup          Initialize .detent/ directory tree and default JSON files',
    '  state-read     Print current .detent/state.json as JSON to stdout',
    '  state-write    Update fields in .detent/state.json (--field value pairs)',
    '  config-read    Print current .detent/config.json as JSON to stdout',
    '  config-write   Update fields in .detent/config.json (--field value pairs)',
    '  spawn          Spawn a Claude Code subprocess with stream-json output (--agent <name> to load agent template)',
    '  truth-propose  Propose a new entry to a truth surface file',
    '  truth-freeze   Freeze a mature truth surface entry (makes it immutable)',
    '  truth-read     Output the contents of a truth surface file to stdout',
    '  truth-update   Update a field on a PROPOSED truth surface entry',
    '',
    'Setup options:',
    '  --dir <path>        Target directory (default: cwd)',
    '  --mode <val>        Pipeline mode: supervised|autonomous (default: supervised)',
    '  --budget <val>      Model budget: quality|balanced|budget (default: balanced)',
    '  --locale <val>      Locale/language (default: en)',
    '  --granularity <val> Unit granularity: fine|standard|coarse (default: standard)',
    '',
    'Spawn options:',
    '  --dir <path>        Working directory for subprocess (default: cwd)',
    '  --prompt <text>     Prompt to send to Claude Code (required)',
    '  --target <binary>   Override binary for testing (default: claude)',
    '',
    'truth-propose options:',
    '  --dir <path>             Target directory (default: cwd)',
    '  --id <id>                Entry ID (required, e.g. DECISION-001)',
    '  --file <name>            Truth surface file name without .md extension (required)',
    '  --source-agent <name>    Agent proposing this entry (default: unknown)',
    '  --rationale <text>       Rationale for the entry (default: "")',
    '  --status <status>        Initial status (default: PROPOSED)',
    '  --retained-goal <text>   For constraint-ledger: goal being retained (TRUTH-03)',
    '  --discarded-options <t>  For constraint-ledger: options considered and discarded (TRUTH-03)',
    '',
    'truth-freeze options:',
    '  --dir <path>    Target directory (default: cwd)',
    '  --id <id>       Entry ID to freeze (required)',
    '  --file <name>   Truth surface file name without .md extension (required)',
    '',
    'truth-read options:',
    '  --dir <path>    Target directory (default: cwd)',
    '  --file <name>   Truth surface file name without .md extension (required)',
    '',
    'truth-update options:',
    '  --dir <path>          Target directory (default: cwd)',
    '  --id <id>             Entry ID to update (required)',
    '  --file <name>         Truth surface file name without .md extension (required)',
    '  --challenged-by <n>   Set the challenged_by field on a PROPOSED entry',
    '',
  ].join('\n'));
  process.exit(0);
}

function cmdSetup(targetDir, named) {
  const dDir = detentDir(targetDir);

  // Create directory tree (idempotent)
  fs.mkdirSync(path.join(dDir), { recursive: true });
  fs.mkdirSync(path.join(dDir, 'truth-surface'), { recursive: true });
  fs.mkdirSync(path.join(dDir, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(dDir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(dDir, 'playbooks'), { recursive: true });

  // Initialize truth surface files with structural headers (idempotent — only write if missing)
  const truthFiles = [
    { name: 'frozen-decisions.md', header: '# Frozen Decisions\n\nDecisions frozen after adversarial challenge. FROZEN entries are immutable.\n' },
    { name: 'constraint-ledger.md', header: '# Constraint Ledger\n\nRetained goals, discarded options, and rationale for each constraint.\n' },
    { name: 'domain-model.md', header: '# Domain Model\n\nDomain concepts and constraints discovered during planning.\n' },
  ];
  for (const tf of truthFiles) {
    const tfPath = path.join(dDir, 'truth-surface', tf.name);
    if (!fs.existsSync(tfPath)) {
      writeFileAtomicSync(tfPath, tf.header, { encoding: 'utf8' });
    }
  }

  // Build default state.json
  const state = {
    schema_version: 1,
    pipeline_stage: 'idle',
    current_unit: null,
    iteration_count: 0,
    reentry_depth: 0,
    last_updated: new Date().toISOString(),
    session_id: null,
  };
  writeJson(statePath(targetDir), state);

  // Build config.json respecting optional flag overrides
  const locale = named.locale || 'en';
  const config = {
    schema_version: 1,
    mode: named.mode || 'supervised',
    model_budget: named.budget || 'balanced',
    locale: locale,
    pipeline_stages: {
      discovery: true,
      planning: true,
      coding: true,
      verification: true,
      achieve: true,
    },
    unit_granularity: named.granularity || 'standard',
    language: locale,
    gates: {
      plan: { enabled: true, description: 'Before coding - review discovery + plan' },
      code: { enabled: true, description: 'After code generation - review before commit' },
      deploy: { enabled: true, description: 'After verification - review before merge/deploy' },
    },
  };
  writeJson(configPath(targetDir), config);

  process.stdout.write(JSON.stringify({ ok: true, dir: path.resolve(targetDir) }) + '\n');
}

function cmdStateRead(targetDir) {
  requireInit(targetDir);
  const state = readJson(statePath(targetDir));
  if (!state) {
    process.stderr.write(`Error: state.json not found in ${detentDir(targetDir)}\n`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(state, null, 2) + '\n');
}

function cmdStateWrite(targetDir, named) {
  requireInit(targetDir);
  const sPath = statePath(targetDir);
  const state = readJson(sPath);
  if (!state) {
    process.stderr.write(`Error: state.json not found in ${detentDir(targetDir)}\n`);
    process.exit(1);
  }

  // Merge named args (excluding --dir) into state
  const intFields = new Set(['iteration_count', 'reentry_depth']);
  const nullFields = new Set(['current_unit', 'session_id']);
  for (const [key, value] of Object.entries(named)) {
    if (key === 'dir') continue;
    if (intFields.has(key)) {
      state[key] = parseInt(value, 10);
    } else if (nullFields.has(key) && value === 'null') {
      state[key] = null;
    } else {
      state[key] = value;
    }
  }

  state.last_updated = new Date().toISOString();
  writeJson(sPath, state);
}

function cmdConfigRead(targetDir) {
  requireInit(targetDir);
  const config = readJson(configPath(targetDir));
  if (!config) {
    process.stderr.write(`Error: config.json not found in ${detentDir(targetDir)}\n`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(config, null, 2) + '\n');
}

function cmdConfigWrite(targetDir, named) {
  requireInit(targetDir);
  const cPath = configPath(targetDir);
  const config = readJson(cPath);
  if (!config) {
    process.stderr.write(`Error: config.json not found in ${detentDir(targetDir)}\n`);
    process.exit(1);
  }

  // Merge named args into config, handling dot-notation for nested fields
  for (const [key, value] of Object.entries(named)) {
    if (key === 'dir') continue;
    if (key.includes('.')) {
      // Dot-notation for nested fields: e.g. pipeline_stages.discovery
      const parts = key.split('.');
      let obj = config;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof obj[parts[i]] !== 'object' || obj[parts[i]] === null) {
          obj[parts[i]] = {};
        }
        obj = obj[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      // Convert boolean strings
      if (value === 'true') obj[lastKey] = true;
      else if (value === 'false') obj[lastKey] = false;
      else obj[lastKey] = value;
    } else {
      // Convert boolean strings at top level too
      if (value === 'true') config[key] = true;
      else if (value === 'false') config[key] = false;
      else config[key] = value;
    }
  }

  writeJson(cPath, config);
}

// ---------------------------------------------------------------------------
// Truth surface helpers
// ---------------------------------------------------------------------------

/** Resolve path to a truth surface .md file. */
function truthFilePath(targetDir, fileName) {
  return path.join(detentDir(targetDir), 'truth-surface', fileName + '.md');
}

// ---------------------------------------------------------------------------
// Truth surface commands
// ---------------------------------------------------------------------------

function cmdTruthPropose(targetDir, named) {
  const id = named.id;
  const file = named.file;

  if (!id) {
    process.stderr.write('Error: --id is required for truth-propose\n');
    process.exit(1);
  }
  if (!file) {
    process.stderr.write('Error: --file is required for truth-propose\n');
    process.exit(1);
  }

  requireInit(targetDir);

  const sourceAgent = named['source-agent'] || 'unknown';
  const rationale = named.rationale || '';
  const status = named.status || 'PROPOSED';
  const retainedGoal = named['retained-goal'] || '';
  const discardedOptions = named['discarded-options'] || '';

  const filePath = truthFilePath(targetDir, file);

  // Initialize file if it doesn't exist
  let content;
  if (!fs.existsSync(filePath)) {
    content = `# ${file}\n\n`;
  } else {
    content = fs.readFileSync(filePath, 'utf8');
  }

  // Check for duplicate entry ID
  if (content.includes(`## ${id}`)) {
    process.stderr.write(`Error: Entry ${id} already exists in ${file}.md\n`);
    process.exit(1);
  }

  // Append entry block
  const entry = [
    `\n## ${id}\n`,
    `\`\`\`yaml`,
    `id: ${id}`,
    `status: ${status}`,
    `source_agent: ${sourceAgent}`,
    `challenged_by: null`,
    `frozen_at: null`,
    `retained_goal: "${retainedGoal}"`,
    `discarded_options: "${discardedOptions}"`,
    `\`\`\``,
    '',
    rationale,
    '',
  ].join('\n');

  const newContent = content + entry;
  writeFileAtomicSync(filePath, newContent, { encoding: 'utf8' });

  process.stdout.write(JSON.stringify({ ok: true, id: id }) + '\n');
}

function cmdTruthFreeze(targetDir, named) {
  const id = named.id;
  const file = named.file;

  if (!id) {
    process.stderr.write('Error: --id is required for truth-freeze\n');
    process.exit(1);
  }
  if (!file) {
    process.stderr.write('Error: --file is required for truth-freeze\n');
    process.exit(1);
  }

  requireInit(targetDir);

  const filePath = truthFilePath(targetDir, file);

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

  // Parse the entry's YAML block (find section from ## id to next ## or end of file)
  const entryStartIdx = content.indexOf(`## ${id}`);
  const afterEntry = content.indexOf('\n## ', entryStartIdx + 1);
  const entrySection = afterEntry === -1 ? content.slice(entryStartIdx) : content.slice(entryStartIdx, afterEntry);

  // Check if already FROZEN
  const statusMatch = entrySection.match(/status:\s*(\w+)/);
  if (statusMatch && statusMatch[1] === 'FROZEN') {
    process.stderr.write(`Error: Entry ${id} is already FROZEN (immutable).\n`);
    process.exit(1);
  }

  // Check maturity — challenged_by must not be null
  const challengedByMatch = entrySection.match(/challenged_by:\s*(\S+)/);
  if (!challengedByMatch || challengedByMatch[1] === 'null') {
    process.stderr.write(`Error: Entry ${id} is not mature (missing challenged_by). Cannot freeze.\n`);
    process.exit(1);
  }

  // Replace status and frozen_at within this entry's section
  const frozenAt = new Date().toISOString();
  let updatedContent = content;

  // Replace the entry section with updated fields
  const updatedSection = entrySection
    .replace(/status:\s*PROPOSED/, 'status: FROZEN')
    .replace(/frozen_at:\s*null/, `frozen_at: ${frozenAt}`);

  if (afterEntry === -1) {
    updatedContent = content.slice(0, entryStartIdx) + updatedSection;
  } else {
    updatedContent = content.slice(0, entryStartIdx) + updatedSection + content.slice(afterEntry);
  }

  writeFileAtomicSync(filePath, updatedContent, { encoding: 'utf8' });

  process.stdout.write(JSON.stringify({ ok: true, id: id, status: 'FROZEN' }) + '\n');
}

function cmdTruthRead(targetDir, named) {
  const file = named.file;

  if (!file) {
    process.stderr.write('Error: --file is required for truth-read\n');
    process.exit(1);
  }

  requireInit(targetDir);

  const filePath = truthFilePath(targetDir, file);

  if (!fs.existsSync(filePath)) {
    process.stderr.write(`Error: File ${file}.md not found\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  process.stdout.write(content);
}

function cmdTruthUpdate(targetDir, named) {
  const id = named.id;
  const file = named.file;

  if (!id) {
    process.stderr.write('Error: --id is required for truth-update\n');
    process.exit(1);
  }
  if (!file) {
    process.stderr.write('Error: --file is required for truth-update\n');
    process.exit(1);
  }

  requireInit(targetDir);

  const filePath = truthFilePath(targetDir, file);

  if (!fs.existsSync(filePath)) {
    process.stderr.write(`Error: File ${file}.md not found\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes(`## ${id}`)) {
    process.stderr.write(`Error: Entry ${id} not found.\n`);
    process.exit(1);
  }

  // Find the entry section
  const entryStartIdx = content.indexOf(`## ${id}`);
  const afterEntry = content.indexOf('\n## ', entryStartIdx + 1);
  const entrySection = afterEntry === -1 ? content.slice(entryStartIdx) : content.slice(entryStartIdx, afterEntry);

  // Check not FROZEN
  const statusMatch = entrySection.match(/status:\s*(\w+)/);
  if (statusMatch && statusMatch[1] === 'FROZEN') {
    process.stderr.write(`Error: Entry ${id} is FROZEN (immutable). Cannot update.\n`);
    process.exit(1);
  }

  let updatedSection = entrySection;

  // Update challenged_by if provided
  if (named['challenged-by']) {
    updatedSection = updatedSection.replace(/challenged_by:\s*null/, `challenged_by: ${named['challenged-by']}`);
  }

  let updatedContent;
  if (afterEntry === -1) {
    updatedContent = content.slice(0, entryStartIdx) + updatedSection;
  } else {
    updatedContent = content.slice(0, entryStartIdx) + updatedSection + content.slice(afterEntry);
  }

  writeFileAtomicSync(filePath, updatedContent, { encoding: 'utf8' });

  process.stdout.write(JSON.stringify({ ok: true, id: id }) + '\n');
}

function cmdSpawn(named) {
  const { spawn } = require('child_process');
  const prompt = named.prompt;
  if (!prompt) {
    process.stderr.write('Error: --prompt required for spawn command\n');
    process.exit(1);
  }
  const targetDir = named.dir ? path.resolve(named.dir) : process.cwd();
  const target = named.target || 'claude';
  const spawnOptions = {
    cwd: targetDir,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env },
  };
  // Extensible isolation: additional layers (plugin dir, project-only settings) added here in Phase 3+
  const agent = named.agent || null;
  let args;
  if (target === 'claude') {
    args = ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
    if (agent) {
      args.push('--agent', agent);
    }
    args.push(prompt);
  } else {
    args = [prompt];
  }
  const child = spawn(target, args, spawnOptions);
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
          process.stdout.write(JSON.stringify(event) + '\n');
        } catch (_) {
          // Non-JSON line (startup messages) -- ignore
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

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const { named, positional } = parseArgs(argv);
  const command = positional[0];

  if (!command) {
    return cmdUsage();
  }

  const targetDir = named.dir
    ? path.resolve(named.dir)
    : process.cwd();

  switch (command) {
    case 'setup':
      return cmdSetup(targetDir, named);
    case 'state-read':
      return cmdStateRead(targetDir);
    case 'state-write':
      return cmdStateWrite(targetDir, named);
    case 'config-read':
      return cmdConfigRead(targetDir);
    case 'config-write':
      return cmdConfigWrite(targetDir, named);
    case 'spawn':
      return cmdSpawn(named);
    case 'truth-propose':
      return cmdTruthPropose(targetDir, named);
    case 'truth-freeze':
      return cmdTruthFreeze(targetDir, named);
    case 'truth-read':
      return cmdTruthRead(targetDir, named);
    case 'truth-update':
      return cmdTruthUpdate(targetDir, named);
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exit(1);
  }
}

main();
