import { bytesToHex } from "@noble/hashes/utils.js";
import { useRef, useState } from "react";
import { switchMap } from "rxjs";

import { useObservable, useObservableMemo } from "../hooks/use-observable";
import { groupStore$, notifyStoreChange } from "../lib/group-store";
import JsonBlock from "./json-block";
import type { Group } from "../../../src/core";

interface StoredGroupDetailsProps {
  group: Group;
  index: number;
}

function StoredGroupDetails({ group, index }: StoredGroupDetailsProps) {
  const groupIdHex = bytesToHex(group.groupId);

  return (
    <details className="collapse bg-base-100 border-base-300 border">
      <summary className="collapse-title font-semibold">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm">
            {group.marmotGroupData.name || `Group #${index + 1}`}
          </span>
          <span className="font-mono text-xs opacity-60 truncate ml-2">
            {groupIdHex.slice(0, 16)}...
          </span>
        </div>
      </summary>

      <div className="collapse-content text-sm space-y-4">
        {/* Group ID */}
        <div>
          <div className="font-semibold mb-1">Group ID</div>
          <code className="text-xs break-all select-all bg-base-200 p-2 rounded block">
            {groupIdHex}
          </code>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-semibold mb-1">Epoch</div>
            <div className="bg-base-200 p-2 rounded">{group.epoch}</div>
          </div>
          <div>
            <div className="font-semibold mb-1">Members</div>
            <div className="bg-base-200 p-2 rounded">
              {group.members.length}
            </div>
          </div>
        </div>

        {/* Marmot Group Data */}
        <div>
          <div className="font-semibold mb-2">Marmot Group Data</div>
          <div className="bg-base-200 p-4 rounded-lg space-y-2">
            <div>
              <span className="font-semibold">Name:</span>{" "}
              {group.marmotGroupData.name}
            </div>
            {group.marmotGroupData.description && (
              <div>
                <span className="font-semibold">Description:</span>{" "}
                {group.marmotGroupData.description}
              </div>
            )}
            <div>
              <span className="font-semibold">Admins:</span>{" "}
              {group.marmotGroupData.adminPubkeys.length}
            </div>
            <div>
              <span className="font-semibold">Relays:</span>{" "}
              {group.marmotGroupData.relays.length}
            </div>
            <div>
              <span className="font-semibold">Nostr Group ID:</span>
              <code className="text-xs ml-2">
                {bytesToHex(group.marmotGroupData.nostrGroupId).slice(0, 16)}...
              </code>
            </div>
          </div>
        </div>

        {/* Full Group Data */}
        <details className="collapse bg-base-200 border-base-300 border">
          <summary className="collapse-title font-semibold">
            Full Group Data (JSON)
          </summary>
          <div className="collapse-content">
            <div className="bg-base-300 p-4 rounded-lg overflow-auto max-h-96">
              <JsonBlock
                value={{
                  groupId: groupIdHex,
                  epoch: group.epoch,
                  members: group.members.length,
                  extensions: group.extensions.length,
                  marmotGroupData: {
                    ...group.marmotGroupData,
                    nostrGroupId: bytesToHex(
                      group.marmotGroupData.nostrGroupId,
                    ),
                    imageHash: bytesToHex(group.marmotGroupData.imageHash),
                    imageKey: bytesToHex(group.marmotGroupData.imageKey),
                    imageNonce: bytesToHex(group.marmotGroupData.imageNonce),
                  },
                }}
              />
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}

export default function GroupStoreModal() {
  const ref = useRef<HTMLDialogElement>(null);
  const groupStore = useObservable(groupStore$);

  const groups = useObservableMemo(
    () => groupStore$.pipe(switchMap((store) => store.list())),
    [],
  );
  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (!groupStore) return;

    const confirmed = window.confirm(
      `Are you sure you want to clear all ${groups?.length ?? 0} group${groups?.length !== 1 ? "s" : ""}? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setClearing(true);
    try {
      await groupStore.clear();
      notifyStoreChange();
    } catch (error) {
      console.error("Failed to clear groups:", error);
      alert("Failed to clear groups. Check console for details.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <dialog id="group_store_modal" className="modal" ref={ref}>
      <div className="modal-box max-w-4xl">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </form>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Local Group Store</h3>
          {groups && groups.length > 0 && (
            <button
              className="btn btn-error btn-sm"
              onClick={handleClearAll}
              disabled={clearing}
            >
              {clearing ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Clearing...
                </>
              ) : (
                "Clear All"
              )}
            </button>
          )}
        </div>

        <p className="text-sm opacity-70 mb-4">
          These are the groups stored locally in your browser for the current
          account.
        </p>

        {/* Content */}
        <div className="space-y-3">
          {groups === undefined ? (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : groups.length === 0 ? (
            <div className="alert alert-info">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-current shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span>No groups stored locally.</span>
            </div>
          ) : (
            <>
              <div className="text-sm opacity-70 mb-2">
                {groups.length} group{groups.length !== 1 ? "s" : ""} stored
              </div>

              {groups.map((group, index) => (
                <StoredGroupDetails
                  key={bytesToHex(group.groupId)}
                  group={group}
                  index={index}
                />
              ))}
            </>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
