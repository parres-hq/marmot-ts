import { NostrEvent, UnsignedEvent } from "applesauce-core/helpers/event";
import { decodeWelcome, encodeWelcome, type Welcome } from "ts-mls/welcome.js";
import {
  decodeContent,
  encodeContent,
  getEncodingTag,
} from "../utils/encoding.js";
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
  const content = encodeContent(serializedWelcome, "base64");

  return {
    kind: WELCOME_EVENT_KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags: [
      ["e", keyPackageId],
      ["relays", ...relays],
      ["encoding", "base64"],
    ],
  };
}

/**
 * Gets the Welcome message from a kind 444 event.
 *
 * @param event - The Nostr event containing the welcome message
 * @returns The decoded Welcome message
 * @throws Error if the content cannot be decoded
 */
export function getWelcome(event: NostrEvent): Welcome {
  if (event.kind !== WELCOME_EVENT_KIND) {
    throw new Error(
      `Expected welcome event kind ${WELCOME_EVENT_KIND}, got ${event.kind}`,
    );
  }
  // Check for encoding tag, default to hex for backward compatibility
  const encodingFormat = getEncodingTag(event) ?? "hex";
  const content = decodeContent(event.content, encodingFormat);
  const welcome = decodeWelcome(content, 0);
  if (!welcome) throw new Error("Failed to decode welcome message");

  return welcome[0];
}
