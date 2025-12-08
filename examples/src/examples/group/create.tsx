import { useState } from "react";
import { switchMap } from "rxjs";
import { useObservable, useObservableMemo } from "../../hooks/use-observable";
import { keyPackageStore$ } from "../../lib/key-package-store";
import { groupStore$, notifyStoreChange } from "../../lib/group-store";
import {
  createSimpleGroup,
  type CreateGroupResult,
} from "../../../../src/core";
import {
  defaultCryptoProvider,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
} from "ts-mls";
import { CiphersuiteName } from "ts-mls/crypto/ciphersuite.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { KeyPackage } from "ts-mls";
import JsonBlock from "../../components/json-block";
import { withSignIn } from "../../components/with-signIn";
import accounts from "../../lib/accounts";
import { RelayListCreator } from "../../components/form/relay-list-creator";
import { PubkeyListCreator } from "../../components/form/pubkey-list-creator";
import {
  extractMarmotGroupData,
  getMemberCount,
} from "../../../../src/core/client-state";
import { CompleteKeyPackage } from "../../../../src";
import { createCredential } from "../../../../src/core/credential";
import { generateKeyPackage } from "../../../../src/core/key-package";

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

interface ConfigurationFormData {
  selectedKeyPackageId: string;
  selectedKeyPackage: CompleteKeyPackage | null;
  groupName: string;
  groupDescription: string;
  adminPubkeys: string[];
  relays: string[];
}

interface ConfigurationFormProps {
  keyPackages: KeyPackage[];
  keyPackageStore: any;
  isCreating: boolean;
  onSubmit: (data: ConfigurationFormData) => void;
}

function ConfigurationForm({
  keyPackages,
  keyPackageStore,
  isCreating,
  onSubmit,
}: ConfigurationFormProps) {
  const [selectedKeyPackageId, setSelectedKeyPackageId] = useState("");
  const [selectedKeyPackage, setSelectedKeyPackage] =
    useState<CompleteKeyPackage | null>(null);
  const [groupName, setGroupName] = useState("My Group");
  const [groupDescription, setGroupDescription] = useState("");
  const [adminPubkeys, setAdminPubkeys] = useState<string[]>([]);
  const [relays, setRelays] = useState<string[]>([]);

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

  const handleSubmit = async () => {
    // If no key package is selected, generate a new one with defaults
    let keyPackageToUse = selectedKeyPackage;

    if (!keyPackageToUse) {
      try {
        const account = accounts.active;
        if (!account) {
          console.error("No active account");
          return;
        }

        // Use default cipher suite
        const defaultCipherSuite: CiphersuiteName =
          "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519";

        console.log(
          "No key package selected, generating new one with defaults...",
        );

        // Get cipher suite implementation
        const selectedCiphersuite = getCiphersuiteFromName(defaultCipherSuite);
        const ciphersuiteImpl = await getCiphersuiteImpl(
          selectedCiphersuite,
          defaultCryptoProvider,
        );

        // Create credential and key package
        const credential = createCredential(account.pubkey);
        keyPackageToUse = await generateKeyPackage({
          credential,
          ciphersuiteImpl,
        });

        console.log("✅ Generated new key package with default cipher suite");
      } catch (err) {
        console.error("Failed to generate key package:", err);
        return;
      }
    }

    onSubmit({
      selectedKeyPackageId,
      selectedKeyPackage: keyPackageToUse,
      groupName,
      groupDescription,
      adminPubkeys,
      relays,
    });
  };
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body">
        <h2 className="card-title">Configuration</h2>
        <p className="text-base-content/70 mb-4">
          Configure your new MLS group with Marmot Group Data Extension
        </p>

        <div className="space-y-4">
          {/* Key Package Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">
                Select Key Package (Optional)
              </span>
            </label>
            {keyPackages.length === 0 ? (
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
                  No key packages available. A new one will be generated
                  automatically with default settings.
                </span>
              </div>
            ) : (
              <>
                <select
                  className="select select-bordered w-full"
                  value={selectedKeyPackageId}
                  onChange={(e) => handleKeyPackageSelect(e.target.value)}
                  disabled={isCreating}
                >
                  <option value="">Generate new key package (default)</option>
                  {keyPackages.map((kp) => (
                    <option
                      key={bytesToHex(kp.initKey)}
                      value={bytesToHex(kp.initKey)}
                    >
                      Key Package ({bytesToHex(kp.initKey).slice(0, 16)}...)
                    </option>
                  ))}
                </select>
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    Leave unselected to generate a new key package with default
                    cipher suite
                  </span>
                </label>
              </>
            )}
          </div>

          {/* Group Name and Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Group Name</span>
              </label>
              <input
                type="text"
                placeholder="Enter group name"
                className="input input-bordered w-full"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Description (Optional)
                </span>
              </label>
              <textarea
                placeholder="Enter group description"
                className="textarea textarea-bordered w-full"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={2}
                disabled={isCreating}
              />
            </div>
          </div>

          {/* Admin Pubkeys and Relays */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <PubkeyListCreator
                pubkeys={adminPubkeys}
                label="Admin Public Keys (Optional)"
                placeholder="Enter hex-encoded public key"
                disabled={isCreating}
                emptyMessage="No admin keys configured. The group creator will be the only admin."
                onPubkeysChange={setAdminPubkeys}
              />
            </div>

            <div className="form-control">
              <RelayListCreator
                relays={relays}
                label="Relays (Optional)"
                placeholder="wss://relay.example.com"
                disabled={isCreating}
                emptyMessage="No relays configured. Add relays to publish group events."
                onRelaysChange={setRelays}
              />
            </div>
          </div>

          {/* Create Button */}
          <div className="card-actions justify-end mt-6">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={isCreating || !groupName.trim()}
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
                {bytesToHex(result.clientState.groupContext.groupId).slice(
                  0,
                  16,
                )}
                ...
              </div>
            </div>

            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Epoch</div>
              <div className="stat-value">
                {result.clientState.groupContext.epoch}
              </div>
            </div>

            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Members</div>
              <div className="stat-value">
                {getMemberCount(result.clientState)}
              </div>
            </div>

            <div className="stat bg-base-100 rounded">
              <div className="stat-title">Extensions</div>
              <div className="stat-value">
                {result.clientState.groupContext.extensions.length}
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

      {/* Group State (JSON) */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Group State</h2>
          <JsonBlock
            value={{
              groupId: bytesToHex(result.clientState.groupContext.groupId),
              epoch: Number(result.clientState.groupContext.epoch),
              members: getMemberCount(result.clientState),
              extensions: result.clientState.groupContext.extensions.length,
              // Note: MarmotGroupData would need to be extracted from extensions
              // This is a simplified version for the example
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
  // Extract basic info from ClientState
  const groupId = bytesToHex(result.clientState.groupContext.groupId);
  const epoch = Number(result.clientState.groupContext.epoch);
  const memberCount = getMemberCount(result.clientState);
  const extensionCount = result.clientState.groupContext.extensions.length;

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
              groupId,
              epoch,
              members: memberCount,
              extensions: extensionCount,
              note: "MarmotGroupData can be extracted from extensions using extractMarmotGroupData()",
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
    adminPubkeys: string[],
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
          adminPubkeys: adminPubkeys,
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
      const key = await groupStore.add(draftResult.clientState);
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
  const keyPackages =
    useObservableMemo(
      () => keyPackageStore$.pipe(switchMap((store) => store.list())),
      [],
    ) ?? [];

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

  const handleFormSubmit = async (data: ConfigurationFormData) => {
    if (!data.selectedKeyPackage) {
      console.error("No key package provided");
      return;
    }

    // Get current user's pubkey as admin
    const account = accounts.active;
    if (!account) {
      console.error("No active account");
      return;
    }

    // Include current user as admin + any additional ones from the picker
    const adminPubkeysList = [account.pubkey, ...data.adminPubkeys];

    const allRelays = [...data.relays];

    await createDraft(
      data.selectedKeyPackage,
      data.groupName,
      data.groupDescription,
      adminPubkeysList,
      allRelays,
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
          keyPackageStore={keyPackageStore}
          isCreating={isCreating}
          onSubmit={handleFormSubmit}
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
