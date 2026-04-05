'use strict';
/**
 * End-to-end test for the Detent pipeline.
 *
 * Stages are independent — each can run alone or use fixtures from prior stages.
 * Real agent spawns only happen when needed; fixtures provide fast, token-free validation.
 *
 * Usage:
 *   node test/run-e2e.js --stage plan            # test plan pipeline (spawn 5 agents, ~15-20 min)
 *   node test/run-e2e.js --stage plan --save      # same + save artifacts as fixtures
 *   node test/run-e2e.js --stage plan --fixtures   # validate using saved fixtures (no spawns, <1s)
 *   node test/run-e2e.js --stage code --fixtures   # test code stage using plan fixtures
 *   node test/run-e2e.js --save                   # full pipeline + save all fixtures
 *   node test/run-e2e.js                          # full pipeline (spawn agents)
 *
 * Fixtures live in test/fixtures/{stage}/ — committed to git as golden artifacts.
 * Re-generate with --save after changing agent templates, skills, or CLI.
 */

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Config ---

const CLI = path.join(__dirname, '..', 'detent-tools.cjs');
const PROJECT_ROOT = path.join(__dirname, '..');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const SPAWN_TIMEOUT = 5 * 60 * 1000; // 5 minutes per agent

// --- Parse args ---

const args = process.argv.slice(2);
const STAGE = (() => {
  const idx = args.indexOf('--stage');
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : 'all';
})();
const USE_FIXTURES = args.includes('--fixtures');
const SAVE_FIXTURES = args.includes('--save');
const VALID_STAGES = ['plan', 'code', 'all'];

if (!VALID_STAGES.includes(STAGE)) {
  console.error(`Invalid stage: ${STAGE}. Valid: ${VALID_STAGES.join(', ')}`);
  process.exit(1);
}

// --- State ---

let passed = 0;
let failed = 0;
let skipped = 0;
const errors = [];

// --- Helpers ---

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
  return execSync(cmd, {
    cwd: opts.cwd || PROJECT_ROOT,
    encoding: 'utf8',
    timeout: opts.timeout || 30000,
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

function spawnAgent(agentName, prompt) {
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

// --- Fixture management ---

function fixtureDir(stage) {
  return path.join(FIXTURES_DIR, stage);
}

function loadFixtures(stage, targetDir) {
  const src = fixtureDir(stage);
  if (!fs.existsSync(src)) {
    console.error(`  [e2e] ERROR: No fixtures found at ${src}`);
    console.error(`         Run with --save first to generate fixtures.`);
    process.exit(1);
  }
  console.log(`  [e2e] Loading ${stage} fixtures from ${src}`);
  fs.cpSync(src, targetDir, { recursive: true });
}

function saveFixtures(stage, sourceDir) {
  const dest = fixtureDir(stage);
  fs.mkdirSync(dest, { recursive: true });
  // Clear old fixtures
  for (const f of fs.readdirSync(dest)) {
    fs.rmSync(path.join(dest, f), { force: true });
  }
  // Copy current artifacts
  for (const f of fs.readdirSync(sourceDir)) {
    const src = path.join(sourceDir, f);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(dest, f));
    }
  }
  console.log(`  [e2e] Saved ${stage} fixtures to ${dest}`);
}

function hasFixtures(stage) {
  const dir = fixtureDir(stage);
  return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
}

// --- Test requirement ---

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
// Setup
// ============================================================

console.log('\n=== Detent E2E Pipeline Test ===\n');
console.log(`Stage: ${STAGE} | Fixtures: ${USE_FIXTURES ? 'yes' : 'no'} | Save: ${SAVE_FIXTURES ? 'yes' : 'no'}\n`);

const detentDir = path.join(PROJECT_ROOT, '.detent');
const planDir = path.join(detentDir, 'plan');
const tsDir = path.join(detentDir, 'truth-surface');

// Backup existing state
const backupDir = path.join(os.tmpdir(), `detent-e2e-backup-${Date.now()}`);
let hasBackup = false;

if (fs.existsSync(path.join(detentDir, 'state.json'))) {
  fs.cpSync(detentDir, backupDir, { recursive: true });
  hasBackup = true;
}

function restore() {
  if (hasBackup) {
    // Restore from backup
    for (const item of ['truth-surface', 'state.json', 'config.json']) {
      const src = path.join(backupDir, item);
      const dest = path.join(detentDir, item);
      if (fs.existsSync(src)) {
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(src, dest, { recursive: true });
      }
    }
    fs.rmSync(path.join(detentDir, 'plan'), { recursive: true, force: true });
    fs.rmSync(path.join(detentDir, 'discovery'), { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  } else {
    fs.rmSync(path.join(detentDir, 'plan'), { recursive: true, force: true });
    fs.rmSync(path.join(detentDir, 'discovery'), { recursive: true, force: true });
  }
}

// Clean setup
function initFreshState() {
  if (fs.existsSync(tsDir)) fs.rmSync(tsDir, { recursive: true, force: true });
  if (fs.existsSync(planDir)) fs.rmSync(planDir, { recursive: true, force: true });

  run(`setup --dir "${PROJECT_ROOT}"`);
  run(`state-write --dir "${PROJECT_ROOT}" --pipeline_stage discovery --reentry_depth 0`);

  const discoveryDir = path.join(detentDir, 'discovery');
  fs.mkdirSync(discoveryDir, { recursive: true });
  fs.writeFileSync(path.join(discoveryDir, 'domain-model.md'), TEST_REQUIREMENT, 'utf8');
  fs.mkdirSync(planDir, { recursive: true });
}

// ============================================================
// Stage: plan
// ============================================================

function stagePlan() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' E2E ► PLAN STAGE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  initFreshState();

  if (USE_FIXTURES) {
    // Load plan fixtures — skip agent spawns entirely
    loadFixtures('plan', planDir);
    loadFixtures('truth-surface', tsDir);
  } else {
    // --- D-Critique ---
    console.log('--- Stage 1/5: D-Critique ---');
    const dResult = spawnAgent('d-critique',
      'Read @.detent/truth-surface/constraint-ledger.md and @.detent/discovery/domain-model.md and produce your critique.');
    test('d-critique exits cleanly', () => {
      assert.strictEqual(dResult.code, 0, `exit ${dResult.code}`);
    });

    // --- G-Red ---
    console.log('\n--- Stage 2/5: G-Red ---');
    const grResult = spawnAgent('g-red',
      'Read @.detent/plan/d-critique-output.md @.detent/truth-surface/constraint-ledger.md and produce your attack.');
    test('g-red exits cleanly', () => {
      assert.strictEqual(grResult.code, 0, `exit ${grResult.code}`);
    });

    // --- G-Blue ---
    console.log('\n--- Stage 3/5: G-Blue ---');
    const gbResult = spawnAgent('g-blue',
      'Read @.detent/plan/g-red-output.md @.detent/plan/d-critique-output.md @.detent/truth-surface/constraint-ledger.md and produce your defense.');
    test('g-blue exits cleanly', () => {
      assert.strictEqual(gbResult.code, 0, `exit ${gbResult.code}`);
    });

    // --- Freeze gate (auto-freeze) ---
    console.log('\n--- Freeze Gate ---');
    const ledger = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
    const entries = ledger.split(/^## /m).slice(1);
    let frozenCount = 0;
    for (const entry of entries) {
      if (entry.includes('status: PROPOSED') && /challenged_by: (?!null)\w/.test(entry)) {
        const idMatch = entry.match(/^(\S+)/);
        if (idMatch) {
          const r = runAllowError(`truth-freeze --dir "${PROJECT_ROOT}" --id ${idMatch[1]} --file constraint-ledger`);
          if (r.code === 0) frozenCount++;
        }
      }
    }
    console.log(`  [e2e] Auto-froze ${frozenCount} mature entries`);

    // --- H-Review ---
    console.log('\n--- Stage 4/5: H-Review ---');
    const hResult = spawnAgent('h-review',
      'Read @.detent/plan/d-critique-output.md @.detent/plan/g-red-output.md @.detent/plan/g-blue-output.md @.detent/truth-surface/constraint-ledger.md and produce your verdict.');
    test('h-review exits cleanly', () => {
      assert.strictEqual(hResult.code, 0, `exit ${hResult.code}`);
    });

    // --- J-Compile (only if approved) ---
    console.log('\n--- Stage 5/5: J-Compile ---');
    const verdictFile = path.join(planDir, 'h-review-verdict.json');
    let approved = false;
    if (fs.existsSync(verdictFile)) {
      try {
        approved = JSON.parse(fs.readFileSync(verdictFile, 'utf8')).verdict === 'approved';
      } catch (_) {}
    }

    if (approved) {
      const jResult = spawnAgent('j-compile',
        'Read @.detent/plan/d-critique-output.md @.detent/plan/g-red-output.md @.detent/plan/g-blue-output.md @.detent/plan/h-review-verdict.json @.detent/truth-surface/constraint-ledger.md and produce the code handoff.');
      test('j-compile exits cleanly', () => {
        assert.strictEqual(jResult.code, 0, `exit ${jResult.code}`);
      });
    } else {
      skip('j-compile spawn', 'H-Review did not approve');
    }
  }

  // --- Artifact validation (runs regardless of spawn vs fixture) ---
  console.log('\n--- Artifact Validation ---');

  test('d-critique-output.md exists with headings', () => {
    const f = path.join(planDir, 'd-critique-output.md');
    assert.ok(fs.existsSync(f), 'missing');
    const c = fs.readFileSync(f, 'utf8');
    assert.ok(c.length > 100, `too short: ${c.length} chars`);
    assert.ok(/^##/m.test(c), 'no ## headings');
  });

  test('g-red-output.md exists with headings', () => {
    const f = path.join(planDir, 'g-red-output.md');
    assert.ok(fs.existsSync(f), 'missing');
    const c = fs.readFileSync(f, 'utf8');
    assert.ok(c.length > 100, `too short: ${c.length} chars`);
    assert.ok(/^##/m.test(c), 'no ## headings');
  });

  test('g-blue-output.md exists with headings', () => {
    const f = path.join(planDir, 'g-blue-output.md');
    assert.ok(fs.existsSync(f), 'missing');
    const c = fs.readFileSync(f, 'utf8');
    assert.ok(c.length > 100, `too short: ${c.length} chars`);
    assert.ok(/^##/m.test(c), 'no ## headings');
  });

  test('constraint-ledger has PROPOSED entries', () => {
    const c = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
    assert.ok(c.includes('status: PROPOSED'), 'no PROPOSED entries');
  });

  test('truth-update was called (challenged_by != null)', () => {
    const c = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
    assert.ok(/challenged_by: (?!null)[\w-]+/.test(c), 'no challenged_by set — truth-update not called');
  });

  test('mature entries exist for freeze gate', () => {
    const c = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
    const entries = c.split(/^## /m).slice(1);
    let mature = 0;
    for (const e of entries) {
      if (e.includes('status: PROPOSED') && /challenged_by: (?!null)\w/.test(e)) mature++;
      if (e.includes('status: FROZEN')) mature++; // already frozen counts
    }
    assert.ok(mature > 0, 'no mature or frozen entries');
    console.log(`        (${mature} mature/frozen entries)`);
  });

  test('FROZEN entries exist', () => {
    const c = run(`truth-read --dir "${PROJECT_ROOT}" --file constraint-ledger`);
    assert.ok(c.includes('status: FROZEN'), 'no FROZEN entries');
  });

  test('h-review-verdict.json is valid', () => {
    const f = path.join(planDir, 'h-review-verdict.json');
    assert.ok(fs.existsSync(f), 'missing');
    const v = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.ok(['approved', 'rejected'].includes(v.verdict), `bad verdict: ${v.verdict}`);
    assert.ok('reentry_stage' in v, 'missing reentry_stage');
    assert.ok('reason' in v, 'missing reason');
    console.log(`        verdict: ${v.verdict}`);
  });

  // handoff.md only expected if approved
  const verdictFile = path.join(planDir, 'h-review-verdict.json');
  let approved = false;
  if (fs.existsSync(verdictFile)) {
    try { approved = JSON.parse(fs.readFileSync(verdictFile, 'utf8')).verdict === 'approved'; } catch (_) {}
  }

  if (approved) {
    test('handoff.md exists with Implementation Units', () => {
      const f = path.join(planDir, 'handoff.md');
      assert.ok(fs.existsSync(f), 'missing');
      const c = fs.readFileSync(f, 'utf8');
      assert.ok(c.length > 200, `too short: ${c.length} chars`);
      assert.ok(/Implementation Unit/i.test(c), 'no Implementation Unit section');
    });
  } else {
    skip('handoff.md validation', 'H-Review did not approve');
  }

  // --- Save fixtures if requested ---
  if (SAVE_FIXTURES) {
    console.log('\n--- Saving Fixtures ---');
    saveFixtures('plan', planDir);
    saveFixtures('truth-surface', tsDir);
  }
}

// ============================================================
// Stage: code (placeholder — will be implemented in Phase 4)
// ============================================================

function stageCode() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' E2E ► CODE STAGE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Load plan fixtures as input for code stage
  if (!hasFixtures('plan')) {
    console.error('  [e2e] ERROR: Code stage requires plan fixtures.');
    console.error('         Run: node test/run-e2e.js --stage plan --save');
    process.exit(1);
  }

  initFreshState();
  loadFixtures('plan', planDir);
  loadFixtures('truth-surface', tsDir);

  // Validate plan fixtures are usable
  test('plan fixtures loaded: handoff.md exists', () => {
    const f = path.join(planDir, 'handoff.md');
    assert.ok(fs.existsSync(f), 'handoff.md missing — plan fixtures incomplete');
  });

  test('plan fixtures loaded: constraint-ledger has FROZEN entries', () => {
    const c = fs.readFileSync(path.join(tsDir, 'constraint-ledger.md'), 'utf8');
    assert.ok(c.includes('status: FROZEN'), 'no FROZEN entries in fixture');
  });

  // TODO: Phase 4 — spawn Coder + Evaluator using handoff.md as input
  skip('coder agent spawn', 'Phase 4 not yet implemented');
  skip('evaluator agent spawn', 'Phase 4 not yet implemented');
  skip('code artifact validation', 'Phase 4 not yet implemented');
}

// ============================================================
// Execute selected stage(s)
// ============================================================

try {
  if (STAGE === 'plan' || STAGE === 'all') {
    stagePlan();
  }
  if (STAGE === 'code' || STAGE === 'all') {
    stageCode();
  }
} finally {
  // Always restore
  restore();
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
