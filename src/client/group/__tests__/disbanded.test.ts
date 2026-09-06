import { describe, expect, it } from "vitest";

import {
  decodeDisbandTombstone,
  disbandTombstoneKey,
  encodeDisbandTombstone,
  type DisbandTombstone,
} from "../../../engine/disband-tombstone.js";

const GROUP_ID = new Uint8Array([1, 2, 3]);
const COMMIT_DIGEST = new Uint8Array(32).fill(4);

describe("disband tombstone", () => {
  const tombstone: DisbandTombstone = {
    groupId: GROUP_ID,
    selectedEpoch: 7,
    commitDigest: COMMIT_DIGEST,
    actorPubkey: "a".repeat(64),
    notificationState: "pending",
  };

  it("uses a namespace distinct from the pending request", () => {
    expect(disbandTombstoneKey("010203")).toBe("010203/disband/terminal");
  });

  it("round-trips authenticated terminal evidence", () => {
    expect(decodeDisbandTombstone(encodeDisbandTombstone(tombstone))).toEqual(
      tombstone,
    );
  });

  it("fails closed on unknown, corrupt, and semantically invalid records", () => {
    const encoder = new TextEncoder();
    expect(() => decodeDisbandTombstone(encoder.encode("not-json"))).toThrow();
    expect(() =>
      decodeDisbandTombstone(
        encoder.encode(
          JSON.stringify({
            version: 2,
            groupId: "010203",
            selectedEpoch: 7,
            commitDigest: "04".repeat(32),
            actorPubkey: "a".repeat(64),
            notificationState: "pending",
          }),
        ),
      ),
    ).toThrow();
    expect(() =>
      decodeDisbandTombstone(
        encoder.encode(
          JSON.stringify({
            version: 1,
            groupId: "010203",
            selectedEpoch: -1,
            commitDigest: "04",
            actorPubkey: "not-a-pubkey",
            notificationState: "pending",
          }),
        ),
      ),
    ).toThrow();
  });
});
