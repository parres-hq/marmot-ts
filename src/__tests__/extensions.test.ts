import { describe, it, expect } from "vitest";
import { createEmptyMarmotGroupDataExtension } from "../core/extensions.js";

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
