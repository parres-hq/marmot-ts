import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import {
  decodeGroupLifecycleV1,
  encodeGroupLifecycleV1,
  groupProtocolLifecycleValues,
} from "../group-lifecycle.js";

describe("group.lifecycle.v1 (0x800c)", () => {
  it.each([
    [groupProtocolLifecycleValues.active, "00"],
    [groupProtocolLifecycleValues.disbanded, "01"],
  ] as const)("round-trips %s as exactly %s", (value, expectedHex) => {
    const encoded = encodeGroupLifecycleV1(value);
    expect(bytesToHex(encoded)).toBe(expectedHex);
    expect(decodeGroupLifecycleV1(encoded)).toBe(value);
  });

  it.each([
    ["empty", new Uint8Array()],
    ["unknown", new Uint8Array([2])],
    ["active with trailing data", new Uint8Array([0, 0])],
    ["disbanded with trailing data", new Uint8Array([1, 0])],
  ])("rejects %s input", (_name, data) => {
    expect(() => decodeGroupLifecycleV1(data)).toThrow();
  });
});
