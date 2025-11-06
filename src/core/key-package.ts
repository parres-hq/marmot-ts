import { bytesToHex, hexToBytes } from "@noble/ciphers/utils.js";
import { Extension, ExtensionType, KeyPackage } from "ts-mls";
import { CiphersuiteId, ciphersuites } from "ts-mls/crypto/ciphersuite.js";
import { decodeKeyPackage, encodeKeyPackage } from "ts-mls/keyPackage.js";
import { protocolVersions } from "ts-mls/protocolVersion.js";

import { getTagValue } from "../utils/nostr.js";
import { isValidRelayUrl, normalizeRelayUrl } from "../utils/relay-url.js";
import { getCredentialPubkey } from "./credential.js";
import {
  KEY_PACKAGE_CIPHER_SUITE_TAG,
  KEY_PACKAGE_CLIENT_TAG,
  KEY_PACKAGE_EXTENSIONS_TAG,
  KEY_PACKAGE_KIND,
  KEY_PACKAGE_MLS_VERSION_TAG,
  KEY_PACKAGE_RELAYS_TAG,
  KeyPackageClient,
  MARMOT_GROUP_DATA_EXTENSION_TYPE,
  MLS_VERSIONS,
  extendedExtensionTypes,
} from "./protocol.js";
import { createRequiredCapabilitiesExtension } from "./extensions.js";
import { createMarmotGroupData } from "./marmot-group-data.js";
import { NostrEvent } from "applesauce-core/helpers";

/** Get the {@link KeyPackage} from a kind 443 event */
export function getKeyPackage(event: NostrEvent): KeyPackage {
  const content = hexToBytes(event.content);
  const decoded = decodeKeyPackage(content, 0);
  if (!decoded) throw new Error("Failed to decode key package");

  const [keyPackage, _noIdeaWhatThisIs] = decoded;
  return keyPackage;
}

/** Gets the MLS protocol version from a kind 443 event */
export function getKeyPackageMLSVersion(
  event: NostrEvent,
): MLS_VERSIONS | undefined {
  const version = getTagValue(event, KEY_PACKAGE_MLS_VERSION_TAG);
  return version as MLS_VERSIONS | undefined;
}

/** Gets the MLS cipher suite from a kind 443 event */
export function getKeyPackageCipherSuiteId(
  event: NostrEvent,
): CiphersuiteId | undefined {
  const cipherSuite = getTagValue(event, KEY_PACKAGE_CIPHER_SUITE_TAG);
  if (!cipherSuite) return undefined;

  // NOTE: we are intentially not passing a radix to parseInt here so that it can handle base 10 and 16 (with leading 0x)
  const id = parseInt(cipherSuite);

  // Verify that cipher suite is a valid ID
  if (!Object.values(ciphersuites).includes(id as CiphersuiteId))
    throw new Error(`Invalid MLS cipher suite ID ${id}`);

  // Cast number to CiphersuiteId
  return id as CiphersuiteId;
}

/** Gets the MLS extensions for a kind 443 event */
export function getKeyPackageExtensions(
  event: NostrEvent,
): ExtensionType[] | undefined {
  const tag = event.tags.find((t) => t[0] === KEY_PACKAGE_EXTENSIONS_TAG);
  if (!tag) return undefined;

  const ids = tag
    .slice(1)
    // NOTE: we are intentially not passing a radix to parseInt here so that it can handle base 10 and 16 (with leading 0x)
    .map((t) => parseInt(t))
    .filter((id) => Number.isFinite(id));

  return ids as ExtensionType[];
}

/** Gets the relays for a kind 443 event */
export function getKeyPackageRelays(event: NostrEvent): string[] | undefined {
  const tag = event.tags.find((t) => t[0] === KEY_PACKAGE_RELAYS_TAG);
  if (!tag) return undefined;
  return tag.slice(1).filter(isValidRelayUrl).map(normalizeRelayUrl);
}

/** Gets the client for a kind 443 event */
export function getKeyPackageClient(
  event: NostrEvent,
): KeyPackageClient | undefined {
  const tag = event.tags.find((t) => t[0] === KEY_PACKAGE_CLIENT_TAG);
  if (!tag) return undefined;

  // TODO: parse the rest of the client tag
  return {
    name: tag[1],
  };
}

/**
 * Default extensions for Marmot key packages.
 *
 * According to MIP-01, key packages should support the Marmot Group Data Extension
 * and other standard MLS extensions that groups will require.
 *
 * Key packages MUST include:
 * - required_capabilities (extension type 3) - Defines required MLS features
 * - ratchet_tree (extension type 2) - Manages cryptographic key tree structure
 * - marmot_group_data (extension type 0xF2EE) - Marmot-specific group data
 */
export function keyPackageDefaultExtensions(): Extension[] {
  return [
    createRequiredCapabilitiesExtension(),
    {
      extensionType: "ratchet_tree",
      extensionData: new Uint8Array(),
    },
    {
      extensionType: MARMOT_GROUP_DATA_EXTENSION_TYPE,
      extensionData: createMarmotGroupData({
        // Empty group id for key packages
        nostrGroupId: new Uint8Array(32),
      }),
    },
  ];
}

export type CreateKeyPackageEventOptions = {
  /** The MLS key package to encode in the event */
  keyPackage: KeyPackage;
  /** The pubkey of the event author (must match the credential in the key package) */
  pubkey: string;
  /** The relays where this key package should be published */
  relays: string[];
  /** Optional client identifier (e.g., "marmot-examples") */
  client?: string;
};

/**
 * Creates an unsigned Nostr event (kind 443) for a MLS key package.
 * The event can be signed and published to allow others to add the user to MLS groups.
 *
 * @param options - Configuration for creating the key package event
 * @returns An unsigned Nostr event ready to be signed and published
 */
export function createKeyPackageEvent(
  options: CreateKeyPackageEventOptions,
): Omit<NostrEvent, "id" | "sig"> {
  const { keyPackage, pubkey, relays, client } = options;

  if (keyPackage.leafNode.credential.credentialType !== "basic")
    throw new Error(
      "Key package leaf node credential is not a basic credential",
    );

  if (pubkey !== getCredentialPubkey(keyPackage.leafNode.credential))
    throw new Error(
      "Key package leaf node credential pubkey does not match the event pubkey",
    );

  // Encode the public key package to bytes
  const encodedBytes = encodeKeyPackage(keyPackage);
  const contentHex = bytesToHex(encodedBytes);

  // Get the cipher suite from the key package
  const ciphersuiteId = ciphersuites[keyPackage.cipherSuite];
  const ciphersuiteHex = `0x${ciphersuiteId.toString(16).padStart(4, "0")}`;

  // Extract extension types from the key package
  const extensionTypes = keyPackage.extensions.map((ext: Extension) => {
    let extType: number;

    if (typeof ext.extensionType === "number") {
      // Custom extension types (like Marmot Group Data Extension 0xF2EE or GREASE values)
      extType = ext.extensionType;
    } else {
      // Extended extension types (including Marmot-specific extensions)
      // Use the extendedExtensionTypes for proper mapping
      extType = extendedExtensionTypes[ext.extensionType];

      // Validate that we have a valid extension type
      if (extType === undefined) {
        throw new Error(`Unknown extension type: ${ext.extensionType}`);
      }
    }

    return `0x${extType.toString(16).padStart(4, "0")}`;
  });

  const version = protocolVersions[keyPackage.version].toFixed(1);

  // Build tags
  const tags: string[][] = [
    [KEY_PACKAGE_MLS_VERSION_TAG, version],
    [KEY_PACKAGE_CIPHER_SUITE_TAG, ciphersuiteHex],
    [KEY_PACKAGE_EXTENSIONS_TAG, ...extensionTypes],
  ];

  // Add client tag if provided
  if (client) tags.push([KEY_PACKAGE_CLIENT_TAG, client]);

  // Add relays tag
  tags.push([KEY_PACKAGE_RELAYS_TAG, ...relays]);

  return {
    kind: KEY_PACKAGE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: contentHex,
    pubkey,
  };
}
