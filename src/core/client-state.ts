import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { ClientConfig, defaultClientConfig } from "ts-mls/clientConfig.js";
import { ClientState } from "ts-mls/clientState.js";
import { Extension } from "ts-mls/extension.js";
import { marmotAuthService } from "./auth-service.js";
import { decodeMarmotGroupData } from "./marmot-group-data.js";
import {
  MARMOT_GROUP_DATA_EXTENSION_TYPE,
  MarmotGroupData,
} from "./protocol.js";

/** Default ClientConfig for Marmot */
export const defaultMarmotClientConfig = {
  ...defaultClientConfig,
  auth_service: marmotAuthService,
};

/**
 * Extracts MarmotGroupData from a ClientState's extensions.
 *
 * @param clientState - The ClientState to extract data from
 * @returns The MarmotGroupData if found, null otherwise
 */
export function extractMarmotGroupData(
  clientState: ClientState,
): MarmotGroupData | null {
  const marmotExtension = clientState.groupContext.extensions.find(
    (ext: Extension) =>
      typeof ext.extensionType === "number" &&
      ext.extensionType === MARMOT_GROUP_DATA_EXTENSION_TYPE,
  );

  if (!marmotExtension) {
    return null;
  }

  return decodeMarmotGroupData(marmotExtension.extensionData);
}

/**
 * Gets the group ID from ClientState as a hex string.
 *
 * @param clientState - The ClientState to get group ID from
 * @returns Hex string representation of the group ID
 */
export function getGroupIdHex(clientState: ClientState): string {
  return bytesToHex(clientState.groupContext.groupId);
}

/**
 * Gets the Nostr group ID from ClientState as a hex string.
 *
 * @param clientState - The ClientState to get Nostr group ID from
 * @returns Hex string representation of the Nostr group ID
 */
export function getNostrGroupIdHex(clientState: ClientState): string {
  const marmotData = extractMarmotGroupData(clientState);
  if (!marmotData) {
    throw new Error("MarmotGroupData not found in ClientState");
  }
  return bytesToHex(marmotData.nostrGroupId);
}

/**
 * Gets the current epoch from ClientState.
 *
 * @param clientState - The ClientState to get epoch from
 * @returns The current epoch number
 */
export function getEpoch(clientState: ClientState): number {
  return Number(clientState.groupContext.epoch);
}

/**
 * Gets the member count from ClientState.
 *
 * @param clientState - The ClientState to get member count from
 * @returns The number of members in the group
 */
export function getMemberCount(clientState: ClientState): number {
  return clientState.ratchetTree.filter(
    (node) => node && node.nodeType === "leaf",
  ).length;
}

/**
 * The serialized form of ClientState for storage.
 * Uses JSON serialization with custom handling for Uint8Array, BigInt, and Map types.
 */
export type SerializedClientState = Record<string, unknown>;

/**
 * Serializes a ClientState object for storage.
 * Converts Uint8Array to hex strings and BigInt to strings.
 * Removes the 'config' field which contains non-serializable functions.
 *
 * @param state - The ClientState to serialize
 * @returns A JSON-serializable object
 */
export function serializeClientState(
  state: ClientState,
): SerializedClientState {
  return JSON.parse(JSON.stringify(state, replacer));
}

/**
 * Deserializes a stored client state back into a ClientState object.
 * Reconstructs Uint8Array and BigInt from strings.
 * Re-injects the ClientConfig.
 *
 * @param stored - The stored state object
 * @param config - The ClientConfig to inject (contains AuthenticationService)
 * @returns The reconstructed ClientState
 */
export function deserializeClientState(
  stored: SerializedClientState,
  config: ClientConfig,
): ClientState {
  const state = JSON.parse(JSON.stringify(stored), reviver) as ClientState;
  // Inject the config back into the state
  state.clientConfig = config;
  return state;
}

// --- Serization helpers ---
const HEX_PREFIX = "hex:";
const BIGINT_PREFIX = "bigint:";

export function replacer(key: string, value: any): any {
  // Exclude config from serialization
  if (key === "clientConfig") {
    return undefined;
  }

  // Handle Uint8Array
  if (value instanceof Uint8Array) {
    return `${HEX_PREFIX}${bytesToHex(value)}`;
  }

  // Handle BigInt
  if (typeof value === "bigint") {
    return `${BIGINT_PREFIX}${value.toString()}`;
  }

  // Handle Map (convert to array of entries)
  if (value instanceof Map) {
    return {
      dataType: "Map",
      value: Array.from(value.entries()),
    };
  }

  return value;
}

function reviver(key: string, value: any): any {
  if (typeof value === "string") {
    // Restore Uint8Array
    if (value.startsWith(HEX_PREFIX)) {
      return hexToBytes(value.slice(HEX_PREFIX.length));
    }

    // Restore BigInt
    if (value.startsWith(BIGINT_PREFIX)) {
      return BigInt(value.slice(BIGINT_PREFIX.length));
    }
  }

  // Restore Map
  if (
    typeof value === "object" &&
    value !== null &&
    value.dataType === "Map" &&
    Array.isArray(value.value)
  ) {
    return new Map(value.value);
  }

  // Handle ratchetTree array - convert null blank nodes back to undefined
  if (key === "ratchetTree" && Array.isArray(value)) {
    return value.map((node) => (node === null ? undefined : node));
  }

  return value;
}
