import type { NostrEvent } from "applesauce-core/helpers/event";
import {
  defaultCryptoProvider,
  getCiphersuiteImpl,
  type CiphersuiteImpl,
} from "ts-mls";
import { describe, expect, it } from "vitest";

import { createCredential } from "../../core/credential.js";
import { createSimpleGroup } from "../../core/group.js";
import { generateKeyPackage } from "../../core/key-package.js";
import { InMemoryKeyValueStore } from "../../extra/in-memory-key-value-store.js";
import { DisbandingError, MarmotGroupEngine } from "../group-engine.js";
import type { GroupPeeler } from "../types.js";

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
    expect(decodeDisbandRequest(encodeDisbandRequest(request))).toEqual(
      request,
    );
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

  async function engineFixture(
    lifecycleStore: InMemoryKeyValueStore<Uint8Array>,
  ) {
    const impl = await getCiphersuiteImpl(
      "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
      defaultCryptoProvider,
    );
    const kp = await generateKeyPackage({
      credential: createCredential("a".repeat(64)),
      ciphersuiteImpl: impl,
    });
    const { clientState } = await createSimpleGroup(kp, impl, "Disband", {
      adminPubkeys: ["a".repeat(64)],
      relays: [],
    });
    const peeler: GroupPeeler<NostrEvent> = {
      async peelGroupMessages(envelopes, state) {
        void state;
        return { read: [], unreadable: envelopes };
      },
      wrapGroupMessage(message, state) {
        void message;
        void state;
        return Promise.resolve({
          id: "candidate",
          pubkey: "a".repeat(64),
          created_at: 1,
          kind: 445,
          tags: [],
          content: "",
          sig: "0".repeat(128),
        });
      },
      idOf(envelope) {
        return envelope.id;
      },
    };
    return {
      state: clientState,
      makeEngine: (state = clientState) =>
        new MarmotGroupEngine({
          state,
          ciphersuite: impl as CiphersuiteImpl,
          peeler,
          lifecycleStore,
        }),
    };
  }

  it("persists before preparation, survives publish failure, and hydrates its gate", async () => {
    const store = new InMemoryKeyValueStore<Uint8Array>();
    const fixture = await engineFixture(store);
    const engine = fixture.makeEngine();
    const prepared = await engine.requestDisband();
    expect(prepared?.kind).toBe("groupEvolution");
    expect((await engine.disbandRequest())?.status).toBe("pending");
    if (prepared?.kind !== "groupEvolution") throw new Error("expected commit");
    engine.publishFailed(prepared.pending);
    const retried = await engine.requestDisband();
    expect(retried?.kind).toBe("groupEvolution");

    const restored = fixture.makeEngine();
    await expect(
      restored.send({ kind: "applicationMessage", payload: new Uint8Array() }),
    ).rejects.toBeInstanceOf(DisbandingError);
  });
});
