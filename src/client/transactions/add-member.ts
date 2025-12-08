import { bytesToHex } from "@noble/hashes/utils.js";
import { NostrEvent } from "applesauce-core/helpers/event";
import { extractMarmotGroupData } from "../../core/client-state.js";
import { getCredentialPubkey } from "../../core/credential.js";
import { addMemberToGroup } from "../../core/group-membership.js";
import { createGroupEvent } from "../../core/group.js";
import { getKeyPackage } from "../../core/key-package.js";
import { createWelcomeRumor } from "../../core/welcome.js";
import { createGiftWrap } from "../../utils/nostr.js";
import { GroupTransaction } from "../marmot-group.js";

/**
 * Parameters for adding a member to an existing group with Nostr integration.
 */
export interface AddMemberOptions {
  /** The key package of the new member to add */
  keyPackageEvent: NostrEvent;
  /** The users inbox relays to publish the events to */
  inboxes: string[];
}

/**
 * Group transaction for adding a new member to an existing MLS group with
 * complete Nostr integration.
 *
 * This transaction orchestrates the complete workflow for adding a member and
 * delivering the corresponding Nostr events:
 * 1. Creates an Add proposal and Commit using MLS operations
 * 2. Generates Nostr events (commit and welcome)
 * 3. Gift-wraps the welcome message
 * 4. Publishes the commit and gift-wrapped welcome events to the configured
 *    inbox relays
 *
 * Callers can still extend this transaction (e.g. to publish to additional
 * relay targets or perform other side effects) if needed.
 */
export function addMember(options: AddMemberOptions): GroupTransaction {
  return async ({ state, ciphersuite, signer, pool }) => {
    const { keyPackageEvent, inboxes } = options;
    const selfPubkey = await signer.getPublicKey();

    // Step 1: Perform MLS member addition
    const keyPackage = getKeyPackage(keyPackageEvent);
    const commitResult = await addMemberToGroup(state, keyPackage, ciphersuite);

    // Step 2: Create Nostr commit event
    const marmotData = extractMarmotGroupData(state);
    if (!marmotData)
      throw new Error("MarmotGroupData not found in ClientState");

    const nostrGroupId = bytesToHex(marmotData.nostrGroupId);
    const commitEvent = createGroupEvent(commitResult.commit, nostrGroupId);

    // Step 3: Create welcome event
    if (!commitResult.welcome)
      throw new Error(
        "Welcome message not generated. This should not happen when adding a member.",
      );

    const welcomeEvent = createWelcomeRumor(
      commitResult.welcome,
      keyPackageEvent.id,
      selfPubkey,
      marmotData.relays,
    );

    // Step 4: create gift wrap
    const giftWrapEvent = await createGiftWrap({
      rumor: welcomeEvent,
      recipient: getCredentialPubkey(keyPackage.leafNode.credential),
      signer,
    });

    // Publish the events to the inbox relays
    await pool.publish(inboxes, commitEvent);
    await pool.publish(inboxes, giftWrapEvent);

    return {
      state: commitResult.newState,
    };
  };
}
