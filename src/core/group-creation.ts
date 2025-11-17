import { randomBytes } from "@noble/hashes/utils.js";
import { createGroup as MLSCreateGroup } from "ts-mls";
import { CiphersuiteImpl } from "ts-mls/crypto/ciphersuite.js";
import { CompleteKeyPackage } from "./key-package-store.js";
import { MarmotGroupData } from "./protocol.js";
import { marmotGroupDataToExtension } from "./marmot-group-data.js";
import {
  Group,
  CreateGroupParams,
  CreateGroupResult,
  CompleteGroup,
} from "./group.js";

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

  // Create the complete group package (ClientState + metadata)
  const completeGroup: CompleteGroup = {
    clientState,
    marmotGroupData,
  };

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
