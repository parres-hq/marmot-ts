import { Credential } from "ts-mls";

const encoder = new TextEncoder();

/** Creates a MLS basic credential from a nostr public key. */
export function createCredential(pubkey: string): Credential {
  return {
    credentialType: "basic",
    identity: encoder.encode(pubkey),
  };
}
