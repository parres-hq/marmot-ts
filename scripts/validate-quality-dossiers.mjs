#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sharedRepositoryRoot = dirname(
  execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
);
const phaseDir = join(root, ".planning/phases/05-quality-gate");
const schema = JSON.parse(readFileSync(join(phaseDir, "05-DOSSIER-SCHEMA.json"), "utf8"));
const B464_SHA = "b4649c015dc154e561d0f61147486142114d887a";
const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const definitions = {
  "proof-v2": {
    dossier: "05-PROOF-V2-DOSSIER.md",
    fixture: "src/__tests__/fixtures/proof-v2-rust.json",
    manifest: "tools/quality-gate/proof-v2-probe/Cargo.toml",
    generator: "tools/quality-gate/proof-v2-probe/src/main.rs",
    subjects: ["src/__tests__/conformance/proof-v2-parity.test.ts"],
    control: "rejects canonical-event and signature mutations",
  },
  "key-package-lifetime": {
    dossier: "05-KEY-PACKAGE-LIFETIME-DOSSIER.md",
    fixture: "src/__tests__/fixtures/key-package-lifetime-rust.json",
    manifest: "tools/quality-gate/lifetime-probe/Cargo.toml",
    generator: "tools/quality-gate/lifetime-probe/src/main.rs",
    subjects: ["src/core/__tests__/key-package-lifetime-parity.test.ts"],
    control: "negative control detects a one-second cap mutation",
  },
  "tag-cardinality": {
    dossier: "05-TAG-CARDINALITY-DOSSIER.md",
    fixture: "src/__tests__/fixtures/key-package-tags-rust.json",
    manifest: "tools/quality-gate/tag-probe/Cargo.toml",
    generator: "tools/quality-gate/tag-probe/src/main.rs",
    subjects: [
      "src/core/__tests__/key-package-tag-parity.test.ts",
      "src/utils/tag-cardinality.ts",
    ],
    control: "negative control rejects a mutated Rust oracle through production parity",
  },
  "safe-aad": {
    dossier: "05-SAFE-AAD-DOSSIER.md",
    fixture: "src/__tests__/fixtures/safe-aad-rust.json",
    manifest: "tools/quality-gate/safe-aad-probe/Cargo.toml",
    generator: "tools/quality-gate/safe-aad-probe/src/main.rs",
    subjects: ["src/core/components/__tests__/safe-aad-parity.test.ts"],
    control: "detects a one-byte dictionary mutation",
  },
};

function fail(message) { throw new Error(message); }
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function git(args, options = {}) {
  return execFileSync("git", args, { cwd: root, encoding: null, ...options });
}
function committed(sourceSha, path) {
  try { return git(["show", `${sourceSha}:${path}`]); }
  catch { fail(`${sourceSha}: missing committed blob ${path}`); }
}
function gitlinkAt(sourceSha, path) {
  const line = git(["ls-tree", sourceSha, path], { encoding: "utf8" }).trim();
  const match = line.match(/^160000 commit ([0-9a-f]{40})\t/);
  if (!match) fail(`${sourceSha}: ${path} is not a committed gitlink`);
  return match[1];
}
function valueAt(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}
function requirePath(object, path, dossier) {
  const value = valueAt(object, path);
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))
    fail(`${dossier}: missing required field ${path}`);
}
function parseEvidence(file) {
  const markdown = readFileSync(file, "utf8");
  const start = markdown.indexOf(schema.evidence_markers.start);
  const end = markdown.indexOf(schema.evidence_markers.end);
  if (start < 0 || end <= start) fail(`${basename(file)}: evidence markers missing`);
  const match = markdown.slice(start + schema.evidence_markers.start.length, end).match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) fail(`${basename(file)}: JSON evidence block missing`);
  try { return JSON.parse(match[1]); }
  catch (error) { fail(`${basename(file)}: invalid evidence JSON: ${error.message}`); }
}

function validateRecord(evidence, id) {
  const definition = definitions[id];
  for (const path of schema.required_paths) requirePath(evidence, path, id);
  for (const path of schema.conditional_required_paths[id] ?? []) requirePath(evidence, path, id);
  if (evidence.schema_version !== schema.schema_version || evidence.dossier !== id)
    fail(`${id}: schema or dossier id mismatch`);
  const provenance = evidence.provenance;
  for (const key of ["tested_source_sha", "marmot_sha", "mdk_sha"])
    if (!SHA40.test(provenance[key])) fail(`${id}: ${key} must be 40-hex`);
  if (!SHA64.test(provenance.lockfile_sha256)) fail(`${id}: lockfile_sha256 must be 64-hex`);

  const lockHash = hash(committed(provenance.tested_source_sha, "pnpm-lock.yaml"));
  if (provenance.lockfile_sha256 !== lockHash || evidence.environment.post_install_lockfile_sha256 !== lockHash)
    fail(`${id}: lockfile digest differs from the tested commit`);
  if (gitlinkAt(provenance.tested_source_sha, "refs/marmot") !== provenance.marmot_sha ||
      gitlinkAt(provenance.tested_source_sha, "refs/mdk") !== provenance.mdk_sha)
    fail(`${id}: reference provenance differs from tested commit gitlinks`);

  const fixture = committed(provenance.tested_source_sha, definition.fixture);
  const fixtureHash = hash(fixture);
  if (!evidence.verification.rust_output_or_digest.includes(fixtureHash))
    fail(`${id}: recorded fixture digest differs from committed fixture bytes`);
  if (evidence.oracle.generator_path !== definition.generator ||
      JSON.stringify(evidence.oracle.subject_paths) !== JSON.stringify(definition.subjects))
    fail(`${id}: oracle paths differ from the reviewed independent call paths`);
  const generator = committed(provenance.tested_source_sha, definition.generator).toString("utf8");
  for (const subject of definition.subjects) {
    const source = committed(provenance.tested_source_sha, subject).toString("utf8");
    if (source.includes(definition.generator) || generator.includes(subject))
      fail(`${id}: Rust generator and TypeScript subject directly depend on each other`);
  }
  committed(provenance.tested_source_sha, definition.manifest);
  if (evidence.oracle.generator_language !== "Rust" || evidence.oracle.subject_language !== "TypeScript")
    fail(`${id}: independent Rust/TypeScript oracle languages required`);
  if (id === "tag-cardinality" && evidence.oracle.source_classification !== "rust-producer-and-spec-receiver")
    fail(`${id}: D-05 source classification missing or incorrect`);
  if (["key-package-lifetime", "safe-aad"].includes(id) && evidence.review.b4649c01_sha !== B464_SHA)
    fail(`${id}: D-06 review commit is not provenance-bound`);
  return { evidence, definition, fixture, fixtureHash };
}

function validateDirectory(directory = phaseDir) {
  const records = Object.entries(definitions).map(([id, definition]) =>
    validateRecord(parseEvidence(join(directory, definition.dossier)), id));
  const tuples = new Set(records.map(({ evidence: { provenance: p } }) =>
    [p.tested_source_sha, p.marmot_sha, p.mdk_sha, p.lockfile_sha256].join(":")));
  if (tuples.size !== 1) fail("dossiers contain mixed or stale source tuples");
  return records;
}

function runChecked(command, args, cwd, label, extraEnv = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, CI: "true", ...extraEnv } });
  if (result.status !== 0) fail(`${label} failed:\n${result.stdout}\n${result.stderr}`);
  return `${result.stdout}${result.stderr}`;
}

function replay(records) {
  const sourceSha = records[0].evidence.provenance.tested_source_sha;
  const worktree = mkdtempSync(join(tmpdir(), "marmot-dossier-replay-"));
  try {
    runChecked("git", ["worktree", "add", "--detach", worktree, sourceSha], root, "detached worktree creation");
    runChecked("git", ["submodule", "update", "--init", "--recursive"], worktree, "submodule checkout");
    runChecked("npx", ["--yes", "pnpm@10.18.3", "install", "--frozen-lockfile"], worktree, "frozen install");
    if (hash(readFileSync(join(worktree, "pnpm-lock.yaml"))) !== records[0].evidence.provenance.lockfile_sha256)
      fail("replay install changed pnpm-lock.yaml");
    runChecked("npx", ["--yes", "pnpm@10.18.3", "compile"], worktree, "compile replay");
    runChecked("npx", ["--yes", "pnpm@10.18.3", "build"], worktree, "build replay");
    for (const { evidence, definition, fixture } of records) {
      const targetDir = join(sharedRepositoryRoot, dirname(definition.manifest), "target");
      const rust = runChecked("cargo", ["run", "--quiet", "--manifest-path", definition.manifest, "--locked"], worktree, `${evidence.dossier} Rust oracle`, { CARGO_TARGET_DIR: targetDir });
      if (!Buffer.from(rust).equals(fixture)) fail(`${evidence.dossier}: Rust oracle output differs from committed fixture`);
      const output = runChecked("npx", ["--yes", "pnpm@10.18.3", "vitest", "run", definition.subjects[0], "-t", definition.control], worktree, `${evidence.dossier} negative control`);
      if (!/1 passed/.test(output)) fail(`${evidence.dossier}: negative control did not execute and pass`);
    }
  } finally {
    spawnSync("git", ["worktree", "remove", worktree, "--force"], { cwd: root });
    rmSync(worktree, { recursive: true, force: true });
  }
}

function selfTest(records) {
  const mutations = [
    (x) => { x.provenance.lockfile_sha256 = "0".repeat(64); },
    (x) => { x.environment.post_install_lockfile_sha256 = "0".repeat(64); },
    (x) => { x.verification.rust_output_or_digest = `PASS ${"0".repeat(64)}`; },
    (x) => { x.oracle.generator_path = "tools/quality-gate/fabricated/src/main.rs"; },
    (x) => { x.oracle.subject_paths = ["src/fabricated.ts"]; },
  ];
  let rejected = 0;
  for (const { evidence } of records) for (const mutate of mutations) {
    const copy = structuredClone(evidence);
    mutate(copy);
    try { validateRecord(copy, evidence.dossier); }
    catch { rejected += 1; continue; }
    fail(`${evidence.dossier}: plausible provenance mutation was accepted`);
  }
  console.log(`PASS: rejected ${rejected} plausible provenance and digest mutations`);
}

const records = validateDirectory();
if (process.argv.includes("--self-test")) selfTest(records);
else replay(records);
console.log(`PASS: validated ${records.length} replay-bound dossiers at tested source ${records[0].evidence.provenance.tested_source_sha}`);
