import { getDisplayName, getProfilePicture } from "applesauce-core/helpers";
import { useObservableMemo } from "../hooks/use-observable";
import { eventStore } from "../lib/nostr";

export function UserName(props: { pubkey: string }) {
  const profile = useObservableMemo(
    () => eventStore.profile(props.pubkey),
    [props.pubkey],
  );

  return <>{getDisplayName(profile, props.pubkey.slice(0, 16))}</>;
}

export function UserAvatar({ pubkey }: { pubkey: string }) {
  const profile = useObservableMemo(() => eventStore.profile(pubkey), [pubkey]);

  return (
    <div className="avatar">
      <div className="w-12 h-12 rounded-full">
        <img
          src={
            getProfilePicture(profile) ||
            `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`
          }
          alt="avatar"
        />
      </div>
    </div>
  );
}
