import { useState, type KeyboardEvent } from "react";
import { isHexKey } from "applesauce-core/helpers";

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
  const [newPubkey, setNewPubkey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAddPubkey = () => {
    const trimmedPubkey = newPubkey.trim();
    if (!trimmedPubkey) return;

    // Validate hex key format
    if (!isHexKey(trimmedPubkey)) {
      setError("Invalid public key format. Must be a hex string.");
      return;
    }

    if (pubkeys.includes(trimmedPubkey)) {
      setError("This public key is already in the list.");
      return;
    }

    setError(null);
    onPubkeysChange([...pubkeys, trimmedPubkey]);
    setNewPubkey("");
  };

  const handleRemovePubkey = (pubkeyToRemove: string) => {
    onPubkeysChange(pubkeys.filter((p) => p !== pubkeyToRemove));
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPubkey();
    }
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
          {pubkeys.map((pubkey, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-base-200 rounded"
            >
              <span className="flex-1 font-mono text-sm">
                {pubkey.slice(0, 16)}...
              </span>
              <button
                className="btn btn-sm btn-error"
                onClick={() => handleRemovePubkey(pubkey)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Pubkey */}
      <div className="join w-full">
        <input
          type="text"
          placeholder={placeholder}
          className="input input-bordered join-item flex-1"
          value={newPubkey}
          onChange={(e) => {
            setNewPubkey(e.target.value);
            setError(null); // Clear error when user types
          }}
          onKeyPress={handleKeyPress}
          disabled={disabled}
        />
        <button
          className="btn btn-primary join-item"
          onClick={handleAddPubkey}
          disabled={disabled || !newPubkey.trim()}
        >
          Add
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-2">
          <div className="alert alert-error alert-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs">{error}</span>
          </div>
        </div>
      )}

      <div className="mt-1">
        <span className="text-sm text-base-content/60">
          Press Enter or click Add to include the public key
        </span>
      </div>
    </div>
  );
}
