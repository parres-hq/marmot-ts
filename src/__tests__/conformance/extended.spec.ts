import fixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/deferred-tick-catchup.v1.json";
import { defaultCryptoProvider, getCiphersuiteImpl } from "ts-mls";
import { beforeAll, describe, expect, it } from "vitest";

import { GroupRegistry } from "../../client/group-registry.js";
import { MarmotGroup } from "../../client/group/marmot-group.js";
import { createCredential } from "../../core/credential.js";
import { createSimpleGroup } from "../../core/group.js";
import { generateKeyPackage } from "../../core/key-package.js";
import { InMemoryKeyValueStore } from "../../extra/in-memory-key-value-store.js";
import { MockNetwork } from "../helpers/mock-network.js";
import { MarmotConformanceSubject, parseMdkScenarioStep } from "./subject.js";

describe("deterministic offline catchup pressure", () => {
  let subject: MarmotConformanceSubject;

  beforeAll(async () => {
    const ciphersuite = await getCiphersuiteImpl(
      "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
      defaultCryptoProvider,
    );
    const pubkey = "a".repeat(64);
    const keyPackage = await generateKeyPackage({
      credential: createCredential(pubkey),
      ciphersuiteImpl: ciphersuite,
    });
    const { clientState } = await createSimpleGroup(
      keyPackage,
      ciphersuite,
      fixture.scenario.name,
      { adminPubkeys: [pubkey], relays: ["wss://mock-relay.test"] },
    );
    const store = new InMemoryKeyValueStore();
    const ingestStateStore = new InMemoryKeyValueStore<Uint8Array>();
    const rewindStore = new InMemoryKeyValueStore<Uint8Array>();
    const signer = { getPublicKey: async () => pubkey } as never;
    const network = new MockNetwork();
    network.autoDeliver = false;
    const group = new MarmotGroup(clientState, {
      store,
      ingestStateStore,
      rewindStore,
      signer,
      ciphersuite,
      network,
    });
    await group.save(true);
    const registry = new GroupRegistry({
      store,
      ingestStateStore,
      rewindStore,
      signer,
      network,
    });
    const groups = new Map(
      fixture.scenario.clients.map((client) => [client, group] as const),
    );
    let now = 0;
    subject = new MarmotConformanceSubject({
      scenarioId: fixture.scenario.name,
      groups,
      network,
      capabilities: new Set([
        "application_messaging",
        "transport_delivery",
        "virtual_time",
        "crash_reopen",
      ]),
      now: () => now,
      advanceTime: (milliseconds) => {
        now += milliseconds;
      },
      restart: async (client, current) => {
        const id = current.id.slice();
        current.dispose();
        const restarted = await registry.load(id);
        for (const [name, candidate] of groups)
          if (candidate === current || name === client)
            groups.set(name, restarted);
        return restarted;
      },
    });
  });

  expect(fixture.scenario.name).toBe("deferred-tick-catchup/v1");
  expect(fixture.expected_outcomes.map((outcome) => outcome.type)).toEqual(
    expect.arrayContaining([
      "pending_resolution",
      "client_state",
      "group_profile",
      "clients_converged",
      "no_pending_work",
    ]),
  );

  // Cases 6..23 are the fixture's offline traffic, missed commit, and catch-up
  // window. Each case is parsed from the pinned Scenario IR and routed through
  // the production-backed subject; unsupported mutations are explicit adapter
  // results rather than locally fabricated pass records.
  for (let index = 6; index <= 23; index++) {
    it(`deferred-tick-catchup/v1/step-${index}`, async () => {
      const step = fixture.scenario.steps[index];
      expect(step).toBeDefined();
      const action = parseMdkScenarioStep(step);
      const result = await subject.execute(action);
      if (action.type === "scenario_operation") {
        expect(result).toEqual({
          kind: "unsupported",
          scenarioId: fixture.scenario.name,
          capability: action.capability,
          reason: `subject does not support ${action.capability}`,
        });
      } else {
        expect(result).toMatchObject({
          kind: "supported",
          action: action.type,
        });
      }
    });
  }
});
