#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const phaseDir = join(root, ".planning/phases/05-quality-gate");
const evidenceArgument = process.argv.slice(2).find((value) => !value.startsWith("--"));
const evidencePath = resolve(
  evidenceArgument ?? join(phaseDir, "05-CI-EVIDENCE.json"),
);
const expectedRows = new Set([
  "node-20",
  "node-22",
  "node-24",
  "deno-2",
  "bun-latest",
  "bun-1.1",
]);
const sha40 = /^[0-9a-f]{40}$/;
const sha256 = /^[0-9a-f]{64}$/;
const selfTest = process.argv.includes("--self-test");
let rejectedMutations = 0;

function fail(message) {
  throw new Error(message);
}

function gh(args, encoding = "utf8") {
  try {
    return execFileSync("gh", args, { cwd: root, encoding });
  } catch (error) {
    fail(`authenticated GitHub retrieval failed: ${error.message}`);
  }
}

function ghJson(endpoint) {
  return JSON.parse(gh(["api", endpoint]));
}

function stripAnsi(value) {
  return value
    .replaceAll(/\x1b\[[0-9;]*m/g, "")
    .replaceAll(/\^\[\[[0-9;]*m/g, "");
}

function assertLogEvidence(job, rawLog) {
  const digest = createHash("sha256").update(rawLog).digest("hex");
  if (!sha256.test(job.log_sha256) || digest !== job.log_sha256)
    fail(`${job.matrix_id}: downloaded job log digest mismatch`);

  const log = stripAnsi(rawLog.toString("utf8"));
  for (const [label, asserted] of [
    ["runtime version", job.resolved_version],
    ["pnpm version", job.pnpm_version],
    ["Vitest version", `v${job.vitest_version}`],
  ]) {
    if (!asserted || !log.includes(asserted))
      fail(`${job.matrix_id}: ${label} is not present in the immutable log`);
  }
  const lines = log.split(/\r?\n/);
  for (const [label, command] of [
    ["frozen install command", job.install.command],
    ["normal command", job.normal.command],
    ["extended command", job.extended.command],
  ]) {
    if (!command || !lines.some((line) => line.endsWith(`Run ${command}`)))
      fail(`${job.matrix_id}: exact ${label} is not present in the immutable log`);
  }

  const files = [...log.matchAll(/Test Files\s+(\d+) passed\s+\((\d+)\)/g)];
  const tests = [...log.matchAll(/Tests\s+(\d+) passed\s+\((\d+)\)/g)];
  for (const [suite, index] of [["normal", 0], ["extended", 1]]) {
    if (
      Number(files[index]?.[1]) !== job[suite].test_files ||
      Number(tests[index]?.[1]) !== job[suite].tests
    ) fail(`${job.matrix_id}: ${suite} counts differ from the immutable log`);
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

function dossierSources() {
  return [
    "05-PROOF-V2-DOSSIER.md",
    "05-KEY-PACKAGE-LIFETIME-DOSSIER.md",
    "05-TAG-CARDINALITY-DOSSIER.md",
    "05-SAFE-AAD-DOSSIER.md",
  ].map((file) => {
    const markdown = readFileSync(join(phaseDir, file), "utf8");
    const match = markdown.match(
      /<!-- quality-dossier-evidence:start -->\s*```json\s*([\s\S]*?)\s*```/,
    );
    if (!match) fail(`${file}: dossier evidence missing`);
    return JSON.parse(match[1]).provenance.tested_source_sha;
  });
}

const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
if (evidence.schema_version !== 1) fail("unsupported schema_version");
if (!sha40.test(evidence.tested_source_sha))
  fail("tested_source_sha must be 40-hex");
if (evidence.run?.head_sha !== evidence.tested_source_sha)
  fail("run head_sha differs from tested_source_sha");
if (
  evidence.run?.status !== "completed" ||
  evidence.run?.conclusion !== "success"
)
  fail("run is not a completed success");
if (
  !Number.isSafeInteger(evidence.run?.id) ||
  !Number.isSafeInteger(evidence.run?.attempt)
)
  fail("run ID/attempt missing");
if (
  evidence.run.url !==
  `https://github.com/${evidence.repository}/actions/runs/${evidence.run.id}`
)
  fail("run URL is not immutable");
if (evidence.retrieval?.authenticated !== true)
  fail("evidence was not retrieved through authenticated GitHub access");
if (
  !evidence.retrieval?.jobs_command?.includes(
    `/actions/runs/${evidence.run.id}/jobs`,
  )
)
  fail("jobs retrieval command is not run-ID bound");
if (!evidence.retrieval?.logs_command?.includes("--job <job_id> --log"))
  fail("job log retrieval command missing");

const liveRun = ghJson(
  `repos/${evidence.repository}/actions/runs/${evidence.run.id}`,
);
for (const [field, expected] of [
  ["id", evidence.run.id],
  ["head_sha", evidence.tested_source_sha],
  ["status", "completed"],
  ["conclusion", "success"],
  ["run_attempt", evidence.run.attempt],
  ["html_url", evidence.run.url],
]) {
  if (liveRun[field] !== expected)
    fail(`run ${field} differs from authenticated GitHub API`);
}

if (!Array.isArray(evidence.jobs) || evidence.jobs.length !== expectedRows.size)
  fail("exactly six matrix jobs are required");
const rowIds = new Set();
const jobIds = new Set();
for (const job of evidence.jobs) {
  if (!expectedRows.has(job.matrix_id))
    fail(`unknown matrix row ${job.matrix_id}`);
  if (rowIds.has(job.matrix_id)) fail(`duplicate matrix row ${job.matrix_id}`);
  if (jobIds.has(job.job_id)) fail(`duplicate job ID ${job.job_id}`);
  rowIds.add(job.matrix_id);
  jobIds.add(job.job_id);
  if (job.status !== "completed" || job.conclusion !== "success")
    fail(`${job.matrix_id}: job did not succeed`);
  if (
    !job.resolved_version ||
    !/^10\./.test(job.pnpm_version) ||
    !/^\d+\.\d+\.\d+$/.test(job.vitest_version)
  ) fail(`${job.matrix_id}: runtime, pnpm, or Vitest version missing`);
  if (job.url !== `${evidence.run.url}/job/${job.job_id}`)
    fail(`${job.matrix_id}: job URL is not immutable`);
  if (
    job.install?.command !== "pnpm install --frozen-lockfile" ||
    job.install?.conclusion !== "success"
  )
    fail(`${job.matrix_id}: frozen install not proven`);
  for (const suite of ["normal", "extended"]) {
    const result = job[suite];
    if (
      !result?.command ||
      result.conclusion !== "success" ||
      result.test_files < 1 ||
      result.tests < 1
    )
      fail(`${job.matrix_id}: ${suite} suite not proven`);
  }
  if (
    !job.extended.command.includes("vitest.extended.config.ts") &&
    job.extended.command !== "pnpm conformance:extended"
  )
    fail(`${job.matrix_id}: extended config not explicit`);

  const liveJob = ghJson(
    `repos/${evidence.repository}/actions/jobs/${job.job_id}`,
  );
  for (const [field, expected] of [
    ["id", job.job_id],
    ["name", job.name],
    ["head_sha", evidence.tested_source_sha],
    ["status", "completed"],
    ["conclusion", "success"],
    ["html_url", job.url],
  ]) {
    if (liveJob[field] !== expected)
      fail(`${job.matrix_id}: job ${field} differs from authenticated GitHub API`);
  }
  for (const [stepName, expectedCommand] of [
    ["Install dependencies", job.install.command],
    [job.family === "node" ? "Run tests" : `Run tests with ${job.family === "deno" ? "Deno" : "Bun"}`, job.normal.command],
  ]) {
    const step = liveJob.steps?.find(({ name }) => name === stepName);
    if (!step || step.status !== "completed" || step.conclusion !== "success")
      fail(`${job.matrix_id}: ${stepName} did not succeed according to GitHub`);
    if (!expectedCommand) fail(`${job.matrix_id}: missing asserted command`);
  }
  const rawLog = gh([
    "run", "view", String(evidence.run.id), "-R", evidence.repository,
    "--job", String(job.job_id), "--log",
  ], null);
  assertLogEvidence(job, rawLog);
  if (selfTest) {
    for (const mutate of [
      (copy) => { copy.resolved_version = "fabricated-runtime"; },
      (copy) => { copy.pnpm_version = "10.fabricated"; },
      (copy) => { copy.vitest_version = "0.0.0"; },
      (copy) => { copy.log_sha256 = "0".repeat(64); },
      (copy) => { copy.install.command = "pnpm install"; },
      (copy) => { copy.normal.command = "fabricated normal command"; },
      (copy) => { copy.extended.command = "fabricated extended command"; },
      (copy) => { copy.normal.test_files += 1; },
      (copy) => { copy.normal.tests += 1; },
      (copy) => { copy.extended.test_files += 1; },
      (copy) => { copy.extended.tests += 1; },
    ]) {
      const copy = structuredClone(job);
      mutate(copy);
      let rejected = false;
      try { assertLogEvidence(copy, rawLog); } catch { rejected = true; }
      if (!rejected) fail(`${job.matrix_id}: adversarial evidence mutation was accepted`);
      rejectedMutations += 1;
    }
  }
}
if ([...expectedRows].some((row) => !rowIds.has(row)))
  fail("one or more matrix rows are missing");

for (const [path, expected] of [
  ["refs/marmot", evidence.references?.marmot_sha],
  ["refs/mdk", evidence.references?.mdk_sha],
  ["ts-mls", evidence.references?.ts_mls_sha],
]) {
  if (
    !sha40.test(expected) ||
    gitlinkAt(evidence.tested_source_sha, path) !== expected
  )
    fail(`${path}: evidence does not match tested-source gitlink`);
}
if (dossierSources().some((sha) => sha !== evidence.tested_source_sha))
  fail("CI and dossier evidence do not share one tested_source_sha");

console.log(
  `PASS: validated six hosted runtime rows at tested source ${evidence.tested_source_sha} (run ${evidence.run.id}, attempt ${evidence.run.attempt})`,
);
if (selfTest)
  console.log(`PASS: rejected ${rejectedMutations} structurally valid fabricated log claims`);
