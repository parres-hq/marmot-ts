import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { ClientState } from "ts-mls/clientState.js";
import { ClientConfig } from "ts-mls/clientConfig.js";
import { defaultMarmotClientConfig } from "./protocol.js";

/**
 * Interface for the stored client state.
 * We use a loose definition here because we're serializing the internal structure
 * of ClientState which is complex and contains many nested types.
 */
export type StoredClientState = Record<string, unknown>;

/**
 * Serializes a ClientState object for storage.
 * Converts Uint8Array to hex strings and BigInt to strings.
 * Removes the 'config' field which contains non-serializable functions.
 *
 * @param state - The ClientState to serialize
 * @returns A JSON-serializable object
 */
export function serializeClientState(state: ClientState): StoredClientState {
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
  stored: StoredClientState,
  config: ClientConfig,
): ClientState {
  const state = JSON.parse(JSON.stringify(stored), reviver) as ClientState;
  // Inject the config back into the state
  state.clientConfig = config;
  return state;
}

/**
 * Rehydrates a ClientState from storage, handling both deserialization and logic injection.
 * This is the primary method for restoring a group session.
 *
 * @param stored - The stored client state
 * @param authService - The authentication service to use (defaults to Marmot's service)
 * @returns A fully functional ClientState object
 */
export function rehydrateClientState(stored: StoredClientState): ClientState {
  return deserializeClientState(stored, defaultMarmotClientConfig);
}

// --- Helpers ---

const HEX_PREFIX = "hex:";
const BIGINT_PREFIX = "bigint:";

function replacer(key: string, value: any): any {
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

function reviver(_key: string, value: any): any {
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

  return value;
}
