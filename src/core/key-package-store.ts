import { bytesToHex } from "@noble/hashes/utils.js";
import { KeyPackage, PrivateKeyPackage } from "ts-mls";
import { Hash } from "ts-mls/crypto/hash.js";
import { makeHashImpl } from "ts-mls/crypto/implementation/noble/makeHashImpl.js";
import { makeKeyPackageRef } from "ts-mls/keyPackage.js";

/** A generic interface for a key-value store */
export interface KeyPackageStoreBackend {
  /** Get an item from the store */
  getItem<T>(key: string): Promise<T | null>;
  /** Set an item in the store */
  setItem<T>(key: string, value: T): Promise<T>;
  /** Remove an item from the store */
  removeItem(key: string): Promise<void>;
  /** Clear all items from the store */
  clear(): Promise<void>;
  /** Get all keys in the store */
  keys(): Promise<string[]>;
}

/**
 * A complete key package containing both public and private components.
 *
 * The public package can be shared with others to add this participant to groups,
 * while the private package must be kept secret and is used for decryption and signing.
 */
export type CompleteKeyPackage = {
  /** The public key package that can be shared with others */
  publicPackage: KeyPackage;
  /** The private key package that must be kept secret */
  privatePackage: PrivateKeyPackage;
};

/**
 * Stores {@link CompleteKeyPackage}s in a {@link KeyPackageStoreBackend}.
 *
 * This class provides a simple interface for managing complete key packages, including their private components.
 * It's designed to work with any backend that implements the {@link KeyPackageStoreBackend} interface.
 *
 * @example
 * ```typescript
 * const store = new KeyPackageStore(backend);
 *
 * // Add a complete key package
 * await store.add(completeKeyPackage);
 * // List all key packages
 * const packages = await store.list();
 * // Get a specific key package by its publicKey
 * const publicPackage = await store.getPublicKey(publicKey);
 * const privatePackage = await store.getPrivateKey(publicKey);
 * // Remove a key package
 * await store.remove(publicPackage);
 * ```
 */
export class KeyPackageStore {
  private backend: KeyPackageStoreBackend;
  private readonly hash: Hash;

  /**
   * Creates a new KeyPackageStore instance.
   * @param backend - The storage backend to use (e.g., localForage)
   */
  constructor(
    backend: KeyPackageStoreBackend,
    hash: Hash = makeHashImpl("SHA-256"),
  ) {
    this.backend = backend;
    this.hash = hash;
  }

  /** Generates a unique key for storing a key package. */
  private async getStorageKey(publicPackage: KeyPackage): Promise<string> {
    const key = await makeKeyPackageRef(publicPackage, this.hash);
    return bytesToHex(key);
  }

  /**
   * Resolves the storage key from various input types.
   * @param hashOrPackage - The hash or key package to resolve
   */
  private async resolveStorageKey(
    hashOrPackage: Uint8Array | string | KeyPackage,
  ): Promise<string> {
    if (typeof hashOrPackage === "string") {
      // Already a hex string
      return hashOrPackage;
    } else if (hashOrPackage instanceof Uint8Array) {
      // Convert Uint8Array to hex
      return bytesToHex(hashOrPackage);
    } else {
      // It's a KeyPackage
      return await this.getStorageKey(hashOrPackage);
    }
  }

  /**
   * Adds a complete key package to the store.
   *
   * @param keyPackage - The complete key package containing both public and private components
   * @returns A promise that resolves to the storage key used
   *
   * @example
   * ```typescript
   * const keyPackage = await marmot.createKeyPackage(credential);
   * const key = await store.add(keyPackage);
   * console.log(`Stored key package with key: ${key}`);
   * ```
   */
  async add(keyPackage: CompleteKeyPackage): Promise<string> {
    const key = await this.getStorageKey(keyPackage.publicPackage);

    // Serialize the key package for storage
    const serialized = {
      publicPackage: keyPackage.publicPackage,
      privatePackage: keyPackage.privatePackage,
    };

    await this.backend.setItem(key, serialized);
    return key;
  }

  /**
   * Retrieves only the public key package from the store.
   *
   * This method is useful when you only need the public component and want to avoid
   * loading the private key into memory.
   *
   * @param keyOrPackage - Either the initKey (as Uint8Array or hex string) or the full KeyPackage
   * @returns A promise that resolves to the public key package, or null if not found
   */
  async getPublicKey(
    keyOrPackage: Uint8Array | string | KeyPackage,
  ): Promise<KeyPackage | null> {
    const key = await this.resolveStorageKey(keyOrPackage);
    const stored = await this.backend.getItem<CompleteKeyPackage>(key);
    return stored ? stored.publicPackage : null;
  }

  /**
   * Retrieves only the private key package from the store.
   *
   * Use this method when you need access to the private keys for cryptographic operations.
   * Be cautious about keeping private keys in memory longer than necessary.
   *
   * @param keyOrPackage - Either the initKey (as Uint8Array or hex string) or the full KeyPackage
   */
  async getPrivateKey(
    keyOrPackage: Uint8Array | string | KeyPackage,
  ): Promise<PrivateKeyPackage | null> {
    const key = await this.resolveStorageKey(keyOrPackage);
    const stored = await this.backend.getItem<CompleteKeyPackage>(key);
    return stored ? stored.privatePackage : null;
  }

  /**
   * Removes a key package from the store.
   * @param keyOrPackage - Either the initKey (as Uint8Array or hex string) or the full KeyPackage
   */
  async remove(keyOrPackage: Uint8Array | string | KeyPackage): Promise<void> {
    const key = await this.resolveStorageKey(keyOrPackage);
    await this.backend.removeItem(key);
  }

  /**
   * Lists all public key packages stored in the store.
   * @returns An array of public key packages
   */
  async list(): Promise<KeyPackage[]> {
    const keys = await this.backend.keys();

    const packages = await Promise.all(
      keys.map((key) => this.backend.getItem<CompleteKeyPackage>(key)),
    );

    // Filter out null values and validate that items are CompleteKeyPackages
    return (
      packages
        .filter((pkg): pkg is CompleteKeyPackage => {
          if (!pkg) return false;
          // Basic validation: check if it has the expected structure
          return (
            typeof pkg === "object" &&
            "publicPackage" in pkg &&
            "privatePackage" in pkg
          );
        })
        // Only return the public packages
        .map((pkg) => pkg.publicPackage)
    );
  }

  /** Gets the count of key packages stored. */
  async count(): Promise<number> {
    const packages = await this.list();
    return packages.length;
  }

  /** Clears all key packages from the store. */
  async clear(): Promise<void> {
    await this.backend.clear();
  }

  /**
   * Checks if a key package exists in the store.
   * @param keyOrPackage - Either the initKey (as Uint8Array or hex string) or the full KeyPackage
   */
  async has(keyOrPackage: Uint8Array | string | KeyPackage): Promise<boolean> {
    const key = await this.resolveStorageKey(keyOrPackage);
    const item = await this.backend.getItem<CompleteKeyPackage>(key);
    return item !== null;
  }
}
