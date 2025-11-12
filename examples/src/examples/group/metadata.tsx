import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { useState } from "react";
import {
  createMarmotGroupData,
  decodeMarmotGroupData,
} from "../../../../src/core/marmot-group-data";
import JsonBlock from "../../components/json-block";
import { MarmotGroupData } from "../../../../src";
import { relayConfig$ } from "../../lib/setting";
import { useObservable } from "../../hooks/use-observable";

// ============================================================================
// Encode Tab Component
// ============================================================================

function EncodeTab() {
  const [name, setName] = useState("My Marmot Group");
  const [description, setDescription] = useState(
    "A secure messaging group using MLS and Nostr",
  );
  const [adminPubkeys, setAdminPubkeys] = useState(
    "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2",
  );
  const relayConfig = useObservable(relayConfig$);
  const [relays, setRelays] = useState(
    relayConfig?.manualRelays.join("\n") ||
      "wss://relay.damus.io/\nwss://nos.lol/",
  );
  const [encoded, setEncoded] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleEncode = () => {
    try {
      setError("");
      const adminPubkeysArray = adminPubkeys
        .split("\n")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      const relaysArray = relays
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      const extensionData = createMarmotGroupData({
        name,
        description,
        adminPubkeys: adminPubkeysArray,
        relays: relaysArray,
      });

      setEncoded(bytesToHex(extensionData));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEncoded("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Encode Group Metadata</h2>
        <p className="text-base-content/70">
          Create MIP-01 Marmot Group Data and encode it to hex format
        </p>
      </div>

      {/* Input Form */}
      <div className="space-y-4">
        {/* Group Name */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-semibold">Group Name</span>
          </label>
          <input
            type="text"
            placeholder="Enter group name"
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Group Description */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-semibold">Description</span>
          </label>
          <textarea
            placeholder="Enter group description"
            className="textarea textarea-bordered w-full"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Admin Pubkeys */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-semibold">
              Admin Public Keys (one per line)
            </span>
          </label>
          <textarea
            placeholder="Enter admin pubkeys (64 hex chars each, one per line)"
            className="textarea textarea-bordered w-full font-mono text-sm"
            rows={3}
            value={adminPubkeys}
            onChange={(e) => setAdminPubkeys(e.target.value)}
          />
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              Example:
              3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d
            </span>
          </label>
        </div>

        {/* Relays */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-semibold">
              Relay URLs (one per line)
            </span>
          </label>
          <textarea
            placeholder="Enter relay URLs (one per line)"
            className="textarea textarea-bordered w-full font-mono text-sm"
            rows={3}
            value={relays}
            onChange={(e) => setRelays(e.target.value)}
          />
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              Must start with ws:// or wss://
            </span>
          </label>
        </div>

        {/* Encode Button */}
        <button className="btn btn-primary w-full" onClick={handleEncode}>
          Encode to Hex
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
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
          <span>{error}</span>
        </div>
      )}

      {/* Encoded Output */}
      {encoded && (
        <div className="space-y-2">
          <label className="label">
            <span className="label-text font-semibold">
              Encoded Extension Data (Hex)
            </span>
          </label>
          <div className="bg-base-200 p-4 rounded-lg">
            <code className="text-sm break-all select-all">{encoded}</code>
          </div>
          <div className="flex justify-end">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => navigator.clipboard.writeText(encoded)}
            >
              Copy to Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Decode Tab Component
// ============================================================================

function DecodeTab() {
  const [hexInput, setHexInput] = useState("");
  const [decoded, setDecoded] = useState<MarmotGroupData | null>(null);
  const [error, setError] = useState<string>("");

  const handleDecode = () => {
    try {
      setError("");
      const cleanHex = hexInput.trim().replace(/\s+/g, "");
      if (!cleanHex) {
        setError("Please enter hex data to decode");
        return;
      }

      const bytes = hexToBytes(cleanHex);
      const groupData = decodeMarmotGroupData(bytes);
      setDecoded(groupData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDecoded(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Decode Group Metadata</h2>
        <p className="text-base-content/70">
          Decode MIP-01 Marmot Group Data from hex format
        </p>
      </div>

      {/* Input Form */}
      <div className="space-y-4">
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-semibold">
              Extension Data (Hex)
            </span>
          </label>
          <textarea
            placeholder="Paste hex-encoded extension data here"
            className="textarea textarea-bordered w-full font-mono text-sm"
            rows={6}
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
          />
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              Paste the hex-encoded Marmot Group Data extension
            </span>
          </label>
        </div>

        <button className="btn btn-primary w-full" onClick={handleDecode}>
          Decode from Hex
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
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
          <span>{error}</span>
        </div>
      )}

      {/* Decoded Output */}
      {decoded && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Decoded Group Data</h3>

          {/* Group Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Version</span>
              </label>
              <div className="bg-base-200 p-3 rounded-lg">
                <span className="badge badge-primary">{decoded.version}</span>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Nostr Group ID (hex)
                </span>
              </label>
              <div className="bg-base-200 p-3 rounded-lg">
                <code className="text-xs break-all select-all">
                  {bytesToHex(decoded.nostrGroupId)}
                </code>
              </div>
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Group Name</span>
            </label>
            <div className="bg-base-200 p-3 rounded-lg">
              {decoded.name || (
                <span className="italic text-base-content/60">Empty</span>
              )}
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Description</span>
            </label>
            <div className="bg-base-200 p-3 rounded-lg">
              {decoded.description || (
                <span className="italic text-base-content/60">Empty</span>
              )}
            </div>
          </div>

          {/* Admin Pubkeys */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">
                Admin Public Keys ({decoded.adminPubkeys.length})
              </span>
            </label>
            <div className="bg-base-200 p-3 rounded-lg space-y-2">
              {decoded.adminPubkeys.length > 0 ? (
                decoded.adminPubkeys.map((pubkey, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="badge badge-sm badge-outline">
                      {idx + 1}
                    </span>
                    <code className="text-xs break-all select-all flex-1">
                      {pubkey}
                    </code>
                  </div>
                ))
              ) : (
                <span className="italic text-base-content/60">No admins</span>
              )}
            </div>
          </div>

          {/* Relays */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">
                Relays ({decoded.relays.length})
              </span>
            </label>
            <div className="bg-base-200 p-3 rounded-lg space-y-2">
              {decoded.relays.length > 0 ? (
                decoded.relays.map((relay, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="badge badge-sm badge-outline">
                      {idx + 1}
                    </span>
                    <code className="text-xs break-all select-all flex-1">
                      {relay}
                    </code>
                  </div>
                ))
              ) : (
                <span className="italic text-base-content/60">No relays</span>
              )}
            </div>
          </div>

          {/* Image Fields */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium py-2 min-h-0">
              Image Encryption Fields (Advanced)
            </div>
            <div className="collapse-content space-y-3">
              <div>
                <div className="text-sm font-semibold mb-1">Image Hash</div>
                <code className="text-xs break-all select-all block">
                  {bytesToHex(decoded.imageHash)}
                </code>
              </div>
              <div>
                <div className="text-sm font-semibold mb-1">Image Key</div>
                <code className="text-xs break-all select-all block">
                  {bytesToHex(decoded.imageKey)}
                </code>
              </div>
              <div>
                <div className="text-sm font-semibold mb-1">Image Nonce</div>
                <code className="text-xs break-all select-all block">
                  {bytesToHex(decoded.imageNonce)}
                </code>
              </div>
            </div>
          </div>

          {/* Raw JSON */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium py-2 min-h-0">
              Raw JSON
            </div>
            <div className="collapse-content">
              <JsonBlock
                value={{
                  ...decoded,
                  nostrGroupId: bytesToHex(decoded.nostrGroupId),
                  imageHash: bytesToHex(decoded.imageHash),
                  imageKey: bytesToHex(decoded.imageKey),
                  imageNonce: bytesToHex(decoded.imageNonce),
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function GroupMetadata() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Marmot Group Metadata</h1>
        <p className="text-base-content/70">
          Encode and decode MIP-01 Marmot Group Data Extension (0xF2EE)
        </p>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-lift">
        <input
          type="radio"
          name="metadata_tabs"
          className="tab"
          aria-label="Encode"
          defaultChecked
        />
        <div className="tab-content bg-base-100 border-base-300 p-6">
          <EncodeTab />
        </div>

        <input
          type="radio"
          name="metadata_tabs"
          className="tab"
          aria-label="Decode"
        />
        <div className="tab-content bg-base-100 border-base-300 p-6">
          <DecodeTab />
        </div>
      </div>
    </div>
  );
}
