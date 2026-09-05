import manifestJson from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/manifest.v1.json";
import { readFileSync } from "node:fs";
import { hexToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import { decodeNostrRoutingV1 } from "../../core/components/nostr-routing.js";
import { resolveManifestArtifact, validateConformanceManifest } from "./manifest.js";

const VECTORS_ROOT = "refs/mdk/crates/cgka-conformance-simulator/vectors";

describe("portable MDK conformance smoke corpus", () => {
  const manifest = validateConformanceManifest(manifestJson, VECTORS_ROOT);
  const portable = manifest.entries.filter((entry) => entry.status === "portable");
  const represented = new Set<string>();

  for (const entry of portable) {
    it(entry.id, () => {
      expect(entry.artifact).toBeDefined();
      const fixture = JSON.parse(
        readFileSync(resolveManifestArtifact(VECTORS_ROOT, entry.artifact!), "utf8"),
      ) as Record<string, any>;

      // Byte fixtures execute through the production codec. The Scenario IR
      // corpus remains explicit until the adapter implements its mutation and
      // scheduler actions; a portable vector must never silently disappear.
      if (String(fixture.vector_type).startsWith("app_component_")) {
        if (fixture.expected.valid) {
          const decoded = decodeNostrRoutingV1(hexToBytes(fixture.bytes.hex));
          expect(decoded.relays).toEqual(fixture.expected.fields.relays);
        } else {
          expect(() => decodeNostrRoutingV1(hexToBytes(fixture.bytes.hex))).toThrow();
        }
        // MDK manifest 93ecfbca calls the valid update
        // `update-valid-two-relays/v1`, while its immutable fixture_name is
        // `update-valid-full-replacement/v1`; artifact identity is therefore
        // anchored by the manifest id rather than silently renamed here.
        expect(fixture.fixture_name).toMatch(/^marmot\.transport\.nostr\.routing\.v1\//);
      } else {
        expect(fixture.scenario?.name).toBe(entry.id);
        expect(fixture.scenario?.steps?.length).toBeGreaterThan(0);
        expect({
          kind: "unsupported",
          scenarioId: entry.id,
          capability: "scenario_ir_v3",
          reason: "the production adapter does not yet expose the full MDK Scenario IR action surface",
        }).toMatchObject({ kind: "unsupported", scenarioId: entry.id, capability: "scenario_ir_v3" });
      }
      represented.add(entry.id);
    });
  }

  it("represents every portable manifest entry", () => {
    expect(represented.size).toBe(portable.length);
    expect([...represented].sort()).toEqual(portable.map((entry) => entry.id).sort());
  });
});
