import { bytesToHex } from "@noble/hashes/utils.js";
import { KeyValueStoreBackend } from "../utils/key-value.js";
import { ClientState } from "ts-mls/clientState.js";
import { ClientConfig } from "ts-mls/clientConfig.js";
import {
  serializeClientState,
  deserializeClientState,
  StoredClientState,
} from "./client-state-storage.js";
import {
  extractMarmotGroupData,
  getMemberCount,
} from "./client-state-utils.js";

/** A generic interface for a group store backend */
export interface GroupStoreBackend extends KeyValueStoreBackend<StoredClientState> {}

/** Options for creating a {@link GroupStore} instance */
export type GroupStoreOptions = {
  prefix?: string;
};

/**
 * Stores {@link ClientState} objects in a {@link GroupStoreBackend}.
 *
 * This class manages the persistence of MLS groups, storing the serialized
 * ClientState and extracted metadata for efficient querying.
 */
export class GroupStore {
  private backend: GroupStoreBackend;
  private readonly prefix?: string;

  /**
   * Creates a new GroupStore instance.
   * @param backend - The storage backend to use (e.g., localForage)
   * @param prefix - Optional prefix to add to all storage keys (useful for namespacing)
   */
  constructor(backend: GroupStoreBackend, { prefix }: GroupStoreOptions = {}) {
    this.backend = backend;
    this.prefix = prefix;
  }

  /**
   * Resolves the storage key from a group ID.
   * @param groupId - The group ID (as Uint8Array or hex string)
   */
  private resolveStorageKey(groupId: Uint8Array | string): string {
    const key = typeof groupId === "string" ? groupId : bytesToHex(groupId);
    return (this.prefix ?? "") + key;
  }

  /**
   * Adds a ClientState to the store.
   *
   * @param clientState - The ClientState to store
   * @returns A promise that resolves to the storage key used
   */
  async add(clientState: ClientState): Promise<string> {
    const key = this.resolveStorageKey(clientState.groupContext.groupId);
    const storedClientState = serializeClientState(clientState);

    await this.backend.setItem(key, storedClientState);
    return key;
  }

  /**
   * Retrieves the stored group entry (metadata + serialized client state).
   *
   * @param groupId - The group ID (as Uint8Array or hex string)
   * @returns A promise that resolves to the stored entry, or null if not found
   */
  async get(groupId: Uint8Array | string): Promise<StoredClientState | null> {
    const key = this.resolveStorageKey(groupId);
    return await this.backend.getItem(key);
  }

  /**
   * Retrieves the ClientState from storage.
   *
   * @param groupId - The group ID (as Uint8Array or hex string)
   * @param config - The ClientConfig required to reconstruct the ClientState
   * @returns A promise that resolves to the ClientState, or null if not found
   */
  async getClientState(
    groupId: Uint8Array | string,
    config: ClientConfig,
  ): Promise<ClientState | null> {
    const key = this.resolveStorageKey(groupId);
    const entry = await this.backend.getItem(key);

    if (!entry) return null;

    return deserializeClientState(entry, config);
  }

  /**
   * Removes a group from the store.
   * @param groupId - The group ID (as Uint8Array or hex string)
   */
  async remove(groupId: Uint8Array | string): Promise<void> {
    const key = this.resolveStorageKey(groupId);
    await this.backend.removeItem(key);
  }

  /**
   * Lists all stored group entries (metadata + serialized client state).
   * @returns An array of stored group entries
   */
  async list(): Promise<StoredClientState[]> {
    const allKeys = await this.backend.keys();

    const keys = this.prefix
      ? allKeys.filter((key) => key.startsWith(this.prefix!))
      : allKeys;

    const entries = await Promise.all(
      keys.map((key) => this.backend.getItem(key)),
    );

    return entries.filter((entry): entry is StoredClientState => {
      return entry !== null;
    });
  }

  /** Gets the count of groups stored. */
  async count(): Promise<number> {
    const groups = await this.list();
    return groups.length;
  }

  /** Clears all groups from the store (only those matching the prefix if one is set). */
  async clear(): Promise<void> {
    if (this.prefix) {
      // Only clear keys with this prefix
      const allKeys = await this.backend.keys();
      const keysToRemove = allKeys.filter((key) =>
        key.startsWith(this.prefix!),
      );
      await Promise.all(
        keysToRemove.map((key) => this.backend.removeItem(key)),
      );
    } else {
      // Clear all keys
      await this.backend.clear();
    }
  }

  /**
   * Checks if a group exists in the store.
   * @param groupId - The group ID (as Uint8Array or hex string)
   */
  async has(groupId: Uint8Array | string): Promise<boolean> {
    const key = this.resolveStorageKey(groupId);
    const item = await this.backend.getItem(key);
    return item !== null;
  }
}
