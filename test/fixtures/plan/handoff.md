# Code Handoff

## Summary

Build a simple key-value store CLI tool backed by a single JSON file. The planning debate resolved three key design decisions: writes use lockfile + atomic rename for both mutual exclusion and crash safety, get errors include the key name and use non-zero exit codes, and all values are stored as opaque strings with no type inference.

## Frozen Constraints

| ID | Constraint | Impact on Implementation |
|----|------------|--------------------------|
| CONSTRAINT-001 | Lockfile (O_EXCL) for mutual exclusion + atomic rename for crash safety | Write operations must acquire lock, write temp, rename, release lock |
| CONSTRAINT-002 | Get on missing key exits non-zero with key name in error message | Get must check key existence and format error with key name |
| CONSTRAINT-003 | Storage file created lazily on first put | Get/Delete/List on missing file treat as empty store, not error |

## Implementation Units

### UNIT-01: Core storage module

- **Description:** Create the storage module with read/write functions that implement lockfile + atomic rename
- **Files:** `src/store.js`
- **Dependencies:** none
- **Acceptance Criteria:**
  - [ ] `readStore(filePath)` returns parsed JSON object, or `{}` if file doesn't exist
  - [ ] `writeStore(filePath, data)` acquires lockfile via `fs.openSync(lockPath, 'wx')`, writes to temp file, renames to target, releases lock
  - [ ] Concurrent writeStore calls do not corrupt data (second call waits or fails gracefully)
  - [ ] No external dependencies — only Node.js built-in `fs` and `path`
- **Frozen Constraints:** CONSTRAINT-001, CONSTRAINT-003

### UNIT-02: CLI commands (put, get, delete, list)

- **Description:** Implement the four CLI commands using the storage module
- **Files:** `src/cli.js`
- **Dependencies:** UNIT-01
- **Acceptance Criteria:**
  - [ ] `put <key> <value>` stores value as string, exits 0, creates file on first use
  - [ ] `get <key>` prints value to stdout, exits 0; if key not found, prints "Error: key '<key>' not found" to stderr, exits 1
  - [ ] `delete <key>` removes key, exits 0; if key not found, prints warning to stderr, exits 0
  - [ ] `list` prints all keys one per line to stdout, exits 0; empty store prints nothing
  - [ ] All values stored as strings — `put key 42` stores `"42"`, not `42`
- **Frozen Constraints:** CONSTRAINT-002, CONSTRAINT-003

### UNIT-03: Entry point and argument parsing

- **Description:** CLI entry point with argument parsing, help text, and error handling
- **Files:** `kv.js` (entry point)
- **Dependencies:** UNIT-02
- **Acceptance Criteria:**
  - [ ] `node kv.js put mykey myvalue` stores the pair
  - [ ] `node kv.js get mykey` retrieves and prints the value
  - [ ] `node kv.js` with no arguments prints usage and exits 1
  - [ ] Unknown commands print error and exit 1
- **Frozen Constraints:** none (UI layer)

## Open Issues

- Delete of non-existent key: warn on stderr but exit 0 (not a hard error). This was a G-Red/G-Blue discussion point — the guidance is to match kubectl behavior (warn, don't fail).
- Storage file path: default to `./kv-store.json` in current directory. Could be made configurable via `--file` flag in a future iteration.
