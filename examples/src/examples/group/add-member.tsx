import { bytesToHex } from "@noble/hashes/utils.js";
import { decodePointer, NostrEvent } from "applesauce-core/helpers";
import { useState } from "react";
import { of, switchMap } from "rxjs";
import { ClientState } from "ts-mls/clientState.js";
import {
  extractMarmotGroupData,
  getMemberCount,
} from "../../../../src/core/client-state";
import { MarmotGroupData } from "../../../../src/core/protocol.js";
import { withSignIn } from "../../components/with-signIn";
import { useObservableMemo } from "../../hooks/use-observable";
import accounts from "../../lib/accounts";
import { groupStore$ } from "../../lib/group-store";
import { eventStore } from "../../lib/nostr";
import { getMarmotClient } from "../../lib/marmot-client";

// ============================================================================
// Component: ErrorAlert
// ============================================================================

function ErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <div className="alert alert-error">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="stroke-current shrink-0 h-6 w-6"
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
      <span>Error: {error}</span>
    </div>
  );
}

// ============================================================================
// Component: ConfigurationForm
// ============================================================================

interface GroupOption {
  groupId: string;
  name: string;
  epoch: number;
  memberCount: number;
  state: ClientState;
  marmotData: MarmotGroupData | null;
}

interface ConfigurationFormProps {
  groups: GroupOption[];
  selectedGroupKey: string;
  keyPackageEventId: string;
  hasKeyPackageEvent: boolean;
  isAdding: boolean;
  onGroupSelect: (key: string) => void;
  onKeyPackageEventIdChange: (id: string) => void;
  onSubmit: () => void;
}

function ConfigurationForm({
  groups,
  selectedGroupKey,
  keyPackageEventId,
  hasKeyPackageEvent,
  isAdding,
  onGroupSelect,
  onKeyPackageEventIdChange,
  onSubmit,
}: ConfigurationFormProps) {
  const selectedGroup = groups.find((g) => g.groupId === selectedGroupKey);

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body">
        <h2 className="card-title">Configuration</h2>
        <p className="text-base-content/70 mb-4">
          Add a new member to an existing MLS group
        </p>

        <div className="space-y-4">
          {/* Group Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Select Group</span>
            </label>
            {groups.length === 0 ? (
              <div className="alert alert-warning">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>No groups available. Create a group first.</span>
              </div>
            ) : (
              <select
                className="select select-bordered w-full"
                value={selectedGroupKey}
                onChange={(e) => onGroupSelect(e.target.value)}
                disabled={isAdding}
              >
                <option value="">Select a group...</option>
                {groups.map((group) => (
                  <option key={group.groupId} value={group.groupId}>
                    {group.name} (Epoch {group.epoch}, {group.memberCount}{" "}
                    members)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Group Details */}
          {selectedGroup && (
            <div className="card bg-base-200">
              <div className="card-body p-4">
                <h3 className="font-semibold mb-2">Selected Group Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Name:</span>{" "}
                    {selectedGroup.name}
                  </div>
                  <div>
                    <span className="font-medium">Epoch:</span>{" "}
                    {selectedGroup.epoch}
                  </div>
                  <div>
                    <span className="font-medium">Members:</span>{" "}
                    {selectedGroup.memberCount}
                  </div>
                  <div>
                    <span className="font-medium">Group ID:</span>{" "}
                    {selectedGroup.groupId.slice(0, 16)}...
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Package Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">
                Key Package nevent (NIP-19)
              </span>
            </label>
            <input
              type="text"
              placeholder="nevent1..."
              className="input input-bordered w-full"
              value={keyPackageEventId}
              onChange={(e) => onKeyPackageEventIdChange(e.target.value)}
              disabled={isAdding}
            />
            {keyPackageEventId && !hasKeyPackageEvent && (
              <label className="label">
                <span className="label-text-alt text-warning">
                  Waiting for key package event in event store...
                </span>
              </label>
            )}
            {keyPackageEventId && hasKeyPackageEvent && (
              <label className="label">
                <span className="label-text-alt text-success">
                  Key package event loaded.
                </span>
              </label>
            )}
          </div>

          {/* Add Member Button */}
          {hasKeyPackageEvent && (
            <div className="card-actions justify-end mt-6">
              <button
                className="btn btn-primary btn-lg"
                onClick={onSubmit}
                disabled={isAdding || !selectedGroupKey}
              >
                {isAdding ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Adding Member...
                  </>
                ) : (
                  "Add Member"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component: ResultsDisplay
// ============================================================================

interface ResultsDisplayProps {
  result: { state: ClientState };
  onReset: () => void;
}

function ResultsDisplay({ result, onReset }: ResultsDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Success Alert */}
      <div className="alert alert-success">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <div className="font-bold">Member added successfully!</div>
          <div className="text-sm">
            Group epoch advanced to {result.state.groupContext.epoch}
          </div>
        </div>
      </div>

      {/* Updated Group Details */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Updated Group</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Members</div>
              <div className="stat-value">{getMemberCount(result.state)}</div>
            </div>

            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Epoch</div>
              <div className="stat-value">
                {result.state.groupContext.epoch}
              </div>
            </div>
          </div>

          <div className="divider"></div>

          <div className="space-y-2">
            {(() => {
              const marmotData = extractMarmotGroupData(result.state);
              if (!marmotData)
                return <div>Error: MarmotGroupData not found</div>;

              return (
                <>
                  <div>
                    <span className="font-semibold">Group Name:</span>{" "}
                    {marmotData.name}
                  </div>
                  {marmotData.description && (
                    <div>
                      <span className="font-semibold">Description:</span>{" "}
                      {marmotData.description}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold">Nostr Group ID:</span>{" "}
                    <span className="font-mono text-sm">
                      {bytesToHex(marmotData.nostrGroupId).slice(0, 16)}...
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div className="flex justify-end">
        <button className="btn btn-outline" onClick={onReset}>
          Add Another Member
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Hook: useAddMember
// ============================================================================

function useAddMember() {
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState<{ state: ClientState } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addMember = async (
    selectedClientState: ClientState,
    selectedKeyPackageEvent: NostrEvent,
  ) => {
    try {
      setIsAdding(true);
      setError(null);
      setResult(null);

      const client = await getMarmotClient();
      const group = await client.getGroup(
        selectedClientState.groupContext.groupId,
      );
      await group.addMember(selectedKeyPackageEvent);

      setResult({ state: group.state });
      console.log("✅ Member added successfully!");
    } catch (err) {
      console.error("Error adding member:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAdding(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    isAdding,
    result,
    error,
    setError,
    addMember,
    reset,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default withSignIn(function AddMember() {
  const clientStates =
    useObservableMemo(
      () =>
        groupStore$.pipe(
          switchMap((store) => (store ? store.list() : Promise.resolve([]))),
        ),
      [],
    ) ?? [];

  const groups = clientStates.map((state, index) => {
    const marmotData = extractMarmotGroupData(state);
    const groupIdHex = bytesToHex(state.groupContext.groupId);
    const epoch = Number(state.groupContext.epoch);
    const memberCount = getMemberCount(state);
    const name = marmotData?.name || `Group #${index + 1}`;

    return {
      groupId: groupIdHex,
      name,
      epoch,
      memberCount,
      state,
      marmotData,
    };
  });

  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [keyPackageEventId, setKeyPackageEventId] = useState("");

  const keyPackageEvent =
    useObservableMemo(() => {
      if (!keyPackageEventId) return of(null);

      try {
        const result = decodePointer(keyPackageEventId);
        // Expecting an nevent pointer; other pointer types are ignored
        if (result.type !== "nevent") throw new Error("Invalid pointer type");

        // Subscribe to the event via the event store so it will be
        return eventStore.event(result.data);
      } catch (err) {
        console.error("Failed to decode NIP-19 pointer:", err);
        return of(null);
      }
    }, [keyPackageEventId]) ?? null;

  const { isAdding, result, error, setError, addMember, reset } =
    useAddMember();

  const handleGroupSelect = (key: string) => {
    setSelectedGroupKey(key);
  };

  const handleAddMember = async () => {
    if (!selectedGroupKey || !keyPackageEvent) {
      console.error(
        "Please select a group and provide a valid key package event ID",
      );
      return;
    }

    const selectedGroupData = groups.find(
      (g) => g.groupId === selectedGroupKey,
    );
    if (!selectedGroupData) {
      console.error("Selected group not found");
      return;
    }

    // Verify admin status using MarmotGroupData from ClientState
    const account = accounts.active;
    if (!account) {
      setError("No active account");
      return;
    }

    // Check if current user is an admin by comparing their pubkey with adminPubkeys
    const currentUserPubkey = await account.signer.getPublicKey();
    const isAdmin =
      selectedGroupData.marmotData?.adminPubkeys?.includes(currentUserPubkey) ||
      false;

    if (!isAdmin) {
      setError("You must be an admin to add members to this group");
      return;
    }

    // Use the already deserialized ClientState from the groups array
    addMember(selectedGroupData.state, keyPackageEvent);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Add Member</h1>
        <p className="text-base-content/70">
          Add a new member to an existing MLS group with Nostr integration
        </p>
      </div>

      {/* Configuration Form */}
      {!result && (
        <ConfigurationForm
          groups={groups}
          selectedGroupKey={selectedGroupKey}
          keyPackageEventId={keyPackageEventId}
          hasKeyPackageEvent={!!keyPackageEvent}
          isAdding={isAdding}
          onGroupSelect={handleGroupSelect}
          onKeyPackageEventIdChange={setKeyPackageEventId}
          onSubmit={handleAddMember}
        />
      )}

      {/* Error Display */}
      <ErrorAlert error={error} />

      {/* Results Display */}
      {result && <ResultsDisplay result={result} onReset={reset} />}
    </div>
  );
});
