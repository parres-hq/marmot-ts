---
phase: 04-feature-parity-conformance-vectors
fixed_at: 2026-09-05T16:21:32Z
review_path: .planning/phases/04-feature-parity-conformance-vectors/04-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

All seven blockers and both warnings were fixed. Logic findings remain flagged for human verification.

| Finding | Commit | Result |
| --- | --- | --- |
| CR-01 | `f293c03` | Prepared wrapper journal plus state-before-terminal persistence and crash-boundary coverage |
| CR-02 | `c4b7b1b` | Durable pending effect payloads, restart re-exposure, explicit acknowledgement |
| CR-03 | `01ac190` | Retryable capacity refusal and independent admission queue without relay redelivery |
| CR-04 | `9cc17b9` | Immediate continuation after deadline-edge pass closure |
| CR-05 | `652aa89` | Typed Scenario IR operation-to-capability mapping and subject-produced support results |
| CR-06 | `4054ece` | Pinned catch-up fixture drives the isolated production-backed extended cases |
| CR-07 | `8a5f900` | Restart disposes the old group and reloads through `GroupRegistry` with all durable stores |
| WR-01 | `74a9e10` | Bare observed edges upgrade to confirmation stamps and survive reload |
| WR-02 | `9e98d40` | Deep canonical snapshot schema, enum, ordering, uniqueness, and nested-field validation |

Verification passed with pinned pnpm 10.18.3: focused tests, root `build`, normal Vitest suite, root `tsc --noEmit`, and isolated extended suite (18/18).

_Fixed: 2026-09-05T16:21:32Z_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 1_

## Second correction pass

The follow-up review identified four blockers in the first fixes. Each was corrected and regression-tested:

| Finding | Commit | Corrected result |
| --- | --- | --- |
| CR-01 | `c727cb0` | Wrapper recovery is bound to the exact processing result and its prior/resulting state hashes; unrelated state changes cannot suppress a prepared wrapper. Application callbacks now occur only after durable state and terminal wrapper output are persisted. |
| CR-07 | `9ea1df3` | Restart no longer force-saves immediately before reload; the test captures the last durable bytes, disposes the crashed instance, and reconstructs through `GroupRegistry`. |
| CR-05 | `77a80b2` | The smoke subject advertises and executes supported behavioral operations through production group/session paths, with a behavioral create/send/deliver/tick/observe regression. |
| CR-06 | `b2a54fd` | The extended harness executes the complete pinned catch-up fixture using four distinct client/group actors and compares epochs, members, payloads, profile fields, group context, exporter state, leaves, application dictionary, and lifecycle. |

Second-pass verification passed with pinned pnpm 10.18.3: focused regression files, `pnpm build`, the full normal Vitest suite, the isolated extended Vitest suite, and root `tsc --noEmit`.

_Corrected: 2026-09-05_  
_Iteration: 2_
