import { useState } from "react";
import { useObservable } from "../hooks/use-observable";
import {
  relayConfig$,
  updateLookupRelays,
  updateCommonRelays,
  addManualRelay,
  removeManualRelay,
  resetLookupRelays,
  resetCommonRelays,
  resetManualRelays,
} from "../lib/setting";

interface RelayConfigProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RelayConfig({ isOpen, onClose }: RelayConfigProps) {
  const relayConfig = useObservable(relayConfig$);
  const [newLookupRelay, setNewLookupRelay] = useState("");
  const [newCommonRelay, setNewCommonRelay] = useState("");
  const [newManualRelay, setNewManualRelay] = useState("");

  if (!relayConfig) return null;

  const handleAddLookupRelay = () => {
    if (newLookupRelay.trim()) {
      const newRelays = [
        ...new Set([...relayConfig.lookupRelays, newLookupRelay.trim()]),
      ];
      updateLookupRelays(newRelays);
      setNewLookupRelay("");
    }
  };

  const handleRemoveLookupRelay = (relay: string) => {
    const newRelays = relayConfig.lookupRelays.filter((r) => r !== relay);
    updateLookupRelays(newRelays);
  };

  const handleAddCommonRelay = () => {
    if (newCommonRelay.trim()) {
      const newRelays = [
        ...new Set([...relayConfig.commonRelays, newCommonRelay.trim()]),
      ];
      updateCommonRelays(newRelays);
      setNewCommonRelay("");
    }
  };

  const handleRemoveCommonRelay = (relay: string) => {
    const newRelays = relayConfig.commonRelays.filter((r) => r !== relay);
    updateCommonRelays(newRelays);
  };

  const handleAddManualRelay = () => {
    if (newManualRelay.trim()) {
      addManualRelay(newManualRelay.trim());
      setNewManualRelay("");
    }
  };

  const handleRemoveManualRelay = (relay: string) => {
    removeManualRelay(relay);
  };

  const handleKeyPress = (
    e: React.KeyboardEvent,
    type: "lookup" | "common" | "manual",
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      switch (type) {
        case "lookup":
          handleAddLookupRelay();
          break;
        case "common":
          handleAddCommonRelay();
          break;
        case "manual":
          handleAddManualRelay();
          break;
      }
    }
  };

  return (
    <dialog className={`modal ${isOpen ? "modal-open" : ""}`}>
      <div className="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Relay Configuration</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Lookup Relays Section */}
          <div className="card bg-base-200">
            <div className="card-body p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="card-title text-sm">Lookup Relays</h4>
                <button
                  className="btn btn-xs btn-outline"
                  onClick={resetLookupRelays}
                  title="Reset to default lookup relays"
                >
                  Reset
                </button>
              </div>
              <p className="text-xs text-base-content/60 mb-3">
                Used for discovering user profiles and relay lists
              </p>

              <div className="space-y-2">
                {relayConfig.lookupRelays.map((relay, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-base-100 p-2 rounded">
                      {relay}
                    </code>
                    <button
                      className="btn btn-xs btn-error"
                      onClick={() => handleRemoveLookupRelay(relay)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="join w-full mt-3">
                <input
                  type="text"
                  placeholder="wss://relay.example.com"
                  className="input input-bordered input-sm join-item flex-1"
                  value={newLookupRelay}
                  onChange={(e) => setNewLookupRelay(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, "lookup")}
                />
                <button
                  className="btn btn-primary btn-sm join-item"
                  onClick={handleAddLookupRelay}
                  disabled={!newLookupRelay.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Common Relays Section */}
          <div className="card bg-base-200">
            <div className="card-body p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="card-title text-sm">Common Relays</h4>
                <button
                  className="btn btn-xs btn-outline"
                  onClick={resetCommonRelays}
                  title="Reset to default common relays"
                >
                  Reset
                </button>
              </div>
              <p className="text-xs text-base-content/60 mb-3">
                Available in relay picker dropdowns across the app
              </p>

              <div className="space-y-2">
                {relayConfig.commonRelays.map((relay, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-base-100 p-2 rounded">
                      {relay}
                    </code>
                    <button
                      className="btn btn-xs btn-error"
                      onClick={() => handleRemoveCommonRelay(relay)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="join w-full mt-3">
                <input
                  type="text"
                  placeholder="wss://relay.example.com"
                  className="input input-bordered input-sm join-item flex-1"
                  value={newCommonRelay}
                  onChange={(e) => setNewCommonRelay(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, "common")}
                />
                <button
                  className="btn btn-primary btn-sm join-item"
                  onClick={handleAddCommonRelay}
                  disabled={!newCommonRelay.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Manual Relays Section */}
          <div className="card bg-base-200">
            <div className="card-body p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="card-title text-sm">Manual Relays</h4>
                <button
                  className="btn btn-xs btn-outline"
                  onClick={resetManualRelays}
                  title="Reset to default manual relays"
                >
                  Reset
                </button>
              </div>
              <p className="text-xs text-base-content/60 mb-3">
                Used as fallback when no relay list is found
              </p>

              <div className="space-y-2">
                {relayConfig.manualRelays.map((relay, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-base-100 p-2 rounded">
                      {relay}
                    </code>
                    <button
                      className="btn btn-xs btn-error"
                      onClick={() => handleRemoveManualRelay(relay)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="join w-full mt-3">
                <input
                  type="text"
                  placeholder="wss://relay.example.com"
                  className="input input-bordered input-sm join-item flex-1"
                  value={newManualRelay}
                  onChange={(e) => setNewManualRelay(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, "manual")}
                />
                <button
                  className="btn btn-primary btn-sm join-item"
                  onClick={handleAddManualRelay}
                  disabled={!newManualRelay.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
