import { NostrEvent } from "applesauce-core/helpers/event";

import { extractMarmotGroupData } from "../../core/client-state.js";
import { getCredentialPubkey } from "../../core/credential.js";
import { addMemberToGroup } from "../../core/group-membership.js";
import { createGroupEvent } from "../../core/group-message.js";
import { getKeyPackage, getKeyPackageRelays } from "../../core/key-package.js";
import { createWelcomeRumor } from "../../core/welcome.js";
import { createGiftWrap } from "../../utils/nostr.js";
import type { GroupTransaction } from "../marmot-group.js";

/**
 * Parameters for accepting an add-member proposal and actually adding the
 * member to an existing group with Nostr integration.
 */
export interface AddMemberOptions {
  /** The key package of the new member to add */
  keyPackageEvent: NostrEvent;
  /**
   * Optional explicit inbox relays for the recipient.
   *
   * These relays are used when sending the gift-wrapped Welcome event (NIP-59).
   * If not provided, we will first try to use the `relays` tag from the
   * KeyPackage event and fall back to the group's relays from MarmotGroupData.
   */
  inboxes?: string[];
}

/**
 * Group transaction for **accepting** an add-member proposal by creating a
 * Commit + Welcome and delivering the corresponding Nostr events.
 *
 * This corresponds to the **admin commit phase** in the Marmot protocol:
 *
 * 1. Creates an Add proposal and Commit using MLS operations
 * 2. Generates Nostr events (commit and welcome)
 * 3. Publishes the Commit as a Group Event to the group's relays
 * 4. Waits for at least one relay to acknowledge the Commit
 * 5. Only then gift-wraps and publishes the Welcome event to the recipient's
 *    inbox relays (NIP-59)
 *
 * Callers can still extend this transaction (e.g. to publish to additional
 * relay targets or perform other side effects) if needed.
 */
export function addMember(options: AddMemberOptions): GroupTransaction {
  return async ({ state, ciphersuite, signer, pool }) => {
    const { keyPackageEvent } = options;
    const selfPubkey = await signer.getPublicKey();

    // Step 1: Perform MLS member addition
    const keyPackage = getKeyPackage(keyPackageEvent);
    const commitResult = await addMemberToGroup(state, keyPackage, ciphersuite);

    // Step 2: Create Nostr commit event
    const marmotData = extractMarmotGroupData(state);
    if (!marmotData)
      throw new Error("MarmotGroupData not found in ClientState");

    const groupRelays = marmotData.relays ?? [];
    if (groupRelays.length === 0)
      throw new Error("Group has no relays configured for commit publishing");

    // Create group event with NIP-44 encryption using exporter_secret
    // Note: Use the NEW state after commit, as it has the updated exporter_secret
    const commitEvent = await createGroupEvent({
      message: commitResult.commit,
      state: commitResult.newState,
      ciphersuite,
    });

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

    // Determine which relays to use for the Welcome / gift wrap.
    // Priority:
    // 1. Explicit inboxes passed to the transaction
    // 2. `relays` tag from the KeyPackage event (MIP-00)
    // 3. Group relays from MarmotGroupData
    const explicitInboxes = options.inboxes ?? [];
    const keyPackageRelays = getKeyPackageRelays(keyPackageEvent) ?? [];
    const welcomeRelays =
      explicitInboxes.length > 0
        ? explicitInboxes
        : keyPackageRelays.length > 0
          ? keyPackageRelays
          : groupRelays;

    if (welcomeRelays.length === 0)
      throw new Error(
        "No relays available to send Welcome event (inboxes, key package relays, and group relays are all empty)",
      );

    // Publish the Commit to the group relays first and wait for at least one
    // positive ACK before sending the Welcome, as required by MIP-02/MIP-03.
    const commitResultPublish = await pool.publish(groupRelays, commitEvent);
    const hasAck = Object.values(commitResultPublish).some((res) => res.ok);

    if (!hasAck)
      throw new Error(
        "Failed to publish Commit event to any relay; aborting Welcome delivery",
      );

    // After at least one relay has acknowledged the Commit, send the
    // gift-wrapped Welcome to the recipient's inbox relays.
    await pool.publish(welcomeRelays, giftWrapEvent);

    return {
      state: commitResult.newState,
    };
  };
}
