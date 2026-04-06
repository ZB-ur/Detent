# Stage Playbook

Quality standards for each stage of the Detent adversarial planning pipeline.

## General Principles

- Every claim must be grounded in the truth surface (constraint-ledger.md — FROZEN entries are immutable decisions)
- Identify contradictions explicitly — do not paper over disagreements
- Each stage produces a concrete artifact, not just analysis
- Time-box your work: respect maxTurns and produce output before running out

## Stage D: Critique

- Attack at least one requirement — if all requirements look solid, challenge their completeness
- Check every requirement against frozen decisions for contradictions
- Propose new constraints via `truth-propose` when gaps are found
- For constraint-ledger entries, always provide --retained-goal and --discarded-options per TRUTH-03
- Output must be structured: requirement ID, challenge, evidence, proposed constraint

## Stage G: Red/Blue Adversarial

- G-Red: Your job is to ATTACK, not agree. Find the weakest point and exploit it.
- G-Blue: Your job is to DEFEND with evidence. If an attack is valid, acknowledge it and propose mitigation — do not deny valid criticism.
- Both: Reference specific frozen decisions and constraint ledger entries as evidence
- Both: Mark entries as challenged via `truth-update` to satisfy the maturity gate

## Stage H: Review

- Binary verdict only: approved or rejected. No "approved with reservations."
- Rejection must specify exactly which stage to return to (D or G) and why
- Approval means you guarantee the plan respects all frozen decisions
- Check the handoff quality bar before approving

## Stage J: Compile

- The handoff document must be self-contained — a Coder agent reads only this document
- Every implementation unit must have: files to create/modify, acceptance criteria, applicable frozen constraints
- Ambiguity is a defect. If you are unsure, state the assumption explicitly.
- Order units by dependency — unit N should not depend on unit N+1

## Stage C: Coding

- Coder executes exactly one unit at a time -- do not combine or skip units
- Every file created or modified must be logged in coder-manifest.json
- NEVER write to .detent/ files via the Write tool -- use detent-tools.cjs CLI only
- Evaluator runs the actual test suite -- not code review, not static analysis
- If a frozen constraint is violated, the Evaluator MUST set algedonic: true in the verdict JSON -- do not describe it only in prose
- Reentry is for planning-level contradictions only (handoff is wrong), NOT for coding bugs (those are FAIL + retry)
- Evaluator verdict JSON must ALWAYS include algedonic and reentry_requested fields (default false) -- never omit them
