import { bytesToHex } from "@noble/hashes/utils.js";
import { NostrEvent, Rumor, UnsignedEvent } from "applesauce-core/helpers";
import { EventSigner } from "applesauce-factory";
import {
  CiphersuiteImpl,
  CreateCommitResult,
  Proposal,
  createCommit,
} from "ts-mls";
import { ClientState } from "ts-mls/clientState.js";
import { CredentialBasic } from "ts-mls/credential.js";
import { KeyPackage } from "ts-mls/keyPackage.js";
import { createGiftWrap } from "../utils/nostr.js";
import { extractMarmotGroupData } from "./client-state.js";
import { createGroupEvent } from "./group.js";
import { createWelcomeEvent } from "./welcome.js";

/**
 * Result of adding a member to a group with Nostr integration.
 */
export interface AddMemberResult {
  /** The updated ClientState */
  clientState: ClientState;
  /** The Nostr commit event that was published */
  commitEvent: NostrEvent;
  /** The unsigned welcome event */
  welcomeEvent: UnsignedEvent;
  /** The gift-wrapped welcome event (kind 1059) */
  giftWrapEvent: NostrEvent;
}

/**
 * Parameters for adding a member to an existing group with Nostr integration.
 */
export interface AddMemberParams {
  /** The current ClientState */
  currentClientState: ClientState;
  /** The key package of the new member to add */
  newMemberKeyPackage: KeyPackage;
  /** The cipher suite implementation for cryptographic operations */
  ciphersuiteImpl: CiphersuiteImpl;
  /** The event signer for creating gift wraps */
  signer: EventSigner;
}

/**
 * Adds a new member to an existing MLS group with complete Nostr integration.
 *
 * This function orchestrates the complete workflow for adding a member:
 * 1. Creates an Add proposal and Commit using MLS operations
 * 2. Generates Nostr events (commit and welcome)
 * 3. Optionally gift-wraps the welcome message for privacy
 * 4. Returns all events and updated group state
 *
 * @param params - Parameters for adding a member with Nostr integration
 * @returns Promise resolving to the result with events and updated group state
 * @throws Error if the member addition fails or parameters are invalid
 */
export async function addMemberWithNostrIntegration(
  params: AddMemberParams,
): Promise<AddMemberResult> {
  const { currentClientState, newMemberKeyPackage, ciphersuiteImpl, signer } =
    params;

  // Step 1: Perform MLS member addition
  const commitResult = await addMemberToGroup(
    currentClientState,
    newMemberKeyPackage,
    ciphersuiteImpl,
  );

  // Step 2: Create Nostr commit event
  const marmotData = extractMarmotGroupData(currentClientState);
  if (!marmotData) {
    throw new Error("MarmotGroupData not found in ClientState");
  }
  const nostrGroupId = bytesToHex(marmotData.nostrGroupId);

  const commitEvent = createGroupEvent(commitResult.commit, nostrGroupId);

  // Step 3: Create welcome event
  if (!commitResult.welcome) {
    throw new Error(
      "Welcome message not generated. This should not happen when adding a member.",
    );
  }

  const keyPackageId = bytesToHex(newMemberKeyPackage.initKey);
  const welcomeEvent = createWelcomeEvent(
    commitResult.welcome,
    keyPackageId,
    await signer.getPublicKey(),
    marmotData.relays,
  );

  // Step 4: create gift wrap
  const giftWrapEvent = await createGiftWrap({
    rumor: welcomeEvent as Rumor,
    recipientPubkey: bytesToHex(
      (newMemberKeyPackage.leafNode.credential as CredentialBasic).identity,
    ),
    signer,
  });

  return {
    clientState: commitResult.newState,
    commitEvent,
    welcomeEvent,
    giftWrapEvent,
  };
}

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
