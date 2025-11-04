import { NostrEvent } from "../utils/nostr.js";
import { isValidRelayUrl, normalizeRelayUrl } from "../utils/relay-url.js";
import {
  KEY_PACKAGE_RELAY_LIST_KIND,
  KEY_PACKAGE_RELAY_LIST_RELAY_TAG,
} from "./protocol.js";

/**
 * Gets the relay URLs from a kind 10051 event.
 * These relays indicate where a user publishes their KeyPackages.
 *
 * @param event - The kind 10051 event containing relay information
 * @returns Array of relay URLs, or empty array if none found
 *
 * @example
 * ```typescript
 * const event = {
 *   kind: 10051,
 *   tags: [
 *     ["relay", "wss://inbox.nostr.wine"],
 *     ["relay", "wss://myrelay.nostr1.com"]
 *   ],
 *   // ... other fields
 * };
 * const relays = getKeyPackageRelayList(event);
 * // Returns: ["wss://inbox.nostr.wine", "wss://myrelay.nostr1.com"]
 * ```
 */
export function getKeyPackageRelayList(event: NostrEvent): string[] {
  return event.tags
    .filter((tag) => tag[0] === KEY_PACKAGE_RELAY_LIST_RELAY_TAG && tag[1])
    .map((tag) => tag[1])
    .filter(isValidRelayUrl)
    .map(normalizeRelayUrl);
}

/**
 * Validates a kind 10051 relay list event.
 *
 * @param event - The event to validate
 * @returns True if the event is a valid kind 10051 relay list event
 *
 * @example
 * ```typescript
 * const isValid = isValidKeyPackageRelayListEvent(event);
 * if (isValid) {
 *   const relays = getKeyPackageRelayList(event);
 * }
 * ```
 */
export function isValidKeyPackageRelayListEvent(event: NostrEvent): boolean {
  return (
    event.kind === KEY_PACKAGE_RELAY_LIST_KIND &&
    getKeyPackageRelayList(event).length > 0
  );
}
