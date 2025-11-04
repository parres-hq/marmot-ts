import { bytesToHex } from "@noble/hashes/utils.js";
import { mapEventsToTimeline } from "applesauce-core";
import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { BehaviorSubject, combineLatest, NEVER, of, switchMap } from "rxjs";
import { map, tap } from "rxjs/operators";
import { KeyPackage } from "ts-mls";
import { getCiphersuiteFromId } from "ts-mls/crypto/ciphersuite.js";

import { normalizeToPubkey } from "applesauce-core/helpers";
import {
  getCredentialPubkey,
  getKeyPackage,
  getKeyPackageCipherSuiteId,
  getKeyPackageClient,
  getKeyPackageExtensions,
  getKeyPackageMLSVersion,
  getKeyPackageRelayList,
  getKeyPackageRelays,
  KEY_PACKAGE_KIND,
  KEY_PACKAGE_RELAY_LIST_KIND,
} from "../../../../src";
import { NostrEvent } from "../../../../src/utils/nostr";
import ExtensionBadge from "../../components/extension-badge";
import JsonBlock from "../../components/json-block";
import KeyPackageDataView from "../../components/key-package/data-view";
import { UserAvatar, UserName } from "../../components/nostr-user";
import { useObservable, useObservableMemo } from "../../hooks/use-observable";
import accounts from "../../lib/accounts";
import { eventStore, pool } from "../../lib/nostr";

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString();
};

// Subject to hold the selected pubkey
const selectedPubkey$ = new BehaviorSubject<string | null>(null);

// Observable of pubkeys key package relays
const keyPackageRelaysList$ = selectedPubkey$.pipe(
  switchMap((pubkey) =>
    pubkey
      ? eventStore.replaceable({
          kind: KEY_PACKAGE_RELAY_LIST_KIND,
          pubkey,
        })
      : NEVER,
  ),
  map((event) => event && getKeyPackageRelayList(event)),
);

// ============================================================================
// Key Package Card Component (simplified version)
// ============================================================================

function KeyPackageCard({ event }: { event: NostrEvent }) {
  const [expanded, setExpanded] = useState(false);

  const mlsVersion = getKeyPackageMLSVersion(event);
  const cipherSuiteId = getKeyPackageCipherSuiteId(event);
  const extensions = getKeyPackageExtensions(event);
  const relays = getKeyPackageRelays(event);
  const client = getKeyPackageClient(event);

  const cipherSuite =
    cipherSuiteId !== undefined
      ? getCiphersuiteFromId(cipherSuiteId)
      : undefined;

  // Parse the key package
  let keyPackage: KeyPackage | null = null;
  let keyPackageError: Error | null = null;
  try {
    keyPackage = getKeyPackage(event);
  } catch (error) {
    keyPackageError = error as Error;
  }

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-base-content/60 font-mono truncate">
              {event.id}
            </div>
            <div className="text-xs text-base-content/40 mt-1">
              {formatDate(event.created_at)}
            </div>
          </div>
          {keyPackage && !keyPackageError && (
            <span className="badge badge-success">Valid</span>
          )}
          {keyPackageError && (
            <span className="badge badge-error">Parse Error</span>
          )}
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-base-content/60 mb-1">MLS Version</div>
            <span className="badge badge-outline">
              {mlsVersion || "Not specified"}
            </span>
          </div>

          <div>
            <div className="text-xs text-base-content/60 mb-1">
              Cipher Suite
            </div>
            <span className="badge badge-outline font-mono">
              {cipherSuite?.name || "Unknown"}
            </span>
          </div>

          {client && (
            <div className="col-span-2">
              <div className="text-xs text-base-content/60 mb-1">Client</div>
              <span className="badge badge-outline">{client.name}</span>
            </div>
          )}

          {relays && relays.length > 0 && (
            <div className="col-span-2">
              <div className="text-xs text-base-content/60 mb-1">
                Relays ({relays.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {relays.map((relay) => (
                  <span key={relay} className="badge badge-outline">
                    {relay}
                  </span>
                ))}
              </div>
            </div>
          )}

          {extensions && extensions.length > 0 && (
            <div className="col-span-2">
              <div className="text-xs text-base-content/60 mb-1">
                Extensions ({extensions.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {extensions.map((ext) => (
                  <ExtensionBadge key={ext} extensionType={ext} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {keyPackageError && (
          <div className="alert alert-error mt-2">
            <div>
              <strong>Parse Error:</strong> {keyPackageError.message}
            </div>
          </div>
        )}

        {/* Expandable Details */}
        {keyPackage && (
          <button
            className="btn btn-ghost mt-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide" : "Show"} Details
          </button>
        )}

        {expanded && keyPackage && (
          <div className="mt-3 space-y-2 border-t border-base-300 pt-3">
            {/* Credential Info */}
            {keyPackage.leafNode.credential.credentialType === "basic" && (
              <div>
                <div className="text-xs text-base-content/60 mb-1">
                  Credential Pubkey
                </div>
                <code className="text-xs break-all">
                  {getCredentialPubkey(keyPackage.leafNode.credential)}
                </code>
              </div>
            )}

            {/* Public Keys */}
            <div>
              <div className="text-xs text-base-content/60 mb-1">
                HPKE Public Key
              </div>
              <code className="text-xs break-all">
                {bytesToHex(keyPackage.leafNode.hpkePublicKey)}
              </code>
            </div>

            <div>
              <div className="text-xs text-base-content/60 mb-1">
                Signature Public Key
              </div>
              <code className="text-xs break-all">
                {bytesToHex(keyPackage.leafNode.signaturePublicKey)}
              </code>
            </div>

            {/* Raw Nostr Event */}
            <div className="collapse collapse-arrow bg-base-200">
              <input type="checkbox" />
              <div className="collapse-title text-xs font-medium py-2 min-h-0">
                Raw Nostr Event
              </div>
              <div className="collapse-content">
                <JsonBlock value={event} />
              </div>
            </div>

            {/* Raw Key Package Data */}
            <div className="collapse collapse-arrow bg-base-200">
              <input type="checkbox" />
              <div className="collapse-title text-xs font-medium py-2 min-h-0">
                Raw Key Package Data
              </div>
              <div className="collapse-content">
                <KeyPackageDataView keyPackage={keyPackage} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main User Key Packages Component
// ============================================================================

export default function UserKeyPackages() {
  const [pubkeyInput, setPubkeyInput] = useState("");
  const allAccounts = useObservable(accounts.accounts$);
  const selectedPubkey = useObservable(selectedPubkey$);
  const keyPackageRelays = useObservable(keyPackageRelaysList$);

  // Handle manual pubkey submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pubkeyInput.trim())
      selectedPubkey$.next(normalizeToPubkey(pubkeyInput.trim()));
  };

  // Handle clear
  const handleClear = () => {
    setPubkeyInput("");
    selectedPubkey$.next(null);
  };

  // Step 2: Fetch key packages from those relays (or default relays if none found)
  const keyPackages = useObservableMemo(
    () =>
      combineLatest([selectedPubkey$, keyPackageRelaysList$]).pipe(
        switchMap(([pubkey, relays]) => {
          if (!pubkey) return of([]);

          // Use the user's specified relays, or fall back to a default relay
          const relaysToUse =
            relays && relays.length > 0 ? relays : ["wss://relay.damus.io/"];

          return pool
            .request(relaysToUse, {
              kinds: [KEY_PACKAGE_KIND],
              authors: [pubkey],
              limit: 50,
            })
            .pipe(
              mapEventsToTimeline(),
              map((arr) => [...arr]),
            );
        }),
      ),
    [],
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">User Key Packages</h1>
        <p className="text-base-content/70">
          View all key packages published by a specific user. First, we fetch
          their relay list (kind 10051), then load their key packages (kind 443)
          from those relays.
        </p>
      </div>

      {/* User Selection Form */}
      <div className="card bg-base-200">
        <div className="card-body p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter user pubkey (hex)"
                className="input input-bordered flex-1"
                value={pubkeyInput}
                onChange={(e) => setPubkeyInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Load
              </button>
              {selectedPubkey && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
            </div>

            {allAccounts && allAccounts.length > 0 && (
              <div>
                <div className="text-sm text-base-content/60 mb-1">
                  Or select an account:
                </div>
                <select
                  className="select select-bordered"
                  value={selectedPubkey ?? ""}
                  onChange={(e) => selectedPubkey$.next(e.target.value)}
                >
                  <option value="" disabled>
                    Select an account
                  </option>
                  {allAccounts.map((account) => (
                    <option key={account.pubkey} value={account.pubkey}>
                      <UserName pubkey={account.pubkey} />
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Selected User Info */}
      {selectedPubkey && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <UserAvatar pubkey={selectedPubkey} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg">
                  <UserName pubkey={selectedPubkey} />
                </h3>
                <code className="text-xs text-base-content/60 truncate block">
                  {selectedPubkey}
                </code>
              </div>
            </div>

            {/* Relay List Info */}
            <div className="mt-3 pt-3 border-t border-base-300">
              <div className="text-sm font-semibold mb-2">
                Key Package Relay List (kind 10051)
              </div>
              {keyPackageRelays ? (
                <div className="space-y-2">
                  <div className="text-xs text-base-content/60">
                    Found relay list
                  </div>
                  {keyPackageRelays.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {keyPackageRelays.map((relay) => (
                        <span key={relay} className="badge badge-primary">
                          {relay}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      <span>
                        Relay list event found but contains no valid relays
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="alert alert-info">
                  <span>
                    No relay list found. Using default relay
                    (wss://relay.damus.io/)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key Packages List */}
      {selectedPubkey && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Key Packages ({(keyPackages || []).length})
            </h2>
          </div>

          {keyPackages && keyPackages.length > 0 ? (
            <div className="space-y-3">
              {keyPackages.map((event) => (
                <ErrorBoundary
                  key={event.id}
                  fallbackRender={({ error }) => (
                    <div className="card bg-base-100 border border-error">
                      <div className="card-body p-4">
                        <div className="alert alert-error p-2">
                          <span className="text-xs">
                            Error rendering key package: {error.message}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                >
                  <KeyPackageCard event={event as NostrEvent} />
                </ErrorBoundary>
              ))}
            </div>
          ) : keyPackages && keyPackages.length === 0 ? (
            <div className="alert alert-info">
              <span>
                No key packages found for this user on the specified relays.
              </span>
            </div>
          ) : (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {!selectedPubkey && (
        <div className="alert alert-info">
          <div>
            <div className="font-semibold mb-1">How it works:</div>
            <ol className="text-sm list-decimal list-inside space-y-1">
              <li>Enter a user's pubkey or select your active account</li>
              <li>
                We'll fetch their key package relay list (kind 10051 event)
              </li>
              <li>
                Then load all their key packages (kind 443 events) from those
                relays
              </li>
              <li>View detailed information about each key package</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
