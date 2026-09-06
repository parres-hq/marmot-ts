# KeyPackage Lifetime and Capability-Delta Dossier

## Provenance

Evidence captured on 2026-09-06 UTC.

| Artifact | Revision |
| --- | --- |
| marmot-ts implementation | `baae3f4b14a16372eb718fa972209f701afbd6ec` |
| Marmot specification (`refs/marmot`) | `4a2bc65f8db5866cec3b2a127dedb37818eaf207` |
| MDK reference (`refs/mdk`) | `dbf45c83a8e157302edd13010944ad2c6a9cf9a5` |
| OpenMLS fork | `59e7d3b27a7e95237879dd5478de1fd90eff7ada` |
| capability behavior change | `b4649c015dc154e561d0f61147486142114d887a` |

Toolchain: `rustc 1.97.1 (8bab26f4f 2026-07-14)`, `cargo 1.97.1 (c980f4866 2026-06-30)`, Node `v22.23.1`, local pnpm `12.3.4`, and Vitest `3.2.7`. CI remains pinned to pnpm 10 with `--frozen-lockfile`; no dependency installation or lockfile change is part of this dossier.

## Deterministic Rust Reproduction

The owned probe at `tools/quality-gate/lifetime-probe` uses path dependencies on MDK's `cgka-engine` and `cgka-traits` plus MDK's exact OpenMLS revision. It refuses to run unless `refs/mdk` is exactly `dbf45c83a8e157302edd13010944ad2c6a9cf9a5`.

The probe injects fixed Ed25519 leaf-signing material, a deterministic OpenMLS randomness provider, a fixed Nostr proof key, and validation time `1788718800`. Thus both the complete MLS-framed KeyPackage and its versioned public projection are stable. Boundary evaluation calls the same OpenMLS `Lifetime::validate_with_time` and `Lifetime::has_acceptable_range` methods used by MDK's `validate_key_package`; the fixed clock avoids wall-clock drift.

Exact generation command:

```sh
cargo run --quiet --manifest-path tools/quality-gate/lifetime-probe/Cargo.toml --locked > src/__tests__/fixtures/key-package-lifetime-rust.json
```

Exact locked reproduction command:

```sh
test "$(git -C refs/mdk rev-parse HEAD)" = dbf45c83a8e157302edd13010944ad2c6a9cf9a5 && cargo run --quiet --manifest-path tools/quality-gate/lifetime-probe/Cargo.toml --locked | diff -u src/__tests__/fixtures/key-package-lifetime-rust.json -
```

Actual result: exit `0` with no diff. The 2,748-byte fixture has file SHA-256 `f03f483508b155f22869c4f0c97b7a8fd01456ee7a7555e999b882f334089997`.

## Fixed Lifetime and KeyPackage Evidence

| Field | Value |
| --- | --- |
| projection schema | `1` |
| validation time | `1788718800` |
| `not_before` | `1788715200` |
| `not_after` | `1795976400` |
| decoded range | `7,261,200` seconds |
| serialized TLS `Lifetime` | `000000006a9da0c0000000006b0c6cd0` |
| projection SHA-256 | `dc43f12e19dfa38135b944c61d9dfc12543188e14adf611cff0439e0aa2c2452` |
| deterministic MLS-framed KeyPackage SHA-256 | `d01f7fb2af47fa845c4137992994c5170cf695bf13517199f1dcdabdd29b6615` |

The fixture contains the complete deterministic KeyPackage TLS hex. The TypeScript parity test hashes those exact bytes, decodes them with shipping `ts-mls` `mlsMessageDecoder`, confirms `wire_format = mls_key_package`, and compares the decoded leaf lifetime to the Rust integers. It then feeds every Rust boundary row through shipping `isLifetimeWithinCap` or `isLifetimeCurrentWithGrace` as appropriate.

The locally produced default remains deliberately smaller: `7,257,600` seconds (84 days), distinct from the accepted maximum of `7,261,200` seconds (84 days plus one hour).

## Boundary Matrix

| Case | `not_before` | `not_after` | Range | Current at fixed clock | MDK/OpenMLS result |
| --- | ---: | ---: | ---: | --- | --- |
| accepted cap | `1788715200` | `1795976400` | `7,261,200` | yes | accepted |
| one over | `1788715200` | `1795976401` | `7,261,201` | yes | rejected: unacceptable range |
| expired | `1788708800` | `1788711599` | `2,799` | no | rejected: expired |
| not yet current | `1788726001` | `1788728800` | `2,799` | no | rejected: not valid yet |

The future and expired fixtures sit 7,201 seconds outside the fixed clock. This keeps them outside marmot-ts's symmetric one-hour tolerance as well as outside OpenMLS's strict current interval, so both implementations agree on the disposition without conflating clock-skew policy with the range cap.

## Negative Control

The permanent test derives a mutation from the accepted row by increasing only `not_after` by one second. Shipping `isLifetimeWithinCap` rejects the resulting `7,261,201`-second range. This proves the passing cap assertion is sensitive to the exact boundary instead of merely accepting all decoded fixture data.

Exact TypeScript command:

```sh
pnpm vitest run src/core/__tests__/key-package-lifetime-parity.test.ts src/core/__tests__/key-package.test.ts src/core/__tests__/key-package-event.test.ts
```

Actual result: 3 files passed, 50 tests passed. `pnpm compile` also passed, and the SHA-256 of `pnpm-lock.yaml` remained `0f516945e45e257735c4c89a5e9e08b4bb2f839b7ce48121a71b4fb0b03a0932` before and after every pnpm command.

## `b4649c01` Signed-Capability Delta

MDK commit `b4649c01` (`fix(engine): keep default MLS capabilities implicit (#1709)`) separated effective support from signed advertisement:

- RFC 9420 default extension types `1..=5` and proposal types `1..=7` are implicit support and are omitted from a signed LeafNode capability list.
- Internal compatibility checks expand those defaults with `with_implicit_default_capabilities`.
- Wire-facing `key_package_metadata` now reads `advertised_capabilities_of_leaf`, preventing implicit values from being projected back into publication metadata.

The deterministic current-profile KeyPackage therefore signs only extension `[6]` (`app_data_dictionary`) and proposal `[8]` (`app_data_update`). Its effective support projection is extensions `[1,2,3,4,5,6]` and proposals `[1,2,3,4,5,6,7,8]`.

Its advertised app components are `[1,32769,32771,32777,32780]`, corresponding to the app-components list carrier `0x0001`, group profile `0x8001`, admin policy `0x8003`, account identity proof `0x8009`, and lifecycle `0x800c`. These are explicit component advertisements; the RFC implicit-default rule applies only to the MLS extension/proposal namespaces.

## Result

PASS — at MDK `dbf45c83`, the fixed-time KeyPackage bytes, decoded lifetime, exact cap boundary, expired/future outcomes, and post-`b4649c01` signed-versus-effective capability shapes are deterministic and reproduced by the shipping TypeScript decoder and policy functions.
