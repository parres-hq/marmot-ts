import { CiphersuiteImpl, Extension } from "ts-mls";
import { ClientState } from "ts-mls/clientState.js";
import { KeyPackage } from "ts-mls/keyPackage.js";
import { MarmotGroupData } from "./protocol.js";
import { CompleteKeyPackage } from "./key-package-store.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { createGroup as MLSCreateGroup } from "ts-mls";
import { marmotGroupDataToExtension } from "./marmot-group-data.js";

/**
 * Complete group package containing both MLS state and Marmot metadata.
 *
 * Similar to CompleteKeyPackage, this stores both the MLS ClientState
 * (for cryptographic operations) and Marmot-specific metadata (for UI/Nostr).
 */
export interface CompleteGroup {
  /** The MLS client state for cryptographic operations */
  clientState: ClientState;
  /** The group metadata (for UI/Nostr) */
  group: Group;
}

/**
 * Represents an MLS group with Marmot-specific extensions and state management.
 *
 * This interface provides the core structure for managing MLS groups with
 * Marmot Group Data Extension integration.
 */
export interface Group {
  /** 32-byte private MLS group identifier (never published to Nostr) */
  groupId: Uint8Array;
  /** Current epoch number (starts at 0 for new groups) */
  epoch: number;
  /** Array of group members with their key packages */
  members: Member[];
  /** Group context extensions including Marmot Group Data Extension */
  extensions: Extension[];
  /** Marmot-specific group metadata */
  marmotGroupData: MarmotGroupData;
  /** Ratchet tree representing the current group state */
  ratchetTree: Uint8Array;
  /** Confirmed transcript hash for the current epoch */
  confirmedTranscriptHash: Uint8Array;
  /** Interim transcript hash for pending commits */
  interimTranscriptHash: Uint8Array;
}

/**
 * Represents a member in an MLS group.
 */
export interface Member {
  /** The member's key package */
  keyPackage: KeyPackage;
  /** Index in the ratchet tree */
  index: number;
  /** Whether this member is the group creator */
  isCreator: boolean;
}

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
  /** The complete group package (ClientState + metadata) */
  completeGroup: CompleteGroup;
  /** The created group with initial state (for display/UI) */
  group: Group;
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

  // Generate private 32-byte MLS group ID (never published to Nostr)
  const groupId = randomBytes(32);

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

  // Create the Marmot Group interface for display/UI purposes
  const group: Group = {
    groupId,
    epoch: Number(clientState.groupContext.epoch),
    members: [
      {
        keyPackage: creatorKeyPackage.publicPackage,
        index: 0,
        isCreator: true,
      },
    ],
    extensions: groupExtensions,
    marmotGroupData,
    ratchetTree: new Uint8Array(), // Ratchet tree is stored in clientState, not needed for display
    confirmedTranscriptHash: clientState.groupContext.confirmedTranscriptHash,
    interimTranscriptHash: new Uint8Array(), // Interim hash is computed during commit operations
  };

  // Create the complete group package (ClientState + metadata)
  const completeGroup: CompleteGroup = {
    clientState,
    group,
  };

  // Welcome message is empty for creator-only group
  const welcomeMessage = new Uint8Array();

  // Initial commit message is empty for creator-only group
  const commitMessage = new Uint8Array();

  return {
    completeGroup,
    group,
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
      typeof ext.extensionType === "number" && ext.extensionType === 0xf2ee, // MARMOT_GROUP_DATA_EXTENSION_TYPE
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
