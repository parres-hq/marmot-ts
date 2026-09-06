# KeyPackage Lifetime and Capability-Delta Dossier

This document is an attestation template. Evidence is populated only from a detached worktree at the immutable tested source.

<!-- quality-dossier-evidence:start -->
```json
{
  "schema_version": 1,
  "dossier": "key-package-lifetime",
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
    "generator_path": "tools/quality-gate/lifetime-probe/src/main.rs",
    "subject_language": "TypeScript",
    "subject_paths": [
      "src/core/__tests__/key-package-lifetime-parity.test.ts"
    ],
    "independence": "independent"
  },
  "negative_control": {
    "command": "",
    "result": ""
  },
  "review": {
    "b4649c01_sha": "b4649c015dc154e561d0f61147486142114d887a",
    "b4649c01_result": ""
  }
}
```
<!-- quality-dossier-evidence:end -->

## Result

Pending immutable-source execution.

