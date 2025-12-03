import { useState } from "react";
import { switchMap } from "rxjs";
import { useObservable, useObservableMemo } from "../../hooks/use-observable";
import { keyPackageStore$ } from "../../lib/key-package-store";
import { groupStore$, notifyStoreChange } from "../../lib/group-store";
import {
  addMemberWithNostrIntegration,
  type AddMemberResult,
  type CompleteKeyPackage,
  deserializeClientState,
  StoredClientState,
} from "../../../../src/core";
import { ClientState } from "ts-mls/clientState.js";
import {
  defaultMarmotClientConfig,
  MarmotGroupData,
} from "../../../../src/core/protocol.js";
import {
  defaultCryptoProvider,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  type KeyPackage,
} from "ts-mls";
import {
  extractMarmotGroupData,
  getMemberCount,
} from "../../../../src/core/client-state-utils.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import JsonBlock from "../../components/json-block";
import { withSignIn } from "../../components/with-signIn";
import accounts from "../../lib/accounts";
import { CredentialBasic } from "ts-mls/credential.js";

// Helper function to get member identities from ClientState
function getMemberIdentities(clientState: ClientState): string[] {
  const identities: string[] = [];
  for (const node of clientState.ratchetTree) {
    if (node && node.nodeType === "leaf") {
      // Use type assertion to access credential property
      const credential = node.leaf.credential;
      if (credential) {
        identities.push(bytesToHex((credential as CredentialBasic).identity));
      }
    }
  }
  return identities;
}

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
  entry: StoredClientState;
}

interface ConfigurationFormProps {
  groups: GroupOption[];
  keyPackages: KeyPackage[];
  selectedGroupKey: string;
  selectedKeyPackageId: string;
  recipientPubkey: string;
  isAdding: boolean;
  onGroupSelect: (key: string) => void;
  onKeyPackageSelect: (id: string) => void;
  onRecipientPubkeyChange: (pubkey: string) => void;
  onSubmit: () => void;
}

function ConfigurationForm({
  groups,
  keyPackages,
  selectedGroupKey,
  selectedKeyPackageId,
  recipientPubkey,
  isAdding,
  onGroupSelect,
  onKeyPackageSelect,
  onRecipientPubkeyChange,
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
                Select Key Package for New Member
              </span>
            </label>
            {keyPackages.length === 0 ? (
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
                <span>
                  No key packages available. Create or import a key package
                  first.
                </span>
              </div>
            ) : (
              <>
                <select
                  className="select select-bordered w-full"
                  value={selectedKeyPackageId}
                  onChange={(e) => onKeyPackageSelect(e.target.value)}
                  disabled={isAdding}
                >
                  <option value="">Select a key package...</option>
                  {keyPackages.map((kp) => {
                    const kpId = bytesToHex(kp.initKey);
                    const isAlreadyMember = selectedGroup
                      ? getMemberIdentities(selectedGroup.state).includes(
                          bytesToHex(
                            (kp.leafNode.credential as CredentialBasic)
                              .identity,
                          ),
                        )
                      : false;

                    return (
                      <option
                        key={kpId}
                        value={kpId}
                        disabled={isAlreadyMember}
                      >
                        {isAlreadyMember ? "✗ Already in group - " : ""}
                        Key Package ({kpId.slice(0, 16)}...)
                      </option>
                    );
                  })}
                </select>
                {selectedGroup && (
                  <label className="label">
                    <span className="label-text-alt text-warning">
                      {
                        keyPackages.filter((kp) =>
                          getMemberIdentities(selectedGroup.state).includes(
                            bytesToHex(
                              (kp.leafNode.credential as CredentialBasic)
                                .identity,
                            ),
                          ),
                        ).length
                      }{" "}
                      of {keyPackages.length} key packages are already in this
                      group
                    </span>
                  </label>
                )}
              </>
            )}
          </div>

          {/* Recipient Pubkey */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">
                Recipient Public Key (for Gift-Wrap)
              </span>
            </label>
            <input
              type="text"
              placeholder="Enter hex-encoded public key"
              className="input input-bordered w-full"
              value={recipientPubkey}
              onChange={(e) => onRecipientPubkeyChange(e.target.value)}
              disabled={isAdding}
            />
            <label className="label">
              <span className="label-text-alt">
                Optional: Provide recipient's pubkey for gift-wrapped welcome
              </span>
            </label>
          </div>

          {/* Add Member Button */}
          <div className="card-actions justify-end mt-6">
            <button
              className="btn btn-primary btn-lg"
              onClick={onSubmit}
              disabled={isAdding || !selectedGroupKey || !selectedKeyPackageId}
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
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component: ResultsDisplay
// ============================================================================

interface ResultsDisplayProps {
  result: AddMemberResult;
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
            Group epoch advanced to {result.clientState.groupContext.epoch}
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
              <div className="stat-value">
                {getMemberCount(result.clientState)}
              </div>
            </div>

            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Epoch</div>
              <div className="stat-value">
                {result.clientState.groupContext.epoch}
              </div>
            </div>
          </div>

          <div className="divider"></div>

          <div className="space-y-2">
            {(() => {
              const marmotData = extractMarmotGroupData(result.clientState);
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

      {/* Commit Event */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">
            Commit Event (Kind {result.commitEvent.kind})
          </h2>
          <JsonBlock value={result.commitEvent} />
        </div>
      </div>

      {/* Welcome Event */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">
            Welcome Event (Kind {result.welcomeEvent.kind})
          </h2>
          <JsonBlock value={result.welcomeEvent} />
        </div>
      </div>

      {/* Gift Wrap Event */}
      {result.giftWrapEvent && (
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title">
              Gift-Wrap Event (Kind {result.giftWrapEvent.kind})
            </h2>
            <JsonBlock value={result.giftWrapEvent} />
          </div>
        </div>
      )}

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
  const groupStore = useObservable(groupStore$);
  const keyPackageStore = useObservable(keyPackageStore$);
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState<AddMemberResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addMember = async (
    selectedClientState: ClientState,
    selectedKeyPackage: CompleteKeyPackage,
    recipientPubkey: string,
  ) => {
    try {
      setIsAdding(true);
      setError(null);
      setResult(null);

      // Get cipher suite implementation
      const ciphersuiteName = getCiphersuiteFromName(
        selectedKeyPackage.publicPackage.cipherSuite,
      );
      const ciphersuiteImpl = await getCiphersuiteImpl(
        ciphersuiteName,
        defaultCryptoProvider,
      );

      // Get the current account for signing
      const account = accounts.active;
      if (!account) {
        throw new Error("No active account");
      }

      // Add member with Nostr integration
      const addResult = await addMemberWithNostrIntegration({
        currentClientState: selectedClientState,
        newMemberKeyPackage: selectedKeyPackage.publicPackage,
        ciphersuiteImpl,
        signer: account.signer,
      });

      // Update the group in storage
      if (groupStore) {
        await groupStore.add(addResult.clientState);
        notifyStoreChange();
      }

      setResult(addResult);
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
  const groupStore = useObservable(groupStore$);
  const keyPackageStore = useObservable(keyPackageStore$);

  const rawGroups =
    useObservableMemo(
      () =>
        groupStore$.pipe(
          switchMap((store) => (store ? store.list() : Promise.resolve([]))),
        ),
      [],
    ) ?? [];

  const groups = rawGroups.map((entry, index) => {
    const state = deserializeClientState(entry, defaultMarmotClientConfig);
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
      entry,
      state,
      marmotData,
    };
  });

  const keyPackages =
    useObservableMemo(
      () =>
        keyPackageStore$.pipe(
          switchMap((store) => (store ? store.list() : Promise.resolve([]))),
        ),
      [],
    ) ?? [];

  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [selectedKeyPackageId, setSelectedKeyPackageId] = useState("");
  const [selectedKeyPackage, setSelectedKeyPackage] =
    useState<CompleteKeyPackage | null>(null);
  const [recipientPubkey, setRecipientPubkey] = useState("");

  const { isAdding, result, error, setError, addMember, reset } =
    useAddMember();

  const handleGroupSelect = (key: string) => {
    setSelectedGroupKey(key);
  };

  const handleKeyPackageSelect = async (keyPackageId: string) => {
    if (!keyPackageStore || !keyPackageId) {
      setSelectedKeyPackageId("");
      setSelectedKeyPackage(null);
      return;
    }

    try {
      setSelectedKeyPackageId(keyPackageId);

      const keyPackage = keyPackages.find(
        (kp) => bytesToHex(kp.initKey) === keyPackageId,
      );
      if (!keyPackage) {
        console.error("Selected key package not found");
        return;
      }

      const completePackage =
        await keyPackageStore.getCompletePackage(keyPackage);
      if (completePackage) {
        setSelectedKeyPackage(completePackage);
      } else {
        console.error("Could not load the complete key package");
      }
    } catch (err) {
      console.error("Failed to load key package:", err);
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroupKey || !selectedKeyPackage) {
      console.error("Please select both a group and a key package");
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
    addMember(selectedGroupData.state, selectedKeyPackage, recipientPubkey);
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
          keyPackages={keyPackages}
          selectedGroupKey={selectedGroupKey}
          selectedKeyPackageId={selectedKeyPackageId}
          recipientPubkey={recipientPubkey}
          isAdding={isAdding}
          onGroupSelect={handleGroupSelect}
          onKeyPackageSelect={handleKeyPackageSelect}
          onRecipientPubkeyChange={setRecipientPubkey}
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
