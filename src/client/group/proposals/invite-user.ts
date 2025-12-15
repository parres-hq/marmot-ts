import { isEvent, NostrEvent } from "applesauce-core/helpers/event";
import { type KeyPackage } from "ts-mls";
import { type ProposalAdd } from "ts-mls/proposal.js";
import { getKeyPackage } from "../../../core/key-package.js";
import { ProposalBuilder } from "../marmot-group.js";

/** Builds a proposal to invite a user to the group from a key package event or raw key package */
export function proposeInviteUser(
  keyPackageEvent: KeyPackage | NostrEvent,
): ProposalBuilder<ProposalAdd> {
  return async () => {
    const keyPackage = isEvent(keyPackageEvent)
      ? getKeyPackage(keyPackageEvent)
      : keyPackageEvent;

    return {
      proposalType: "add",
      add: { keyPackage },
    };
  };
}
