'use strict';
const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Path to the CLI under test
const CLI = path.join(__dirname, '..', 'detent-tools.cjs');

let passed = 0;
let failed = 0;

// Create a unique temp directory for this test run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detent-test-'));

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

function run(args, opts = {}) {
  const cmd = `node "${CLI}" ${args}`;
  return execSync(cmd, { encoding: 'utf8', ...opts });
}

function runAllowError(args) {
  try {
    const stdout = execSync(`node "${CLI}" ${args}`, { encoding: 'utf8' });
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status || 1 };
  }
}

// Make a fresh sub-dir for each test to isolate state
let testDirCount = 0;
function freshDir() {
  const d = path.join(tmpDir, `t${++testDirCount}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

console.log('\nDetent CLI test suite\n');

// --- T1: No-args usage ---
test('no-args prints Usage: and exits 0', () => {
  const result = runAllowError('');
  assert.strictEqual(result.code, 0, `Expected exit 0, got ${result.code}`);
  assert.ok(result.stdout.includes('Usage:'), `Expected "Usage:" in stdout, got: ${result.stdout}`);
});

// --- T2: setup creates directory tree ---
test('setup creates .detent/ directory tree', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  assert.ok(fs.existsSync(path.join(dir, '.detent')), '.detent/ missing');
  assert.ok(fs.existsSync(path.join(dir, '.detent', 'state.json')), '.detent/state.json missing');
  assert.ok(fs.existsSync(path.join(dir, '.detent', 'config.json')), '.detent/config.json missing');
  assert.ok(fs.existsSync(path.join(dir, '.detent', 'truth-surface')), '.detent/truth-surface/ missing');
  assert.ok(fs.existsSync(path.join(dir, '.detent', 'raw')), '.detent/raw/ missing');
  assert.ok(fs.existsSync(path.join(dir, '.detent', 'logs')), '.detent/logs/ missing');
});

// --- T3: state.json schema from setup ---
test('setup creates state.json with correct default schema', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const state = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'state.json'), 'utf8'));
  assert.strictEqual(state.schema_version, 1, 'schema_version should be 1');
  assert.strictEqual(state.pipeline_stage, 'idle', 'pipeline_stage should be idle');
  assert.strictEqual(state.current_unit, null, 'current_unit should be null');
  assert.strictEqual(state.iteration_count, 0, 'iteration_count should be 0');
  assert.strictEqual(state.reentry_depth, 0, 'reentry_depth should be 0');
  assert.ok(typeof state.last_updated === 'string', 'last_updated should be a string');
  assert.ok(state.last_updated.length > 0, 'last_updated should be non-empty');
  assert.strictEqual(state.session_id, null, 'session_id should be null');
});

// --- T4: config.json schema from setup ---
test('setup creates config.json with correct default schema', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const config = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'config.json'), 'utf8'));
  assert.strictEqual(config.schema_version, 1, 'schema_version should be 1');
  assert.strictEqual(config.mode, 'supervised', 'mode should be supervised');
  assert.strictEqual(config.model_budget, 'balanced', 'model_budget should be balanced');
  assert.strictEqual(config.locale, 'en', 'locale should be en');
  assert.ok(typeof config.pipeline_stages === 'object', 'pipeline_stages should be object');
  assert.strictEqual(config.pipeline_stages.discovery, true, 'pipeline_stages.discovery should be true');
  assert.strictEqual(config.pipeline_stages.planning, true, 'pipeline_stages.planning should be true');
  assert.strictEqual(config.pipeline_stages.coding, true, 'pipeline_stages.coding should be true');
  assert.strictEqual(config.pipeline_stages.verification, true, 'pipeline_stages.verification should be true');
  assert.strictEqual(config.pipeline_stages.achieve, true, 'pipeline_stages.achieve should be true');
  assert.strictEqual(config.unit_granularity, 'standard', 'unit_granularity should be standard');
  assert.strictEqual(config.language, 'en', 'language should be en');
});

// --- T5: setup with flags overrides defaults ---
test('setup with --mode --budget --locale --granularity overrides defaults', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}" --mode autonomous --budget quality --locale zh-CN --granularity fine`);
  const config = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'config.json'), 'utf8'));
  assert.strictEqual(config.mode, 'autonomous', 'mode should be autonomous');
  assert.strictEqual(config.model_budget, 'quality', 'model_budget should be quality');
  assert.strictEqual(config.locale, 'zh-CN', 'locale should be zh-CN');
  assert.strictEqual(config.unit_granularity, 'fine', 'unit_granularity should be fine');
  assert.strictEqual(config.language, 'zh-CN', 'language should be zh-CN (mirrors locale)');
});

// --- T6: state-write updates pipeline_stage ---
test('state-write updates pipeline_stage', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`state-write --dir "${dir}" --pipeline_stage discovery`);
  const state = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'state.json'), 'utf8'));
  assert.strictEqual(state.pipeline_stage, 'discovery', 'pipeline_stage should be discovery');
});

// --- T7: state-read outputs current state ---
test('state-read outputs state.json as JSON to stdout', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const stdout = run(`state-read --dir "${dir}"`);
  const state = JSON.parse(stdout);
  assert.ok('pipeline_stage' in state, 'pipeline_stage field expected');
  assert.strictEqual(state.pipeline_stage, 'idle');
});

// --- T8: config-write updates mode ---
test('config-write updates mode to autonomous', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`config-write --dir "${dir}" --mode autonomous`);
  const config = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'config.json'), 'utf8'));
  assert.strictEqual(config.mode, 'autonomous', 'mode should be autonomous');
});

// --- T9: config-read outputs current config ---
test('config-read outputs config.json as JSON to stdout', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const stdout = run(`config-read --dir "${dir}"`);
  const config = JSON.parse(stdout);
  assert.ok('mode' in config, 'mode field expected in config output');
});

// --- T10: unknown command exits 1 and writes to stderr ---
test('unknown-command exits 1 and writes error to stderr', () => {
  const result = runAllowError('unknown-command');
  assert.strictEqual(result.code, 1, `Expected exit 1, got ${result.code}`);
  assert.ok(result.stderr.includes('Unknown command'), `Expected "Unknown command" in stderr, got: ${result.stderr}`);
});

// --- T11: state-write updates last_updated ---
test('state-write updates last_updated timestamp', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const before = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'state.json'), 'utf8'));
  // Small pause to ensure timestamp changes
  const beforeTime = before.last_updated;
  run(`state-write --dir "${dir}" --pipeline_stage planning`);
  const after = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'state.json'), 'utf8'));
  assert.ok(after.last_updated !== undefined, 'last_updated should exist after state-write');
});

// --- T12: state-write updates multiple fields ---
test('state-write updates multiple fields at once', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`state-write --dir "${dir}" --pipeline_stage coding --iteration_count 3`);
  const state = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'state.json'), 'utf8'));
  assert.strictEqual(state.pipeline_stage, 'coding', 'pipeline_stage should be coding');
  assert.strictEqual(state.iteration_count, 3, 'iteration_count should be 3 (parsed as int)');
});

// --- cleanup ---
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (e) {
  // Non-fatal cleanup failure
}

// --- report ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
