import {
  CiphersuiteImpl,
  CreateCommitResult,
  Proposal,
  createCommit,
  createProposal,
} from "ts-mls";
import { ClientState } from "ts-mls/clientState.js";
import { KeyPackage } from "ts-mls/keyPackage.js";
import type { MLSMessage } from "ts-mls/message.js";

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

/**
 * Creates an MLS Proposal message for adding a new member to the group.
 *
 * This does **not** change the ratchet tree itself; it just produces the
 * MLSMessage that can be wrapped as a Group Event and published.
 */
export async function createAddMemberProposalMessage(
  currentClientState: ClientState,
  newMemberKeyPackage: KeyPackage,
  ciphersuiteImpl: CiphersuiteImpl,
): Promise<MLSMessage> {
  const addProposal: Proposal = {
    proposalType: "add",
    add: { keyPackage: newMemberKeyPackage },
  };

  const { message } = await createProposal(
    currentClientState,
    true, // public message
    addProposal,
    ciphersuiteImpl,
  );

  return message;
}
