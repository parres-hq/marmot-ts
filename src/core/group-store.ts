import { bytesToHex } from "@noble/hashes/utils.js";
import { KeyValueStoreBackend } from "../utils/key-value.js";
import { Group, CompleteGroup } from "./group.js";
import { ClientConfig } from "ts-mls/clientConfig.js";
import {
  serializeClientState,
  deserializeClientState,
  StoredClientState,
} from "./client-state-storage.js";

/**
 * The data structure actually stored in the backend.
 * Contains both the public group metadata and the serialized private client state.
 */
export interface StoredGroupEntry {
  group: Group;
  clientState: StoredClientState;
}

/** A generic interface for a group store backend */
export interface GroupStoreBackend
  extends KeyValueStoreBackend<StoredGroupEntry> {}

/** Options for creating a {@link GroupStore} instance */
export type GroupStoreOptions = {
  prefix?: string;
};

/**
 * Stores {@link Group}s and their {@link ClientState} in a {@link GroupStoreBackend}.
 *
 * This class manages the persistence of MLS groups, including the sensitive
 * ClientState which is serialized and stored alongside the group metadata.
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
   * Adds a complete group (metadata + client state) to the store.
   *
   * @param completeGroup - The complete group package
   * @returns A promise that resolves to the storage key used
   */
  async add(completeGroup: CompleteGroup): Promise<string> {
    const { group, clientState } = completeGroup;
    const key = this.resolveStorageKey(group.groupId);

    const entry: StoredGroupEntry = {
      group,
      clientState: serializeClientState(clientState),
    };

    await this.backend.setItem(key, entry);
    return key;
  }

  /**
   * Retrieves the stored group entry (metadata + serialized client state).
   *
   * @param groupId - The group ID (as Uint8Array or hex string)
   * @returns A promise that resolves to the stored entry, or null if not found
   */
  async get(groupId: Uint8Array | string): Promise<StoredGroupEntry | null> {
    const key = this.resolveStorageKey(groupId);
    return await this.backend.getItem(key);
  }

  /**
   * Retrieves the complete group package (metadata + client state).
   *
   * @param groupId - The group ID (as Uint8Array or hex string)
   * @param config - The ClientConfig required to reconstruct the ClientState
   * @returns A promise that resolves to the complete group, or null if not found
   */
  async getComplete(
    groupId: Uint8Array | string,
    config: ClientConfig,
  ): Promise<CompleteGroup | null> {
    const key = this.resolveStorageKey(groupId);
    const entry = await this.backend.getItem(key);

    if (!entry) return null;

    const clientState = deserializeClientState(entry.clientState, config);

    return {
      group: entry.group,
      clientState,
    };
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
  async list(): Promise<StoredGroupEntry[]> {
    const allKeys = await this.backend.keys();

    const keys = this.prefix
      ? allKeys.filter((key) => key.startsWith(this.prefix!))
      : allKeys;

    const entries = await Promise.all(
      keys.map((key) => this.backend.getItem(key)),
    );

    return entries.filter((entry): entry is StoredGroupEntry => {
      return entry !== null && "group" in entry && "clientState" in entry;
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
