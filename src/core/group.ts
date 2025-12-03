import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { NostrEvent, Rumor, UnsignedEvent } from "applesauce-core/helpers";
import { EventSigner } from "applesauce-factory";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import {
  CiphersuiteImpl,
  CreateCommitResult,
  Extension,
  createGroup as MLSCreateGroup,
  Proposal,
  createCommit,
} from "ts-mls";
import { ClientState } from "ts-mls/clientState.js";
import { CredentialBasic } from "ts-mls/credential.js";
import { KeyPackage } from "ts-mls/keyPackage.js";
import { encodeMlsMessage, type MLSMessage } from "ts-mls/message.js";
import { createGiftWrap } from "../utils/nostr.js";
import { extractMarmotGroupData } from "./client-state.js";
import { CompleteKeyPackage } from "./key-package.js";
import { marmotGroupDataToExtension } from "./marmot-group-data.js";
import {
  GROUP_EVENT_KIND,
  MARMOT_GROUP_DATA_EXTENSION_TYPE,
  MarmotGroupData,
} from "./protocol.js";
import { createWelcomeEvent } from "./welcome.js";

/**
 * Parameters for creating a new MLS group.
 */
export interface CreateGroupParams {
  /** Creator's complete key package (public + private) */
  creatorKeyPackage: CompleteKeyPackage;
  /** Marmot Group Data configuration */
  marmotGroupData: MarmotGroupData;
  /** Additional group context extensions (optional) */
  extensions?: Extension[];
  /** Cipher suite implementation for cryptographic operations */
  ciphersuiteImpl: CiphersuiteImpl;
}

/**
 * Result of a successful group creation operation.
 */
export interface CreateGroupResult {
  /** The ClientState for the created group */
  clientState: ClientState;
  /** Welcome message for adding initial members (empty for creator-only group) */
  welcomeMessage: Uint8Array;
  /** Initial commit message for group creation */
  commitMessage: Uint8Array;
}

/**
 * Creates a new MLS group with Marmot Group Data Extension.
 *
 * This function orchestrates the creation of an MLS group with the creator as the sole member,
 * including proper Marmot Group Data Extension integration and RFC 9420 compliance.
 *
 * @param params - Parameters for group creation
 * @returns Promise resolving to the created group and related messages
 * @throws Error if group creation fails or parameters are invalid
 */
export async function createGroup(
  params: CreateGroupParams,
): Promise<CreateGroupResult> {
  const {
    creatorKeyPackage,
    marmotGroupData,
    extensions = [],
    ciphersuiteImpl,
  } = params;
  const groupId = marmotGroupData.nostrGroupId;
  // Create Marmot Group Data Extension
  const marmotExtension = marmotGroupDataToExtension(marmotGroupData);

  // Combine all extensions (Marmot extension + any additional extensions)
  const groupExtensions = [marmotExtension, ...extensions];

  // Create the MLS group using ts-mls primitives and capture the ClientState
  const clientState = await MLSCreateGroup(
    groupId,
    creatorKeyPackage.publicPackage,
    creatorKeyPackage.privatePackage,
    groupExtensions,
    ciphersuiteImpl,
  );

  // Welcome message is empty for creator-only group
  const welcomeMessage = new Uint8Array();

  // Initial commit message is empty for creator-only group
  const commitMessage = new Uint8Array();

  return {
    clientState,
    welcomeMessage,
    commitMessage,
  };
}

/**
 * Validates that a key package supports the required Marmot extensions.
 *
 * @param keyPackage - The key package to validate
 * @returns true if the key package supports Marmot extensions
 */
export function validateKeyPackageForGroup(
  keyPackage: CompleteKeyPackage,
): boolean {
  const extensions = keyPackage.publicPackage.extensions;

  // Check if Marmot Group Data Extension is supported
  const supportsMarmot = extensions.some(
    (ext) =>
      typeof ext.extensionType === "number" &&
      ext.extensionType === MARMOT_GROUP_DATA_EXTENSION_TYPE,
  );

  return supportsMarmot;
}

/**
 * Creates a simple group with minimal configuration for testing.
 *
 * @param creatorKeyPackage - Creator's key package
 * @param ciphersuiteImpl - Cipher suite implementation
 * @param groupName - Optional group name
 * @returns Promise resolving to the created group
 */
export async function createSimpleGroup(
  creatorKeyPackage: CompleteKeyPackage,
  ciphersuiteImpl: CiphersuiteImpl,
  groupName: string = "New Group",
  options?: {
    description?: string;
    adminPubkeys?: string[];
    relays?: string[];
  },
): Promise<CreateGroupResult> {
  const marmotGroupData: MarmotGroupData = {
    version: 1,
    nostrGroupId: randomBytes(32),
    name: groupName,
    description: options?.description || "",
    adminPubkeys: options?.adminPubkeys || [],
    relays: options?.relays || [],
    imageHash: new Uint8Array(32),
    imageKey: new Uint8Array(32),
    imageNonce: new Uint8Array(12),
  };

  return createGroup({
    creatorKeyPackage,
    marmotGroupData,
    ciphersuiteImpl,
  });
}

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
  console.log("step 1");
  // Step 1: Perform MLS member addition
  const commitResult = await addMemberToGroup(
    currentClientState,
    newMemberKeyPackage,
    ciphersuiteImpl,
  );
  console.log("step 2");
  // Step 3: Create Nostr commit event
  const marmotData = extractMarmotGroupData(currentClientState);
  if (!marmotData) {
    throw new Error("MarmotGroupData not found in ClientState");
  }
  const nostrGroupId = bytesToHex(marmotData.nostrGroupId);

  const commitEvent = createGroupEvent(commitResult.commit, nostrGroupId);
  console.log("step 4");
  // Step 4: Create welcome event
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
  console.log("step 5");
  // Step 5: create gift wrap
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

/**
 * Creates an unsigned Nostr event (kind 445) for a group commit message.
 *
 * @param commitMessage - The serialized MLS commit message
 * @param groupId - The 32-byte Nostr group ID (from MarmotGroupData)
 * @param pubkey - The sender's public key (hex string)
 * @param relays - Array of relay URLs for the group
 * @returns Unsigned Nostr event
 */
export function createGroupEvent(
  commitMessage: MLSMessage,
  groupId: string,
): NostrEvent {
  const serializedMessage = encodeMlsMessage(commitMessage);
  const content = bytesToHex(serializedMessage);
  const secretKey = generateSecretKey();
  const unsignedEvent = {
    kind: GROUP_EVENT_KIND,
    pubkey: getPublicKey(secretKey),
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags: [["h", groupId]],
  };
  return finalizeEvent(unsignedEvent, secretKey);
}
