# SafeAAD and Leaf Capability Parity Dossier

## Provenance

Evidence captured on 2026-09-06 UTC.

| Artifact | Revision |
| --- | --- |
| marmot-ts implementation | `4b4226455dc1b67da94a3a61b3ba8808c3fdbd88` |
| Marmot specification (`refs/marmot`) | `4a2bc65f8db5866cec3b2a127dedb37818eaf207` |
| MDK reference (`refs/mdk`) | `dbf45c83a8e157302edd13010944ad2c6a9cf9a5` |
| capability behavior change | `b4649c015dc154e561d0f61147486142114d887a` |
| OpenMLS fork | `59e7d3b27a7e95237879dd5478de1fd90eff7ada` |

Toolchain: `rustc 1.97.1 (8bab26f4f 2026-07-14)`, `cargo 1.97.1 (c980f4866 2026-06-30)`, Node `v22.23.1`, local pnpm `12.3.4`, and Vitest `3.2.7`. CI remains pinned to pnpm 10. The root `pnpm-lock.yaml` SHA-256 stayed `0f516945e45e257735c4c89a5e9e08b4bb2f839b7ce48121a71b4fb0b03a0932`.

## Genuine MDK Extraction Path

The owned probe at `tools/quality-gate/safe-aad-probe` builds an actual current-profile `cgka_engine::Engine<SqliteAccountStorage>` through the public `EngineBuilder` pattern used by `refs/mdk/crates/cgka-engine/tests/group_creation.rs`. It supplies a valid Nostr identity, account-proof signer, and transport peeler, then calls the public trait method `cgka_traits::CgkaEngine::fresh_key_package(&mut engine)`.

The probe parses only the returned MDK-owned `KeyPackage::bytes()` as `MlsMessageIn`, validates the KeyPackage, obtains its real LeafNode, and reads `leaf.extensions().app_data_dictionary().dictionary()`. It neither calls nor copies the private `leaf_app_components_extension` implementation.

Current-profile account-proof component `0x8009` embeds a creation timestamp and signature. Therefore the complete real leaf dictionary varies across independent engine construction. Per the plan's deterministic-projection allowance, the checked fixture serializes the exact extracted SafeAAD entry alone as a stable `app_data_dictionary` projection; no component value is recreated.

Generation:

```sh
cargo run --quiet --manifest-path tools/quality-gate/safe-aad-probe/Cargo.toml --locked > src/__tests__/fixtures/safe-aad-rust.json
```

Pinned reproduction:

```sh
test "$(git -C refs/mdk rev-parse HEAD)" = dbf45c83a8e157302edd13010944ad2c6a9cf9a5 && cargo run --quiet --manifest-path tools/quality-gate/safe-aad-probe/Cargo.toml --locked | diff -u src/__tests__/fixtures/safe-aad-rust.json -
```

Actual result: exit `0`, no diff. Fixture file SHA-256: `e0aa57f747c2cd308be0f78d3206a2ac621f07fb2510d082501f68c7158bf2c7`.

## Exact SafeAAD Bytes

| Field | Exact value |
| --- | --- |
| component id | `0x0002` |
| component value | `00` |
| serialized one-entry dictionary projection | `0400020100` |
| projection SHA-256 | `1488eb12e7041072e9446639f22054ed76cfdc3c53680f401ebeddb56924cc74` |

The leading `04` is the encoded byte length of the dictionary contents; `0002` is the SafeAAD component id; `01` is the component-value length; and `00` is `encode_components_list(empty)`. Shipping TypeScript extracts its LeafNode SafeAAD value and serializes the same stable projection to exactly `0400020100`.

The real current MDK leaf's `app_components` advertisement is `[1,32769,32771,32777,32780]`, or `[0x0001,0x8001,0x8003,0x8009,0x800c]`. The `0x8009` account-proof component explains why projecting only SafeAAD is necessary for stable byte evidence.

## Scope and Negative Controls

- Leaf scope: the fixture comes from a validated LeafNode embedded in the genuine MDK KeyPackage output, and both implementations expose SafeAAD value `00` there.
- GroupContext scope: shipping `makeAppComponentsExtension` rejects a `0x0002` entry with the explicit LeafNode-only error.
- Mutation sensitivity: the permanent TypeScript test changes the dictionary byte-length prefix from `04` to `05`; the production dictionary decoder rejects the truncated claim. It also asserts the mutated hex differs from the Rust fixture.

Focused verification:

```sh
pnpm vitest run src/core/components/__tests__/safe-aad-parity.test.ts src/core/components/__tests__/dictionary.test.ts src/core/__tests__/key-package.test.ts
```

Actual result: 3 files passed, 26 tests passed. `pnpm compile` also passed.

## `b4649c01` Capability Delta

MDK commit `b4649c01` changed the signed LeafNode capability contract: RFC 9420 default extension types `1..=5` and proposal types `1..=7` are implicit support and must not appear in signed advertisements. Internal compatibility checks add them only to effective support.

The genuine current MDK KeyPackage now signs extensions `[6]` and proposals `[8]`; its effective projections are extensions `[1,2,3,4,5,6]` and proposals `[1,2,3,4,5,6,7,8]`. The permanent TypeScript control independently filters GREASE, proves every RFC-default id is absent from its signed advertisement, and proves the non-default `app_data_dictionary` (`6`) and `app_data_update` (`8`) capabilities remain present. TypeScript may advertise additional non-default protocol capabilities; these do not weaken the default-omission invariant introduced by `b4649c01`.

This regenerated evidence is intentionally tied to `dbf45c83`, which contains `b4649c01`; the pre-change signed-capability shape is not reused.

## Result

PASS — SafeAAD value and serialized stable dictionary projection are byte-identical after extraction from a genuine MDK `Engine::fresh_key_package` result, LeafNode/GroupContext scopes are enforced, the byte mutation is rejected, and the post-`b4649c01` signed-versus-effective capability distinction is executable and pinned.
