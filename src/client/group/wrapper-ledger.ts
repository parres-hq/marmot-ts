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

/** Durable observation verdicts for branch-selection withdrawal/re-adoption. */
export class ConvergenceEffectLedger {
  constructor(
    readonly store: GenericKeyValueStore<Uint8Array>,
    readonly groupId: string,
  ) {}

  #key(digest: Uint8Array): string {
    return `${this.groupId}/ingest/effect/v1/${bytesToHex(digest)}`;
  }

  async #read(digest: Uint8Array): Promise<StoredEffectVerdictV1 | undefined> {
    const bytes = await this.store.getItem(this.#key(digest));
    if (!bytes) return undefined;
    try {
      const value = JSON.parse(decoder.decode(bytes)) as StoredEffectVerdictV1;
      if (
        value.version === 1 &&
        (value.state === "withdrawn" || value.state === "active")
      )
        return value;
    } catch {
      // Corrupt local evidence cannot establish an observation boundary.
    }
    return undefined;
  }

  async #write(digest: Uint8Array, state: StoredEffectVerdictV1["state"]) {
    await this.store.setItem(
      this.#key(digest),
      encoder.encode(JSON.stringify({ version: 1, state })),
    );
  }

  async recordWithdrawal(
    digest: Uint8Array,
    _notifications: readonly StateNotification[],
  ): Promise<boolean> {
    if ((await this.#read(digest))?.state === "withdrawn") return false;
    await this.#write(digest, "withdrawn");
    return true;
  }

  async recordAdoption(digest: Uint8Array): Promise<boolean> {
    if ((await this.#read(digest))?.state !== "withdrawn") return false;
    await this.#write(digest, "active");
    return true;
  }
}
