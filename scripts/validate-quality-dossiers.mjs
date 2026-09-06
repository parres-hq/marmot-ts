#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const phaseDir = join(root, ".planning/phases/05-quality-gate");
const schema = JSON.parse(
  readFileSync(join(phaseDir, "05-DOSSIER-SCHEMA.json"), "utf8"),
);
const dossierFiles = {
  "proof-v2": "05-PROOF-V2-DOSSIER.md",
  "key-package-lifetime": "05-KEY-PACKAGE-LIFETIME-DOSSIER.md",
  "tag-cardinality": "05-TAG-CARDINALITY-DOSSIER.md",
  "safe-aad": "05-SAFE-AAD-DOSSIER.md",
};
const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const B464_SHA = "b4649c015dc154e561d0f61147486142114d887a";

function fail(message) {
  throw new Error(message);
}

function valueAt(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function requirePath(object, path, dossier) {
  const value = valueAt(object, path);
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    fail(`${dossier}: missing required field ${path}`);
  }
}

function parseEvidence(file) {
  const markdown = readFileSync(file, "utf8");
  const start = markdown.indexOf(schema.evidence_markers.start);
  const end = markdown.indexOf(schema.evidence_markers.end);
  if (start < 0 || end <= start) fail(`${basename(file)}: evidence markers missing`);
  const block = markdown.slice(start + schema.evidence_markers.start.length, end);
  const match = block.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) fail(`${basename(file)}: JSON evidence block missing`);
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    fail(`${basename(file)}: invalid evidence JSON: ${error.message}`);
  }
}

function gitlinkAt(sourceSha, path) {
  const line = execFileSync("git", ["ls-tree", sourceSha, path], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const match = line.match(/^160000 commit ([0-9a-f]{40})\t/);
  if (!match) fail(`${sourceSha}: ${path} is not a committed gitlink`);
  return match[1];
}

function validateEvidence(evidence, expectedDossier) {
  for (const path of schema.required_paths) requirePath(evidence, path, expectedDossier);
  for (const path of schema.conditional_required_paths[expectedDossier] ?? []) {
    requirePath(evidence, path, expectedDossier);
  }
  if (evidence.schema_version !== schema.schema_version)
    fail(`${expectedDossier}: unsupported schema_version`);
  if (evidence.dossier !== expectedDossier) fail(`${expectedDossier}: dossier id mismatch`);
  const provenance = evidence.provenance;
  for (const key of ["tested_source_sha", "marmot_sha", "mdk_sha"]) {
    if (!SHA40.test(provenance[key])) fail(`${expectedDossier}: ${key} must be 40-hex`);
  }
  for (const key of ["lockfile_sha256"]) {
    if (!SHA64.test(provenance[key])) fail(`${expectedDossier}: ${key} must be 64-hex`);
  }
  if (!SHA64.test(evidence.environment.post_install_lockfile_sha256))
    fail(`${expectedDossier}: post-install lock hash must be 64-hex`);
  if (provenance.lockfile_sha256 !== evidence.environment.post_install_lockfile_sha256)
    fail(`${expectedDossier}: frozen install changed pnpm-lock.yaml`);
  if (evidence.environment.detached_worktree !== true)
    fail(`${expectedDossier}: verification was not run in a detached worktree`);
  if (!evidence.environment.install_command.includes("pnpm@10.18.3 install --frozen-lockfile"))
    fail(`${expectedDossier}: install command is not pinned and frozen`);
  if (!evidence.verification.rust_command.includes("cargo run") || !evidence.verification.rust_command.includes("--locked"))
    fail(`${expectedDossier}: Rust extraction command must use cargo run --locked`);
  if (!evidence.verification.typescript_command.includes("pnpm@10.18.3"))
    fail(`${expectedDossier}: TypeScript command must use pinned pnpm`);
  if (evidence.oracle.generator_language !== "Rust" || evidence.oracle.subject_language !== "TypeScript")
    fail(`${expectedDossier}: independent Rust/TypeScript oracle languages required`);
  if (!evidence.oracle.generator_path.startsWith("tools/quality-gate/") || !evidence.oracle.generator_path.endsWith(".rs"))
    fail(`${expectedDossier}: invalid Rust generator path`);
  if (!evidence.oracle.subject_paths.every((path) => path.endsWith(".ts")))
    fail(`${expectedDossier}: subject_paths must identify TypeScript sources`);
  if (evidence.oracle.independence !== "independent")
    fail(`${expectedDossier}: oracle independence must be declared`);
  if (!/pass/i.test(evidence.negative_control.result))
    fail(`${expectedDossier}: negative control did not pass`);
  if (expectedDossier === "tag-cardinality" && evidence.oracle.source_classification !== "rust-producer-and-spec-receiver")
    fail(`${expectedDossier}: D-05 source classification missing or incorrect`);
  if (["key-package-lifetime", "safe-aad"].includes(expectedDossier)) {
    if (evidence.review.b4649c01_sha !== B464_SHA || !/pass|reviewed/i.test(evidence.review.b4649c01_result))
      fail(`${expectedDossier}: D-06/b4649c01 review missing or incorrect`);
  }
  return evidence;
}

function validateDirectory(directory = phaseDir) {
  const records = Object.entries(dossierFiles).map(([id, file]) =>
    validateEvidence(parseEvidence(join(directory, file)), id),
  );
  const tuples = new Set(
    records.map(({ provenance: p }) =>
      [p.tested_source_sha, p.marmot_sha, p.mdk_sha, p.lockfile_sha256].join(":"),
    ),
  );
  if (tuples.size !== 1) fail("dossiers contain mixed or stale source tuples");
  const provenance = records[0].provenance;
  if (gitlinkAt(provenance.tested_source_sha, "refs/marmot") !== provenance.marmot_sha)
    fail("marmot_sha does not match the tested commit gitlink");
  if (gitlinkAt(provenance.tested_source_sha, "refs/mdk") !== provenance.mdk_sha)
    fail("mdk_sha does not match the tested commit gitlink");
  return records;
}

function sample(id, sourceSha, marmotSha, mdkSha) {
  return {
    schema_version: 1,
    dossier: id,
    provenance: { tested_source_sha: sourceSha, marmot_sha: marmotSha, mdk_sha: mdkSha, lockfile_sha256: "a".repeat(64) },
    environment: { detached_worktree: true, node_version: "v22", pnpm_version: "10.18.3", install_command: "CI=true npx --yes pnpm@10.18.3 install --frozen-lockfile", install_result: "PASS", post_install_lockfile_sha256: "a".repeat(64) },
    verification: { compile_command: "compile", compile_result: "PASS", build_command: "build", build_result: "PASS", rust_command: "cargo run --locked", rust_output_or_digest: "digest", fixture_diff_result: "PASS", typescript_command: "npx --yes pnpm@10.18.3 vitest run", typescript_output: "PASS" },
    oracle: { generator_language: "Rust", generator_path: `tools/quality-gate/${id}/main.rs`, subject_language: "TypeScript", subject_paths: ["src/example.ts"], independence: "independent", ...(id === "tag-cardinality" ? { source_classification: "rust-producer-and-spec-receiver" } : {}) },
    negative_control: { command: "mutate fixture", result: "PASS" },
    ...(["key-package-lifetime", "safe-aad"].includes(id) ? { review: { b4649c01_sha: B464_SHA, b4649c01_result: "reviewed PASS" } } : {}),
  };
}

function writeEvidence(file, evidence) {
  writeFileSync(file, `${schema.evidence_markers.start}\n\`\`\`json\n${JSON.stringify(evidence, null, 2)}\n\`\`\`\n${schema.evidence_markers.end}\n`);
}

function selfTest() {
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const marmotSha = gitlinkAt(sourceSha, "refs/marmot");
  const mdkSha = gitlinkAt(sourceSha, "refs/mdk");
  const directory = mkdtempSync(join(tmpdir(), "marmot-dossiers-"));
  try {
    for (const [id, file] of Object.entries(dossierFiles)) writeEvidence(join(directory, file), sample(id, sourceSha, marmotSha, mdkSha));
    validateDirectory(directory);
    const mutations = [...schema.required_paths, "mixed-tuple", "bad-gitlink"];
    for (const mutation of mutations) {
      const id = mutation.startsWith("review.") ? "safe-aad" : mutation === "oracle.source_classification" ? "tag-cardinality" : "proof-v2";
      const file = join(directory, dossierFiles[id]);
      const original = sample(id, sourceSha, marmotSha, mdkSha);
      if (mutation === "mixed-tuple") original.provenance.lockfile_sha256 = "b".repeat(64);
      else if (mutation === "bad-gitlink") original.provenance.mdk_sha = "b".repeat(40);
      else {
        const parts = mutation.split(".");
        const key = parts.pop();
        delete parts.reduce((value, part) => value[part], original)[key];
      }
      writeEvidence(file, original);
      let rejected = false;
      try { validateDirectory(directory); } catch { rejected = true; }
      if (!rejected) fail(`self-test mutation was accepted: ${mutation}`);
      writeEvidence(file, sample(id, sourceSha, marmotSha, mdkSha));
    }
    console.log(`PASS: accepted complete evidence and rejected ${mutations.length} mutation classes`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const records = validateDirectory();
  console.log(`PASS: validated ${records.length} dossiers at tested source ${records[0].provenance.tested_source_sha}`);
}
