import { describe, expect, it } from "vitest";
import { NostrEvent } from "applesauce-core/helpers";
import { createDeleteKeyPackageEvent } from "../core/key-package.js";
import { KEY_PACKAGE_KIND } from "../core/protocol.js";

const mockPubkey =
  "02a1633cafe37eeebe2b39b4ec5f3d74c35e61fa7e7e6b7b8c5f7c4f3b2a1b2c3d";
const mockSig = "304502210...";

describe("createDeleteKeyPackageEvent", () => {
  it("should create a valid kind 5 delete event with event IDs", () => {
    const eventIds = ["abc123def456", "789ghi012jkl", "345mno678pqr"];

    const deleteEvent = createDeleteKeyPackageEvent({
      pubkey: mockPubkey,
      events: eventIds,
    });

    expect(deleteEvent.kind).toBe(5);
    expect(deleteEvent.pubkey).toBe(mockPubkey);
    expect(deleteEvent.content).toBe("");
    expect(deleteEvent.created_at).toBeGreaterThan(0);

    // Check for k tag
    const kTag = deleteEvent.tags.find((t) => t[0] === "k");
    expect(kTag).toEqual(["k", "443"]);

    // Check for e tags
    const eTags = deleteEvent.tags.filter((t) => t[0] === "e");
    expect(eTags).toHaveLength(3);
    expect(eTags).toEqual([
      ["e", "abc123def456"],
      ["e", "789ghi012jkl"],
      ["e", "345mno678pqr"],
    ]);
  });

  it("should create a valid kind 5 delete event with full NostrEvent objects", () => {
    const keyPackageEvents: NostrEvent[] = [
      {
        kind: KEY_PACKAGE_KIND,
        id: "event1id",
        pubkey: mockPubkey,
        created_at: 1693876543,
        tags: [],
        content: "aabbccdd",
        sig: mockSig,
      },
      {
        kind: KEY_PACKAGE_KIND,
        id: "event2id",
        pubkey: mockPubkey,
        created_at: 1693876544,
        tags: [],
        content: "eeffgghh",
        sig: mockSig,
      },
    ];

    const deleteEvent = createDeleteKeyPackageEvent({
      pubkey: mockPubkey,
      events: keyPackageEvents,
    });

    expect(deleteEvent.kind).toBe(5);
    expect(deleteEvent.pubkey).toBe(mockPubkey);

    // Check for k tag
    const kTag = deleteEvent.tags.find((t) => t[0] === "k");
    expect(kTag).toEqual(["k", "443"]);

    // Check for e tags
    const eTags = deleteEvent.tags.filter((t) => t[0] === "e");
    expect(eTags).toHaveLength(2);
    expect(eTags).toEqual([
      ["e", "event1id"],
      ["e", "event2id"],
    ]);
  });

  it("should throw an error when no events are provided", () => {
    expect(() => {
      createDeleteKeyPackageEvent({
        pubkey: mockPubkey,
        events: [],
      });
    }).toThrow("At least one event must be provided for deletion");
  });

  it("should throw an error when a full event is not kind 443", () => {
    const wrongKindEvent: NostrEvent = {
      kind: 1, // Wrong kind (text note instead of key package)
      id: "wrongeventid",
      pubkey: mockPubkey,
      created_at: 1693876543,
      tags: [],
      content: "Hello world",
      sig: mockSig,
    };

    expect(() => {
      createDeleteKeyPackageEvent({
        pubkey: mockPubkey,
        events: [wrongKindEvent],
      });
    }).toThrow(
      `Event wrongeventid is not a key package event (kind 1 instead of ${KEY_PACKAGE_KIND})`,
    );
  });

  it("should handle mixed event IDs and full events", () => {
    const keyPackageEvent: NostrEvent = {
      kind: KEY_PACKAGE_KIND,
      id: "fulleventid",
      pubkey: mockPubkey,
      created_at: 1693876543,
      tags: [],
      content: "aabbccdd",
      sig: mockSig,
    };

    const deleteEvent = createDeleteKeyPackageEvent({
      pubkey: mockPubkey,
      events: ["stringeventid1", keyPackageEvent, "stringeventid2"],
    });

    expect(deleteEvent.kind).toBe(5);

    const eTags = deleteEvent.tags.filter((t) => t[0] === "e");
    expect(eTags).toHaveLength(3);
    expect(eTags).toEqual([
      ["e", "stringeventid1"],
      ["e", "fulleventid"],
      ["e", "stringeventid2"],
    ]);
  });

  it("should create event with correct timestamp", () => {
    const beforeTime = Math.floor(Date.now() / 1000);

    const deleteEvent = createDeleteKeyPackageEvent({
      pubkey: mockPubkey,
      events: ["someeventid"],
    });

    const afterTime = Math.floor(Date.now() / 1000);

    expect(deleteEvent.created_at).toBeGreaterThanOrEqual(beforeTime);
    expect(deleteEvent.created_at).toBeLessThanOrEqual(afterTime);
  });
});
