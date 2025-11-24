import { useState } from "react";

interface RelayListCreatorProps {
  relays: string[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  onRelaysChange: (relays: string[]) => void;
}

export function RelayListCreator({
  relays,
  label = "Relays",
  placeholder = "wss://relay.example.com",
  disabled = false,
  emptyMessage = "No relays configured. Add relays below to publish your group events.",
  onRelaysChange,
}: RelayListCreatorProps) {
  const [newRelay, setNewRelay] = useState("");

  const handleAddRelay = () => {
    if (newRelay.trim() && !relays.includes(newRelay.trim())) {
      onRelaysChange([...relays, newRelay.trim()]);
      setNewRelay("");
    }
  };

  const handleRemoveRelay = (relayToRemove: string) => {
    onRelaysChange(relays.filter((r) => r !== relayToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddRelay();
    }
  };

  return (
    <div className="w-full">
      <label className="block mb-2">
        <span className="font-semibold">
          {label} ({relays.length})
        </span>
      </label>

      {/* Current Relays Display */}
      {relays.length === 0 ? (
        <div className="italic p-4 text-center border border-dashed border-base-300 rounded opacity-50">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {relays.map((relay, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-base-200 rounded"
            >
              <span className="flex-1 font-mono text-sm">{relay}</span>
              <button
                className="btn btn-sm btn-error"
                onClick={() => handleRemoveRelay(relay)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Relay */}
      <div className="join w-full">
        <input
          type="text"
          placeholder={placeholder}
          className="input input-bordered join-item flex-1"
          value={newRelay}
          onChange={(e) => setNewRelay(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
        />
        <button
          className="btn btn-primary join-item"
          onClick={handleAddRelay}
          disabled={disabled || !newRelay.trim()}
        >
          Add
        </button>
      </div>
      <div className="mt-1">
        <span className="text-sm text-base-content/60">
          Press Enter or click Add to include the relay
        </span>
      </div>
    </div>
  );
}
