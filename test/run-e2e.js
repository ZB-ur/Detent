'use strict';
/**
 * End-to-end test for the /detent:plan pipeline.
 *
 * Spawns real Claude Code sessions via detent-tools.cjs spawn.
 * Validates artifacts, truth surface mutations, and pipeline flow.
 *
 * Usage:
 *   node test/run-e2e.js              # full pipeline test
 *   node test/run-e2e.js --skip-spawn # validate existing artifacts only (no agent spawns)
 *
 * Expected duration: ~15-20 minutes (real agent spawns)
 * Token cost: ~5 agent sessions (d-critique, g-red, g-blue, h-review, j-compile)
 */

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'detent-tools.cjs');
const PROJECT_ROOT = path.join(__dirname, '..');
const SKIP_SPAWN = process.argv.includes('--skip-spawn');
const SPAWN_TIMEOUT = 5 * 60 * 1000; // 5 minutes per agent

let passed = 0;
let failed = 0;
let skipped = 0;
const errors = [];

// --- Test helpers ---

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`        ${err.message}`);
    failed++;
    errors.push({ name, message: err.message });
  }
}

function skip(name, reason) {
  console.log(`  SKIP: ${name} (${reason})`);
  skipped++;
}

function run(args, opts = {}) {
  const cmd = `node "${CLI}" ${args}`;
  const timeout = opts.timeout || 30000;
  return execSync(cmd, {
    cwd: opts.cwd || PROJECT_ROOT,
    encoding: 'utf8',
    timeout,
    stdio: ['inherit', 'pipe', 'pipe'],
  }).trim();
}

function runAllowError(args, opts = {}) {
  try {
    const stdout = run(args, opts);
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return {
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || '').toString().trim(),
      code: err.status || 1,
    };
  }
}

function spawn(agentName, prompt) {
  console.log(`\n  [e2e] Spawning ${agentName}...`);
  const start = Date.now();
  const result = runAllowError(
    `spawn --dir "${PROJECT_ROOT}" --agent ${agentName} --prompt "${prompt.replace(/"/g, '\\"')}"`,
    { timeout: SPAWN_TIMEOUT }
  );
  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  console.log(`  [e2e] ${agentName} finished in ${elapsed}s (exit ${result.code})`);
  return result;
}

// --- Test requirement content ---

const TEST_REQUIREMENT = `# Domain Model

## Context
Build a simple key-value store CLI tool.

## Requirements
- Put: store a key-value pair
- Get: retrieve a value by key, return error if not found
- Delete: remove a key-value pair
- List: show all stored keys
- Storage backend is a single JSON file

## Constraints
- Node.js, no external dependencies
- File must be locked during writes to prevent corruption
`;

// ============================================================
// Phase 0: Setup
// ============================================================

console.log('\n=== E2E Pipeline Test ===\n');
console.log(`Mode: ${SKIP_SPAWN ? 'artifact validation only (--skip-spawn)' : 'full pipeline (real agent spawns)'}`);
console.log(`Project root: ${PROJECT_ROOT}\n`);

// Backup existing .detent state if present
const detentDir = path.join(PROJECT_ROOT, '.detent');
const backupDir = path.join(os.tmpdir(), `detent-e2e-backup-${Date.now()}`);
let hasBackup = false;

if (fs.existsSync(path.join(detentDir, 'state.json'))) {
  console.log('  [e2e] Backing up existing .detent/ state...');
  fs.cpSync(detentDir, backupDir, { recursive: true });
  hasBackup = true;
}

// Initialize fresh state
test('setup initializes .detent/', () => {
  // Remove truth-surface and plan to get clean state, keep playbooks
  const tsDir = path.join(detentDir, 'truth-surface');
  const planDir = path.join(detentDir, 'plan');
  if (fs.existsSync(tsDir)) fs.rmSync(tsDir, { recursive: true, force: true });
  if (fs.existsSync(planDir)) fs.rmSync(planDir, { recursive: true, force: true });

  run(`setup --dir "${PROJECT_ROOT}"`);
  assert.ok(fs.existsSync(path.join(detentDir, 'state.json')), 'state.json missing');
  assert.ok(fs.existsSync(path.join(detentDir, 'truth-surface', 'constraint-ledger.md')), 'constraint-ledger.md missing');
});

test('set pipeline_stage to discovery', () => {
  run(`state-write --dir "${PROJECT_ROOT}" --pipeline_stage discovery --reentry_depth 0`);
  const state = JSON.parse(run(`state-read --dir "${PROJECT_ROOT}"`));
  assert.strictEqual(state.pipeline_stage, 'discovery');
});

test('write test requirement', () => {
  const discoveryDir = path.join(detentDir, 'discovery');
  fs.mkdirSync(discoveryDir, { recursive: true });
  fs.writeFileSync(path.join(discoveryDir, 'domain-model.md'), TEST_REQUIREMENT, 'utf8');
  assert.ok(fs.existsSync(path.join(discoveryDir, 'domain-model.md')));
});

test('prepare clean plan directory', () => {
  const planDir = path.join(detentDir, 'plan');
  fs.rmSync(planDir, { recursive: true, force: true });
  fs.mkdirSync(planDir, { recursive: true });
  assert.ok(fs.existsSync(planDir));
});

// ============================================================
// Phase 1: Agent Spawns (or skip)
// ============================================================

console.log('\n--- Stage 1/5: D-Critique ---');

if (!SKIP_SPAWN) {
  const dResult = spawn('d-critique',
    'Read @.detent/truth-surface/constraint-ledger.md and @.detent/discovery/domain-model.md and produce your critique.');

  test('d-critique spawn exits cleanly', () => {
    assert.strictEqual(dResult.code, 0, `d-critique exited with code ${dResult.code}`);
  });
} else {
  skip('d-critique spawn', '--skip-spawn');
}

test('d-critique-output.md exists and has headings', () => {
  const f = path.join(detentDir, 'plan', 'd-critique-output.md');
  assert.ok(fs.existsSync(f), 'd-critique-output.md missing');
  const content = fs.readFileSync(f, 'utf8');
  assert.ok(content.length > 100, `d-critique output too short (${content.length} chars)`);
  assert.ok(/^##/m.test(content), 'd-critique output has no ## headings');
});

console.log('\n--- Stage 2/5: G-Red ---');

if (!SKIP_SPAWN) {
  const gRedResult = spawn('g-red',
    'Read @.detent/plan/d-critique-output.md @.detent/truth-surface/constraint-ledger.md and produce your attack.');

  test('g-red spawn exits cleanly', () => {
    assert.strictEqual(gRedResult.code, 0, `g-red exited with code ${gRedResult.code}`);
  });
} else {
  skip('g-red spawn', '--skip-spawn');
}

test('g-red-output.md exists and has headings', () => {
  const f = path.join(detentDir, 'plan', 'g-red-output.md');
  assert.ok(fs.existsSync(f), 'g-red-output.md missing');
  const content = fs.readFileSync(f, 'utf8');
  assert.ok(content.length > 100, `g-red output too short (${content.length} chars)`);
  assert.ok(/^##/m.test(content), 'g-red output has no ## headings');
});

console.log('\n--- Stage 3/5: G-Blue ---');

if (!SKIP_SPAWN) {
  const gBlueResult = spawn('g-blue',
    'Read @.detent/plan/g-red-output.md @.detent/plan/d-critique-output.md @.detent/truth-surface/constraint-ledger.md and produce your defense.');

  test('g-blue spawn exits cleanly', () => {
    assert.strictEqual(gBlueResult.code, 0, `g-blue exited with code ${gBlueResult.code}`);
  });
} else {
  skip('g-blue spawn', '--skip-spawn');
}

test('g-blue-output.md exists and has headings', () => {
  const f = path.join(detentDir, 'plan', 'g-blue-output.md');
  assert.ok(fs.existsSync(f), 'g-blue-output.md missing');
  const content = fs.readFileSync(f, 'utf8');
  assert.ok(content.length > 100, `g-blue output too short (${content.length} chars)`);
  assert.ok(/^##/m.test(content), 'g-blue output has no ## headings');
});

// ============================================================
// Phase 2: Truth Surface Validation (post G-Red/G-Blue)
// ============================================================

console.log('\n--- Truth Surface Validation ---');

test('constraint-ledger has PROPOSED entries', () => {
  const content = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
  assert.ok(content.includes('status: PROPOSED'), 'No PROPOSED entries found in constraint-ledger');
});

test('at least one entry has challenged_by set (truth-update was called)', () => {
  const content = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
  // Match challenged_by with a non-null value
  const challengedPattern = /challenged_by: (?!null)([\w-]+)/;
  assert.ok(challengedPattern.test(content),
    'No entry has challenged_by set — G-Red/G-Blue did not call truth-update');
});

test('mature entries exist (PROPOSED + challenged_by != null)', () => {
  const content = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
  // Find entries that are PROPOSED and have a non-null challenged_by
  const entries = content.split(/^## /m).slice(1); // split by entry headers
  let matureCount = 0;
  for (const entry of entries) {
    if (entry.includes('status: PROPOSED') && /challenged_by: (?!null)\w/.test(entry)) {
      matureCount++;
    }
  }
  assert.ok(matureCount > 0, `No mature PROPOSED entries found (need challenged_by != null for freeze gate). Found ${entries.length} total entries.`);
  console.log(`        (${matureCount} mature entries ready for freeze)`);
});

// ============================================================
// Phase 3: Freeze Gate (auto-freeze mature entries)
// ============================================================

console.log('\n--- Freeze Gate (auto-freeze) ---');

test('auto-freeze mature PROPOSED entries', () => {
  const content = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
  const entries = content.split(/^## /m).slice(1);

  let frozenCount = 0;
  for (const entry of entries) {
    if (entry.includes('status: PROPOSED') && /challenged_by: (?!null)\w/.test(entry)) {
      const idMatch = entry.match(/^(\S+)/);
      if (idMatch) {
        const result = runAllowError(`truth-freeze --dir "${PROJECT_ROOT}" --id ${idMatch[1]} --file constraint-ledger`);
        if (result.code === 0) frozenCount++;
      }
    }
  }
  assert.ok(frozenCount > 0, 'Failed to freeze any mature entries');
  console.log(`        (${frozenCount} entries frozen)`);
});

test('FROZEN entries exist in constraint-ledger after freeze', () => {
  const content = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
  assert.ok(content.includes('status: FROZEN'), 'No FROZEN entries after freeze gate');
});

// ============================================================
// Phase 4: H-Review
// ============================================================

console.log('\n--- Stage 4/5: H-Review ---');

if (!SKIP_SPAWN) {
  const hResult = spawn('h-review',
    'Read @.detent/plan/d-critique-output.md @.detent/plan/g-red-output.md @.detent/plan/g-blue-output.md @.detent/truth-surface/constraint-ledger.md and produce your verdict.');

  test('h-review spawn exits cleanly', () => {
    assert.strictEqual(hResult.code, 0, `h-review exited with code ${hResult.code}`);
  });
} else {
  skip('h-review spawn', '--skip-spawn');
}

test('h-review-verdict.json exists and is valid JSON', () => {
  const f = path.join(detentDir, 'plan', 'h-review-verdict.json');
  assert.ok(fs.existsSync(f), 'h-review-verdict.json missing');
  const content = fs.readFileSync(f, 'utf8');
  const verdict = JSON.parse(content);
  assert.ok(verdict.verdict, 'verdict field missing');
  assert.ok(['approved', 'rejected'].includes(verdict.verdict), `Invalid verdict: ${verdict.verdict}`);
  assert.ok('reentry_stage' in verdict, 'reentry_stage field missing');
  assert.ok('reason' in verdict, 'reason field missing');
  console.log(`        verdict: ${verdict.verdict}${verdict.reentry_stage ? ` (reentry: ${verdict.reentry_stage})` : ''}`);
});

// ============================================================
// Phase 5: J-Compile (only if approved)
// ============================================================

console.log('\n--- Stage 5/5: J-Compile ---');

const verdictFile = path.join(detentDir, 'plan', 'h-review-verdict.json');
let verdictApproved = false;

if (fs.existsSync(verdictFile)) {
  try {
    const verdict = JSON.parse(fs.readFileSync(verdictFile, 'utf8'));
    verdictApproved = verdict.verdict === 'approved';
  } catch (_) {}
}

if (!verdictApproved) {
  skip('j-compile spawn', 'H-Review did not approve');
  skip('handoff.md validation', 'H-Review did not approve');
} else if (SKIP_SPAWN) {
  skip('j-compile spawn', '--skip-spawn');

  test('handoff.md exists and has Implementation Units', () => {
    const f = path.join(detentDir, 'plan', 'handoff.md');
    assert.ok(fs.existsSync(f), 'handoff.md missing');
    const content = fs.readFileSync(f, 'utf8');
    assert.ok(/Implementation Unit/i.test(content), 'handoff.md has no Implementation Unit section');
  });
} else {
  const jResult = spawn('j-compile',
    'Read @.detent/plan/d-critique-output.md @.detent/plan/g-red-output.md @.detent/plan/g-blue-output.md @.detent/plan/h-review-verdict.json @.detent/truth-surface/constraint-ledger.md and produce the code handoff.');

  test('j-compile spawn exits cleanly', () => {
    assert.strictEqual(jResult.code, 0, `j-compile exited with code ${jResult.code}`);
  });

  test('handoff.md exists and has Implementation Units', () => {
    const f = path.join(detentDir, 'plan', 'handoff.md');
    assert.ok(fs.existsSync(f), 'handoff.md missing');
    const content = fs.readFileSync(f, 'utf8');
    assert.ok(content.length > 200, `handoff.md too short (${content.length} chars)`);
    assert.ok(/Implementation Unit/i.test(content), 'handoff.md has no Implementation Unit section');
  });
}

// ============================================================
// Cleanup: Restore backed-up state
// ============================================================

console.log('\n--- Cleanup ---');

if (hasBackup) {
  console.log('  [e2e] Restoring .detent/ state from backup...');
  // Restore truth-surface and state from backup
  const backupTs = path.join(backupDir, 'truth-surface');
  const backupState = path.join(backupDir, 'state.json');
  const backupConfig = path.join(backupDir, 'config.json');

  if (fs.existsSync(backupTs)) {
    fs.rmSync(path.join(detentDir, 'truth-surface'), { recursive: true, force: true });
    fs.cpSync(backupTs, path.join(detentDir, 'truth-surface'), { recursive: true });
  }
  if (fs.existsSync(backupState)) {
    fs.copyFileSync(backupState, path.join(detentDir, 'state.json'));
  }
  if (fs.existsSync(backupConfig)) {
    fs.copyFileSync(backupConfig, path.join(detentDir, 'config.json'));
  }
  // Clean plan directory (test artifacts)
  fs.rmSync(path.join(detentDir, 'plan'), { recursive: true, force: true });
  fs.rmSync(path.join(detentDir, 'discovery'), { recursive: true, force: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
  console.log('  [e2e] State restored.');
} else {
  // Clean up test artifacts but keep .detent/ structure
  fs.rmSync(path.join(detentDir, 'plan'), { recursive: true, force: true });
  fs.rmSync(path.join(detentDir, 'discovery'), { recursive: true, force: true });
}

// ============================================================
// Report
// ============================================================

console.log(`\n=== E2E Results ===`);
console.log(`${passed + failed + skipped} checks: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);

if (errors.length > 0) {
  console.log('Failures:');
  for (const e of errors) {
    console.log(`  - ${e.name}: ${e.message}`);
  }
  console.log('');
}

if (failed > 0) {
  process.exit(1);
}
