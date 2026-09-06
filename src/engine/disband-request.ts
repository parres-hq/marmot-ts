/** @module @category Engine */

export type DisbandFailureReason = "NoLongerMember" | "NoLongerAdmin";

export type DisbandRequest =
  | {
      status: "pending";
      requestedAtMs: number;
      lastPreparedEpoch: number | null;
    }
  | {
      status: "failed";
      reason: DisbandFailureReason;
      requestedAtMs: number;
      lastPreparedEpoch: null;
    };

type StoredDisbandRequest = DisbandRequest & { version: 1 };

export function disbandRequestKey(groupIdHex: string): string {
  return `${groupIdHex}/disband/request`;
}

export function encodeDisbandRequest(request: DisbandRequest): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ version: 1, ...request } satisfies StoredDisbandRequest),
  );
}

export function decodeDisbandRequest(data: Uint8Array): DisbandRequest {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new Error("Invalid disband request encoding");
  }
  if (!value || typeof value !== "object")
    throw new Error("Invalid disband request record");
  const record = value as Partial<StoredDisbandRequest>;
  if (
    record.version !== 1 ||
    typeof record.requestedAtMs !== "number" ||
    !Number.isFinite(record.requestedAtMs) ||
    (record.lastPreparedEpoch !== null &&
      (typeof record.lastPreparedEpoch !== "number" ||
        !Number.isSafeInteger(record.lastPreparedEpoch) ||
        record.lastPreparedEpoch < 0))
  )
    throw new Error("Invalid disband request record");
  if (record.status === "pending") {
    return {
      status: "pending",
      requestedAtMs: record.requestedAtMs,
      lastPreparedEpoch: record.lastPreparedEpoch,
    };
  }
  if (
    record.status === "failed" &&
    (record.reason === "NoLongerMember" || record.reason === "NoLongerAdmin") &&
    record.lastPreparedEpoch === null
  ) {
    return {
      status: "failed",
      reason: record.reason,
      requestedAtMs: record.requestedAtMs,
      lastPreparedEpoch: null,
    };
  }
  throw new Error("Invalid disband request record");
}
