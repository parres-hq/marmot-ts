import { bytesToHex } from "@noble/ciphers/utils.js";
import { UnsignedEvent } from "applesauce-core/helpers/event";
import { encodeWelcome, type Welcome } from "ts-mls/welcome.js";
import { WELCOME_EVENT_KIND } from "./protocol.js";

/**
 * Creates an unsigned Nostr event (kind 444) for a welcome message.
 *
 * @param welcomeMessage - The MLS welcome message
 * @param keyPackageId - The ID of the key package used for the add operation
 * @param pubkey - The sender's public key (hex string)
 * @param relays - Array of relay URLs for the group
 * @returns Unsigned Nostr event
 */
export function createWelcomeEvent(
  welcomeMessage: Welcome,
  keyPackageId: string,
  pubkey: string,
  relays: string[],
): UnsignedEvent {
  // Serialize the welcome message according to RFC 9420
  const serializedWelcome = encodeWelcome(welcomeMessage);
  const content = bytesToHex(serializedWelcome);

  return {
    kind: WELCOME_EVENT_KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags: [
      ["e", keyPackageId],
      ["relays", ...relays],
    ],
  };
}
