import { useState, useEffect } from "react";
import { useObservable } from "../../hooks/use-observable";
import { keyPackageStore$ } from "../../lib/key-package-store";
import { groupStore$, notifyStoreChange } from "../../lib/group-store";
import {
  createSimpleGroup,
  type CompleteKeyPackage,
  type CreateGroupResult,
} from "../../../../src/core";
import {
  defaultCryptoProvider,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
} from "ts-mls";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { KeyPackage } from "ts-mls";
import { relayConfig$ } from "../../lib/setting";
import JsonBlock from "../../components/json-block";
import { withSignIn } from "../../components/with-signIn";
import accounts from "../../lib/accounts";

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

interface ConfigurationFormProps {
  keyPackages: KeyPackage[];
  selectedKeyPackageId: string;
  groupName: string;
  groupDescription: string;
  isCreating: boolean;
  onKeyPackageSelect: (id: string) => void;
  onGroupNameChange: (name: string) => void;
  onGroupDescriptionChange: (desc: string) => void;
  onSubmit: () => void;
}

function ConfigurationForm({
  keyPackages,
  selectedKeyPackageId,
  groupName,
  groupDescription,
  isCreating,
  onKeyPackageSelect,
  onGroupNameChange,
  onGroupDescriptionChange,
  onSubmit,
}: ConfigurationFormProps) {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body">
        <h2 className="card-title">Configuration</h2>

        {/* Key Package Selection */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Select Key Package</span>
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
                No key packages available. Create a key package first.
              </span>
            </div>
          ) : (
            <select
              className="select select-bordered"
              value={selectedKeyPackageId}
              onChange={(e) => onKeyPackageSelect(e.target.value)}
              disabled={isCreating}
            >
              <option value="">Select a key package...</option>
              {keyPackages.map((kp) => (
                <option
                  key={bytesToHex(kp.initKey)}
                  value={bytesToHex(kp.initKey)}
                >
                  Key Package ({bytesToHex(kp.initKey).slice(0, 16)}...)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Group Name */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Group Name</span>
          </label>
          <input
            type="text"
            placeholder="Enter group name"
            className="input input-bordered"
            value={groupName}
            onChange={(e) => onGroupNameChange(e.target.value)}
            disabled={isCreating}
          />
        </div>

        {/* Group Description */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">
              Description (Optional)
            </span>
          </label>
          <textarea
            placeholder="Enter group description"
            className="textarea textarea-bordered"
            value={groupDescription}
            onChange={(e) => onGroupDescriptionChange(e.target.value)}
            rows={3}
            disabled={isCreating}
          />
        </div>

        {/* Create Button */}
        <div className="card-actions justify-end mt-4">
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={isCreating || !selectedKeyPackageId || !groupName.trim()}
          >
            {isCreating ? (
              <>
                <span className="loading loading-spinner"></span>
                Creating...
              </>
            ) : (
              "Show Group Details"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component: DraftDisplay
// ============================================================================

interface DraftDisplayProps {
  result: CreateGroupResult;
  isStoring: boolean;
  onStore: () => void;
  onReset: () => void;
}

function DraftDisplay({
  result,
  isStoring,
  onStore,
  onReset,
}: DraftDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Group Details */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Group Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Group ID</div>
              <div className="stat-value text-sm font-mono">
                {bytesToHex(result.group.groupId).slice(0, 16)}...
              </div>
            </div>

            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Epoch</div>
              <div className="stat-value">{result.group.epoch}</div>
            </div>

            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Members</div>
              <div className="stat-value">{result.group.members.length}</div>
            </div>

            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Extensions</div>
              <div className="stat-value">{result.group.extensions.length}</div>
            </div>
          </div>

          <div className="divider"></div>

          <div className="space-y-2">
            <div>
              <span className="font-semibold">Group Name:</span>{" "}
              {result.group.marmotGroupData.name}
            </div>
            {result.group.marmotGroupData.description && (
              <div>
                <span className="font-semibold">Description:</span>{" "}
                {result.group.marmotGroupData.description}
              </div>
            )}
            <div>
              <span className="font-semibold">Nostr Group ID:</span>{" "}
              <span className="font-mono text-sm">
                {bytesToHex(result.group.marmotGroupData.nostrGroupId).slice(
                  0,
                  16,
                )}
                ...
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Group State (JSON) */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Group State</h2>
          <JsonBlock
            value={{
              groupId: bytesToHex(result.group.groupId),
              epoch: result.group.epoch,
              members: result.group.members.length,
              extensions: result.group.extensions.length,
              marmotGroupData: {
                ...result.group.marmotGroupData,
                nostrGroupId: bytesToHex(
                  result.group.marmotGroupData.nostrGroupId,
                ),
                imageHash: bytesToHex(result.group.marmotGroupData.imageHash),
                imageKey: bytesToHex(result.group.marmotGroupData.imageKey),
                imageNonce: bytesToHex(result.group.marmotGroupData.imageNonce),
              },
            }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          className="btn btn-outline"
          onClick={onReset}
          disabled={isStoring}
        >
          Reset
        </button>
        <button
          className="btn btn-success btn-lg"
          onClick={onStore}
          disabled={isStoring}
        >
          {isStoring ? (
            <>
              <span className="loading loading-spinner"></span>
              Storing...
            </>
          ) : (
            "Store Group Locally"
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Component: SuccessDisplay
// ============================================================================

interface SuccessDisplayProps {
  result: CreateGroupResult;
  storageKey: string;
}

function SuccessDisplay({ result, storageKey }: SuccessDisplayProps) {
  return (
    <div className="space-y-4">
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
          <div className="font-bold">
            Group created and stored successfully!
          </div>
          <div className="text-sm">
            Storage Key: {storageKey.slice(0, 16)}...
          </div>
        </div>
      </div>

      {/* Group Details */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Created Group</h2>
          <div className="divider my-1"></div>
          <JsonBlock
            value={{
              groupId: bytesToHex(result.group.groupId),
              epoch: result.group.epoch,
              members: result.group.members.length,
              extensions: result.group.extensions.length,
              marmotGroupData: {
                ...result.group.marmotGroupData,
                nostrGroupId: bytesToHex(
                  result.group.marmotGroupData.nostrGroupId,
                ),
                imageHash: bytesToHex(result.group.marmotGroupData.imageHash),
                imageKey: bytesToHex(result.group.marmotGroupData.imageKey),
                imageNonce: bytesToHex(result.group.marmotGroupData.imageNonce),
              },
            }}
          />
        </div>
      </div>

      <div className="alert alert-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="h-6 w-6 shrink-0 stroke-current"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <span>
          The private MLS Group ID is stored locally and should never be
          published to Nostr relays.
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Hook: useGroupCreation
// ============================================================================

function useGroupCreation() {
  const groupStore = useObservable(groupStore$);
  const [isCreating, setIsCreating] = useState(false);
  const [isStoring, setIsStoring] = useState(false);
  const [draftResult, setDraftResult] = useState<CreateGroupResult | null>(
    null,
  );
  const [storedResult, setStoredResult] = useState<CreateGroupResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  const createDraft = async (
    selectedKeyPackage: CompleteKeyPackage,
    groupName: string,
    groupDescription: string,
    adminPubkey: string,
    relays: string[],
  ) => {
    try {
      setIsCreating(true);
      setError(null);
      setDraftResult(null);
      setStoredResult(null);
      setStorageKey(null);

      // Get cipher suite implementation
      const ciphersuiteName = getCiphersuiteFromName(
        selectedKeyPackage.publicPackage.cipherSuite,
      );
      const ciphersuiteImpl = await getCiphersuiteImpl(
        ciphersuiteName,
        defaultCryptoProvider,
      );

      // Create group with admin and relays
      const result = await createSimpleGroup(
        selectedKeyPackage,
        ciphersuiteImpl,
        groupName,
        {
          description: groupDescription,
          adminPubkeys: [adminPubkey],
          relays: relays,
        },
      );

      setDraftResult(result);
      console.log("✅ Group created! Ready to store.");
    } catch (err) {
      console.error("Error creating group:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const storeGroup = async () => {
    if (!draftResult || !groupStore) {
      setError("No draft group to store");
      return;
    }

    try {
      setIsStoring(true);
      setError(null);

      // Store the group locally (including serialized client state)
      console.log("Storing group locally...");
      const key = await groupStore.add(draftResult.completeGroup);
      setStorageKey(key);
      console.log("Stored with key:", key);

      // Notify that the store has changed
      notifyStoreChange();

      setStoredResult(draftResult);
      setDraftResult(null);
      console.log("✅ Group stored successfully!");
    } catch (err) {
      console.error("Error storing group:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStoring(false);
    }
  };

  const reset = () => {
    setDraftResult(null);
    setStoredResult(null);
    setStorageKey(null);
    setError(null);
  };

  return {
    isCreating,
    isStoring,
    draftResult,
    storedResult,
    error,
    storageKey,
    createDraft,
    storeGroup,
    reset,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default withSignIn(function GroupCreation() {
  const keyPackageStore = useObservable(keyPackageStore$);
  const relayConfig = useObservable(relayConfig$);
  const [keyPackages, setKeyPackages] = useState<KeyPackage[]>([]);
  const [selectedKeyPackageId, setSelectedKeyPackageId] = useState("");
  const [selectedKeyPackage, setSelectedKeyPackage] =
    useState<CompleteKeyPackage | null>(null);
  const [groupName, setGroupName] = useState("My Group");
  const [groupDescription, setGroupDescription] = useState("");

  const {
    isCreating,
    isStoring,
    draftResult,
    storedResult,
    error,
    storageKey,
    createDraft,
    storeGroup,
    reset,
  } = useGroupCreation();

  // Load available key packages
  useEffect(() => {
    if (!keyPackageStore) return;

    const loadKeyPackages = async () => {
      try {
        const packages = await keyPackageStore.list();
        setKeyPackages(packages);
      } catch (err) {
        console.error("Failed to load key packages:", err);
      }
    };

    loadKeyPackages();
  }, [keyPackageStore]);

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

  const handleCreateDraft = () => {
    if (!selectedKeyPackage) {
      console.error("Please select a key package first");
      return;
    }

    // Get current user's pubkey as admin
    const account = accounts.active;
    if (!account) {
      console.error("No active account");
      return;
    }

    // Get relays from config
    const relays = relayConfig?.commonRelays || [];

    createDraft(
      selectedKeyPackage,
      groupName,
      groupDescription,
      account.pubkey,
      relays,
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Create Group</h1>
        <p className="text-base-content/70">
          Create a new MLS group with Marmot Group Data Extension
        </p>
      </div>

      {/* Configuration Form */}
      {!draftResult && !storedResult && (
        <ConfigurationForm
          keyPackages={keyPackages}
          selectedKeyPackageId={selectedKeyPackageId}
          groupName={groupName}
          groupDescription={groupDescription}
          isCreating={isCreating}
          onKeyPackageSelect={handleKeyPackageSelect}
          onGroupNameChange={setGroupName}
          onGroupDescriptionChange={setGroupDescription}
          onSubmit={handleCreateDraft}
        />
      )}

      {/* Error Display */}
      <ErrorAlert error={error} />

      {/* Draft Display */}
      {draftResult && !storedResult && (
        <DraftDisplay
          result={draftResult}
          isStoring={isStoring}
          onStore={storeGroup}
          onReset={reset}
        />
      )}

      {/* Success Display */}
      {storedResult && storageKey && (
        <SuccessDisplay result={storedResult} storageKey={storageKey} />
      )}
    </div>
  );
});
