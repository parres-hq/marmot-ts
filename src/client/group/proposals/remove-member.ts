import { ProposalRemove } from "ts-mls/proposal.js";
import { getPubkeyLeafNodeIndexes } from "../../../core/group-members.js";
import { ProposalBuilder } from "../marmot-group.js";

/**
 * Proposes removing all leaf nodes (devices/clients) for a given Nostr user.
 * This returns a ProposalBuilder that creates an array of remove proposals.
 *
 * @param pubkey - The Nostr public key (hex string) of the user to kick
 * @returns A ProposalBuilder that returns an array of ProposalRemove proposals
 */
export function proposeKickUser(
  pubkey: string,
): ProposalBuilder<ProposalRemove[]> {
  return async ({ state }) => {
    const leafIndexes = getPubkeyLeafNodeIndexes(state, pubkey);

    if (leafIndexes.length === 0)
      throw new Error(`User with pubkey ${pubkey} not found in group`);

    // Return an array of proposals, one for each leaf node
    return leafIndexes.map(
      (leafIndex) =>
        ({
          proposalType: "remove",
          remove: { removed: leafIndex },
        }) satisfies ProposalRemove,
    );
  };
}
