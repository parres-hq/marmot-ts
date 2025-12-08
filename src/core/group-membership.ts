import {
  CiphersuiteImpl,
  CreateCommitResult,
  Proposal,
  createCommit,
} from "ts-mls";
import { ClientState } from "ts-mls/clientState.js";
import { KeyPackage } from "ts-mls/keyPackage.js";
/**
 * Adds a new member to an existing MLS group.
 *
 * @param currentClientState - The current client state of the group
 * @param newMemberKeyPackage - The key package of the new member to add
 * @param ciphersuiteImpl - The cipher suite implementation for cryptographic operations
 * @returns Promise resolving to the commit, welcome message, and new client state
 * @throws Error if the member addition fails or parameters are invalid
 */
export async function addMemberToGroup(
  currentClientState: ClientState,
  newMemberKeyPackage: KeyPackage,
  ciphersuiteImpl: CiphersuiteImpl,
): Promise<CreateCommitResult> {
  // Create an Add proposal for the new member
  const addProposal: Proposal = {
    proposalType: "add",
    add: { keyPackage: newMemberKeyPackage },
  };

  // Commit the proposal with ratchet tree extension enabled
  return await createCommit(
    { state: currentClientState, cipherSuite: ciphersuiteImpl },
    {
      extraProposals: [addProposal],
      ratchetTreeExtension: true,
    },
  );
}
