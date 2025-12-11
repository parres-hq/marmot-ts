import { createProposal, Proposal } from "ts-mls";
import { replaceExtension } from "../../core/extensions.js";
import { createGroupEvent } from "../../core/group-message.js";
import { marmotGroupDataToExtension } from "../../core/marmot-group-data.js";
import { MarmotGroupData } from "../../core/protocol.js";
import type { GroupAction } from "../marmot-group.js";

/**
 * Builds a {@link GroupAction} that publishes a "group context extensions"
 * proposal to change the group's name and/or description.
 *
 * This action does **not** change the local MLS state. It simply publishes a
 * proposal that admins can later review and turn into a Commit.
 *
 * Any group member can propose metadata changes, but only admins can commit
 * them.
 *
 * @example
 * ```ts
 * // Propose a new name
 * await group.action(proposeChangeMetadata, { name: "New Group Name" });
 *
 * // Propose a new description
 * await group.action(proposeChangeMetadata, { description: "Updated description" });
 *
 * // Propose both
 * await group.action(proposeChangeMetadata, {
 *   name: "New Name",
 *   description: "New description"
 * });
 * ```
 */
export function proposeUpdateMetadata(
  metadata: Partial<MarmotGroupData>,
): GroupAction {
  return async ({ state, ciphersuite, groupData, publish }) => {
    // Create updated group data, preserving existing values for unchanged fields
    const updatedGroupData: MarmotGroupData = {
      ...groupData,
      ...metadata,
    };

    // Convert to MLS extension
    const updatedExtension = marmotGroupDataToExtension(updatedGroupData);

    const proposal: Proposal = {
      proposalType: "group_context_extensions",
      groupContextExtensions: {
        // Replace the marmot group data extension with the updated one
        extensions: replaceExtension(
          state.groupContext.extensions,
          updatedExtension,
        ),
      },
    };

    // Create the proposal message
    // TODO: I don't know why the createProposal function returns a new ClientState object. This needs to be investigated
    const { message: proposalMessage } = await createProposal(
      state,
      true, // public message
      proposal,
      ciphersuite,
    );

    // Wrap in a Group Event and publish
    const proposalEvent = await createGroupEvent(
      proposalMessage,
      state,
      ciphersuite,
    );

    await publish(proposalEvent);
  };
}
