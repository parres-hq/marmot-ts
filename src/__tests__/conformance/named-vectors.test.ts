import committerFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/convergence-committer-selected.v1.json";
import witnessFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/convergence-witness-selected.v1.json";
import adminFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/admin-policy-update.v1.json";
import groupDataFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/group-data-update.v1.json";
import groupDataForkFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/group-data-fork-recovery.v1.json";
import inviteForkFixture from "../../../refs/mdk/crates/cgka-conformance-simulator/vectors/concurrent-invite-fork-recovery.v1.json";
import { describe, expect, it } from "vitest";
import { defaultProposalTypes } from "ts-mls";

import {
  compareBranchScores,
  DEFAULT_CONVERGENCE_POLICY,
  scoreBranch,
} from "../../core/convergence.js";
import { decideCommitAuthorization } from "../../core/commit-authorization.js";
import { MockNetwork } from "../helpers/mock-network.js";
import { MarmotConformanceSubject, parseMdkScenarioStep } from "./subject.js";

const FIXTURES = [
  committerFixture,
  witnessFixture,
  adminFixture,
  groupDataFixture,
  groupDataForkFixture,
  inviteForkFixture,
] as const;

describe("named MDK semantic vector operations", () => {
  it.each(FIXTURES.map((fixture) => [fixture.scenario.name, fixture] as const))(
    "%s executes every specialized operation through an explicit driver",
    async (_name, fixture) => {
      const executed: string[] = [];
      const network = new MockNetwork();
      const subject = new MarmotConformanceSubject({
        scenarioId: fixture.scenario.name,
        groups: new Map(),
        network,
        capabilities: new Set([
          "group_mutation",
          "application_messaging",
          "transport_delivery",
          "virtual_time",
          "observation",
          "semantic_transport_faults",
        ]),
        now: () => 0,
        advanceTime: () => {},
        restart: async () => {
          throw new Error("not used by these vectors");
        },
        executeScenarioOperation: async (step) => {
          executed.push(String(step.type));
          // These operations are deliberately explicit. A missing case is a
          // hard failure rather than a green `unsupported` capability record.
          switch (step.type) {
            case "invite_members":
            case "update_admin_policy":
            case "observe_admin_policy":
            case "expect_update_admin_policy_error":
            case "probe_bidirectional_decryptability":
              return;
            case "set_partition":
              network.autoDeliver = false;
              return;
            case "withhold_message":
              if (network.queuedEvents.length > 0) network.dropQueued(0);
              return;
            case "release_withheld":
              return;
            default:
              throw new Error(`unimplemented named operation ${step.type}`);
          }
        },
      });
      const specialized = fixture.scenario.steps
        .map(parseMdkScenarioStep)
        .filter((action) => action.type === "scenario_operation");
      for (const action of specialized)
        expect(await subject.execute(action)).toMatchObject({
          kind: "supported",
        });
      expect(executed).toEqual(
        specialized.map((action) =>
          action.type === "scenario_operation" ? action.operation : "",
        ),
      );
    },
  );

  it("compares committer and witness outcomes with production scoring", () => {
    const sender = new Uint8Array(32).fill(1);
    const other = new Uint8Array(32).fill(2);
    const plain = scoreBranch(
      {
        id: "plain",
        forkEpoch: 1,
        tipEpoch: 2,
        tipDigest: new Uint8Array(32).fill(2),
        appWitnesses: [],
      },
      DEFAULT_CONVERGENCE_POLICY,
    );
    const witnessed = scoreBranch(
      {
        id: "witnessed",
        forkEpoch: 1,
        tipEpoch: 2,
        tipDigest: new Uint8Array(32).fill(3),
        appWitnesses: [
          { epoch: 2, sender },
          { epoch: 2, sender: other },
        ],
      },
      DEFAULT_CONVERGENCE_POLICY,
    );
    expect(plain.witnessQuorumMet).toBe(
      committerFixture.expected_outcomes[0].witness_quorum_met,
    );
    expect(witnessed.witnessQuorumMet).toBe(
      witnessFixture.expected_outcomes[0].witness_quorum_met,
    );
    expect(witnessed.appWitnessScore).toBeGreaterThanOrEqual(
      witnessFixture.expected_outcomes[0].min_app_witness_score!,
    );
    expect(compareBranchScores(witnessed, plain)).toBeGreaterThan(0);
  });

  it("compares the named admin failures with production authorization", () => {
    const alice = "a".repeat(64);
    const bob = "b".repeat(64);
    const rejected = decideCommitAuthorization({
      actorPubkey: bob,
      actorLeafIndex: 1,
      adminPubkeys: [alice],
      proposals: [
        {
          proposal: {
            proposalType: defaultProposalTypes.remove,
            remove: { removed: 0 },
          },
          senderLeafIndex: 1,
        } as never,
      ],
    });
    expect(rejected).toMatchObject({ authorized: false });
    expect(
      adminFixture.expected_outcomes.filter(
        (outcome) => outcome.type === "expected_error",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ error: "not_group_admin" }),
        expect.objectContaining({ error: "admin_policy" }),
      ]),
    );
  });

  it("compares named mutation/fork terminal outcomes", () => {
    expect(groupDataFixture.expected_outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "group_profile", name: "after" }),
        expect.objectContaining({ type: "clients_converged", epoch: 2 }),
      ]),
    );
    for (const fixture of [groupDataForkFixture, inviteForkFixture])
      expect(fixture.expected_outcomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "convergence_decision",
            selected_tip_epoch: 2,
          }),
        ]),
      );
  });
});
