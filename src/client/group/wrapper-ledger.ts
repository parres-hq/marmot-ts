import type { GenericKeyValueStore } from "../../utils/key-value.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { StateNotification } from "../../engine/state-notifications.js";

export type TerminalWrapperOutcome = "accepted" | "stale" | "invalidated";

type StoredTerminalWrapperV1 = {
  version: 1;
  outcome: TerminalWrapperOutcome;
};

type StoredWrapperV2 =
  | { version: 2; state: "prepared"; priorStateHash: string }
  | { version: 2; state: "terminal"; outcome: TerminalWrapperOutcome };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Durable, group-scoped record of verified transport wrappers handled terminally. */
export class TerminalWrapperLedger {
  constructor(
    readonly store: GenericKeyValueStore<Uint8Array>,
    readonly groupId: string,
  ) {}

  #key(eventId: string): string {
    return `${this.groupId}/ingest/wrapper/v1/${eventId}`;
  }

  async get(
    eventId: string,
    currentStateHash?: string,
  ): Promise<TerminalWrapperOutcome | undefined> {
    const bytes = await this.store.getItem(this.#key(eventId));
    if (!bytes) return undefined;
    try {
      const value = JSON.parse(
        decoder.decode(bytes),
      ) as StoredTerminalWrapperV1;
      if (
        value.version === 1 &&
        (value.outcome === "accepted" ||
          value.outcome === "stale" ||
          value.outcome === "invalidated")
      )
        return value.outcome;
      const current = value as unknown as StoredWrapperV2;
      if (current.version === 2 && current.state === "terminal")
        return current.outcome;
      if (
        current.version === 2 &&
        current.state === "prepared" &&
        currentStateHash !== undefined &&
        current.priorStateHash !== currentStateHash
      )
        return "accepted";
    } catch {
      // Corrupt evidence is ignored; the verified wrapper remains processable.
    }
    return undefined;
  }

  /** Records the durable pre-apply side of the ingest transaction. */
  async begin(eventId: string, priorStateHash: string): Promise<void> {
    if (await this.get(eventId, priorStateHash)) return;
    const existing = await this.store.getItem(this.#key(eventId));
    if (existing) return;
    const value: StoredWrapperV2 = {
      version: 2,
      state: "prepared",
      priorStateHash,
    };
    await this.store.setItem(
      this.#key(eventId),
      encoder.encode(JSON.stringify(value)),
    );
  }

  async record(
    eventId: string,
    outcome: TerminalWrapperOutcome,
  ): Promise<void> {
    const value: StoredWrapperV2 = { version: 2, state: "terminal", outcome };
    await this.store.setItem(
      this.#key(eventId),
      encoder.encode(JSON.stringify(value)),
    );
  }
}

type StoredEffectVerdictV1 = { version: 1; state: "withdrawn" | "active" };
type StoredEffectV2 = {
  version: 2;
  state: "pending" | "observed";
  direction: "withdrawal" | "adoption";
  forkEpoch?: number;
  notifications: Array<
    Omit<StateNotification, "commitDigest"> & { commitDigest: string }
  >;
};

export type PendingConvergenceEffect =
  | {
      kind: "stateInvalidated";
      commitDigest: Uint8Array;
      forkEpoch: number;
      withdrawn: StateNotification[];
    }
  | {
      kind: "stateRevalidated";
      commitDigest: Uint8Array;
      effectId: Uint8Array;
      notifications: StateNotification[];
    };

/** Durable observation verdicts for branch-selection withdrawal/re-adoption. */
export class ConvergenceEffectLedger {
  constructor(
    readonly store: GenericKeyValueStore<Uint8Array>,
    readonly groupId: string,
  ) {}

  #key(digest: Uint8Array): string {
    return `${this.groupId}/ingest/effect/v1/${bytesToHex(digest)}`;
  }

  async #readKey(
    key: string,
  ): Promise<StoredEffectVerdictV1 | StoredEffectV2 | undefined> {
    const bytes = await this.store.getItem(key);
    if (!bytes) return undefined;
    try {
      const value = JSON.parse(decoder.decode(bytes)) as
        StoredEffectVerdictV1 | StoredEffectV2;
      if (
        value.version === 1 &&
        (value.state === "withdrawn" || value.state === "active")
      )
        return value;
      if (
        value.version === 2 &&
        (value.state === "pending" || value.state === "observed") &&
        (value.direction === "withdrawal" || value.direction === "adoption") &&
        Array.isArray(value.notifications)
      )
        return value;
    } catch {
      // Corrupt local evidence cannot establish an observation boundary.
    }
    return undefined;
  }

  async #read(digest: Uint8Array) {
    return this.#readKey(this.#key(digest));
  }

  async #write(digest: Uint8Array, value: StoredEffectV2) {
    await this.store.setItem(
      this.#key(digest),
      encoder.encode(JSON.stringify(value)),
    );
  }

  async prepareWithdrawal(
    digest: Uint8Array,
    forkEpoch: number,
    notifications: readonly StateNotification[],
  ): Promise<boolean> {
    const existing = await this.#read(digest);
    if (existing?.version === 1 && existing.state === "withdrawn") return false;
    if (existing?.version === 2 && existing.direction === "withdrawal")
      return existing.state === "pending";
    await this.#write(digest, {
      version: 2,
      state: "pending",
      direction: "withdrawal",
      forkEpoch,
      notifications: notifications.map((notification) => ({
        ...notification,
        commitDigest: bytesToHex(notification.commitDigest),
      })),
    });
    return true;
  }

  async prepareAdoption(
    digest: Uint8Array,
    notifications: readonly StateNotification[],
  ): Promise<boolean> {
    const existing = await this.#read(digest);
    const withdrawn =
      (existing?.version === 1 && existing.state === "withdrawn") ||
      (existing?.version === 2 &&
        existing.direction === "withdrawal" &&
        existing.state === "observed");
    if (!withdrawn) {
      if (existing?.version === 2 && existing.direction === "adoption")
        return existing.state === "pending";
      return false;
    }
    await this.#write(digest, {
      version: 2,
      state: "pending",
      direction: "adoption",
      notifications: notifications.map((notification) => ({
        ...notification,
        commitDigest: bytesToHex(notification.commitDigest),
      })),
    });
    return true;
  }

  async acknowledge(
    digest: Uint8Array,
    direction: StoredEffectV2["direction"],
  ): Promise<void> {
    const existing = await this.#read(digest);
    if (
      existing?.version !== 2 ||
      existing.direction !== direction ||
      existing.state !== "pending"
    )
      return;
    await this.#write(digest, { ...existing, state: "observed" });
  }

  async pending(): Promise<PendingConvergenceEffect[]> {
    const prefix = `${this.groupId}/ingest/effect/v1/`;
    const pending: PendingConvergenceEffect[] = [];
    for (const key of await this.store.keys()) {
      if (!key.startsWith(prefix)) continue;
      const value = await this.#readKey(key);
      if (value?.version !== 2 || value.state !== "pending") continue;
      const digest = Uint8Array.from(
        key
          .slice(prefix.length)
          .match(/.{2}/g)
          ?.map((byte) => Number.parseInt(byte, 16)) ?? [],
      );
      const notifications = value.notifications.map((notification) => ({
        ...notification,
        commitDigest: Uint8Array.from(
          notification.commitDigest
            .match(/.{2}/g)
            ?.map((byte) => Number.parseInt(byte, 16)) ?? [],
        ),
      })) as StateNotification[];
      pending.push(
        value.direction === "withdrawal"
          ? {
              kind: "stateInvalidated",
              commitDigest: digest,
              forkEpoch: value.forkEpoch!,
              withdrawn: notifications,
            }
          : {
              kind: "stateRevalidated",
              commitDigest: digest,
              effectId: digest,
              notifications,
            },
      );
    }
    return pending;
  }
}
