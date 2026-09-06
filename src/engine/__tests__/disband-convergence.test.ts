import {
  defaultCryptoProvider,
  defaultProposalTypes,
  getCiphersuiteImpl,
  joinGroup,
  createCommit,
  type MlsMessage,
  unsafeTestingAuthenticationService,
} from "ts-mls";
import { describe, expect, it } from "vitest";

import { createCredential } from "../../core/credential.js";
import { createSimpleGroup } from "../../core/group.js";
import { generateKeyPackage } from "../../core/key-package.js";
import { InMemoryKeyValueStore } from "../../extra/in-memory-key-value-store.js";
import { MarmotGroupEngine } from "../group-engine.js";
import type { GroupPeeler } from "../types.js";

describe("bounded disband convergence", () => {
  it("holds a valid linear disband until cutoff and terminalizes only its selected branch", async () => {
    const admin = "a".repeat(64);
    const member = "d".repeat(64);
    const ciphersuite = await getCiphersuiteImpl(
      "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
      defaultCryptoProvider,
    );
    const context = {
      cipherSuite: ciphersuite,
      authService: unsafeTestingAuthenticationService,
    };
    const adminPackage = await generateKeyPackage({
      credential: createCredential(admin),
      ciphersuiteImpl: ciphersuite,
    });
    const memberPackage = await generateKeyPackage({
      credential: createCredential(member),
      ciphersuiteImpl: ciphersuite,
    });
    const { clientState: adminEpoch0 } = await createSimpleGroup(
      adminPackage,
      ciphersuite,
      "Terminal",
      { adminPubkeys: [admin], relays: [] },
    );
    const add = await createCommit({
      context,
      state: adminEpoch0,
      wireAsPublicMessage: false,
      ratchetTreeExtension: true,
      extraProposals: [
        {
          proposalType: defaultProposalTypes.add,
          add: { keyPackage: memberPackage.publicPackage },
        },
      ],
    });
    const memberEpoch1 = await joinGroup({
      context,
      welcome: add.welcome!.welcome!,
      keyPackage: memberPackage.publicPackage,
      privateKeys: memberPackage.privatePackage,
      ratchetTree: undefined,
    });
    type Envelope = { id: string };
    const messages = new Map<string, MlsMessage>();
    let nextEnvelope = 0;
    const peeler: GroupPeeler<Envelope> = {
      async peelGroupMessages(envelopes) {
        return {
          read: envelopes.map((envelope) => ({
            envelope,
            message: messages.get(envelope.id)!,
          })),
          unreadable: [],
        };
      },
      wrapGroupMessage(message) {
        const id = `e-${nextEnvelope++}`;
        messages.set(id, message);
        return Promise.resolve({ id });
      },
      idOf(envelope) {
        return envelope.id;
      },
    };
    let nowMs = 100;
    const observer = new MarmotGroupEngine({
      state: memberEpoch1,
      ciphersuite,
      peeler,
      now: () => nowMs,
      settlementQuiescenceMs: 1_000,
    });
    const author = new MarmotGroupEngine({
      state: add.newState,
      ciphersuite,
      peeler,
      lifecycleStore: new InMemoryKeyValueStore<Uint8Array>(),
    });
    const candidate = await author.requestDisband();
    if (candidate?.kind !== "groupEvolution")
      throw new Error("expected disband candidate");

    const beforeEpoch = Number(observer.state.groupContext.epoch);
    const yielded = [];
    for await (const result of observer.ingest([candidate.envelope]))
      yielded.push(result);

    expect(yielded).toEqual([]);
    expect(observer.lifecycle).toBe("Recovering");
    expect(Number(observer.state.groupContext.epoch)).toBe(beforeEpoch);
    expect(observer.convergencePass).toMatchObject({
      generation: 1,
      openedAtMs: 100,
      deadlineMs: 5_100,
      lastRelevantInputMs: 100,
      baseEpoch: beforeEpoch,
    });

    nowMs = 1_100;
    await observer.driveConvergence();
    expect(observer.lifecycle).toBe("Disbanded");
    expect(observer.state.groupActiveState.kind).toBe("removedFromGroup");
  });
});
