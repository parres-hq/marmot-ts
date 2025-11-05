import {
  Extension,
  RequiredCapabilities,
  encodeRequiredCapabilities,
  defaultCapabilities as baseCapabilities,
} from "ts-mls";
import { MARMOT_GROUP_DATA_EXTENSION_TYPE } from "./protocol.js";

/**
 * Creates empty Marmot Group Data Extension data for key packages.
 *
 * According to MIP-01, key packages should signal support for the Marmot Group Data Extension
 * but the actual extension data is populated when creating groups.
 *
 * The TLS structure is:
 * struct {
 *     uint16 version;                    // Version number (current: 1)
 *     opaque nostr_group_id[32];         // All zeros for key packages
 *     opaque name<0..2^16-1>;            // Empty string
 *     opaque description<0..2^16-1>;     // Empty string
 *     opaque admin_pubkeys<0..2^16-1>;   // Empty string
 *     opaque relays<0..2^16-1>;          // Empty string
 *     opaque image_hash[32];             // All zeros
 *     opaque image_key[32];              // All zeros
 *     opaque image_nonce[12];            // All zeros
 * } NostrGroupData;
 */
export function createEmptyMarmotGroupDataExtension(): Uint8Array {
  // Version 1 (2 bytes)
  const version = new Uint8Array(2);
  const view = new DataView(version.buffer);
  view.setUint16(0, 1, false); // Big-endian

  // nostr_group_id (32 bytes of zeros)
  const nostrGroupId = new Uint8Array(32);

  // Empty variable-length fields (each with 2-byte length prefix)
  const emptyName = new Uint8Array(2); // length 0
  const emptyDescription = new Uint8Array(2); // length 0
  const emptyAdminPubkeys = new Uint8Array(2); // length 0
  const emptyRelays = new Uint8Array(2); // length 0

  // Image fields (all zeros)
  const imageHash = new Uint8Array(32);
  const imageKey = new Uint8Array(32);
  const imageNonce = new Uint8Array(12);

  // Concatenate all parts
  const result = new Uint8Array(
    version.length +
      nostrGroupId.length +
      emptyName.length +
      emptyDescription.length +
      emptyAdminPubkeys.length +
      emptyRelays.length +
      imageHash.length +
      imageKey.length +
      imageNonce.length,
  );

  let offset = 0;
  result.set(version, offset);
  offset += version.length;
  result.set(nostrGroupId, offset);
  offset += nostrGroupId.length;
  result.set(emptyName, offset);
  offset += emptyName.length;
  result.set(emptyDescription, offset);
  offset += emptyDescription.length;
  result.set(emptyAdminPubkeys, offset);
  offset += emptyAdminPubkeys.length;
  result.set(emptyRelays, offset);
  offset += emptyRelays.length;
  result.set(imageHash, offset);
  offset += imageHash.length;
  result.set(imageKey, offset);
  offset += imageKey.length;
  result.set(imageNonce, offset);

  return result;
}

/**
 * Creates required capabilities extension that mandates the Marmot Group Data Extension.
 *
 * According to MIP-01, all groups MUST require the Marmot Group Data Extension.
 */
function createRequiredCapabilitiesExtension(): Extension {
  const requiredCapabilities: RequiredCapabilities = {
    extensionTypes: [MARMOT_GROUP_DATA_EXTENSION_TYPE],
    proposalTypes: [],
    credentialTypes: ["basic"],
  };

  return {
    extensionType: "required_capabilities",
    extensionData: encodeRequiredCapabilities(requiredCapabilities),
  };
}

/**
 * Default capabilities for Marmot key packages.
 *
 * According to MIP-01, key packages MUST signal support for the Marmot Group Data Extension
 * in their capabilities to pass validation when being added to groups.
 */
export function defaultCapabilities() {
  const caps = baseCapabilities();

  // Add Marmot Group Data Extension to capabilities
  caps.extensions = [...caps.extensions, MARMOT_GROUP_DATA_EXTENSION_TYPE];

  return caps;
}

/**
 * Default extensions for Marmot key packages.
 *
 * According to MIP-01, key packages should support the Marmot Group Data Extension
 * and other standard MLS extensions that groups will require.
 */
export const defaultExtensions: Extension[] = [
  {
    extensionType: MARMOT_GROUP_DATA_EXTENSION_TYPE,
    extensionData: createEmptyMarmotGroupDataExtension(),
  },
];

/**
 * Extensions required for Marmot groups.
 *
 * According to MIP-01, groups MUST include:
 * - required_capabilities (mandating Marmot Group Data Extension)
 * - ratchet_tree
 * - marmot_group_data
 */
export const groupExtensions: Extension[] = [
  createRequiredCapabilitiesExtension(),
  {
    extensionType: "ratchet_tree",
    extensionData: new Uint8Array(),
  },
  {
    extensionType: MARMOT_GROUP_DATA_EXTENSION_TYPE,
    extensionData: createEmptyMarmotGroupDataExtension(),
  },
];

/**
 * Validates that a key package supports the required Marmot extensions.
 *
 * @param extensions - The extensions from a key package
 * @returns true if the Marmot Group Data Extension is supported
 */
export function supportsMarmotExtensions(extensions: Extension[]): boolean {
  return extensions.some(
    (ext) =>
      typeof ext.extensionType === "number" &&
      ext.extensionType === MARMOT_GROUP_DATA_EXTENSION_TYPE,
  );
}
