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
const schema = JSON.parse(
  readFileSync(join(phaseDir, "05-DOSSIER-SCHEMA.json"), "utf8"),
);
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
    tests: 2,
  },
  "key-package-lifetime": {
    dossier: "05-KEY-PACKAGE-LIFETIME-DOSSIER.md",
    fixture: "src/__tests__/fixtures/key-package-lifetime-rust.json",
    manifest: "tools/quality-gate/lifetime-probe/Cargo.toml",
    generator: "tools/quality-gate/lifetime-probe/src/main.rs",
    subjects: ["src/core/__tests__/key-package-lifetime-parity.test.ts"],
    control: "negative control detects a one-second cap mutation",
    tests: 5,
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
    control:
      "negative control rejects a mutated Rust oracle through production parity",
    tests: 57,
  },
  "safe-aad": {
    dossier: "05-SAFE-AAD-DOSSIER.md",
    fixture: "src/__tests__/fixtures/safe-aad-rust.json",
    manifest: "tools/quality-gate/safe-aad-probe/Cargo.toml",
    generator: "tools/quality-gate/safe-aad-probe/src/main.rs",
    subjects: ["src/core/components/__tests__/safe-aad-parity.test.ts"],
    control: "detects a one-byte dictionary mutation",
    tests: 4,
  },
};
const PNPM_VERSION = "10.18.3";
const VITEST_VERSION = "3.2.6";
const commands = {
  install: `npx --yes pnpm@${PNPM_VERSION} install --frozen-lockfile`,
  compile: `npx --yes pnpm@${PNPM_VERSION} compile`,
  build: `npx --yes pnpm@${PNPM_VERSION} build`,
};

function rustCommand(definition) {
  return `cargo run --quiet --manifest-path ${definition.manifest} --locked`;
}

function typescriptCommand(definition) {
  return `npx --yes pnpm@${PNPM_VERSION} vitest run ${definition.subjects[0]}`;
}

function controlCommand(definition) {
  return `${typescriptCommand(definition)} -t ${JSON.stringify(definition.control)}`;
}

function validateToolVersions(evidence, actual) {
  for (const [label, recorded, observed] of [
    ["Node", evidence.environment.node_version, actual.node],
    ["pnpm", evidence.environment.pnpm_version, actual.pnpm],
    ["Cargo", evidence.environment.cargo_version, actual.cargo],
    ["rustc", evidence.environment.rustc_version, actual.rustc],
  ])
    if (recorded !== observed)
      fail(`${evidence.dossier}: ${label} version differs from executed tool`);
}

function fail(message) {
  throw new Error(message);
}
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function git(args, options = {}) {
  return execFileSync("git", args, { cwd: root, encoding: null, ...options });
}
function committed(sourceSha, path) {
  try {
    return git(["show", `${sourceSha}:${path}`]);
  } catch {
    fail(`${sourceSha}: missing committed blob ${path}`);
  }
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
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
    fail(`${dossier}: missing required field ${path}`);
}
function parseEvidence(file) {
  const markdown = readFileSync(file, "utf8");
  const start = markdown.indexOf(schema.evidence_markers.start);
  const end = markdown.indexOf(schema.evidence_markers.end);
  if (start < 0 || end <= start)
    fail(`${basename(file)}: evidence markers missing`);
  const match = markdown
    .slice(start + schema.evidence_markers.start.length, end)
    .match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) fail(`${basename(file)}: JSON evidence block missing`);
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    fail(`${basename(file)}: invalid evidence JSON: ${error.message}`);
  }
}

function validateRecord(evidence, id) {
  const definition = definitions[id];
  for (const path of schema.required_paths) requirePath(evidence, path, id);
  for (const path of schema.conditional_required_paths[id] ?? [])
    requirePath(evidence, path, id);
  if (
    evidence.schema_version !== schema.schema_version ||
    evidence.dossier !== id
  )
    fail(`${id}: schema or dossier id mismatch`);
  const provenance = evidence.provenance;
  for (const key of ["tested_source_sha", "marmot_sha", "mdk_sha"])
    if (!SHA40.test(provenance[key])) fail(`${id}: ${key} must be 40-hex`);
  if (!SHA64.test(provenance.lockfile_sha256))
    fail(`${id}: lockfile_sha256 must be 64-hex`);
  for (const [label, actual, expected] of [
    ["pnpm version", evidence.environment.pnpm_version, PNPM_VERSION],
    ["Vitest version", evidence.verification.vitest_version, VITEST_VERSION],
    ["install command", evidence.environment.install_command, commands.install],
    [
      "install result",
      evidence.environment.install_result,
      `exit=0; lockfile_sha256=${provenance.lockfile_sha256}`,
    ],
    [
      "compile command",
      evidence.verification.compile_command,
      commands.compile,
    ],
    ["build command", evidence.verification.build_command, commands.build],
    ["compile result", evidence.verification.compile_result, "exit=0"],
    ["build result", evidence.verification.build_result, "exit=0"],
    [
      "Rust command",
      evidence.verification.rust_command,
      rustCommand(definition),
    ],
    [
      "TypeScript command",
      evidence.verification.typescript_command,
      typescriptCommand(definition),
    ],
    [
      "negative-control command",
      evidence.negative_control.command,
      controlCommand(definition),
    ],
    [
      "TypeScript result",
      evidence.verification.typescript_output,
      `exit=0; test_files=1; tests=${definition.tests}; vitest=${VITEST_VERSION}`,
    ],
    [
      "negative-control result",
      evidence.negative_control.result,
      `exit=0; test_files=1; tests=1; vitest=${VITEST_VERSION}`,
    ],
    [
      "fixture diff result",
      evidence.verification.fixture_diff_result,
      "exit=0; bytes_equal=true",
    ],
  ])
    if (actual !== expected)
      fail(`${id}: ${label} is not bound to the canonical replay`);
  for (const [label, value, digest] of [
    [
      "install result",
      evidence.environment.install_result,
      evidence.environment.install_result_sha256,
    ],
    [
      "TypeScript result",
      evidence.verification.typescript_output,
      evidence.verification.typescript_output_sha256,
    ],
    [
      "negative-control result",
      evidence.negative_control.result,
      evidence.negative_control.output_sha256,
    ],
  ])
    if (!SHA64.test(digest) || hash(value) !== digest)
      fail(`${id}: ${label} digest does not bind the recorded derived output`);

  const lockHash = hash(
    committed(provenance.tested_source_sha, "pnpm-lock.yaml"),
  );
  if (
    provenance.lockfile_sha256 !== lockHash ||
    evidence.environment.post_install_lockfile_sha256 !== lockHash
  )
    fail(`${id}: lockfile digest differs from the tested commit`);
  if (
    gitlinkAt(provenance.tested_source_sha, "refs/marmot") !==
      provenance.marmot_sha ||
    gitlinkAt(provenance.tested_source_sha, "refs/mdk") !== provenance.mdk_sha
  )
    fail(`${id}: reference provenance differs from tested commit gitlinks`);

  const fixture = committed(provenance.tested_source_sha, definition.fixture);
  const fixtureHash = hash(fixture);
  if (
    evidence.verification.rust_output_or_digest !==
    `exit=0; sha256=${fixtureHash}`
  )
    fail(`${id}: recorded fixture digest differs from committed fixture bytes`);
  if (
    evidence.oracle.generator_path !== definition.generator ||
    JSON.stringify(evidence.oracle.subject_paths) !==
      JSON.stringify(definition.subjects)
  )
    fail(`${id}: oracle paths differ from the reviewed independent call paths`);
  const generator = committed(
    provenance.tested_source_sha,
    definition.generator,
  ).toString("utf8");
  for (const subject of definition.subjects) {
    const source = committed(provenance.tested_source_sha, subject).toString(
      "utf8",
    );
    if (source.includes(definition.generator) || generator.includes(subject))
      fail(
        `${id}: Rust generator and TypeScript subject directly depend on each other`,
      );
  }
  committed(provenance.tested_source_sha, definition.manifest);
  if (
    evidence.oracle.generator_language !== "Rust" ||
    evidence.oracle.subject_language !== "TypeScript"
  )
    fail(`${id}: independent Rust/TypeScript oracle languages required`);
  if (
    id === "tag-cardinality" &&
    evidence.oracle.source_classification !== "rust-producer-and-spec-receiver"
  )
    fail(`${id}: D-05 source classification missing or incorrect`);
  if (
    ["key-package-lifetime", "safe-aad"].includes(id) &&
    evidence.review.b4649c01_sha !== B464_SHA
  )
    fail(`${id}: D-06 review commit is not provenance-bound`);
  return { evidence, definition, fixture, fixtureHash };
}

function validateDirectory(directory = phaseDir) {
  const records = Object.entries(definitions).map(([id, definition]) =>
    validateRecord(parseEvidence(join(directory, definition.dossier)), id),
  );
  const tuples = new Set(
    records.map(({ evidence: { provenance: p } }) =>
      [p.tested_source_sha, p.marmot_sha, p.mdk_sha, p.lockfile_sha256].join(
        ":",
      ),
    ),
  );
  if (tuples.size !== 1) fail("dossiers contain mixed or stale source tuples");
  return records;
}

function runChecked(command, args, cwd, label, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "true", ...extraEnv },
  });
  if (result.status !== 0)
    fail(`${label} failed:\n${result.stdout}\n${result.stderr}`);
  return `${result.stdout}${result.stderr}`;
}

function parseVitest(output, label) {
  const clean = output
    .replaceAll(/\x1b\[[0-9;]*m/g, "")
    .replaceAll(/\^\[\[[0-9;]*m/g, "");
  const version = clean.match(/RUN\s+v(\d+\.\d+\.\d+)/)?.[1];
  const files = Number(clean.match(/Test Files\s+(\d+) passed/)?.[1]);
  const tests = Number(clean.match(/Tests\s+(\d+) passed/)?.[1]);
  if (!version || !files || !tests)
    fail(`${label}: could not derive Vitest result from captured output`);
  return { version, files, tests, outputSha256: hash(output) };
}

function replay(records) {
  const sourceSha = records[0].evidence.provenance.tested_source_sha;
  const worktree = mkdtempSync(join(tmpdir(), "marmot-dossier-replay-"));
  try {
    runChecked(
      "git",
      ["worktree", "add", "--detach", worktree, sourceSha],
      root,
      "detached worktree creation",
    );
    runChecked(
      "git",
      ["submodule", "update", "--init", "--recursive"],
      worktree,
      "submodule checkout",
    );
    const actualVersions = {
      node: runChecked("node", ["--version"], worktree, "Node version").trim(),
      pnpm: runChecked(
        "npx",
        ["--yes", `pnpm@${PNPM_VERSION}`, "--version"],
        worktree,
        "pnpm version",
      ).trim(),
      cargo: runChecked(
        "cargo",
        ["--version"],
        worktree,
        "Cargo version",
      ).trim(),
      rustc: runChecked(
        "rustc",
        ["--version"],
        worktree,
        "rustc version",
      ).trim(),
    };
    for (const { evidence } of records)
      validateToolVersions(evidence, actualVersions);
    const installOutput = runChecked(
      "npx",
      ["--yes", `pnpm@${PNPM_VERSION}`, "install", "--frozen-lockfile"],
      worktree,
      "frozen install",
    );
    if (
      hash(readFileSync(join(worktree, "pnpm-lock.yaml"))) !==
      records[0].evidence.provenance.lockfile_sha256
    )
      fail("replay install changed pnpm-lock.yaml");
    if (!/frozen-lockfile|Lockfile is up to date/i.test(installOutput))
      fail("frozen install output did not prove lockfile use");
    if (
      records[0].evidence.environment.install_result !==
      `exit=0; lockfile_sha256=${records[0].evidence.provenance.lockfile_sha256}`
    )
      fail("install result is not derived from replay outcome");
    runChecked(
      "npx",
      ["--yes", `pnpm@${PNPM_VERSION}`, "compile"],
      worktree,
      "compile replay",
    );
    runChecked(
      "npx",
      ["--yes", `pnpm@${PNPM_VERSION}`, "build"],
      worktree,
      "build replay",
    );
    for (const { evidence, definition, fixture } of records) {
      const targetDir = join(
        sharedRepositoryRoot,
        dirname(definition.manifest),
        "target",
      );
      const rust = runChecked(
        "cargo",
        ["run", "--quiet", "--manifest-path", definition.manifest, "--locked"],
        worktree,
        `${evidence.dossier} Rust oracle`,
        { CARGO_TARGET_DIR: targetDir },
      );
      if (!Buffer.from(rust).equals(fixture))
        fail(
          `${evidence.dossier}: Rust oracle output differs from committed fixture`,
        );
      const parityOutput = runChecked(
        "npx",
        [
          "--yes",
          `pnpm@${PNPM_VERSION}`,
          "vitest",
          "run",
          definition.subjects[0],
        ],
        worktree,
        `${evidence.dossier} full parity test`,
      );
      const parity = parseVitest(
        parityOutput,
        `${evidence.dossier} full parity test`,
      );
      if (
        parity.version !== VITEST_VERSION ||
        parity.files !== 1 ||
        parity.tests !== definition.tests
      )
        fail(
          `${evidence.dossier}: full parity output differs from recorded result`,
        );
      const controlOutput = runChecked(
        "npx",
        [
          "--yes",
          `pnpm@${PNPM_VERSION}`,
          "vitest",
          "run",
          definition.subjects[0],
          "-t",
          definition.control,
        ],
        worktree,
        `${evidence.dossier} negative control`,
      );
      const control = parseVitest(
        controlOutput,
        `${evidence.dossier} negative control`,
      );
      if (
        control.version !== VITEST_VERSION ||
        control.files !== 1 ||
        control.tests !== 1
      )
        fail(
          `${evidence.dossier}: negative control output differs from recorded result`,
        );
      console.log(
        `CAPTURE ${evidence.dossier}: parity_sha256=${parity.outputSha256} negative_sha256=${control.outputSha256}`,
      );
    }
  } finally {
    spawnSync("git", ["worktree", "remove", worktree, "--force"], {
      cwd: root,
    });
    rmSync(worktree, { recursive: true, force: true });
  }
}

function selfTest(records) {
  const mutations = [
    (x) => {
      x.provenance.lockfile_sha256 = "0".repeat(64);
    },
    (x) => {
      x.environment.post_install_lockfile_sha256 = "0".repeat(64);
    },
    (x) => {
      x.verification.rust_output_or_digest = `exit=0; sha256=${"0".repeat(64)}`;
    },
    (x) => {
      x.oracle.generator_path = "tools/quality-gate/fabricated/src/main.rs";
    },
    (x) => {
      x.oracle.subject_paths = ["src/fabricated.ts"];
    },
    (x) => {
      x.environment.pnpm_version = "10.99.0";
    },
    (x) => {
      x.environment.install_command = "npx pnpm install";
    },
    (x) => {
      x.environment.install_result = "exit=0";
    },
    (x) => {
      x.verification.vitest_version = "99.0.0";
    },
    (x) => {
      x.verification.typescript_command = "vitest run";
    },
    (x) => {
      x.verification.typescript_output = "PASS";
    },
    (x) => {
      x.negative_control.command = "vitest -t mutation";
    },
    (x) => {
      x.negative_control.result = "PASS";
    },
    (x) => {
      x.environment.install_result_sha256 = "0".repeat(64);
    },
    (x) => {
      x.verification.compile_command = "tsc";
    },
    (x) => {
      x.verification.compile_result = "PASS";
    },
    (x) => {
      x.verification.build_command = "pnpm build";
    },
    (x) => {
      x.verification.build_result = "PASS";
    },
    (x) => {
      x.verification.rust_command = "cargo run";
    },
    (x) => {
      x.verification.fixture_diff_result = "PASS";
    },
    (x) => {
      x.verification.typescript_output_sha256 = "0".repeat(64);
    },
    (x) => {
      x.negative_control.output_sha256 = "0".repeat(64);
    },
  ];
  let rejected = 0;
  for (const { evidence } of records)
    for (const mutate of mutations) {
      const copy = structuredClone(evidence);
      mutate(copy);
      try {
        validateRecord(copy, evidence.dossier);
      } catch {
        rejected += 1;
        continue;
      }
      fail(`${evidence.dossier}: plausible provenance mutation was accepted`);
    }
  const actualVersions = {
    node: runChecked("node", ["--version"], root, "Node version").trim(),
    pnpm: runChecked(
      "npx",
      ["--yes", `pnpm@${PNPM_VERSION}`, "--version"],
      root,
      "pnpm version",
    ).trim(),
    cargo: runChecked("cargo", ["--version"], root, "Cargo version").trim(),
    rustc: runChecked("rustc", ["--version"], root, "rustc version").trim(),
  };
  for (const { evidence } of records)
    for (const field of [
      "node_version",
      "pnpm_version",
      "cargo_version",
      "rustc_version",
    ]) {
      const copy = structuredClone(evidence);
      copy.environment[field] = "fabricated-version";
      let wasRejected = false;
      try {
        validateToolVersions(copy, actualVersions);
      } catch {
        wasRejected = true;
      }
      if (!wasRejected)
        fail(`${evidence.dossier}: ${field} mutation was accepted`);
      rejected += 1;
    }
  console.log(
    `PASS: rejected ${rejected} plausible provenance and digest mutations`,
  );
}

const records = validateDirectory();
if (process.argv.includes("--self-test")) selfTest(records);
else replay(records);
console.log(
  `PASS: validated ${records.length} replay-bound dossiers at tested source ${records[0].evidence.provenance.tested_source_sha}`,
);
