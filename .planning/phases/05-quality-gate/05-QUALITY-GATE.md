# Phase 5 Quality Gate

## Verdict

**PASS** — the authenticated six-runtime GitHub Actions matrix and all four independent Rust/TypeScript parity dossiers validate the same immutable tested source.

This document is a later attestation. Its containing commit is recorded in `05-08-SUMMARY.md`; the document does not claim to contain its own commit SHA.

## Immutable provenance

| Field | Value |
| --- | --- |
| Tested source | `c399203cd0de4db45b3b39d3b49ab27da9b8f075` |
| Marmot specification gitlink | `4a2bc65f8db5866cec3b2a127dedb37818eaf207` |
| MDK reference gitlink | `dbf45c83a8e157302edd13010944ad2c6a9cf9a5` |
| ts-mls gitlink | `af6d1c599f2912fda5fbcac1b461fdd3013e37c7` |
| Frozen lockfile SHA-256 | `0f516945e45e257735c4c89a5e9e08b4bb2f839b7ce48121a71b4fb0b03a0932` |
| Original dossier attestation | `172eb0a4f01812ffb0578b7155fd5d600453c86a` (superseded; attested the earlier source `b937e3f3e4fddcb6e48aff4ca6507623504be48d`) |
| Unified CI/dossier re-attestation | `06464c2dd4e0e43102e574979dca670b22a07407` |

The dossier replay ran in a detached worktree at the tested source with pnpm `10.18.3`, a frozen install, unchanged lockfile, compile/build, four locked Rust generators, 68 focused TypeScript parity tests, and four negative controls. The validated JSON records are authoritative; commit labels above describe later attestations only.

## Hosted runtime authority

Authenticated GitHub Actions run [`34054220800`](https://github.com/marmot-protocol/marmot-ts/actions/runs/34054220800), attempt 1, completed successfully with `head_sha` equal to the tested source. No artifacts were published; evidence was parsed from authenticated run, job, and job-log APIs and retained in `05-CI-EVIDENCE.json`.

Every row used pnpm `10.34.5`, ran `pnpm install --frozen-lockfile`, passed the normal suite with 96 files and 964 tests, and passed the isolated extended suite with 1 file and 1 test.

| Matrix row | Resolved runtime | Immutable job | Normal | Extended |
| --- | --- | --- | --- | --- |
| Node 20.x | `v20.20.2` | [`101543036557`](https://github.com/marmot-protocol/marmot-ts/actions/runs/34054220800/job/101543036557) | PASS — 96/964 | PASS — 1/1 |
| Node 22.x | `v22.23.2` | [`101543036543`](https://github.com/marmot-protocol/marmot-ts/actions/runs/34054220800/job/101543036543) | PASS — 96/964 | PASS — 1/1 |
| Node 24.x | `v24.20.0` | [`101543036533`](https://github.com/marmot-protocol/marmot-ts/actions/runs/34054220800/job/101543036533) | PASS — 96/964 | PASS — 1/1 |
| Deno 2.x | `2.9.6`; V8 `15.0.245.2-rusty`; TypeScript `6.0.3` | [`101543036357`](https://github.com/marmot-protocol/marmot-ts/actions/runs/34054220800/job/101543036357) | PASS — 96/964 | PASS — 1/1 |
| Bun latest | `1.4.2`; revision `1.4.2+744846f84` | [`101543036544`](https://github.com/marmot-protocol/marmot-ts/actions/runs/34054220800/job/101543036544) | PASS — 96/964 | PASS — 1/1 |
| Bun 1.1 | `1.1.45`; revision `1.1.45+196621f25` | [`101543036442`](https://github.com/marmot-protocol/marmot-ts/actions/runs/34054220800/job/101543036442) | PASS — 96/964 | PASS — 1/1 |

Local smoke evidence in `05-RUNTIME-EVIDENCE.md` remains secondary and does not substitute for these hosted results.

## Cross-implementation parity dossiers

| Dossier | Independent oracle | Shipping subject | Result |
| --- | --- | --- | --- |
| Proof-v2 | Rust canonical-event/signature generator | TypeScript proof-v2 verification | PASS, including mutation rejection |
| KeyPackage lifetime | Rust lifetime-cap generator | TypeScript lifetime verification | PASS, including one-second cap mutation |
| Tag cardinality | Rust producer plus spec receiver | TypeScript canonical tag handling | PASS, including tag mutation |
| SafeAAD | Rust SafeAAD dictionary generator | TypeScript SafeAAD and capability handling | PASS, including dictionary mutation |

The dossier validator also verifies the tested-source gitlinks, frozen lockfile identity, independent generator/subject languages, and 30 mutation classes.

## Failure and repair ledger

| Attempt | Classification | Repair | Release-evidence disposition |
| --- | --- | --- | --- |
| Run `34053723452`, attempt 1 | Checkout infrastructure: unpublished local `ts-mls` gitlink object | Published exactly `af6d1c599f2912fda5fbcac1b461fdd3013e37c7` to its source repository | Rejected; no runtime or test steps ran |
| Run `34053723452`, attempt 2 | Node 20 test compatibility: `Promise.withResolvers` unavailable; fail-fast canceled remaining Node work | Replaced the test-only primitive with a portable Promise in `c399203cd0de4db45b3b39d3b49ab27da9b8f075`; full Node 20 normal and extended suites passed locally | Rejected; matrix was incomplete |
| Run `34054220800`, attempt 1 | None | None | Accepted; all six rows and both suites passed |

## Requirement mapping

| Requirement | Evidence | Status |
| --- | --- | --- |
| QA-01 | Authenticated run `34054220800`; six immutable job IDs; resolved runtimes; pnpm 10; frozen installs; normal and extended counts | PASS |
| QA-02 | Four detached-source Rust/TypeScript dossiers, common source tuple, byte-for-byte fixture diffs, and negative controls | PASS |

## Reproduction and validation

```bash
node scripts/validate-quality-dossiers.mjs
node scripts/validate-quality-ci.mjs .planning/phases/05-quality-gate/05-CI-EVIDENCE.json
```

Both commands must pass. The CI validator rejects wrong source SHAs, mutable URLs, missing or duplicate matrix rows, non-pnpm-10 execution, non-frozen installation, failed jobs, and missing normal or extended suite evidence.
