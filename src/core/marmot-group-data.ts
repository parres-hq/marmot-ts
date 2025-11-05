import { randomBytes } from "@noble/hashes/utils.js";

/**
 * Marmot Group Data Extension Implementation (MIP-01)
 *
 * This module implements the mandatory Marmot Group Data Extension which links
 * MLS groups to Nostr metadata and provides cryptographically secure group state.
 *
 * Extension Identifier: 0xF2EE
 *
 * Note: Image encryption/decryption functions will be added in MIP-04 implementation.
 *
 * @see https://github.com/parres-hq/marmot/blob/master/01.md#marmot-group-data-extension
 */

export const MARMOT_GROUP_DATA_VERSION = 1;

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

/**
 * Parameters for creating a new Marmot Group Data Extension.
 */
export interface CreateMarmotGroupDataParams {
  /** 32-byte Nostr group identifier (generated randomly if not provided) */
  nostrGroupId?: Uint8Array;
  /** Group name (empty string if not provided) */
  name?: string;
  /** Group description (empty string if not provided) */
  description?: string;
  /** Array of admin public keys (hex-encoded) */
  adminPubkeys?: string[];
  /** Array of relay WebSocket URLs */
  relays?: string[];
  /** Encrypted image hash (all zeros if not provided) */
  imageHash?: Uint8Array;
  /** Image encryption key (all zeros if not provided) */
  imageKey?: Uint8Array;
  /** Image encryption nonce (all zeros if not provided) */
  imageNonce?: Uint8Array;
}

/**
 * Encodes a Marmot Group Data Extension according to TLS presentation language.
 *
 * @param data - The group data to encode
 * @returns TLS-encoded extension data
 * @throws Error if validation fails
 */
export function encodeMarmotGroupData(data: MarmotGroupData): Uint8Array {
  // Validate input
  validateMarmotGroupData(data);

  const textEncoder = new TextEncoder();

  // Encode version (2 bytes, big-endian)
  const versionBytes = new Uint8Array(2);
  new DataView(versionBytes.buffer).setUint16(0, data.version, false);

  // nostr_group_id (32 bytes)
  if (data.nostrGroupId.length !== 32) {
    throw new Error("nostr_group_id must be exactly 32 bytes");
  }
  const nostrGroupId = data.nostrGroupId;

  // Encode name (variable-length with 2-byte length prefix)
  const nameBytes = textEncoder.encode(data.name);
  const nameWithLength = encodeVariableLengthField(nameBytes);

  // Encode description (variable-length with 2-byte length prefix)
  const descBytes = textEncoder.encode(data.description);
  const descWithLength = encodeVariableLengthField(descBytes);

  // Encode admin_pubkeys (comma-separated hex strings with 2-byte length prefix)
  const adminStr = data.adminPubkeys.join(",");
  const adminBytes = textEncoder.encode(adminStr);
  const adminWithLength = encodeVariableLengthField(adminBytes);

  // Encode relays (comma-separated URLs with 2-byte length prefix)
  const relaysStr = data.relays.join(",");
  const relaysBytes = textEncoder.encode(relaysStr);
  const relaysWithLength = encodeVariableLengthField(relaysBytes);

  // Image fields (fixed-length)
  if (data.imageHash.length !== 32) {
    throw new Error("image_hash must be exactly 32 bytes");
  }
  if (data.imageKey.length !== 32) {
    throw new Error("image_key must be exactly 32 bytes");
  }
  if (data.imageNonce.length !== 12) {
    throw new Error("image_nonce must be exactly 12 bytes");
  }

  // Calculate total length
  const totalLength =
    versionBytes.length +
    nostrGroupId.length +
    nameWithLength.length +
    descWithLength.length +
    adminWithLength.length +
    relaysWithLength.length +
    data.imageHash.length +
    data.imageKey.length +
    data.imageNonce.length;

  // Concatenate all parts
  const result = new Uint8Array(totalLength);
  let offset = 0;

  result.set(versionBytes, offset);
  offset += versionBytes.length;

  result.set(nostrGroupId, offset);
  offset += nostrGroupId.length;

  result.set(nameWithLength, offset);
  offset += nameWithLength.length;

  result.set(descWithLength, offset);
  offset += descWithLength.length;

  result.set(adminWithLength, offset);
  offset += adminWithLength.length;

  result.set(relaysWithLength, offset);
  offset += relaysWithLength.length;

  result.set(data.imageHash, offset);
  offset += data.imageHash.length;

  result.set(data.imageKey, offset);
  offset += data.imageKey.length;

  result.set(data.imageNonce, offset);

  return result;
}

/**
 * Decodes a Marmot Group Data Extension from TLS-encoded bytes.
 *
 * @param extensionData - The TLS-encoded extension data
 * @returns Decoded group data
 * @throws Error if the data is malformed or invalid
 */
export function decodeMarmotGroupData(
  extensionData: Uint8Array,
): MarmotGroupData {
  const MIN_SIZE = 2 + 32 + 2 + 2 + 2 + 2 + 32 + 32 + 12; // 118 bytes

  if (extensionData.length < MIN_SIZE) {
    throw new Error(
      `Extension data too short: expected at least ${MIN_SIZE} bytes, got ${extensionData.length}`,
    );
  }

  let offset = 0;
  const textDecoder = new TextDecoder();

  // Read version (2 bytes, big-endian)
  const version = new DataView(extensionData.buffer).getUint16(offset, false);
  offset += 2;

  // Validate version
  if (version < 1) {
    throw new Error(`Invalid version: ${version}`);
  }

  // Read nostr_group_id (32 bytes)
  const nostrGroupId = extensionData.slice(offset, offset + 32);
  offset += 32;

  // Read name (variable-length with 2-byte length prefix)
  const { data: nameBytes, nextOffset: nameOffset } = decodeVariableLengthField(
    extensionData,
    offset,
  );
  const name = textDecoder.decode(nameBytes);
  offset = nameOffset;

  // Read description (variable-length with 2-byte length prefix)
  const { data: descBytes, nextOffset: descOffset } = decodeVariableLengthField(
    extensionData,
    offset,
  );
  const description = textDecoder.decode(descBytes);
  offset = descOffset;

  // Read admin_pubkeys (variable-length with 2-byte length prefix)
  const { data: adminBytes, nextOffset: adminOffset } =
    decodeVariableLengthField(extensionData, offset);
  const adminStr = textDecoder.decode(adminBytes);
  const adminPubkeys = adminStr.length > 0 ? adminStr.split(",") : [];
  offset = adminOffset;

  // Read relays (variable-length with 2-byte length prefix)
  const { data: relaysBytes, nextOffset: relaysOffset } =
    decodeVariableLengthField(extensionData, offset);
  const relaysStr = textDecoder.decode(relaysBytes);
  const relays = relaysStr.length > 0 ? relaysStr.split(",") : [];
  offset = relaysOffset;

  // Read image_hash (32 bytes)
  if (offset + 32 > extensionData.length) {
    throw new Error("Extension data truncated: missing image_hash");
  }
  const imageHash = extensionData.slice(offset, offset + 32);
  offset += 32;

  // Read image_key (32 bytes)
  if (offset + 32 > extensionData.length) {
    throw new Error("Extension data truncated: missing image_key");
  }
  const imageKey = extensionData.slice(offset, offset + 32);
  offset += 32;

  // Read image_nonce (12 bytes)
  if (offset + 12 > extensionData.length) {
    throw new Error("Extension data truncated: missing image_nonce");
  }
  const imageNonce = extensionData.slice(offset, offset + 12);
  offset += 12;

  // Validate no extra data
  if (offset !== extensionData.length) {
    // For forward compatibility, log warning but continue
    console.warn(
      `Extension has ${extensionData.length - offset} extra bytes (version ${version} may have additional fields)`,
    );
  }

  return {
    version,
    nostrGroupId,
    name,
    description,
    adminPubkeys,
    relays,
    imageHash,
    imageKey,
    imageNonce,
  };
}

/**
 * Creates a new Marmot Group Data Extension with the provided parameters.
 *
 * @param params - Parameters for the group data
 * @returns Encoded extension data ready for use in MLS
 */
export function createMarmotGroupData(
  params: CreateMarmotGroupDataParams = {},
): Uint8Array {
  const data: MarmotGroupData = {
    version: MARMOT_GROUP_DATA_VERSION,
    nostrGroupId: params.nostrGroupId || randomBytes(32),
    name: params.name || "",
    description: params.description || "",
    adminPubkeys: params.adminPubkeys || [],
    relays: params.relays || [],
    imageHash: params.imageHash || new Uint8Array(32),
    imageKey: params.imageKey || new Uint8Array(32),
    imageNonce: params.imageNonce || new Uint8Array(12),
  };

  return encodeMarmotGroupData(data);
}

// Image encryption/decryption functions will be implemented in MIP-04

/**
 * Validates that an admin public key is authorized in the group data.
 *
 * @param groupData - The decoded group data
 * @param adminPubkey - The public key to check (hex-encoded)
 * @returns true if the admin is authorized
 */
export function isAdmin(
  groupData: MarmotGroupData,
  adminPubkey: string,
): boolean {
  return groupData.adminPubkeys.includes(adminPubkey.toLowerCase());
}

// Helper functions

/**
 * Encodes a variable-length field with a 2-byte length prefix (big-endian).
 */
function encodeVariableLengthField(data: Uint8Array): Uint8Array {
  if (data.length > 65535) {
    throw new Error(
      `Variable-length field too long: ${data.length} bytes (max 65535)`,
    );
  }

  const result = new Uint8Array(2 + data.length);
  new DataView(result.buffer).setUint16(0, data.length, false);
  result.set(data, 2);

  return result;
}

/**
 * Decodes a variable-length field with a 2-byte length prefix (big-endian).
 */
function decodeVariableLengthField(
  buffer: Uint8Array,
  offset: number,
): { data: Uint8Array; nextOffset: number } {
  if (offset + 2 > buffer.length) {
    throw new Error("Buffer too short to read length prefix");
  }

  const length = new DataView(buffer.buffer).getUint16(offset, false);
  offset += 2;

  if (offset + length > buffer.length) {
    throw new Error(
      `Buffer too short: expected ${length} bytes, got ${buffer.length - offset}`,
    );
  }

  const data = buffer.slice(offset, offset + length);
  return {
    data,
    nextOffset: offset + length,
  };
}

/**
 * Validates MarmotGroupData structure.
 */
function validateMarmotGroupData(data: MarmotGroupData): void {
  // Validate version
  if (data.version < 1) {
    throw new Error(`Invalid version: ${data.version}`);
  }

  // Validate nostr_group_id length
  if (data.nostrGroupId.length !== 32) {
    throw new Error("nostr_group_id must be exactly 32 bytes");
  }

  // Validate strings are valid UTF-8 (TextEncoder will throw if invalid)
  try {
    new TextEncoder().encode(data.name);
    new TextEncoder().encode(data.description);
  } catch (error) {
    throw new Error(`Invalid UTF-8 encoding: ${error}`);
  }

  // Validate admin pubkeys
  for (const pubkey of data.adminPubkeys) {
    if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
      throw new Error(
        `Invalid admin public key format: ${pubkey} (must be 64 hex characters)`,
      );
    }
  }

  // Validate no duplicate admin keys
  const uniqueAdmins = new Set(data.adminPubkeys.map((k) => k.toLowerCase()));
  if (uniqueAdmins.size !== data.adminPubkeys.length) {
    throw new Error("Duplicate admin public keys detected");
  }

  // Validate relays
  for (const relay of data.relays) {
    if (!relay.startsWith("ws://") && !relay.startsWith("wss://")) {
      throw new Error(
        `Invalid relay URL: ${relay} (must start with ws:// or wss://)`,
      );
    }
  }

  // Validate image field lengths
  if (data.imageHash.length !== 32) {
    throw new Error("image_hash must be exactly 32 bytes");
  }
  if (data.imageKey.length !== 32) {
    throw new Error("image_key must be exactly 32 bytes");
  }
  if (data.imageNonce.length !== 12) {
    throw new Error("image_nonce must be exactly 12 bytes");
  }
}
