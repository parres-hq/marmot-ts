import { describe, expect, it } from "vitest";
import {
  createMarmotGroupData,
  decodeMarmotGroupData,
  encodeMarmotGroupData,
  isAdmin,
  type MarmotGroupData,
} from "../core/marmot-group-data.js";

describe("encodeMarmotGroupData and decodeMarmotGroupData", () => {
  it("should encode and decode group data correctly", () => {
    const groupData: MarmotGroupData = {
      version: 1,
      nostrGroupId: new Uint8Array(32).fill(1),
      name: "Test Group",
      description: "A test group for unit tests",
      adminPubkeys: ["a".repeat(64), "b".repeat(64)],
      relays: ["wss://relay1.example.com", "wss://relay2.example.com"],
      imageHash: new Uint8Array(32).fill(2),
      imageKey: new Uint8Array(32).fill(3),
      imageNonce: new Uint8Array(12).fill(4),
    };

    const encoded = encodeMarmotGroupData(groupData);
    const decoded = decodeMarmotGroupData(encoded);

    expect(decoded.version).toBe(groupData.version);
    expect(decoded.nostrGroupId).toEqual(groupData.nostrGroupId);
    expect(decoded.name).toBe(groupData.name);
    expect(decoded.description).toBe(groupData.description);
    expect(decoded.adminPubkeys).toEqual(groupData.adminPubkeys);
    expect(decoded.relays).toEqual(groupData.relays);
    expect(decoded.imageHash).toEqual(groupData.imageHash);
    expect(decoded.imageKey).toEqual(groupData.imageKey);
    expect(decoded.imageNonce).toEqual(groupData.imageNonce);
  });

  it("should handle empty arrays correctly", () => {
    const groupData: MarmotGroupData = {
      version: 1,
      nostrGroupId: new Uint8Array(32),
      name: "",
      description: "",
      adminPubkeys: [],
      relays: [],
      imageHash: new Uint8Array(32),
      imageKey: new Uint8Array(32),
      imageNonce: new Uint8Array(12),
    };

    const encoded = encodeMarmotGroupData(groupData);
    const decoded = decodeMarmotGroupData(encoded);

    expect(decoded.adminPubkeys).toEqual([]);
    expect(decoded.relays).toEqual([]);
  });

  it("should handle UTF-8 strings correctly", () => {
    const groupData: MarmotGroupData = {
      version: 1,
      nostrGroupId: new Uint8Array(32),
      name: "Test 🚀 Group",
      description: "Description with émojis and spëcial çharacters",
      adminPubkeys: [],
      relays: [],
      imageHash: new Uint8Array(32),
      imageKey: new Uint8Array(32),
      imageNonce: new Uint8Array(12),
    };

    const encoded = encodeMarmotGroupData(groupData);
    const decoded = decodeMarmotGroupData(encoded);

    expect(decoded.name).toBe(groupData.name);
    expect(decoded.description).toBe(groupData.description);
  });
});

describe("createMarmotGroupData", () => {
  it("should create group data with default values", () => {
    const encoded = createMarmotGroupData();
    const decoded = decodeMarmotGroupData(encoded);

    expect(decoded.version).toBe(1);
    expect(decoded.nostrGroupId.length).toBe(32);
    expect(decoded.name).toBe("");
    expect(decoded.description).toBe("");
    expect(decoded.adminPubkeys).toEqual([]);
    expect(decoded.relays).toEqual([]);
  });

  it("should create group data with custom values", () => {
    const customGroupId = new Uint8Array(32).fill(5);
    const encoded = createMarmotGroupData({
      nostrGroupId: customGroupId,
      name: "My Group",
      description: "My Description",
      adminPubkeys: ["a".repeat(64)],
      relays: ["wss://relay.example.com"],
    });

    const decoded = decodeMarmotGroupData(encoded);

    expect(decoded.nostrGroupId).toEqual(customGroupId);
    expect(decoded.name).toBe("My Group");
    expect(decoded.description).toBe("My Description");
    expect(decoded.adminPubkeys).toEqual(["a".repeat(64)]);
    expect(decoded.relays).toEqual(["wss://relay.example.com/"]);
  });
});

describe("validation", () => {
  it("should reject invalid admin public keys", () => {
    const groupData: MarmotGroupData = {
      version: 1,
      nostrGroupId: new Uint8Array(32),
      name: "",
      description: "",
      adminPubkeys: ["invalid"],
      relays: [],
      imageHash: new Uint8Array(32),
      imageKey: new Uint8Array(32),
      imageNonce: new Uint8Array(12),
    };

    expect(() => encodeMarmotGroupData(groupData)).toThrow(
      /Invalid admin public key format/,
    );
  });

  it("should reject invalid relay URLs", () => {
    const groupData: MarmotGroupData = {
      version: 1,
      nostrGroupId: new Uint8Array(32),
      name: "",
      description: "",
      adminPubkeys: [],
      relays: ["http://not-a-websocket.com"],
      imageHash: new Uint8Array(32),
      imageKey: new Uint8Array(32),
      imageNonce: new Uint8Array(12),
    };

    expect(() => encodeMarmotGroupData(groupData)).toThrow(/Invalid relay URL/);
  });

  it("should reject wrong-sized fields", () => {
    const groupData: MarmotGroupData = {
      version: 1,
      nostrGroupId: new Uint8Array(16), // Wrong size!
      name: "",
      description: "",
      adminPubkeys: [],
      relays: [],
      imageHash: new Uint8Array(32),
      imageKey: new Uint8Array(32),
      imageNonce: new Uint8Array(12),
    };

    expect(() => encodeMarmotGroupData(groupData)).toThrow(
      /nostr_group_id must be exactly 32 bytes/,
    );
  });

  it("should reject truncated extension data", () => {
    const validData = createMarmotGroupData();
    const truncated = validData.slice(0, 50);

    expect(() => decodeMarmotGroupData(truncated)).toThrow(
      /Extension data too short/,
    );
  });
});

describe("isAdmin", () => {
  it("should return true for authorized admin", () => {
    const adminKey = "a".repeat(64);
    const groupData: MarmotGroupData = {
      version: 1,
      nostrGroupId: new Uint8Array(32),
      name: "",
      description: "",
      adminPubkeys: [adminKey],
      relays: [],
      imageHash: new Uint8Array(32),
      imageKey: new Uint8Array(32),
      imageNonce: new Uint8Array(12),
    };

    expect(isAdmin(groupData, adminKey)).toBe(true);
    expect(isAdmin(groupData, adminKey.toUpperCase())).toBe(true); // Case insensitive
  });

  it("should return false for unauthorized admin", () => {
    const groupData: MarmotGroupData = {
      version: 1,
      nostrGroupId: new Uint8Array(32),
      name: "",
      description: "",
      adminPubkeys: ["a".repeat(64)],
      relays: [],
      imageHash: new Uint8Array(32),
      imageKey: new Uint8Array(32),
      imageNonce: new Uint8Array(12),
    };

    expect(isAdmin(groupData, "b".repeat(64))).toBe(false);
  });
});
