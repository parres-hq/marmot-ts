import { useState, useEffect } from "react";
import { useObservable } from "../../hooks/use-observable";
import { groupStore$, notifyStoreChange } from "../../lib/group-store";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { StoredGroupEntry } from "../../../../src/core/group-store";
import JsonBlock from "../../components/json-block";
import { withSignIn } from "../../components/with-signIn";

// ============================================================================
// Component: GroupCard
// ============================================================================

interface GroupCardProps {
  entry: StoredGroupEntry;
  onDelete: (groupId: Uint8Array) => void;
}

function GroupCard({ entry, onDelete }: GroupCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { group } = entry;
  const groupIdHex = bytesToHex(group.groupId);
  const nostrGroupIdHex = bytesToHex(group.marmotGroupData.nostrGroupId);

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this group? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(group.groupId);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="card-title text-lg mb-1">
              {group.marmotGroupData.name}
            </h3>
            {group.marmotGroupData.description && (
              <p className="text-base-content/70 text-sm mb-2">
                {group.marmotGroupData.description}
              </p>
            )}
          </div>
          <button
            className="btn btn-sm btn-outline btn-error"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>

        {/* Group Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
          <div className="stat p-2 bg-base-200 rounded">
            <div className="stat-title text-xs">Epoch</div>
            <div className="stat-value text-lg">{group.epoch}</div>
          </div>

          <div className="stat p-2 bg-base-200 rounded">
            <div className="stat-title text-xs">Members</div>
            <div className="stat-value text-lg">{group.members.length}</div>
          </div>

          <div className="stat p-2 bg-base-200 rounded">
            <div className="stat-title text-xs">Extensions</div>
            <div className="stat-value text-lg">{group.extensions.length}</div>
          </div>

          <div className="stat p-2 bg-base-200 rounded">
            <div className="stat-title text-xs">Admins</div>
            <div className="stat-value text-lg">
              {group.marmotGroupData.adminPubkeys.length}
            </div>
          </div>

          <div className="stat p-2 bg-base-200 rounded">
            <div className="stat-title text-xs">Relays</div>
            <div className="stat-value text-lg">
              {group.marmotGroupData.relays.length}
            </div>
          </div>

          <div className="stat p-2 bg-base-200 rounded">
            <div className="stat-title text-xs">Version</div>
            <div className="stat-value text-lg">
              v{group.marmotGroupData.version}
            </div>
          </div>
        </div>

        {/* Marmot Group Data Details */}
        <div className="bg-base-200 p-4 rounded-lg mb-4">
          <h4 className="font-semibold mb-2">Marmot Group Data</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="font-semibold text-sm">Group ID:</span>
              <div className="font-mono text-xs bg-base-100 p-1 rounded break-all">
                {groupIdHex.slice(0, 32)}...
              </div>
            </div>

            <div>
              <span className="font-semibold text-sm">Nostr Group ID:</span>
              <div className="font-mono text-xs bg-base-100 p-1 rounded break-all">
                {nostrGroupIdHex.slice(0, 32)}...
              </div>
            </div>

            <div>
              <span className="font-semibold text-sm">Admin Pubkeys:</span>
              <div className="text-xs">
                {group.marmotGroupData.adminPubkeys.length === 0 ? (
                  <span className="text-base-content/60">None</span>
                ) : (
                  group.marmotGroupData.adminPubkeys
                    .slice(0, 2)
                    .map((pubkey, index) => (
                      <div
                        key={index}
                        className="font-mono bg-base-100 p-1 rounded break-all mb-1"
                      >
                        {pubkey.slice(0, 32)}...
                      </div>
                    ))
                )}
                {group.marmotGroupData.adminPubkeys.length > 2 && (
                  <div className="text-base-content/60 text-xs">
                    +{group.marmotGroupData.adminPubkeys.length - 2} more
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="font-semibold text-sm">Relays:</span>
              <div className="text-xs">
                {group.marmotGroupData.relays.length === 0 ? (
                  <span className="text-base-content/60">None</span>
                ) : (
                  group.marmotGroupData.relays
                    .slice(0, 2)
                    .map((relay, index) => (
                      <div
                        key={index}
                        className="bg-base-100 p-1 rounded break-all mb-1"
                      >
                        {relay}
                      </div>
                    ))
                )}
                {group.marmotGroupData.relays.length > 2 && (
                  <div className="text-base-content/60 text-xs">
                    +{group.marmotGroupData.relays.length - 2} more
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="font-semibold text-sm">Image Hash:</span>
              <div className="font-mono text-xs bg-base-100 p-1 rounded break-all">
                {bytesToHex(group.marmotGroupData.imageHash).slice(0, 24)}...
              </div>
            </div>
          </div>
        </div>

        {/* Details Toggle */}
        <div className="card-actions justify-between">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "Hide Details" : "View Details"}
          </button>
        </div>

        {/* JSON Details */}
        {showDetails && (
          <div className="mt-4">
            <JsonBlock
              value={{
                group: {
                  groupId: groupIdHex,
                  epoch: group.epoch,
                  members: group.members.length,
                  extensions: group.extensions.length,
                  marmotGroupData: {
                    ...group.marmotGroupData,
                    nostrGroupId: nostrGroupIdHex,
                    imageHash: bytesToHex(group.marmotGroupData.imageHash),
                    imageKey: bytesToHex(group.marmotGroupData.imageKey),
                    imageNonce: bytesToHex(group.marmotGroupData.imageNonce),
                  },
                },
                clientState: entry.clientState,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Component: EmptyState
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="max-w-md mx-auto">
        <svg
          className="mx-auto h-12 w-12 text-base-content/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium">No groups found</h3>
        <p className="mt-2 text-base-content/70">
          Create your first group to get started with MLS messaging.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Component: LoadingState
// ============================================================================

function LoadingState() {
  return (
    <div className="flex justify-center items-center py-12">
      <span className="loading loading-spinner loading-lg"></span>
      <span className="ml-2">Loading groups...</span>
    </div>
  );
}

// ============================================================================
// Main Component: GroupManager
// ============================================================================

function GroupManager() {
  const groupStore = useObservable(groupStore$);
  const [groups, setGroups] = useState<StoredGroupEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load groups when groupStore changes
  useEffect(() => {
    if (!groupStore) {
      setIsLoading(false);
      return;
    }

    const loadGroups = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const groupList = await groupStore.list();
        setGroups(groupList);
      } catch (err) {
        console.error("Failed to load groups:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadGroups();
  }, [groupStore]);

  const handleDelete = async (groupId: Uint8Array) => {
    if (!groupStore) return;

    try {
      await groupStore.remove(groupId);
      // Update the local state by filtering out the deleted group
      setGroups(
        groups.filter(
          (entry) => bytesToHex(entry.group.groupId) !== bytesToHex(groupId),
        ),
      );
      // Notify other components that the store has changed
      notifyStoreChange();
    } catch (err) {
      console.error("Failed to delete group:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Group Manager</h1>
        <p className="text-base-content/70">
          View and manage your locally stored MLS groups
        </p>
      </div>

      {/* Error Display */}
      {error && (
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
      )}

      {/* Loading State */}
      {isLoading && <LoadingState />}

      {/* Empty State */}
      {!isLoading && groups.length === 0 && <EmptyState />}

      {/* Groups Grid */}
      {!isLoading && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {groups.map((entry) => (
            <GroupCard
              key={bytesToHex(entry.group.groupId)}
              entry={entry}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Groups Count */}
      {!isLoading && groups.length > 0 && (
        <div className="text-center text-base-content/70">
          Showing {groups.length} group{groups.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

export default withSignIn(GroupManager);
