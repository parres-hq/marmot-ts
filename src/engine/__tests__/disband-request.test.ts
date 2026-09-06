import { describe, expect, it } from "vitest";

import {
  decodeDisbandRequest,
  disbandRequestKey,
  encodeDisbandRequest,
  type DisbandRequest,
} from "../disband-request.js";

describe("durable disband request codec", () => {
  it("round-trips a versioned pending request in the group namespace", () => {
    const request: DisbandRequest = {
      status: "pending",
      requestedAtMs: 42,
      lastPreparedEpoch: 7,
    };
    expect(decodeDisbandRequest(encodeDisbandRequest(request))).toEqual(request);
    expect(disbandRequestKey("deadbeef")).toBe("deadbeef/disband/request");
  });

  it("round-trips typed terminal authority failures", () => {
    for (const reason of ["NoLongerMember", "NoLongerAdmin"] as const) {
      const request: DisbandRequest = {
        status: "failed",
        reason,
        requestedAtMs: 42,
        lastPreparedEpoch: null,
      };
      expect(decodeDisbandRequest(encodeDisbandRequest(request))).toEqual(
        request,
      );
    }
  });

  it("rejects malformed, unknown-version, and invalid status records", () => {
    expect(() => decodeDisbandRequest(new Uint8Array())).toThrow();
    expect(() =>
      decodeDisbandRequest(new TextEncoder().encode('{"version":2}')),
    ).toThrow();
    expect(() =>
      decodeDisbandRequest(
        new TextEncoder().encode(
          '{"version":1,"status":"cancelled","requestedAtMs":1,"lastPreparedEpoch":null}',
        ),
      ),
    ).toThrow();
  });
});
