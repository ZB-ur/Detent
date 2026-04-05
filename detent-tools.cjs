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
    '  spawn          Spawn a Claude Code subprocess with stream-json output',
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
  let args;
  if (target === 'claude') {
    args = ['-p', '--output-format', 'stream-json', '--dangerously-skip-permissions', prompt];
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
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exit(1);
  }
}

main();
