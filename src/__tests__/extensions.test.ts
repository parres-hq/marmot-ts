import { describe, it, expect } from "vitest";
import {
  createEmptyMarmotGroupDataExtension,
  defaultExtensions,
} from "../core/extensions.js";
import { createKeyPackageEvent } from "../core/key-package.js";
import { getKeyPackageExtensions } from "../core/key-package.js";
import {
  generateKeyPackage,
  defaultCryptoProvider,
  defaultLifetime,
} from "ts-mls";
import { getCiphersuiteFromName, getCiphersuiteImpl } from "ts-mls";
import { createCredential } from "../core/credential.js";
import { defaultCapabilities } from "../core/extensions.js";

describe("Marmot Group Data Extension", () => {
  it("should create properly formatted TLS-serialized extension data", () => {
    const extensionData = createEmptyMarmotGroupDataExtension();

    // Verify total size (2 + 32 + 2 + 2 + 2 + 2 + 32 + 32 + 12 = 118 bytes)
    expect(extensionData.length).toBe(118);

    // Verify version field (2 bytes, big-endian, value 1)
    const view = new DataView(extensionData.buffer);
    expect(view.getUint16(0, false)).toBe(1); // false for big-endian

    // Verify nostr_group_id is all zeros (32 bytes)
    const nostrGroupId = extensionData.slice(2, 34);
    expect(nostrGroupId.every((byte) => byte === 0)).toBe(true);

    // Verify variable-length fields have zero length prefixes
    // name (offset 34-35)
    expect(view.getUint16(34, false)).toBe(0);
    // description (offset 36-37)
    expect(view.getUint16(36, false)).toBe(0);
    // admin_pubkeys (offset 38-39)
    expect(view.getUint16(38, false)).toBe(0);
    // relays (offset 40-41)
    expect(view.getUint16(40, false)).toBe(0);

    // Verify image fields are all zeros
    const imageHash = extensionData.slice(42, 74); // 32 bytes
    const imageKey = extensionData.slice(74, 106); // 32 bytes
    const imageNonce = extensionData.slice(106, 118); // 12 bytes

    expect(imageHash.every((byte) => byte === 0)).toBe(true);
    expect(imageKey.every((byte) => byte === 0)).toBe(true);
    expect(imageNonce.every((byte) => byte === 0)).toBe(true);
  });

  it("should create extension data that matches MIP-01 TLS structure", () => {
    const extensionData = createEmptyMarmotGroupDataExtension();

    // The structure should be:
    // uint16 version (2 bytes)
    // opaque nostr_group_id[32] (32 bytes)
    // opaque name<0..2^16-1> (2 bytes length + 0 bytes data)
    // opaque description<0..2^16-1> (2 bytes length + 0 bytes data)
    // opaque admin_pubkeys<0..2^16-1> (2 bytes length + 0 bytes data)
    // opaque relays<0..2^16-1> (2 bytes length + 0 bytes data)
    // opaque image_hash[32] (32 bytes)
    // opaque image_key[32] (32 bytes)
    // opaque image_nonce[12] (12 bytes)

    const expectedSize = 2 + 32 + 2 + 2 + 2 + 2 + 32 + 32 + 12;
    expect(extensionData.length).toBe(expectedSize);
  });
});

describe("Key Package Extensions", () => {
  it("should include all required MLS extensions in key package", async () => {
    // Create a test key package with default extensions
    const pubkey =
      "884704bd421671e01c13f854d2ce23ce2a5bfe9562f4f297ad2bc921ba30c3a6";
    const credential = createCredential(pubkey);

    const ciphersuiteImpl = await getCiphersuiteImpl(
      getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"),
      defaultCryptoProvider,
    );

    const keyPackage = await generateKeyPackage(
      credential,
      defaultCapabilities(),
      defaultLifetime,
      defaultExtensions,
      ciphersuiteImpl,
    );

    // Create key package event
    const event = createKeyPackageEvent({
      keyPackage: keyPackage.publicPackage,
      pubkey,
      relays: ["wss://relay.example.com"],
      client: "test-client",
    });

    // Verify the event includes the mls_extensions tag
    const extensionsTag = event.tags.find((tag) => tag[0] === "mls_extensions");
    expect(extensionsTag).toBeDefined();
    expect(extensionsTag!.length).toBeGreaterThan(1);

    // Extract extension types from the tag
    const extensionTypes = extensionsTag!.slice(1).map((ext) => parseInt(ext));

    // Should include required_capabilities (0x0003), ratchet_tree (0x0002), and marmot_group_data (0xf2ee)
    expect(extensionTypes).toContain(0x0003); // required_capabilities
    expect(extensionTypes).toContain(0x0002); // ratchet_tree
    expect(extensionTypes).toContain(0xf2ee); // marmot_group_data

    // Verify we can parse the extensions back using getKeyPackageExtensions
    const parsedExtensions = getKeyPackageExtensions(event as any);
    expect(parsedExtensions).toBeDefined();
    expect(parsedExtensions!.length).toBe(3);
    expect(parsedExtensions).toContain(0x0003);
    expect(parsedExtensions).toContain(0x0002);
    expect(parsedExtensions).toContain(0xf2ee);
  });

  it("should correctly map string extension types to numeric values", async () => {
    const pubkey =
      "884704bd421671e01c13f854d2ce23ce2a5bfe9562f4f297ad2bc921ba30c3a6";
    const credential = createCredential(pubkey);

    const ciphersuiteImpl = await getCiphersuiteImpl(
      getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"),
      defaultCryptoProvider,
    );

    const keyPackage = await generateKeyPackage(
      credential,
      defaultCapabilities(),
      defaultLifetime,
      defaultExtensions,
      ciphersuiteImpl,
    );

    // Create key package event
    const event = createKeyPackageEvent({
      keyPackage: keyPackage.publicPackage,
      pubkey,
      relays: ["wss://relay.example.com"],
    });

    // Verify the extensions tag contains the correct hex values
    const extensionsTag = event.tags.find((tag) => tag[0] === "mls_extensions");
    expect(extensionsTag).toBeDefined();

    const extensionHexValues = extensionsTag!.slice(1);
    expect(extensionHexValues).toContain("0x0003"); // required_capabilities
    expect(extensionHexValues).toContain("0x0002"); // ratchet_tree
    expect(extensionHexValues).toContain("0xf2ee"); // marmot_group_data
  });
});
