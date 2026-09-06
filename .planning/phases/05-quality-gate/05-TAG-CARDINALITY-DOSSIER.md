# Tag Cardinality Cross-Implementation Dossier

This document is an attestation template. Evidence is populated only from a detached worktree at the immutable tested source.

<!-- quality-dossier-evidence:start -->
```json
{
  "schema_version": 1,
  "dossier": "tag-cardinality",
  "provenance": {
    "tested_source_sha": "",
    "marmot_sha": "",
    "mdk_sha": "",
    "lockfile_sha256": ""
  },
  "environment": {
    "detached_worktree": false,
    "node_version": "",
    "pnpm_version": "",
    "install_command": "",
    "install_result": "",
    "post_install_lockfile_sha256": ""
  },
  "verification": {
    "compile_command": "",
    "compile_result": "",
    "build_command": "",
    "build_result": "",
    "rust_command": "",
    "rust_output_or_digest": "",
    "fixture_diff_result": "",
    "typescript_command": "",
    "typescript_output": ""
  },
  "oracle": {
    "generator_language": "Rust",
    "generator_path": "tools/quality-gate/tag-probe/src/main.rs",
    "subject_language": "TypeScript",
    "subject_paths": [
      "src/core/__tests__/key-package-tag-parity.test.ts"
    ],
    "independence": "independent",
    "source_classification": "rust-producer-and-spec-receiver"
  },
  "negative_control": {
    "command": "",
    "result": ""
  }
}
```
<!-- quality-dossier-evidence:end -->

## Result

Pending immutable-source execution.

