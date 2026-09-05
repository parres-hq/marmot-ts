import manifestJson from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/manifest.v1.json";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveManifestArtifact, validateConformanceManifest } from "./manifest.js";

const VECTORS_ROOT = "refs/mdk/crates/cgka-conformance-simulator/vectors";

describe("portable MDK conformance smoke corpus", () => {
  const manifest = validateConformanceManifest(manifestJson, VECTORS_ROOT);
  const portable = manifest.entries.filter((entry) => entry.status === "portable");

  it("represents every portable manifest entry", () => {
    expect(portable).toHaveLength(0);
  });

  for (const entry of portable) {
    it(entry.id, () => {
      expect(entry.artifact).toBeDefined();
      const fixture = JSON.parse(
        readFileSync(resolveManifestArtifact(VECTORS_ROOT, entry.artifact!), "utf8"),
      ) as Record<string, unknown>;
      expect(fixture).toBeDefined();
    });
  }
});
