---
phase: 05-quality-gate
plan: 08
subsystem: release
tags: [github-actions, provenance, runtime-matrix, quality-gate]
requires:
  - phase: 05-quality-gate
    provides: Immutable tested-source push and four parity dossiers
provides:
  - Authenticated six-runtime normal and extended CI evidence
  - Machine validation binding CI and parity dossiers to one tested source
  - Final Phase 5 quality-gate record
affects: [release-evidence, QA-01, QA-02]
tech-stack:
  added: []
  patterns: [immutable run-and-job evidence, distinct source-and-attestation identities]
key-files:
  created:
    - .planning/phases/05-quality-gate/05-CI-EVIDENCE.json
    - scripts/validate-quality-ci.mjs
    - .planning/phases/05-quality-gate/05-QUALITY-GATE.md
  modified:
    - .planning/phases/05-quality-gate/05-PROOF-V2-DOSSIER.md
    - .planning/phases/05-quality-gate/05-KEY-PACKAGE-LIFETIME-DOSSIER.md
    - .planning/phases/05-quality-gate/05-TAG-CARDINALITY-DOSSIER.md
    - .planning/phases/05-quality-gate/05-SAFE-AAD-DOSSIER.md
key-decisions:
  - "Promote c399203cd0de4db45b3b39d3b49ab27da9b8f075 as the unified tested source after repairing the Node 20-only test incompatibility."
  - "Reject both incomplete runs from release evidence and accept only successful run 34054220800 with six immutable job IDs."
patterns-established:
  - "Final quality evidence uses one tested source while later attestation commits are recorded separately and never self-referenced."
requirements-completed: [QA-01, QA-02]
coverage:
  - id: D1
    description: Six hosted runtime jobs prove frozen pnpm 10 installs plus normal and extended test success at one source SHA.
    requirement: QA-01
    verification:
      - kind: integration
        ref: node scripts/validate-quality-ci.mjs .planning/phases/05-quality-gate/05-CI-EVIDENCE.json
        status: pass
    human_judgment: false
  - id: D2
    description: Four independent parity dossiers and CI evidence share the same tested source and reference gitlinks.
    requirement: QA-02
    verification:
      - kind: integration
        ref: node scripts/validate-quality-dossiers.mjs
        status: pass
    human_judgment: false
duration: 18min
completed: 2026-09-06
status: complete
---

# Phase 5 Plan 8: Hosted Quality Gate Summary

**Authenticated GitHub evidence now proves the complete six-runtime normal and extended matrix at the same immutable source as four independently replayed Rust/TypeScript parity dossiers.**

## Performance

- **Duration:** 18 min
- **Completed:** 2026-09-06
- **Tasks:** 2
- **Hosted jobs:** 6

## Accomplishments

- Published the exact missing `ts-mls` object after explicit approval, then rejected the checkout-failed CI attempt rather than overstating its coverage.
- Found and repaired a Node 20-only test compatibility defect, verified the full Node 20 normal and extended suites, and obtained explicit approval for the new immutable source push.
- Captured successful run `34054220800` with unique immutable job IDs for Node 20/22/24, Deno 2, Bun latest, and Bun 1.1; every row used pnpm 10, a frozen install, and passed 96/964 normal plus 1/1 extended tests.
- Replayed all four dossiers in a detached worktree at `c399203cd0de4db45b3b39d3b49ab27da9b8f075`, then sealed the final quality gate.

## Task Commits

1. **Node 20 compatibility repair** — `c399203cd0de4db45b3b39d3b49ab27da9b8f075` (test)
2. **Task 1: hosted CI and unified dossier evidence** — `06464c2dd4e0e43102e574979dca670b22a07407` (feat)
3. **Task 2: final quality gate** — `7afbb0c9da3c9483c98d6895c77d7aa73f609c22` (docs)

`ci_attestation_sha` is `06464c2dd4e0e43102e574979dca670b22a07407`. The final gate's containing commit is `7afbb0c9da3c9483c98d6895c77d7aa73f609c22`. Both are later than, and explicitly distinct from, `tested_source_sha` `c399203cd0de4db45b3b39d3b49ab27da9b8f075`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Published the pinned ts-mls object**

- **Found during:** Task 1, run `34053723452` attempt 1
- **Issue:** Recursive checkout could not fetch superproject gitlink `af6d1c599f2912fda5fbcac1b461fdd3013e37c7` because it existed only locally.
- **Fix:** After explicit user approval, pushed exactly that object to `refs/heads/gsd/04-06-group-context-encoder` and verified the remote ref.
- **Verification:** Attempt 2 and the final run checked out all three submodules successfully.

**2. [Rule 1 - Bug] Removed a Node 20-only test API**

- **Found during:** Task 1, run `34053723452` attempt 2
- **Issue:** Two tests called `Promise.withResolvers`, unavailable on supported Node 20.
- **Fix:** Replaced it with a portable Promise resolver closure.
- **Files modified:** `src/__tests__/groups-manager.test.ts`
- **Verification:** Targeted Node 20/22 tests passed; full Node 20 suite passed 96 files and 964 tests; extended passed 1/1; final hosted matrix passed.
- **Commit:** `c399203cd0de4db45b3b39d3b49ab27da9b8f075`

**3. [Rule 3 - Blocking] Re-attested dossiers at the repaired source**

- **Found during:** Task 2 provenance binding
- **Issue:** Original dossier attestation `172eb0a4f01812ffb0578b7155fd5d600453c86a` referenced the superseded source `b937e3f3e4fddcb6e48aff4ca6507623504be48d`.
- **Fix:** Replayed frozen install, compile/build, four Rust fixture diffs, 68 focused tests, and four negative controls in a detached worktree at the final tested source; updated all dossier provenance together.
- **Verification:** Both validators pass against one tested-source tuple.
- **Commit:** `06464c2dd4e0e43102e574979dca670b22a07407`

**Total deviations:** 3 auto-fixed (1 Rule 1, 2 Rule 3). **Impact:** All incomplete evidence was rejected, and the final gate is stronger because CI and dossiers are mechanically bound to the repaired source.

## Authentication Gates

- GitHub CLI access was authenticated throughout retrieval.
- The user separately approved the exact `ts-mls` object push, rerun, and repaired-source push. No additional external mutation was performed.

## Issues Encountered

- Run `34053723452` attempt 1 failed at checkout and attempt 2 was incomplete after Node 20 failed. Neither is used as passing evidence.
- Run `34054220800` attempt 1 completed successfully and is the sole hosted release authority.

## Next Phase Readiness

QA-01 and QA-02 are complete. Phase 5 is ready for final verification and milestone closure.

## Self-Check: PASSED

- CI validator passes for six unique hosted rows at the exact tested source.
- Dossier validator passes for all four independent dossiers at the same source and gitlinks.
- Final quality-gate document records source and later attestation identities without a self-SHA claim.
- Worktree is clean apart from this summary before its atomic commit.

---

_Phase: 05-quality-gate_
_Completed: 2026-09-06_
