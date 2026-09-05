import committerFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/convergence-committer-selected.v1.json";
import witnessFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/convergence-witness-selected.v1.json";
import adminFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/admin-policy-update.v1.json";
import groupDataFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/group-data-update.v1.json";
import groupDataForkFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/group-data-fork-recovery.v1.json";
import inviteForkFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/concurrent-invite-fork-recovery.v1.json";
import { PrivateKeyAccount } from "applesauce-accounts/accounts";
import {
  createCommit,
  defaultCryptoProvider,
  defaultProposalTypes,
  getCiphersuiteImpl,
  joinGroup,
  unsafeTestingAuthenticationService,
  type ClientState,
  type KeyPackageWithPrivateKey,
} from "ts-mls";
import { describe, expect, it } from "vitest";

import { MarmotGroup } from "../../client/group/marmot-group.js";
import { proposeInviteUser } from "../../client/group/proposals/invite-user.js";
import { proposeUpdateMetadata } from "../../client/group/proposals/update-metadata.js";
import { createCredential } from "../../core/credential.js";
import { createSimpleGroup } from "../../core/group.js";
import { generateKeyPackage } from "../../core/key-package.js";
import { InMemoryKeyValueStore } from "../../extra/in-memory-key-value-store.js";
import { MockNetwork } from "../helpers/mock-network.js";
import { MarmotConformanceSubject, parseMdkScenarioStep } from "./subject.js";
import type { CanonicalConformanceSnapshot } from "./snapshot.js";

const FIXTURES = [
  committerFixture,
  witnessFixture,
  adminFixture,
  groupDataFixture,
  groupDataForkFixture,
  inviteForkFixture,
] as const;
const ACTORS = ["alice", "bob", "carol", "david", "eve"] as const;

type Fixture = (typeof FIXTURES)[number];

async function executeFixture(fixture: Fixture) {
  const create = fixture.scenario.steps[0] as {
    type: "create_group";
    creator: string;
    invitees: string[];
    name: string;
    initial_admins?: string[];
  };
  const ciphersuite = await getCiphersuiteImpl(
    "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
    defaultCryptoProvider,
  );
  const accounts = new Map(
    ACTORS.map((actor, index) => [
      actor,
      PrivateKeyAccount.fromKey((index + 11).toString(16).padStart(64, "0")),
    ]),
  );
  const identities = new Map(
    await Promise.all(
      ACTORS.map(
        async (actor) =>
          [actor, await accounts.get(actor)!.signer.getPublicKey()] as const,
      ),
    ),
  );
  const packages = new Map<string, KeyPackageWithPrivateKey>(
    await Promise.all(
      ACTORS.map(
        async (actor) =>
          [
            actor,
            await generateKeyPackage({
              credential: createCredential(identities.get(actor)!),
              accountProofSigner: accounts.get(actor)!.signer,
              ciphersuiteImpl: ciphersuite,
            }),
          ] as const,
      ),
    ),
  );
  const { clientState: epoch0 } = await createSimpleGroup(
    packages.get(create.creator)!,
    ciphersuite,
    create.name,
    {
      adminPubkeys: [
        ...(create.initial_admins ?? []),
        ...(fixture.scenario.name.includes("fork-recovery")
          ? create.invitees
          : []),
      ].map((actor) => identities.get(actor)!),
      relays: ["wss://mock-relay.test"],
    },
  );
  const initial = await createCommit({
    context: {
      cipherSuite: ciphersuite,
      authService: unsafeTestingAuthenticationService,
    },
    state: epoch0,
    wireAsPublicMessage: false,
    ratchetTreeExtension: true,
    extraProposals: create.invitees.map((actor) => ({
      proposalType: defaultProposalTypes.add,
      add: { keyPackage: packages.get(actor)!.publicPackage },
    })),
  });
  const states = new Map<string, ClientState>([
    [create.creator, initial.newState],
  ]);
  for (const actor of create.invitees) {
    const kp = packages.get(actor)!;
    states.set(
      actor,
      await joinGroup({
        context: {
          cipherSuite: ciphersuite,
          authService: unsafeTestingAuthenticationService,
        },
        welcome: initial.welcome!.welcome!,
        keyPackage: kp.publicPackage,
        privateKeys: kp.privatePackage,
        ratchetTree: undefined,
      }),
    );
  }
  const network = new MockNetwork();
  network.autoDeliver = false;
  const groups = new Map<string, MarmotGroup>();
  const makeGroup = (actor: string, state: ClientState) =>
    new MarmotGroup(state, {
      store: new InMemoryKeyValueStore(),
      ingestStateStore: new InMemoryKeyValueStore<Uint8Array>(),
      rewindStore: new InMemoryKeyValueStore<Uint8Array>(),
      signer: accounts.get(actor)!.signer,
      ciphersuite,
      network,
    });
  for (const [actor, state] of states) {
    const group = makeGroup(actor, state);
    await group.save(true);
    groups.set(actor, group);
  }
  const publishMetadata = async (
    client: string,
    metadata: Parameters<typeof proposeUpdateMetadata>[0],
  ) => {
    const group = groups.get(client)!;
    const proposals = await proposeUpdateMetadata(metadata)(
      group.session.proposalContext(),
    );
    const effects = await group.session.send({
      kind: "commit",
      actorPubkey: identities.get(client)!,
      extraProposals: proposals,
    });
    await group.runtime.publishEffects(effects);
  };
  const subject = new MarmotConformanceSubject({
    scenarioId: fixture.scenario.name,
    groups,
    identities,
    keyPackages: new Map(
      [...packages].map(([actor, kp]) => [actor, kp.publicPackage]),
    ),
    network,
    capabilities: new Set([
      "group_mutation",
      "application_messaging",
      "transport_delivery",
      "virtual_time",
      "observation",
      "semantic_transport_faults",
    ]),
    now: () => 1_000,
    advanceTime: () => {},
    restart: async () => {
      throw new Error("named fixtures contain no restart");
    },
    executeScenarioOperation: async (step) => {
      if (step.type === "expect_update_admin_policy_error") {
        await expect(
          publishMetadata(String(step.client), {
            adminPubkeys: (step.admins as string[]).map((actor) =>
              identities.get(actor)!,
            ),
          }),
        ).rejects.toThrow();
        return;
      }
      throw new Error(`unimplemented operation ${String(step.type)}`);
    },
  });
  const held = new Map<string, (typeof network.queuedEvents)[number]>();
  const publications = new Map<string, (typeof network.queuedEvents)[number]>();
  let snapshots: Record<string, CanonicalConformanceSnapshot> = {};

  for (const raw of fixture.scenario.steps as readonly Record<
    string,
    unknown
  >[]) {
    if (raw.type === "invite_members") {
      const before = network.queuedEvents.length;
      const inviter = String(raw.inviter);
      const invitees = raw.invitees as string[];
      const group = groups.get(inviter)!;
      const results = await group.submitIntent({
        kind: "commit",
        actorPubkey: identities.get(inviter)!,
        extraProposals: invitees.map((actor) =>
          proposeInviteUser(packages.get(actor)!.publicPackage),
        ),
      });
      const publication = network.queuedEvents[before]!;
      publications.set(String(raw.pending), publication);
      const welcome = results.find(
        (result) => result.work.kind === "groupEvolution",
      )?.work;
      if (welcome?.kind === "groupEvolution" && welcome.welcome) {
        for (const actor of invitees) {
          const kp = packages.get(actor)!;
          const state = await joinGroup({
            context: {
              cipherSuite: ciphersuite,
              authService: unsafeTestingAuthenticationService,
            },
            welcome:
              (welcome.welcome as { welcome?: never }).welcome ??
              welcome.welcome,
            keyPackage: kp.publicPackage,
            privateKeys: kp.privatePackage,
            ratchetTree: undefined,
          });
          groups.set(actor, makeGroup(actor, state));
        }
      }
      continue;
    }
    if (raw.type === "withhold_message") {
      const label = String(raw.label);
      const publication = String(
        (raw.selector as Record<string, unknown>).publication,
      );
      const event = publications.get(publication)!;
      const index = network.queuedEvents.indexOf(event);
      expect(index).toBeGreaterThanOrEqual(0);
      held.set(label, network.queuedEvents.splice(index, 1)[0]!);
      continue;
    }
    if (raw.type === "release_withheld") {
      network.queuedEvents.push(held.get(String(raw.label))!);
      continue;
    }
    if (raw.type === "expect_update_admin_policy_error") {
      await subject.execute(parseMdkScenarioStep(raw));
      continue;
    }
    if (raw.type === "update_group_data") {
      await publishMetadata(String(raw.client), { name: String(raw.name) });
      continue;
    }
    if (raw.type === "update_admin_policy") {
      await publishMetadata(String(raw.client), {
        adminPubkeys: (raw.admins as string[]).map((actor) =>
          identities.get(actor)!,
        ),
      });
      continue;
    }
    const result = await subject.execute(parseMdkScenarioStep(raw));
    expect(result.kind).toBe("supported");
    if (result.kind === "supported" && result.snapshots)
      snapshots = result.snapshots;
  }
  return { groups, snapshots, subject, identities };
}

describe("named MDK scenarios against real Marmot actors", () => {
  it.each(FIXTURES.map((fixture) => [fixture.scenario.name, fixture] as const))(
    "%s executes every step and matches its terminal outcomes",
    async (_name, fixture) => {
      const { groups, snapshots, subject, identities } =
        await executeFixture(fixture);
      const observedClients = new Set(
        fixture.expected_outcomes
          .filter((outcome) => "client" in outcome)
          .map((outcome) => (outcome as { client: string }).client),
      );
      for (const client of observedClients)
        snapshots[client] ??= await subject.snapshot(client);
      for (const expected of fixture.expected_outcomes) {
        if (expected.type === "client_state") {
          const snapshot = snapshots[expected.client]!;
          expect(snapshot.epoch).toBe(String(expected.epoch));
          expect(snapshot.leaves).toHaveLength(expected.member_count);
          expect(
            snapshot.application_outputs.map((output) => output.value),
          ).toEqual(expected.received_payloads);
        }
        if (expected.type === "group_profile")
          expect(groups.get(expected.client)!.groupData).toMatchObject({
            name: expected.name,
            description: expected.description,
          });
        if (expected.type === "admin_policy")
          expect(groups.get(expected.client)!.groupData?.adminPubkeys).toEqual(
            expected.admins.map((actor) => identities.get(actor)),
          );
        if (expected.type === "convergence_decision") {
          const client = "client" in expected ? expected.client : "alice";
          expect(Number(groups.get(client)!.state.groupContext.epoch)).toBe(
            expected.selected_tip_epoch,
          );
        }
      }
      const clientStates = fixture.expected_outcomes.filter(
        (outcome) => outcome.type === "client_state",
      );
      if (clientStates.length > 1) {
        const canonical = clientStates.map((expected) => {
          const snapshot = snapshots[expected.client]!;
          return {
            epoch: snapshot.epoch,
            context: snapshot.group_context_sha256,
            leaves: snapshot.leaves,
            dictionary: snapshot.app_data_dictionary,
          };
        });
        expect(canonical.slice(1)).toEqual(
          canonical.slice(1).map(() => canonical[0]),
        );
      }
    },
    60_000,
  );
});
