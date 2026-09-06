# Tag Cardinality Cross-Implementation Dossier

Evidence captured on 2026-09-06 UTC from a detached worktree at the immutable tested source. This attestation was written later and does not redefine the tested source.

<!-- quality-dossier-evidence:start -->
```json
{
  "schema_version": 1,
  "dossier": "tag-cardinality",
  "provenance": {
    "tested_source_sha": "b937e3f3e4fddcb6e48aff4ca6507623504be48d",
    "marmot_sha": "4a2bc65f8db5866cec3b2a127dedb37818eaf207",
    "mdk_sha": "dbf45c83a8e157302edd13010944ad2c6a9cf9a5",
    "lockfile_sha256": "0f516945e45e257735c4c89a5e9e08b4bb2f839b7ce48121a71b4fb0b03a0932"
  },
  "environment": {
    "detached_worktree": true,
    "node_version": "v22.23.1",
    "pnpm_version": "10.18.3",
    "install_command": "CI=true npx --yes pnpm@10.18.3 install --frozen-lockfile",
    "install_result": "PASS: 816 packages installed; prepare built ts-mls; lockfile unchanged",
    "post_install_lockfile_sha256": "0f516945e45e257735c4c89a5e9e08b4bb2f839b7ce48121a71b4fb0b03a0932"
  },
  "verification": {
    "compile_command": "CI=true npx --yes pnpm@10.18.3 compile",
    "compile_result": "PASS: tsc -b tsconfig.build.json, exit 0",
    "build_command": "CI=true npx --yes pnpm@10.18.3 build",
    "build_result": "PASS: clean plus compile, exit 0",
    "rust_command": "CARGO_TARGET_DIR=/home/user/Projects/marmot-ts/tools/quality-gate/tag-probe/target cargo run --quiet --manifest-path tools/quality-gate/tag-probe/Cargo.toml --locked | diff -u src/__tests__/fixtures/key-package-tags-rust.json -",
    "rust_output_or_digest": "PASS: no diff; fixture SHA-256 72449286faac63fbc300c8972386430406ba947a4a0784b8a4d9aca13714bf80",
    "fixture_diff_result": "PASS: exit 0, no output",
    "typescript_command": "CI=true npx --yes pnpm@10.18.3 vitest run src/__tests__/conformance/proof-v2-parity.test.ts src/core/__tests__/key-package-lifetime-parity.test.ts src/core/__tests__/key-package-tag-parity.test.ts src/core/components/__tests__/safe-aad-parity.test.ts",
    "typescript_output": "PASS: 4 files, 68 tests, Vitest 3.2.6, duration 2.98s"
  },
  "oracle": {
    "generator_language": "Rust",
    "generator_path": "tools/quality-gate/tag-probe/src/main.rs",
    "subject_language": "TypeScript",
    "subject_paths": [
      "src/core/__tests__/key-package-tag-parity.test.ts",
      "src/utils/tag-cardinality.ts"
    ],
    "independence": "independent",
    "source_classification": "rust-producer-and-spec-receiver"
  },
  "negative_control": {
    "command": "CI=true npx --yes pnpm@10.18.3 vitest run src/__tests__/conformance/proof-v2-parity.test.ts src/core/__tests__/key-package-lifetime-parity.test.ts src/core/__tests__/key-package-tag-parity.test.ts src/core/components/__tests__/safe-aad-parity.test.ts -t 'rejects canonical-event and signature mutations|negative control detects a one-second cap mutation|negative control detects a canonical tag mutation|detects a one-byte dictionary mutation'",
    "result": "PASS: 4 mutation controls passed; 64 nonmatching tests skipped"
  }
}
```
<!-- quality-dossier-evidence:end -->

## Result

PASS — the independent Rust fixture reproduced byte-for-byte, shipping TypeScript verification passed, and the dossier-specific mutation control rejected altered evidence.

