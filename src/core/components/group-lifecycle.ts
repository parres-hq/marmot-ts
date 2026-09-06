/** @module @category Core - App Components */
import { BinaryReader, BinaryWriter } from "../binary.js";

/** Protocol lifecycle values carried by `marmot.group.lifecycle.v1`. */
export const groupProtocolLifecycleValues = {
  active: "active",
  disbanded: "disbanded",
} as const;

export type GroupProtocolLifecycleValue =
  (typeof groupProtocolLifecycleValues)[keyof typeof groupProtocolLifecycleValues];

/** Encodes the lifecycle state as its exact one-byte wire value. */
export function encodeGroupLifecycleV1(
  value: GroupProtocolLifecycleValue,
): Uint8Array {
  const encoded =
    value === groupProtocolLifecycleValues.active
      ? 0
      : value === groupProtocolLifecycleValues.disbanded
        ? 1
        : undefined;
  if (encoded === undefined) throw new Error("unknown group lifecycle value");
  return new BinaryWriter().uint8(encoded).build();
}

/** Decodes an exact one-byte `marmot.group.lifecycle.v1` value. */
export function decodeGroupLifecycleV1(
  data: Uint8Array,
): GroupProtocolLifecycleValue {
  const reader = new BinaryReader(data);
  const encoded = reader.uint8();
  reader.end();
  switch (encoded) {
    case 0:
      return groupProtocolLifecycleValues.active;
    case 1:
      return groupProtocolLifecycleValues.disbanded;
    default:
      throw new Error(`unknown group lifecycle value: ${encoded}`);
  }
}
