#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const phaseDir = join(root, ".planning/phases/05-quality-gate");
const evidencePath = resolve(
  process.argv[2] ?? join(phaseDir, "05-CI-EVIDENCE.json"),
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

function fail(message) {
  throw new Error(message);
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
  if (!job.resolved_version || !/^10\./.test(job.pnpm_version))
    fail(`${job.matrix_id}: runtime or pnpm 10 version missing`);
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
