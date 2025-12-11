import { getDisplayName, getProfilePicture } from "applesauce-core/helpers";
import { useObservableMemo } from "../../hooks/use-observable";
import { eventStore } from "../../lib/nostr";
import UserSearch from "./user-search";

function SelectedPubkeyItem({
  pubkey,
  disabled,
  onRemove,
}: {
  pubkey: string;
  disabled: boolean;
  onRemove: (pubkey: string) => void;
}) {
  const profile = useObservableMemo(
    () => eventStore.profile({ pubkey }),
    [pubkey],
  );

  const displayName = getDisplayName(profile, pubkey.slice(0, 8) + "...");
  const picture = getProfilePicture(
    profile,
    `https://robohash.org/${pubkey}.png`,
  );

  return (
    <div className="flex items-center gap-3 p-2 bg-base-200 rounded">
      <div className="avatar">
        <div className="w-10 h-10 rounded-full">
          <img src={picture} alt={displayName} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{displayName}</div>
        <div className="text-xs text-base-content/60 font-mono truncate">
          {pubkey}
        </div>
      </div>
      <button
        className="btn btn-sm btn-error"
        onClick={() => onRemove(pubkey)}
        disabled={disabled}
      >
        Remove
      </button>
    </div>
  );
}

interface PubkeyListCreatorProps {
  pubkeys: string[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  onPubkeysChange: (pubkeys: string[]) => void;
}

export function PubkeyListCreator({
  pubkeys,
  label = "Public Keys",
  placeholder = "Enter hex-encoded public key",
  disabled = false,
  emptyMessage = "No public keys configured.",
  onPubkeysChange,
}: PubkeyListCreatorProps) {
  const handleAddPubkey = (pubkey: string) => {
    if (pubkeys.includes(pubkey)) return;
    onPubkeysChange([...pubkeys, pubkey]);
  };

  const handleRemovePubkey = (pubkeyToRemove: string) => {
    onPubkeysChange(pubkeys.filter((p) => p !== pubkeyToRemove));
  };

  return (
    <div className="w-full">
      <label className="block mb-2">
        <span className="font-semibold">
          {label} ({pubkeys.length})
        </span>
      </label>

      {/* Current Pubkeys Display */}
      {pubkeys.length === 0 ? (
        <div className="italic p-4 text-center border border-dashed border-base-300 rounded opacity-50">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {pubkeys.map((pubkey) => (
            <SelectedPubkeyItem
              key={pubkey}
              pubkey={pubkey}
              disabled={disabled}
              onRemove={handleRemovePubkey}
            />
          ))}
        </div>
      )}

      {/* Add New Pubkey */}
      <div className="flex gap-2">
        <UserSearch onSelect={handleAddPubkey} placeholder={placeholder} />
      </div>

      <div className="mt-1">
        <span className="text-sm text-base-content/60">
          Search for a user or paste a valid npub/hex pubkey
        </span>
      </div>
    </div>
  );
}
