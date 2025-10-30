import { cbc } from "@noble/ciphers/aes.js";
import { bytesToUtf8 } from "@noble/ciphers/utils.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { KeyPackageStoreBackend } from "../core/key-package-store.js";

const TEST_KEY = "__test__";
const TEST_VALUE = "decryption test value";

/**
 * Wrapper around a {@link KeyPackageStoreBackend} that encrypts and decrypts data using a password.
 * WARNING: THIS IS NOT SECURE AND SHOULD NOT BE USED IN PRODUCTION. IT IS ONLY FOR DEMONSTRATION PURPOSES.
 */
export class EncryptedKeyValueStore {
  private key: Uint8Array | null = null;
  get unlocked() {
    return this.key !== null;
  }

  constructor(
    private database: KeyPackageStoreBackend,
    private salt: Uint8Array,
  ) {}

  // Generate encryption key from password
  private deriveKey(password: string): Uint8Array {
    // Convert password to bytes
    const passwordBytes = utf8ToBytes(password);

    // Use PBKDF2 to derive a key from the password
    // 32 bytes key for AES-256, with 10000 iterations
    return pbkdf2(sha256, passwordBytes, this.salt, { c: 10000, dkLen: 32 });
  }

  // Encrypt and store data
  async setItem(
    key: string,
    value: string,
    encryptionKey = this.key,
  ): Promise<boolean> {
    if (!encryptionKey) throw new Error("Storage locked");

    try {
      // Convert value to string if it's an object
      const valueBytes = utf8ToBytes(value);

      // Generate a random IV for CBC mode
      const iv = crypto.getRandomValues(new Uint8Array(16));

      // Create AES-CBC cipher
      const cipher = cbc(encryptionKey, iv);

      // Encrypt the data
      const encryptedData = cipher.encrypt(valueBytes);

      // Store IV and encrypted data directly as binary
      const dataToStore = { iv, data: encryptedData };

      // Store the encrypted data - LocalForage can handle this directly
      await this.database.setItem(key, dataToStore);
      return true;
    } catch (error) {
      console.error("Encryption error:", error);
      return false;
    }
  }

  // Retrieve and decrypt data
  async getItem(key: string, encryptionKey = this.key): Promise<string | null> {
    if (!encryptionKey) throw new Error("Storage locked");

    // Get encrypted data
    const encryptedPackage = (await this.database.getItem(key)) as {
      iv: Uint8Array;
      data: Uint8Array;
    } | null;
    if (!encryptedPackage) return null;

    // Create AES-CBC decipher
    const decipher = cbc(encryptionKey, encryptedPackage.iv);

    // Decrypt the data
    let decryptedBytes: Uint8Array;
    try {
      decryptedBytes = decipher.decrypt(encryptedPackage.data);
    } catch (e) {
      throw new Error("Decryption failed, incorrect PIN");
    }

    // Convert bytes to UTF-8 string
    const decryptedText = bytesToUtf8(decryptedBytes);

    return decryptedText;
  }

  // Remove an item
  async removeItem(key: string): Promise<void> {
    return this.database.removeItem(key);
  }

  // Clear all stored data
  async clear(): Promise<void> {
    return this.database.clear();
  }

  /** Verify if a password can decrypt stored data */
  async unlock(password: string, testKey: string = TEST_KEY): Promise<boolean> {
    // Create a key from the password
    const key = this.deriveKey(password);

    try {
      // Try to get a known test value with this password
      const testValue = await this.getItem(testKey, key);

      // If we've never set a test value with this password before, set one
      if (testValue === null) {
        // First setup
        await this.setItem(testKey, TEST_VALUE, key);
        this.key = this.deriveKey(password);
        return true;
      } else if (testValue === TEST_VALUE) {
        // Save the key for later
        this.key = this.deriveKey(password);
        return true;
      }
    } catch (error) {
      // decryption failed, do nothing
    }

    return false;
  }
}
