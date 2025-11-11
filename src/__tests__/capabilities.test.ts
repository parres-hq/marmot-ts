import { Capabilities } from "ts-mls";
import { describe, expect, it } from "vitest";
import {
  ensureMarmotCapabilities,
  LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE,
  MARMOT_GROUP_DATA_EXTENSION_TYPE,
} from "../core";

describe("ensureMarmotCapabilities", () => {
  it("should add Marmot Group Data Extension if not present", () => {
    const capabilities: Capabilities = {
      versions: ["mls10"],
      ciphersuites: ["MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"],
      extensions: [1, 2, 3],
      proposals: [],
      credentials: ["basic"],
    };

    const result = ensureMarmotCapabilities(capabilities);

    expect(result.extensions).toContain(MARMOT_GROUP_DATA_EXTENSION_TYPE);
    expect(result.extensions).toContain(1);
    expect(result.extensions).toContain(2);
    expect(result.extensions).toContain(3);
  });

  it("should not duplicate Marmot Group Data Extension if already present", () => {
    const capabilities: Capabilities = {
      versions: ["mls10"],
      ciphersuites: ["MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"],
      extensions: [1, 2, MARMOT_GROUP_DATA_EXTENSION_TYPE, 3],
      proposals: [],
      credentials: ["basic"],
    };

    const result = ensureMarmotCapabilities(capabilities);

    expect(result.extensions).toContain(MARMOT_GROUP_DATA_EXTENSION_TYPE);
    expect(result.extensions).toContain(LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE);
  });

  it("should preserve all other capability fields", () => {
    const capabilities: Capabilities = {
      versions: ["mls10"],
      ciphersuites: [
        "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
        "MLS_128_DHKEMP256_AES128GCM_SHA256_P256",
        "MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519",
      ],
      extensions: [1, 2],
      proposals: [1, 2],
      credentials: ["basic"],
    };

    const result = ensureMarmotCapabilities(capabilities);

    expect(result.versions).toEqual(capabilities.versions);
    expect(result.ciphersuites).toEqual(capabilities.ciphersuites);
    expect(result.proposals).toEqual(capabilities.proposals);
    expect(result.credentials).toEqual(capabilities.credentials);
  });

  it("should work with empty extensions array", () => {
    const capabilities: Capabilities = {
      versions: ["mls10"],
      ciphersuites: ["MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"],
      extensions: [],
      proposals: [],
      credentials: ["basic"],
    };

    const result = ensureMarmotCapabilities(capabilities);

    expect(result.extensions).toEqual([
      MARMOT_GROUP_DATA_EXTENSION_TYPE,
      LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE,
    ]);
  });
});
