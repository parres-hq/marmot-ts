import { bytesToHex } from "@noble/hashes/utils.js";
import { KeyValueStoreBackend } from "../utils/key-value.js";
import { Group } from "./group.js";

/** A generic interface for a group store backend */
export interface GroupStoreBackend extends KeyValueStoreBackend<Group> {}

/** Options for creating a {@link GroupStore} instance */
export type GroupStoreOptions = {
  prefix?: string;
};

/**
 * Stores {@link Group}s in a {@link GroupStoreBackend}.
 *
 * This class provides a simple interface for managing groups with their Marmot metadata.
 * It's designed to work with any backend that implements the {@link GroupStoreBackend} interface.
 *
 * Note: Only stores serializable Group data, not the MLS ClientState (which contains functions).
 *
 * @example
 * ```typescript
 * const store = new GroupStore(backend);
 *
 * // Add a group
 * await store.add(group);
 * // List all groups
 * const groups = await store.list();
 * // Get a specific group by its groupId
 * const group = await store.get(groupId);
 * // Remove a group
 * await store.remove(groupId);
 * ```
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
   * Adds a group to the store.
   *
   * @param group - The group containing Marmot metadata
   * @returns A promise that resolves to the storage key used
   *
   * @example
   * ```typescript
   * const result = await createGroup(params);
   * const key = await store.add(result.group);
   * console.log(`Stored group with key: ${key}`);
   * ```
   */
  async add(group: Group): Promise<string> {
    const key = this.resolveStorageKey(group.groupId);

    await this.backend.setItem(key, group);
    return key;
  }

  /**
   * Retrieves a group from the store.
   *
   * @param groupId - The group ID (as Uint8Array or hex string)
   * @returns A promise that resolves to the group, or null if not found
   */
  async get(groupId: Uint8Array | string): Promise<Group | null> {
    const key = this.resolveStorageKey(groupId);
    return await this.backend.getItem(key);
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
   * Lists all groups stored in the store.
   * @returns An array of groups
   */
  async list(): Promise<Group[]> {
    const allKeys = await this.backend.keys();

    // Filter keys by prefix
    const keys = this.prefix
      ? allKeys.filter((key) => key.startsWith(this.prefix!))
      : allKeys;

    const groups = await Promise.all(
      keys.map((key) => this.backend.getItem(key)),
    );

    // Filter out null values and validate that items are Groups
    return groups.filter((group): group is Group => {
      if (!group) return false;
      // Basic validation: check if it has the expected structure
      return (
        typeof group === "object" &&
        "groupId" in group &&
        "marmotGroupData" in group
      );
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
