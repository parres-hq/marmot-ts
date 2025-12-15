import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  Credential,
  CredentialBasic,
  encodeCredential,
} from "ts-mls/credential.js";

export function isHexKey(str: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(str);
}

/** Creates a MLS basic credential from a nostr public key. */
export function createCredential(pubkey: string): CredentialBasic {
  if (isHexKey(pubkey) === false)
    throw new Error("Invalid nostr public key, must be 64 hex characters");

  return {
    credentialType: "basic",
    identity: hexToBytes(pubkey),
  };
}

const legacyDecoder = new TextDecoder();

/** Gets the nostr public key from a credential. */
export function getCredentialPubkey(credential: Credential): string {
  if (credential.credentialType !== "basic")
    throw new Error(
      "Credential is not a basic credential, cannot get nostr public key",
    );

  const str = bytesToHex(credential.identity);

  // Backwards compatibility with utf8 encoded public keys
  if (isHexKey(str) === false) {
    const decoded = legacyDecoder.decode(credential.identity);
    if (isHexKey(decoded) === false)
      throw new Error("Invalid credential nostr public key");
    return decoded;
  }

  return str;
}

/** Checks if two credentials are the same. */
export function isSameCredential(a: Credential, b: Credential): boolean {
  // If they are basic credentials, we can just compare the identities
  if (a.credentialType === "basic" && b.credentialType === "basic") {
    return bytesToHex(a.identity) === bytesToHex(b.identity);
  }

  // NOTE: assuming the encoding is deterministic
  return bytesToHex(encodeCredential(a)) === bytesToHex(encodeCredential(b));
}
