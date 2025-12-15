import { isEvent, NostrEvent } from "applesauce-core/helpers/event";
import { type KeyPackage } from "ts-mls";
import { type ProposalAdd } from "ts-mls/proposal.js";
import { getKeyPackage } from "../../../core/key-package.js";
import { ProposalBuilder } from "../marmot-group.js";

/** Builds an add member proposal from a key package event or raw key package */
export function proposeAddMember(
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
