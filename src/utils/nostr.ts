import { NostrEvent, Rumor } from "applesauce-core/helpers";
import type { EventSigner } from "applesauce-factory";
import { create } from "applesauce-factory";
import { GiftWrapBlueprint } from "applesauce-factory/blueprints";
import type { GiftWrapOptions } from "applesauce-factory/operations/gift-wrap";

/** Returns the value of a name / value tag */
export function getTagValue(
  event: NostrEvent,
  name: string,
): string | undefined {
  return event.tags.find((t) => t[0] === name)?.[1];
}

/**
 * Options for creating a gift wrap event for a welcome message.
 */
export interface CreateGiftWrapOptions {
  /** The unsigned welcome event (kind 444) to wrap */
  rumor: Rumor;
  /** The recipient's public key (hex string) */
  recipientPubkey: string;
  /** The signer for creating the gift wrap */
  signer: EventSigner;
  /** Optional gift wrap options */
  opts?: GiftWrapOptions;
}

/**
 * Creates a gift wrap event (kind 1059) for a welcome message.
 *
 * Uses applesauce-factory's GiftWrapBlueprint to create the gift wrap event
 * for the recipient, providing privacy and unlinkability (NIP-59).
 *
 * @param options - Configuration for creating the gift wrap
 * @returns A signed gift wrap event ready for publishing
 */
export async function createGiftWrap(
  options: CreateGiftWrapOptions,
): Promise<NostrEvent> {
  const { rumor, recipientPubkey, signer, opts } = options;

  // Use the GiftWrapBlueprint to create the gift wrap
  return await create(
    { signer },
    GiftWrapBlueprint,
    recipientPubkey,
    rumor,
    opts,
  );
}
