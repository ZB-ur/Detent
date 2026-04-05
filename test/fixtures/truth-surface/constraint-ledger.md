# Constraint Ledger

All constraints, decisions, and domain facts. PROPOSED entries are under debate; FROZEN entries are immutable.

## CONSTRAINT-001

```yaml
id: CONSTRAINT-001
status: FROZEN
source_agent: d-critique
challenged_by: g-red
frozen_at: 2026-04-06T00:00:00.000Z
retained_goal: "File locking must use atomic rename pattern, not advisory locks"
discarded_options: "flock/advisory locks (not portable across platforms, no protection against corruption on crash); no locking (concurrent writes corrupt JSON)"
```

The requirement says "file must be locked during writes" but doesn't specify the mechanism. Advisory locks (flock) are not portable and don't protect against crash corruption. Atomic rename (write to temp file, then rename) is the standard pattern for single-file JSON stores — it guarantees either the old or new content is present, never a partial write.

## CONSTRAINT-002

```yaml
id: CONSTRAINT-002
status: FROZEN
source_agent: d-critique
challenged_by: g-blue
frozen_at: 2026-04-06T00:00:00.000Z
retained_goal: "Get on missing key must exit non-zero with specific error message containing the key name"
discarded_options: "Return null/undefined silently (caller cannot distinguish missing key from empty value); throw generic error (no key context for debugging)"
```

"Return error if not found" is underspecified. The error must include the key name for debugging. Exit code must be non-zero so callers can distinguish success from failure programmatically.

## CONSTRAINT-003

```yaml
id: CONSTRAINT-003
status: FROZEN
source_agent: g-blue
challenged_by: g-red
frozen_at: 2026-04-06T00:00:00.000Z
retained_goal: "Storage file created lazily on first put, not eagerly on init"
discarded_options: "Require explicit init command (extra step, bad UX for a simple tool); create on import/require (side effect on module load)"
```

No init step needed for a simple KV store. The JSON file should be created on the first put operation. Get/Delete/List on a non-existent file should behave as if the store is empty (not error).

## CONSTRAINT-004

```yaml
id: CONSTRAINT-004
status: PROPOSED
source_agent: d-critique
challenged_by: g-red
frozen_at: null
retained_goal: "Values are restricted to JSON-serializable types"
discarded_options: "Arbitrary binary values (requires encoding layer, complicates the JSON backend); string-only values (unnecessarily restrictive)"
```

Since the backend is a JSON file, values must be JSON-serializable. This is an implicit constraint from the storage choice but should be explicit so the CLI can validate input and produce clear errors.
