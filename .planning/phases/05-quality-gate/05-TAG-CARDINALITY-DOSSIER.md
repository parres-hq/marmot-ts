# Tag Cardinality Cross-Implementation Dossier

## Provenance

Evidence captured on 2026-09-06 UTC.

| Artifact | Revision |
| --- | --- |
| marmot-ts implementation | `15550921c93353bd4d8faa7b77c70b7797044a7b` |
| Marmot specification (`refs/marmot`) | `4a2bc65f8db5866cec3b2a127dedb37818eaf207` |
| MDK reference (`refs/mdk`) | `dbf45c83a8e157302edd13010944ad2c6a9cf9a5` |

Toolchain: `rustc 1.97.1 (8bab26f4f 2026-07-14)`, `cargo 1.97.1 (c980f4866 2026-06-30)`, Node `v22.23.1`, local pnpm `12.3.4`, and Vitest `3.2.7`. CI remains pinned to pnpm 10 with `--frozen-lockfile`; this dossier adds no package-manager dependency.

## Rust-produced kind-30443 evidence

This section is the only Rust-produced evidence in this dossier. The owned probe at `tools/quality-gate/tag-probe` has path dependencies on MDK's public `transport-nostr-adapter`, `cgka-engine`, and `cgka-traits` crates. It refuses to run unless `refs/mdk` is exactly `dbf45c83a8e157302edd13010944ad2c6a9cf9a5`.

The probe passes fixed publication fields and the deterministic KeyPackage bytes from the lifetime dossier to `NostrKeyPackagePublication::to_event_at`. MDK produces this exact unsigned kind-30443 tag array, including order:

```json
[
  ["d", "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1"],
  ["mls_protocol_version", "1.0"],
  ["i", "3c20ae45aa82f20b69836e446e2fc15cac2cc220eaef5e5bc33b9c0586e9023e"],
  ["mls_ciphersuite", "0x0001"],
  ["mls_extensions", "0x0006"],
  ["mls_proposals", "0x0008"],
  ["app_components", "0x8001", "0x8003", "0x8004", "0x8005", "0x8006", "0x8007", "0x8008", "0x800c"]
]
```

The SHA-256 of the compact JSON encoding of that array is `7d68975a5864f568ed147fb2bb6ca5d9b9ec40e9992b8d42392f664688cb1c4b`. The complete 727-byte checked-in fixture has file SHA-256 `72449286faac63fbc300c8972386430406ba947a4a0784b8a4d9aca13714bf80`.

Exact generation command:

```sh
cargo run --quiet --manifest-path tools/quality-gate/tag-probe/Cargo.toml --locked > src/__tests__/fixtures/key-package-tags-rust.json
```

Exact locked reproduction command:

```sh
test "$(git -C refs/mdk rev-parse HEAD)" = dbf45c83a8e157302edd13010944ad2c6a9cf9a5 && cargo run --quiet --manifest-path tools/quality-gate/tag-probe/Cargo.toml --locked | diff -u src/__tests__/fixtures/key-package-tags-rust.json -
```

Actual result: exit `0` with no diff. The TypeScript parity test decodes the same fixed MLS KeyPackage through shipping `ts-mls`, calls production `createKeyPackageEvent`, and compares the complete ordered tag array with this Rust-produced fixture.

### Rust/TypeScript mutation control

The permanent parity test copies the canonical array and changes only the `d` value from `a1…a1` to `ff…ff`. The complete-array comparison rejects the mutation. This proves the producer parity assertion is sensitive to the exact ordered bytes rather than merely checking tag names.

## Specification-derived inbound rejection evidence

This section is not Rust-produced evidence. MDK exposes no general inbound cardinality oracle for all Marmot Nostr event shapes. The authority here is the “Event identity and tag cardinality” table in `refs/marmot/transports/nostr.md` at specification SHA `4a2bc65f8db5866cec3b2a127dedb37818eaf207`; the executable evidence is the TypeScript `TAG_CARDINALITY`, `getSingletonTagValue`, and `getListTag` test matrix.

| Event kind | Required tag | Rule | Missing | Repeated | Empty/no value | Extra value | Duplicate list value | Evidence source |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 445 | `h` | singleton | reject | reject | reject | reject | n/a | specification-derived |
| 1059 | `p` | singleton | reject | reject | reject | reject | n/a | specification-derived |
| 444 | `e` | singleton | reject | reject | reject | reject | n/a | specification-derived |
| 444 | `relays` | list | reject | reject | reject | n/a | reject | specification-derived |
| 30443 | `d` | singleton | reject | reject | reject | reject | n/a | specification-derived |
| 30443 | `i` | singleton | reject | reject | reject | reject | n/a | specification-derived |
| 30443 | `mls_protocol_version` | singleton | reject | reject | reject | reject | n/a | specification-derived |
| 30443 | `mls_ciphersuite` | list | reject | reject | reject | n/a | reject | specification-derived |
| 30443 | `mls_extensions` | list | reject | reject | reject | n/a | reject | specification-derived |
| 30443 | `mls_proposals` | list | reject | reject | reject | n/a | reject | specification-derived |
| 30443 | `app_components` | list | reject | reject | reject | n/a | reject | specification-derived |

For singleton rows, “empty/no value” covers both a tag with no value slot and a tag with an empty string; “extra value” covers any additional slot. For list rows, it covers a tag with no values and a list containing an empty string. Every list row separately exercises duplicate-value rejection.

Exact combined verification command:

```sh
test "$(git -C refs/mdk rev-parse HEAD)" = dbf45c83a8e157302edd13010944ad2c6a9cf9a5 && cargo run --quiet --manifest-path tools/quality-gate/tag-probe/Cargo.toml --locked | diff -u src/__tests__/fixtures/key-package-tags-rust.json - && pnpm vitest run src/core/__tests__/key-package-tag-parity.test.ts src/utils/__tests__/tag-cardinality.test.ts src/core/__tests__/key-package-event.test.ts
```

Actual result: 3 files passed and 101 tests passed. `pnpm compile` also passed.

## Attribution boundary and result

PASS — MDK `dbf45c83` independently produces the exact canonical kind-30443 tag array and order consumed by the TypeScript parity test. Separately, the Marmot transport specification defines the complete inbound rejection matrix, and TypeScript rejects every required missing, repeated, empty, extra-singleton, and duplicate-list shape. No inbound rejection result in this dossier is represented as Rust-produced evidence.
