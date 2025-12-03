import { defaultExtensionTypes } from "ts-mls";
import { defaultClientConfig } from "ts-mls/clientConfig.js";
import { marmotAuthService } from "./auth-service.js";
import { bytesToHex } from "@noble/ciphers/utils.js";
import { NostrEvent, UnsignedEvent } from "applesauce-core/helpers/event";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import { encodeMlsMessage, type MLSMessage } from "ts-mls/message.js";
import { encodeWelcome, type Welcome } from "ts-mls/welcome.js";

/** The extension id for the last_resort key package extension for key packages */
export const LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE = 0x000a;

/** Event kind for key package relay list events */
export const KEY_PACKAGE_RELAY_LIST_KIND = 10051;

/** The name of the tag that contains relay URLs */
export const KEY_PACKAGE_RELAY_LIST_RELAY_TAG = "relay";

/** Event kind for key package events */
export const KEY_PACKAGE_KIND = 443;

/** The name of the tag that contains the MLS protocol version */
export const KEY_PACKAGE_MLS_VERSION_TAG = "mls_protocol_version";

/** The name of the tag that contains the MLS cipher suite */
export const KEY_PACKAGE_CIPHER_SUITE_TAG = "mls_ciphersuite";

/** The name of the tag that contains the MLS extensions */
export const KEY_PACKAGE_EXTENSIONS_TAG = "mls_extensions";

/** The name of the tag that contains the relays */
export const KEY_PACKAGE_RELAYS_TAG = "relays";

/** The name of the tag that contains the client */
export const KEY_PACKAGE_CLIENT_TAG = "client";

/** The possible MLS protocol versions */
export type MLS_VERSIONS = "1.0";

/** Parsed client tag from a kind 443 event */
export type KeyPackageClient = {
  name: string;
  // TODO: this is probably a NIP-89 client tag, so it should probably have the rest of the fields
};

/** The identifier for the Marmot Group Data Extension (MIP-01) */
export const MARMOT_GROUP_DATA_EXTENSION_TYPE = 0xf2ee;

/** The version number for the Marmot Group Data Extension (MIP-01) */
export const MARMOT_GROUP_DATA_VERSION = 1;

/** Extended extension types that include Marmot-specific extensions */
export const extendedExtensionTypes = {
  ...defaultExtensionTypes,
  marmot_group_data: MARMOT_GROUP_DATA_EXTENSION_TYPE,
  last_resort: LAST_RESORT_KEY_PACKAGE_EXTENSION_TYPE,
} as const;

export type ExtendedExtensionTypeName = keyof typeof extendedExtensionTypes;
export type ExtendedExtensionTypeValue =
  (typeof extendedExtensionTypes)[ExtendedExtensionTypeName];

/** Default ClientConfig for Marmot */
export const defaultMarmotClientConfig = {
  ...defaultClientConfig,
  auth_service: marmotAuthService,
};

/**
 * Represents the decoded Marmot Group Data Extension structure.
 */
export interface MarmotGroupData {
  /** Extension format version number (current: 1) */
  version: number;
  /** 32-byte identifier for the group used in Nostr protocol operations */
  nostrGroupId: Uint8Array;
  /** UTF-8 encoded group name */
  name: string;
  /** UTF-8 encoded group description */
  description: string;
  /** Array of 32-byte Nostr public keys (hex-encoded strings) */
  adminPubkeys: string[];
  /** Array of WebSocket URLs for Nostr relays */
  relays: string[];
  /** SHA-256 hash of the encrypted group image (all zeros if no image) */
  imageHash: Uint8Array;
  /** ChaCha20-Poly1305 encryption key for the group image (all zeros if no image) */
  imageKey: Uint8Array;
  /** ChaCha20-Poly1305 nonce for group image encryption (all zeros if no image) */
  imageNonce: Uint8Array;
}

/** Event kind for group events (commits, proposals, application messages) */
export const GROUP_EVENT_KIND = 445;

/** Event kind for welcome events */
export const WELCOME_EVENT_KIND = 444;

/** Event kind for gift wrap events (NIP-59) */
export const GIFT_WRAP_KIND = 1059;

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

/**
 * Creates an unsigned Nostr event (kind 444) for a welcome message.
 *
 * @param welcomeMessage - The MLS welcome message
 * @param keyPackageId - The ID of the key package used for the add operation
 * @param pubkey - The sender's public key (hex string)
 * @param relays - Array of relay URLs for the group
 * @returns Unsigned Nostr event
 */
export function createWelcomeEvent(
  welcomeMessage: Welcome,
  keyPackageId: string,
  pubkey: string,
  relays: string[],
): UnsignedEvent {
  // Serialize the welcome message according to RFC 9420
  const serializedWelcome = encodeWelcome(welcomeMessage);
  const content = bytesToHex(serializedWelcome);

  return {
    kind: WELCOME_EVENT_KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags: [
      ["e", keyPackageId],
      ["relays", ...relays],
    ],
  };
}
