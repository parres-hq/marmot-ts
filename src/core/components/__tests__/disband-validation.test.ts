import {
  appDataUpdateProposalType,
  defaultProposalTypes,
  nodeTypes,
  type ClientState,
  type ProposalWithSender,
} from "ts-mls";
import { describe, expect, it } from "vitest";

import { createCredential } from "../../credential.js";
import {
  adminPolicyEntry,
  appComponentsEntry,
  groupLifecycleEntry,
  makeAppComponentsExtension,
} from "../dictionary.js";
import {
  APP_COMPONENTS_COMPONENT_ID,
  GROUP_ADMIN_POLICY_COMPONENT_ID,
  GROUP_LIFECYCLE_COMPONENT_ID,
} from "../ids.js";
import { encodeAdminPolicyV1 } from "../admin-policy.js";
import { encodeComponentsList } from "../app-components-list.js";
import { encodeGroupLifecycleV1 } from "../group-lifecycle.js";
import { classifyDisbandCommit } from "../disband-validation.js";

const ADMIN = "a".repeat(64);
const MEMBER = "e".repeat(64);

function state(
  members: string[],
  lifecycle: "active" | "disbanded" | undefined,
  required: number[],
  admins = [ADMIN],
): ClientState {
  const entries = [appComponentsEntry(required), adminPolicyEntry(admins)];
  if (lifecycle) entries.push(groupLifecycleEntry(lifecycle));
  const tree = members.flatMap((pubkey, index) => [
    {
      nodeType: nodeTypes.leaf,
      leaf: {
        credential: createCredential(pubkey),
        extensions: [
          makeAppComponentsExtension([
            appComponentsEntry([GROUP_LIFECYCLE_COMPONENT_ID]),
          ]),
        ],
      },
    },
    ...(index === members.length - 1 ? [] : [undefined]),
  ]);
  return {
    groupContext: { extensions: [makeAppComponentsExtension(entries)] },
    ratchetTree: tree,
  } as unknown as ClientState;
}

function update(componentId: number, bytes: Uint8Array): ProposalWithSender {
  return {
    senderLeafIndex: 0,
    proposal: {
      proposalType: appDataUpdateProposalType,
      appDataUpdate: { componentId, operation: "update", update: bytes },
    },
  };
}

describe("classifyDisbandCommit", () => {
  it("accepts the exact active-to-disbanded shape and reports its actor", () => {
    const result = classifyDisbandCommit({
      parentState: state([ADMIN, MEMBER], "active", [
        GROUP_LIFECYCLE_COMPONENT_ID,
      ]),
      resultingState: state([ADMIN], "disbanded", [
        GROUP_LIFECYCLE_COMPONENT_ID,
      ]),
      committerLeafIndex: 0,
      proposals: [
        {
          senderLeafIndex: 0,
          proposal: {
            proposalType: defaultProposalTypes.remove,
            remove: { removed: 1 },
          },
        },
        update(
          GROUP_LIFECYCLE_COMPONENT_ID,
          encodeGroupLifecycleV1("disbanded"),
        ),
        update(GROUP_ADMIN_POLICY_COMPONENT_ID, encodeAdminPolicyV1([ADMIN])),
      ],
    });
    expect(result).toEqual({ kind: "validDisband", actorPubkey: ADMIN });
  });

  it("rejects unrelated proposals and sibling leaves left behind", () => {
    const result = classifyDisbandCommit({
      parentState: state([ADMIN, ADMIN, MEMBER], "active", [
        GROUP_LIFECYCLE_COMPONENT_ID,
      ]),
      resultingState: state([ADMIN, ADMIN], "disbanded", [
        GROUP_LIFECYCLE_COMPONENT_ID,
      ]),
      committerLeafIndex: 0,
      proposals: [
        {
          senderLeafIndex: 0,
          proposal: {
            proposalType: defaultProposalTypes.remove,
            remove: { removed: 2 },
          },
        },
        update(
          GROUP_LIFECYCLE_COMPONENT_ID,
          encodeGroupLifecycleV1("disbanded"),
        ),
        update(GROUP_ADMIN_POLICY_COMPONENT_ID, encodeAdminPolicyV1([ADMIN])),
      ],
    });
    expect(result.kind).toBe("violation");
  });

  it("accepts atomic legacy enablement and rejects partial enablement", () => {
    const parent = state([ADMIN, MEMBER], undefined, [], [ADMIN]);
    const enabled = state(
      [ADMIN, MEMBER],
      "active",
      [GROUP_LIFECYCLE_COMPONENT_ID],
      [ADMIN],
    );
    const both = [
      update(
        APP_COMPONENTS_COMPONENT_ID,
        encodeComponentsList([GROUP_LIFECYCLE_COMPONENT_ID]),
      ),
      update(GROUP_LIFECYCLE_COMPONENT_ID, encodeGroupLifecycleV1("active")),
    ];
    expect(
      classifyDisbandCommit({
        parentState: parent,
        resultingState: enabled,
        committerLeafIndex: 0,
        proposals: both,
      }),
    ).toEqual({ kind: "validEnablement", actorPubkey: ADMIN });
    expect(
      classifyDisbandCommit({
        parentState: parent,
        resultingState: enabled,
        committerLeafIndex: 0,
        proposals: both.slice(1),
      }).kind,
    ).toBe("violation");
  });
});
