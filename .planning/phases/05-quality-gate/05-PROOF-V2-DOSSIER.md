# Proof-v2 Cross-Implementation Dossier

## Provenance

Evidence captured at `2026-09-06T18:17:22Z` (UTC).

| Artifact | Revision |
| --- | --- |
| marmot-ts implementation | `ccdff084f18e4da4de1ff94c92e86132f1264577` |
| Marmot specification (`refs/marmot`) | `4a2bc65f8db5866cec3b2a127dedb37818eaf207` |
| MDK reference (`refs/mdk`) | `dbf45c83a8e157302edd13010944ad2c6a9cf9a5` |

Toolchain: `rustc 1.97.1 (8bab26f4f 2026-07-14)`, `cargo 1.97.1 (c980f4866 2026-06-30)`, Node `v22.23.1`, pnpm `12.3.4`, Vitest `3.2.7`.

## Independent Rust Reproduction

The owned probe at `tools/quality-gate/proof-v2-probe` has a path dependency on MDK's `cgka-engine`. It refuses to run unless `refs/mdk` is exactly `dbf45c83a8e157302edd13010944ad2c6a9cf9a5`. Fixed SHA-256-derived account and MLS leaf signing seeds make its BIP-340 output deterministic. The probe calls MDK's canonical event builder, signed-event validator, and legacy proof-extension encoder; it does not derive expected bytes from TypeScript.

Exact generation command:

```sh
cargo run --quiet --manifest-path tools/quality-gate/proof-v2-probe/Cargo.toml --locked > src/__tests__/fixtures/proof-v2-rust.json
```

Exact reproducibility check:

```sh
test "$(git -C refs/mdk rev-parse HEAD)" = dbf45c83a8e157302edd13010944ad2c6a9cf9a5 && cargo run --quiet --manifest-path tools/quality-gate/proof-v2-probe/Cargo.toml --locked | diff -u src/__tests__/fixtures/proof-v2-rust.json -
```

Actual result: exit `0`, with no diff output. The emitted stream and checked-in fixture both have SHA-256 `a106630044c129b7621fddf6c7a5ab1976afe6b5a785aab68925c3270b0c560f`; the fixture is 946 bytes including its trailing newline.

## Rust-Produced Fixture

| Field | Value |
| --- | --- |
| profile | `legacy-version-byte-2` |
| version | `2` |
| account identity | `67d3ed702d55d4c049de6e43ead43a9b9cf1b4976f40a7357673b1acbf8f34b0` |
| MLS signature key | `9f228d14a7609599c4971bd0f65f43ae7d00b0a50ccfc021e95ca7fd825197ac` |
| ciphersuite | `1` |
| signature scheme | `2055` (`0x0807`, Ed25519) |
| event id | `29e15f6d6dacb28ba1a806829ec7016709cad47cd998eb620558d7df0a39ec18` |
| 64-byte signature | `7cbce4eb7989be74a5936779acfa09fa3c00594bc234b337a104683dee33c0c651a6e87b02981bd670ca3aeb7b4ce0ba2d6b03e8cb0bae1ce557ef7ece69e74e` |
| proof bytes | `020001080767d3ed702d55d4c049de6e43ead43a9b9cf1b4976f40a7357673b1acbf8f34b000209f228d14a7609599c4971bd0f65f43ae7d00b0a50ccfc021e95ca7fd825197ac7cbce4eb7989be74a5936779acfa09fa3c00594bc234b337a104683dee33c0c651a6e87b02981bd670ca3aeb7b4ce0ba2d6b03e8cb0bae1ce557ef7ece69e74e` |

## TypeScript Production Verification

Exact command:

```sh
pnpm vitest run src/__tests__/conformance/proof-v2-parity.test.ts
```

Actual output:

```text
✓ src/__tests__/conformance/proof-v2-parity.test.ts (2 tests) 24ms
Test Files  1 passed (1)
Tests       2 passed (2)
Duration    2.71s
```

The parity test loads only the Rust-produced fixture for expected bytes. It passes the encoded proof through shipping `decodeAccountIdentityProof`, recomputes the canonical event id with `accountIdentityProofEventId`, verifies the Schnorr signature, and exercises the complete shipping `verifyLeafAccountIdentityProof` path on a LeafNode carrying extension `0xf2f1`.

## Sensitivity / Negative Controls

The second permanent test changes the first byte of the canonical event's MLS signature-key input while retaining the Rust signature; Schnorr verification returns `false`. It independently flips the final signature byte in the encoded proof; the production leaf verifier throws `proof signature does not verify for credential identity`. Thus a passing comparison is sensitive to mutations of both canonical event data and signature bytes.

## Profile Distinction

This fixture covers MDK's deployed legacy carrier: custom LeafNode extension `0xf2f1` whose proof starts with version byte `2`, uses timestamp `0`, empty content, and the legacy `extension`/`version` tags. “Legacy” describes the carrier/profile, not a proof-v1 payload.

At pinned MDK `dbf45c83`, the current profile is distinct: account-identity-proof component `0x8009` is stored in `app_data_dictionary` as a 104-byte `account_identity || created_at || signature` value and signs the current component-tag event shape. No claim in this dossier treats the legacy version-byte-2 fixture as current-component byte parity.

## Result

PASS — MDK `dbf45c83` independently and reproducibly emits the pinned legacy proof-v2 bytes; the production TypeScript proof and leaf-verification functions accept them exactly, while both canonical-data and signature mutations are rejected.
