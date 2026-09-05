import manifestJson from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/manifest.v1.json";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  defaultCryptoProvider,
  getCiphersuiteImpl,
  groupContextEncoder,
  encode,
} from "ts-mls";
import { describe, expect, it } from "vitest";
import { createCredential } from "../../core/credential.js";
import { createSimpleGroup } from "../../core/group.js";
import { generateKeyPackage } from "../../core/key-package.js";
import {
  resolveManifestArtifact,
  validateConformanceManifest,
} from "./manifest.js";
import {
  projectCanonicalConformanceSnapshot,
  validateCanonicalConformanceSnapshot,
} from "./snapshot.js";

const VECTORS_ROOT = "refs/mdk/crates/cgka-conformance-simulator/vectors";

describe("conformance adapter", () => {
  it("strictly validates the pinned manifest and confines artifact paths", () => {
    const manifest = validateConformanceManifest(manifestJson, VECTORS_ROOT);
    expect(manifest.entries[0]?.id).toBe("three-client-message-exchange/v1");
    expect(resolveManifestArtifact(VECTORS_ROOT, manifest.entries[0]!.artifact!)).toContain(VECTORS_ROOT);
    expect(() => resolveManifestArtifact(VECTORS_ROOT, "../secret.json")).toThrow("escapes");
    expect(() => resolveManifestArtifact(VECTORS_ROOT, "/tmp/secret.json")).toThrow("relative");
    expect(() => validateConformanceManifest({ ...manifestJson, surprise: true }, VECTORS_ROOT)).toThrow();
  });

  it("projects every canonical field from live MLS state", async () => {
    const impl = await getCiphersuiteImpl(
      "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
      defaultCryptoProvider,
    );
    const keyPackage = await generateKeyPackage({
      credential: createCredential("a".repeat(64)),
      ciphersuiteImpl: impl,
    });
    const { clientState } = await createSimpleGroup(keyPackage, impl, "projection", {
      adminPubkeys: ["a".repeat(64)],
      relays: ["wss://relay.test"],
    });
    const snapshot = await projectCanonicalConformanceSnapshot({
      state: clientState,
      ciphersuite: impl,
      lifecycle: "Stable",
      convergenceStatus: "Settled",
      inputDispositions: [{ input: "create", disposition: "accepted" }],
      applicationOutputs: [{ identity: "app-1", kind: "message", value: "hello", observed: true }],
    });
    expect(encode(groupContextEncoder, clientState.groupContext)).not.toHaveLength(0);
    expect(snapshot.group_id).toBe(bytesToHex(clientState.groupContext.groupId));
    expect(snapshot.group_context_sha256).toHaveLength(64);
    expect(snapshot.exporter_commitment_sha256).toHaveLength(64);
    expect(snapshot.leaves).toHaveLength(1);
    expect(snapshot.app_data_dictionary.map((entry) => entry.component_id)).toEqual(
      [...snapshot.app_data_dictionary.map((entry) => entry.component_id)].sort((a, b) => a - b),
    );
    expect(validateCanonicalConformanceSnapshot(snapshot)).toBe(snapshot);
    const { epoch: _epoch, ...missing } = snapshot;
    expect(() => validateCanonicalConformanceSnapshot(missing)).toThrow();
    expect(() => validateCanonicalConformanceSnapshot({ ...snapshot, local_queue_id: "nope" })).toThrow();
  });
});
