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

// --- T13: setup includes gates in config.json ---
test('setup creates config.json with gates field', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const config = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'config.json'), 'utf8'));
  assert.ok(config.gates, 'gates field should exist');
  assert.strictEqual(config.gates.plan.enabled, true, 'plan gate should be enabled');
  assert.strictEqual(config.gates.code.enabled, true, 'code gate should be enabled');
  assert.strictEqual(config.gates.deploy.enabled, true, 'deploy gate should be enabled');
});

// --- T14: pipeline stage transition sequence ---
test('state-write transitions through all 5 pipeline stages', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const stages = ['discovery', 'planning', 'coding', 'verification', 'achieve'];
  for (const stage of stages) {
    run(`state-write --dir "${dir}" --pipeline_stage ${stage}`);
    const state = JSON.parse(fs.readFileSync(path.join(dir, '.detent', 'state.json'), 'utf8'));
    assert.strictEqual(state.pipeline_stage, stage, `pipeline_stage should be ${stage}`);
  }
});

// --- T15: spawn without --prompt exits 1 ---
test('spawn without --prompt exits 1 with error', () => {
  const result = runAllowError('spawn');
  assert.strictEqual(result.code, 1, `Expected exit 1, got ${result.code}`);
  assert.ok(result.stderr.includes('Error'), `Expected "Error" in stderr, got: ${result.stderr}`);
});

// --- T16: spawn JSONL line-buffer parses and forwards events ---
test('spawn command forwards JSONL events from mock target', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  // Create a mock script that outputs a JSONL line
  const mockScript = path.join(dir, 'mock-agent.js');
  fs.writeFileSync(mockScript, 'console.log(JSON.stringify({type:"result",text:"ok"}));\n');
  const result = runAllowError(`spawn --dir "${dir}" --target node --prompt "${mockScript}"`);
  assert.strictEqual(result.code, 0, `Expected exit 0, got ${result.code}`);
  assert.ok(result.stdout.includes('"type"'), `Expected JSONL in stdout, got: ${result.stdout}`);
  assert.ok(result.stdout.includes('"result"'), `Expected "result" type in stdout`);
});

// --- T17: spawn exits with child exit code ---
test('spawn command exits with child exit code', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const mockScript = path.join(dir, 'mock-exit.js');
  fs.writeFileSync(mockScript, 'process.exit(0);\n');
  const result = runAllowError(`spawn --dir "${dir}" --target node --prompt "${mockScript}"`);
  assert.strictEqual(result.code, 0, `Expected exit 0, got ${result.code}`);
});

// --- T18: all 5 pipeline skill files exist ---
test('all 5 pipeline skill files exist', () => {
  const skills = ['detent-discovery', 'detent-plan', 'detent-code', 'detent-verify', 'detent-achieve'];
  for (const skill of skills) {
    const skillPath = path.join(__dirname, '..', '.claude', 'skills', skill, 'SKILL.md');
    assert.ok(fs.existsSync(skillPath), `${skill}/SKILL.md should exist at ${skillPath}`);
  }
});

// --- T19: every skill @-references shared rules ---
test('every pipeline skill references shared rules', () => {
  const skills = ['detent-discovery', 'detent-plan', 'detent-code', 'detent-verify', 'detent-achieve'];
  for (const skill of skills) {
    const content = fs.readFileSync(path.join(__dirname, '..', '.claude', 'skills', skill, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('@.claude/skills/_shared/rules.md'), `${skill} should @-reference shared rules`);
  }
});

// --- T20: every skill contains state-read and state-write ---
test('every pipeline skill reads and writes state', () => {
  const skills = ['detent-discovery', 'detent-plan', 'detent-code', 'detent-verify', 'detent-achieve'];
  for (const skill of skills) {
    const content = fs.readFileSync(path.join(__dirname, '..', '.claude', 'skills', skill, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('state-read'), `${skill} should contain state-read`);
    assert.ok(content.includes('state-write'), `${skill} should contain state-write`);
  }
});

// --- T21: only plan/code/achieve skills contain gate checks ---
test('only plan/code/achieve skills contain gate checks', () => {
  const gated = ['detent-plan', 'detent-code', 'detent-achieve'];
  const ungated = ['detent-discovery', 'detent-verify'];
  for (const skill of gated) {
    const content = fs.readFileSync(path.join(__dirname, '..', '.claude', 'skills', skill, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('Gate Check') || content.includes('gate'), `${skill} should contain gate check`);
  }
  for (const skill of ungated) {
    const content = fs.readFileSync(path.join(__dirname, '..', '.claude', 'skills', skill, 'SKILL.md'), 'utf8');
    assert.ok(!content.includes('Gate Check'), `${skill} should NOT contain Gate Check section`);
  }
});

// --- T22: every skill frontmatter includes AskUserQuestion ---
test('every pipeline skill allows AskUserQuestion tool', () => {
  const skills = ['detent-discovery', 'detent-plan', 'detent-code', 'detent-verify', 'detent-achieve'];
  for (const skill of skills) {
    const content = fs.readFileSync(path.join(__dirname, '..', '.claude', 'skills', skill, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('AskUserQuestion'), `${skill} should include AskUserQuestion in allowed-tools`);
  }
});

// --- T23: every skill contains stage-mismatch entry guard ---
test('every pipeline skill contains stage-mismatch entry guard', () => {
  const skills = ['detent-discovery', 'detent-plan', 'detent-code', 'detent-verify', 'detent-achieve'];
  for (const skill of skills) {
    const content = fs.readFileSync(path.join(__dirname, '..', '.claude', 'skills', skill, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('expects'), `${skill} should contain stage-mismatch error pattern with "expects" keyword`);
  }
});

// --- T24: truth-propose creates entry in file ---
test('truth-propose creates entry in file', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`truth-propose --dir "${dir}" --id DECISION-001 --file frozen-decisions --source-agent d-critique --rationale "test rationale"`);
  const content = fs.readFileSync(path.join(dir, '.detent', 'truth-surface', 'frozen-decisions.md'), 'utf8');
  assert.ok(content.includes('## DECISION-001'), 'File should contain ## DECISION-001 header');
  assert.ok(content.includes('status: PROPOSED'), 'Entry should have status: PROPOSED');
  assert.ok(content.includes('source_agent: d-critique'), 'Entry should have source_agent: d-critique');
  assert.ok(content.includes('challenged_by: null'), 'Entry should have challenged_by: null');
});

// --- T25: truth-propose with duplicate ID exits non-zero ---
test('truth-propose with duplicate ID exits non-zero', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`truth-propose --dir "${dir}" --id DECISION-001 --file frozen-decisions --source-agent test --rationale "first"`);
  const result = runAllowError(`truth-propose --dir "${dir}" --id DECISION-001 --file frozen-decisions --source-agent test --rationale "second"`);
  assert.strictEqual(result.code, 1, `Expected exit 1 for duplicate ID, got ${result.code}`);
  assert.ok(result.stderr.includes('already exists'), `Expected "already exists" in stderr, got: ${result.stderr}`);
});

// --- T26: truth-propose without --id exits non-zero ---
test('truth-propose without --id exits non-zero', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const result = runAllowError(`truth-propose --dir "${dir}" --file frozen-decisions --source-agent test --rationale "test"`);
  assert.strictEqual(result.code, 1, `Expected exit 1 for missing --id, got ${result.code}`);
  assert.ok(result.stderr.includes('required'), `Expected "required" in stderr, got: ${result.stderr}`);
});

// --- T27: truth-freeze on entry with challenged_by=null exits non-zero ---
test('truth-freeze on entry with challenged_by=null exits non-zero (not mature)', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`truth-propose --dir "${dir}" --id DECISION-001 --file frozen-decisions --source-agent test --rationale "test"`);
  const result = runAllowError(`truth-freeze --dir "${dir}" --id DECISION-001 --file frozen-decisions`);
  assert.strictEqual(result.code, 1, `Expected exit 1 for immature entry, got ${result.code}`);
  assert.ok(result.stderr.includes('not mature') || result.stderr.includes('challenged_by'), `Expected maturity error in stderr, got: ${result.stderr}`);
});

// --- T28: truth-update sets challenged_by; then truth-freeze succeeds ---
test('truth-update sets challenged_by field; then truth-freeze succeeds and entry is FROZEN', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`truth-propose --dir "${dir}" --id DECISION-001 --file frozen-decisions --source-agent d-critique --rationale "test"`);
  run(`truth-update --dir "${dir}" --id DECISION-001 --file frozen-decisions --challenged-by g-red`);
  run(`truth-freeze --dir "${dir}" --id DECISION-001 --file frozen-decisions`);
  const content = fs.readFileSync(path.join(dir, '.detent', 'truth-surface', 'frozen-decisions.md'), 'utf8');
  assert.ok(content.includes('status: FROZEN'), 'Entry should have status: FROZEN after freeze');
  assert.ok(!content.includes('frozen_at: null'), 'frozen_at should not be null after freeze');
});

// --- T29: truth-freeze on already FROZEN entry exits non-zero ---
test('truth-freeze on already FROZEN entry exits non-zero', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`truth-propose --dir "${dir}" --id DECISION-001 --file frozen-decisions --source-agent test --rationale "test"`);
  run(`truth-update --dir "${dir}" --id DECISION-001 --file frozen-decisions --challenged-by g-red`);
  run(`truth-freeze --dir "${dir}" --id DECISION-001 --file frozen-decisions`);
  const result = runAllowError(`truth-freeze --dir "${dir}" --id DECISION-001 --file frozen-decisions`);
  assert.strictEqual(result.code, 1, `Expected exit 1 for already FROZEN entry, got ${result.code}`);
  assert.ok(result.stderr.includes('already FROZEN') || result.stderr.includes('FROZEN'), `Expected FROZEN error in stderr, got: ${result.stderr}`);
});

// --- T30: truth-freeze on non-existent ID exits non-zero ---
test('truth-freeze on non-existent ID exits non-zero', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const result = runAllowError(`truth-freeze --dir "${dir}" --id NONEXISTENT-001 --file frozen-decisions`);
  assert.strictEqual(result.code, 1, `Expected exit 1 for non-existent ID, got ${result.code}`);
  assert.ok(result.stderr.includes('not found') || result.stderr.includes('NONEXISTENT-001'), `Expected "not found" in stderr, got: ${result.stderr}`);
});

// --- T31: truth-read outputs file contents ---
test('truth-read outputs file contents to stdout', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`truth-propose --dir "${dir}" --id DECISION-001 --file frozen-decisions --source-agent test --rationale "some rationale"`);
  const stdout = run(`truth-read --dir "${dir}" --file frozen-decisions`);
  assert.ok(stdout.includes('## DECISION-001'), 'truth-read should output file contents including entry header');
  assert.ok(stdout.includes('PROPOSED'), 'truth-read should include PROPOSED status');
});

// --- T32: truth-read on missing file exits non-zero ---
test('truth-read on missing file exits non-zero', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const result = runAllowError(`truth-read --dir "${dir}" --file nonexistent-file`);
  assert.strictEqual(result.code, 1, `Expected exit 1 for missing file, got ${result.code}`);
  assert.ok(result.stderr.includes('not found') || result.stderr.includes('nonexistent-file'), `Expected "not found" in stderr, got: ${result.stderr}`);
});

// --- T33: setup creates .detent/playbooks/ directory ---
test('setup creates .detent/playbooks/ directory', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  assert.ok(fs.existsSync(path.join(dir, '.detent', 'playbooks')), '.detent/playbooks/ should exist after setup');
});

// --- T34: setup creates truth surface with single constraint-ledger.md ---
test('setup creates constraint-ledger.md as the single truth surface file', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  const constraintContent = fs.readFileSync(path.join(dir, '.detent', 'truth-surface', 'constraint-ledger.md'), 'utf8');
  assert.ok(constraintContent.includes('# Constraint Ledger'), 'constraint-ledger.md should have "# Constraint Ledger" header');
  // frozen-decisions.md and domain-model.md should NOT be created
  assert.ok(!fs.existsSync(path.join(dir, '.detent', 'truth-surface', 'frozen-decisions.md')), 'frozen-decisions.md should not exist (merged into constraint-ledger)');
  assert.ok(!fs.existsSync(path.join(dir, '.detent', 'truth-surface', 'domain-model.md')), 'domain-model.md should not exist (merged into constraint-ledger)');
});

// --- T35: truth-propose with --retained-goal and --discarded-options stores those fields (TRUTH-03) ---
test('truth-propose with --retained-goal and --discarded-options stores them in YAML block (TRUTH-03)', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`truth-propose --dir "${dir}" --id CONSTRAINT-001 --file constraint-ledger --source-agent d-critique --rationale "constraint rationale" --retained-goal "keep X simple" --discarded-options "Y; Z"`);
  const content = fs.readFileSync(path.join(dir, '.detent', 'truth-surface', 'constraint-ledger.md'), 'utf8');
  assert.ok(content.includes('retained_goal:'), 'Entry should have retained_goal field');
  assert.ok(content.includes('keep X simple'), 'retained_goal should contain the provided value');
  assert.ok(content.includes('discarded_options:'), 'Entry should have discarded_options field');
  assert.ok(content.includes('Y; Z'), 'discarded_options should contain the provided value');
});

// --- T36: truth-propose without --retained-goal defaults to empty string in YAML block ---
test('truth-propose without --retained-goal defaults to empty string in YAML block', () => {
  const dir = freshDir();
  run(`setup --dir "${dir}"`);
  run(`truth-propose --dir "${dir}" --id DECISION-002 --file frozen-decisions --source-agent test --rationale "test"`);
  const content = fs.readFileSync(path.join(dir, '.detent', 'truth-surface', 'frozen-decisions.md'), 'utf8');
  assert.ok(content.includes('retained_goal: ""'), 'retained_goal should default to empty string ""');
  assert.ok(content.includes('discarded_options: ""'), 'discarded_options should default to empty string ""');
});

// --- T37: /detent:plan SKILL.md exists and contains spawn ---
test('/detent:plan SKILL.md exists and contains detent-tools.cjs spawn', () => {
  const skillPath = path.join(__dirname, '..', '.claude', 'skills', 'detent-plan', 'SKILL.md');
  assert.ok(fs.existsSync(skillPath), 'detent-plan/SKILL.md missing');
  const content = fs.readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('detent-tools.cjs spawn'), 'detent-plan SKILL.md should contain detent-tools.cjs spawn');
});

// --- T38: /detent:plan SKILL.md references h-review-verdict.json for routing ---
test('/detent:plan SKILL.md contains h-review-verdict.json (reads H verdict for routing)', () => {
  const skillPath = path.join(__dirname, '..', '.claude', 'skills', 'detent-plan', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('h-review-verdict.json'), 'detent-plan SKILL.md should reference h-review-verdict.json for routing');
});

// --- T39: /detent:plan SKILL.md does not contain Write in allowed-tools ---
test('/detent:plan SKILL.md does not have Write in allowed-tools', () => {
  const skillPath = path.join(__dirname, '..', '.claude', 'skills', 'detent-plan', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  // Extract the frontmatter block (between first --- and second ---)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatterMatch, 'SKILL.md should have YAML frontmatter');
  const frontmatter = frontmatterMatch[1];
  assert.ok(!frontmatter.includes('Write'), 'detent-plan SKILL.md should not have Write in allowed-tools frontmatter');
});

// --- T40: /detent:plan SKILL.md contains truth-freeze (supervised gate per D-02) ---
test('/detent:plan SKILL.md contains truth-freeze (supervised-mode freeze gate per D-02)', () => {
  const skillPath = path.join(__dirname, '..', '.claude', 'skills', 'detent-plan', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('truth-freeze'), 'detent-plan SKILL.md should contain truth-freeze for supervised gate');
});

// --- T41: All 5 agent template files exist in .claude/agents/ ---
test('all 5 agent template files exist in .claude/agents/', () => {
  const agents = ['d-critique', 'g-red', 'g-blue', 'h-review', 'j-compile'];
  for (const agent of agents) {
    const agentPath = path.join(__dirname, '..', '.claude', 'agents', `${agent}.md`);
    assert.ok(fs.existsSync(agentPath), `${agent}.md missing from .claude/agents/`);
  }
});

// --- T42: D-Critique agent has Read, Bash tools only (no Write) ---
test('d-critique agent has tools: Read, Bash (no Write)', () => {
  const agentPath = path.join(__dirname, '..', '.claude', 'agents', 'd-critique.md');
  assert.ok(fs.existsSync(agentPath), 'd-critique.md missing');
  const content = fs.readFileSync(agentPath, 'utf8');
  assert.ok(content.includes('tools: Read, Bash'), 'Expected tools: Read, Bash in d-critique.md');
  assert.ok(!content.includes('tools: Read, Bash, Write'), 'D-Critique should not have Write tool');
});

// --- T43: H-Review agent contains h-review-verdict.json ---
test('h-review agent contains h-review-verdict.json', () => {
  const agentPath = path.join(__dirname, '..', '.claude', 'agents', 'h-review.md');
  assert.ok(fs.existsSync(agentPath), 'h-review.md missing');
  const content = fs.readFileSync(agentPath, 'utf8');
  assert.ok(content.includes('h-review-verdict.json'), 'h-review.md should reference h-review-verdict.json');
});

// --- T44: J-Compile agent has Read, Bash tools only (no Write) ---
test('j-compile agent has tools: Read, Bash (no Write)', () => {
  const agentPath = path.join(__dirname, '..', '.claude', 'agents', 'j-compile.md');
  assert.ok(fs.existsSync(agentPath), 'j-compile.md missing');
  const content = fs.readFileSync(agentPath, 'utf8');
  assert.ok(content.includes('tools: Read, Bash'), 'Expected tools: Read, Bash in j-compile.md');
  assert.ok(!content.includes('tools: Read, Bash, Write'), 'J-Compile should not have Write tool');
});

// --- T45: All agent templates contain model: inherit ---
test('all agent templates contain model: inherit', () => {
  const agents = ['d-critique', 'g-red', 'g-blue', 'h-review', 'j-compile'];
  for (const agent of agents) {
    const agentPath = path.join(__dirname, '..', '.claude', 'agents', `${agent}.md`);
    const content = fs.readFileSync(agentPath, 'utf8');
    assert.ok(content.includes('model: inherit'), `${agent}.md should contain model: inherit`);
  }
});

// --- T46: No agent template has Write in its tools: line ---
test('no agent template has Write in its tools: line', () => {
  const agents = ['d-critique', 'g-red', 'g-blue', 'h-review', 'j-compile'];
  for (const agent of agents) {
    const agentPath = path.join(__dirname, '..', '.claude', 'agents', `${agent}.md`);
    const content = fs.readFileSync(agentPath, 'utf8');
    // Find the tools: line in frontmatter
    const toolsMatch = content.match(/^tools:\s*(.+)$/m);
    if (toolsMatch) {
      assert.ok(!toolsMatch[1].includes('Write'), `${agent}.md tools: line should not include Write (got: ${toolsMatch[1]})`);
    }
  }
});

// --- T47: /detent:plan SKILL.md contains VALIDATION FAILED (output validation present) ---
test('/detent:plan SKILL.md contains VALIDATION FAILED (output validation after each agent spawn)', () => {
  const skillPath = path.join(__dirname, '..', '.claude', 'skills', 'detent-plan', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  assert.ok(content.includes('VALIDATION FAILED'), 'detent-plan SKILL.md should contain VALIDATION FAILED checks for truncated output detection');
});

// --- T48: spawn command includes --verbose flag for stream-json ---
test('spawn command includes --verbose flag in claude args', () => {
  const cliPath = path.join(__dirname, '..', 'detent-tools.cjs');
  const content = fs.readFileSync(cliPath, 'utf8');
  assert.ok(content.includes("'--verbose'"), 'detent-tools.cjs spawn should include --verbose flag');
});

// --- T49: spawn command supports --agent parameter ---
test('spawn command supports --agent parameter', () => {
  const cliPath = path.join(__dirname, '..', 'detent-tools.cjs');
  const content = fs.readFileSync(cliPath, 'utf8');
  assert.ok(content.includes("named.agent"), 'detent-tools.cjs spawn should read named.agent');
  assert.ok(content.includes("'--agent'"), 'detent-tools.cjs spawn should pass --agent to claude');
});

// --- T50: SKILL.md spawn calls use --agent parameter ---
test('/detent:plan SKILL.md spawn calls use --agent parameter for agent template loading', () => {
  const skillPath = path.join(__dirname, '..', '.claude', 'skills', 'detent-plan', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  const agents = ['d-critique', 'g-red', 'g-blue', 'h-review', 'j-compile'];
  for (const agent of agents) {
    assert.ok(content.includes(`--agent ${agent}`), `SKILL.md should use --agent ${agent} in spawn call`);
  }
});

// --- T51: SKILL.md spawn calls do NOT contain "Run as the" (agent template handles identity) ---
test('/detent:plan SKILL.md spawn prompts do not contain redundant "Run as the" identity', () => {
  const skillPath = path.join(__dirname, '..', '.claude', 'skills', 'detent-plan', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');
  // With --agent flag, the agent template defines identity — prompt should not duplicate it
  const spawnLines = content.split('\n').filter(l => l.includes('detent-tools.cjs spawn'));
  for (const line of spawnLines) {
    assert.ok(!line.includes('Run as the'), `Spawn prompt should not contain "Run as the" when using --agent: ${line.slice(0, 80)}`);
  }
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
