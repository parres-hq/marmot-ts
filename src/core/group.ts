import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { NostrEvent } from "applesauce-core/helpers";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import {
  CiphersuiteImpl,
  Extension,
  createGroup as MLSCreateGroup,
} from "ts-mls";
import { ClientState } from "ts-mls/clientState.js";
import { encodeMlsMessage, type MLSMessage } from "ts-mls/message.js";
import { CompleteKeyPackage } from "./key-package.js";
import { marmotGroupDataToExtension } from "./marmot-group-data.js";
import { GROUP_EVENT_KIND, MarmotGroupData } from "./protocol.js";

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

  return {
    clientState,
  };
}

export type SimpleGroupOptions = {
  description?: string;
  adminPubkeys?: string[];
  relays?: string[];
};

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
  options?: SimpleGroupOptions,
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
