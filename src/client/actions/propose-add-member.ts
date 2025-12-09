import { NostrEvent } from "applesauce-core/helpers/event";
import { extractMarmotGroupData } from "../../core/client-state.js";
import { createAddMemberProposalMessage } from "../../core/group-membership.js";
import { createGroupEvent } from "../../core/group-message.js";
import { getKeyPackage } from "../../core/key-package.js";
import type { GroupAction } from "../marmot-group.js";

/**
 * Options for proposing the addition of a new member to a group.
 *
 * This represents the **proposal phase** of the add-member flow. Any existing
 * group member can call this action to suggest that a new member (represented
 * by a KeyPackage event) should be added to the group.
 */
export interface ProposeAddMemberOptions {
  /**
   * The KeyPackage event (kind 443) for the user that should be added to the
   * group.
   */
  keyPackageEvent: NostrEvent;

  /**
   * Optional explicit relay list for publishing the proposal.
   *
   * If not provided, the group's relay list from `MarmotGroupData.relays`
   * will be used.
   */
  relays?: string[];
}

/**
 * Builds a {@link GroupAction} that publishes an "add member" proposal as a
 * Group Event (kind 445).
 *
 * This action does **not** change the local MLS state. It simply publishes a
 * proposal that admins can later review and turn into a Commit using a
 * separate transaction (e.g. `acceptAddMember`).
 */
export function proposeAddMember(
  options: ProposeAddMemberOptions,
): GroupAction {
  return async ({ state, pool, ciphersuite }) => {
    const { keyPackageEvent, relays } = options;

    // Basic validation that the supplied event is a usable KeyPackage
    // (throws if decoding fails).
    getKeyPackage(keyPackageEvent);

    const marmotData = extractMarmotGroupData(state);
    if (!marmotData)
      throw new Error("MarmotGroupData not found in ClientState for proposal");

    const groupRelays = marmotData.relays ?? [];
    const publishRelays = relays && relays.length > 0 ? relays : groupRelays;

    if (publishRelays.length === 0)
      throw new Error(
        "No relays available to publish add-member proposal (group has no relays and none were provided)",
      );

    const keyPackage = getKeyPackage(keyPackageEvent);

    // Build the MLS Proposal message & wrap it in a NIP‑44 encrypted
    // Group Event using the shared core helpers.
    const proposalMessage = await createAddMemberProposalMessage(
      state,
      keyPackage,
      ciphersuite,
    );
    const proposalEvent = await createGroupEvent(
      proposalMessage,
      state,
      ciphersuite,
    );

    await pool.publish(publishRelays, proposalEvent);
  };
}
