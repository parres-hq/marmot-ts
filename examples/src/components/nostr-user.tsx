// ============================================================================
// User Profile Components
// ============================================================================

import { from } from "solid-js";
import { eventStore } from "../lib/nostr";
import { getDisplayName, getProfilePicture } from "applesauce-core/helpers";

export function UserName(props: { pubkey: string }) {
  const profile = from(eventStore.profile(props.pubkey));
  return <span>{getDisplayName(profile(), props.pubkey.slice(0, 16))}</span>;
}

export function UserAvatar(props: { pubkey: string }) {
  const profile = from(eventStore.profile(props.pubkey));
  return (
    <div class="avatar">
      <div class="w-12 h-12 rounded-full">
        <img
          src={
            getProfilePicture(profile()) ||
            `https://api.dicebear.com/7.x/identicon/svg?seed=${props.pubkey}`
          }
          alt="avatar"
        />
      </div>
    </div>
  );
}
