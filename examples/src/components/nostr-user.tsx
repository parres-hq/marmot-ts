// ============================================================================
// User Profile Components
// ============================================================================

import { getDisplayName, getProfilePicture } from "applesauce-core/helpers";
import { useObservableMemo } from "../hooks/use-observable";
import { eventStore } from "../lib/nostr";

export function UserName(props: { pubkey: string }) {
  const profile = useObservableMemo(
    () => eventStore.profile(props.pubkey),
    [props.pubkey],
  );

  return <span>{getDisplayName(profile, props.pubkey.slice(0, 16))}</span>;
}

export function UserAvatar(props: { pubkey: string }) {
  const profile = useObservableMemo(
    () => eventStore.profile(props.pubkey),
    [props.pubkey],
  );

  return (
    <div className="avatar">
      <div className="w-12 h-12 rounded-full">
        <img
          src={
            getProfilePicture(profile) ||
            `https://api.dicebear.com/7.x/identicon/svg?seed=${props.pubkey}`
          }
          alt="avatar"
        />
      </div>
    </div>
  );
}
