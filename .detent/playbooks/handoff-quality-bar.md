# Handoff Quality Bar

Minimum quality standards for the J-Compile code handoff document (.detent/plan/handoff.md).

## Required Sections

The handoff document MUST contain all of these sections:

1. **Summary** — One paragraph describing what is being built and why
2. **Frozen Constraints** — List of all FROZEN decisions that apply, with their IDs
3. **Implementation Units** — Ordered list of coding units

## Implementation Unit Requirements

Each unit MUST specify:

- **Unit ID** — Unique identifier (e.g., UNIT-01)
- **Description** — What this unit implements
- **Files** — Exact file paths to create or modify
- **Dependencies** — Which other units must complete first (or "none")
- **Acceptance Criteria** — Testable conditions that prove the unit is correct
- **Frozen Constraints** — Which frozen decisions apply to this unit (by ID)

## Quality Checks

Before finalizing the handoff, verify:

- [ ] Every frozen decision is referenced by at least one unit
- [ ] No unit depends on a later unit (ordering is valid)
- [ ] Every file path is specific (no "relevant files" or "etc.")
- [ ] Every acceptance criterion is testable (can be checked with a command or assertion)
- [ ] No ambiguous language ("should", "might", "could consider") — use "must", "will", "exactly"

## Rejection Triggers

H-Review SHOULD reject the plan if:

- Any frozen decision is contradicted by the proposed implementation
- A unit's acceptance criteria are vague or untestable
- Units have circular dependencies
- The handoff references files or APIs that don't exist and aren't being created
