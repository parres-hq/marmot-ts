import { bytesToHex } from "@noble/hashes/utils.js";
import { BehaviorSubject, mapEventsToTimeline } from "applesauce-core";
import { onlyEvents } from "applesauce-relay";
import { useMemo, useState, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { map, switchMap } from "rxjs/operators";
import { KeyPackage } from "ts-mls";
import { CredentialBasic } from "ts-mls/credential.js";
import { getCiphersuiteFromId } from "ts-mls/crypto/ciphersuite.js";
import { LeafNode } from "ts-mls/leafNode.js";
import { protocolVersions } from "ts-mls/protocolVersion.js";

import {
  getCredentialPubkey,
  getKeyPackage,
  getKeyPackageCipherSuiteId,
  getKeyPackageClient,
  getKeyPackageExtensions,
  getKeyPackageMLSVersion,
  getKeyPackageRelays,
  KEY_PACKAGE_KIND,
} from "../../../../src";
import { NostrEvent } from "../../../../src/utils/nostr";
import { useObservable, useObservableMemo } from "../../hooks/use-observable";
import { pool } from "../../lib/nostr";

import ExtensionBadge from "../../components/extension-badge";
import JsonBlock from "../../components/json-block";
import KeyPackageDataView from "../../components/key-package/data-view";
import { UserAvatar, UserName } from "../../components/nostr-user";
import RelayPicker from "../../components/form/relay-picker";

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString();
};

const relay = new BehaviorSubject<string>("wss://relay.damus.io/");

function DetailsField(props: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden">
      <div className="text-sm text-base-content/60 mb-1">{props.label}</div>
      {props.children}
    </div>
  );
}

// ============================================================================
// Leaf Node Info Component
// ============================================================================

function LeafNodeCapabilitiesSection(props: { leafNode: LeafNode }) {
  // Check if this is a key package leaf node with lifetime
  const hasLifetime = props.leafNode.leafNodeSource === "key_package";
  const lifetime = hasLifetime ? (props.leafNode as any).lifetime : undefined;

  // Format bigint timestamp to readable date
  const formatLifetimeDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  // Check if lifetime is currently valid
  const isLifetimeValid =
    lifetime &&
    BigInt(Math.floor(Date.now() / 1000)) >= lifetime.notBefore &&
    BigInt(Math.floor(Date.now() / 1000)) <= lifetime.notAfter;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Leaf Node Capabilities</h3>
        <p className="text-sm text-base-content/60">
          Supported protocol versions, cipher suites, extensions, and proposals
        </p>
      </div>

      {/* Capabilities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Versions */}
        <DetailsField label="Protocol Versions">
          <div className="flex flex-wrap gap-2">
            {props.leafNode.capabilities.versions.map((version) => (
              <span key={version} className="badge badge-primary badge-outline">
                {version} ({protocolVersions[version]})
              </span>
            ))}
          </div>
        </DetailsField>

        {/* Ciphersuites */}
        <DetailsField label="Cipher Suites">
          <div className="flex flex-wrap gap-2">
            {props.leafNode.capabilities.ciphersuites.map((suite) => (
              <span key={suite} className="badge badge-outline">
                {suite}
              </span>
            ))}
          </div>
        </DetailsField>

        {/* Credentials */}
        <DetailsField label="Credential Types">
          <div className="flex flex-wrap gap-2">
            {props.leafNode.capabilities.credentials.map((cred) => (
              <span key={cred} className="badge badge-success badge-outline">
                {cred}
              </span>
            ))}
          </div>
        </DetailsField>

        {/* Extensions */}
        <DetailsField label="Extensions">
          <div className="flex flex-wrap gap-2">
            {props.leafNode.capabilities.extensions.length > 0 ? (
              props.leafNode.capabilities.extensions.map((ext) => (
                <ExtensionBadge key={ext} extensionType={ext} />
              ))
            ) : (
              <span className="badge badge-error badge-outline">None</span>
            )}
          </div>
        </DetailsField>

        {/* Proposals */}
        <DetailsField label="Proposal Types">
          <div className="flex flex-wrap gap-2">
            {props.leafNode.capabilities.proposals.length > 0 ? (
              props.leafNode.capabilities.proposals.map((proposal) => (
                <span key={proposal} className="badge badge-info badge-outline">
                  {proposal}
                </span>
              ))
            ) : (
              <span className="text-base-content/40 italic">None</span>
            )}
          </div>
        </DetailsField>
      </div>

      {/* Public Keys Section */}
      <div>
        <h4 className="text-base font-semibold mb-3">Public Keys</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* HPKE Public Key */}
          <DetailsField label="HPKE Public Key">
            <p className="break-all select-all font-mono text-xs">
              {bytesToHex(props.leafNode.hpkePublicKey)}
            </p>
          </DetailsField>

          {/* Signature Public Key */}
          <DetailsField label="Signature Public Key">
            <p className="break-all select-all font-mono text-xs">
              {bytesToHex(props.leafNode.signaturePublicKey)}
            </p>
          </DetailsField>
        </div>
      </div>

      {/* Lifetime Information (if available) */}
      {lifetime && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-base font-semibold">Lifetime</h4>
            {isLifetimeValid ? (
              <span className="badge badge-success">Valid</span>
            ) : (
              <span className="badge badge-error">Expired/Not Yet Valid</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailsField label="Not Before">
              <p className="text-sm">
                {formatLifetimeDate(lifetime.notBefore)}
              </p>
              <p className="text-xs text-base-content/60 font-mono">
                Unix: {lifetime.notBefore.toString()}
              </p>
            </DetailsField>
            <DetailsField label="Not After">
              <p className="text-sm">{formatLifetimeDate(lifetime.notAfter)}</p>
              <p className="text-xs text-base-content/60 font-mono">
                Unix: {lifetime.notAfter.toString()}
              </p>
            </DetailsField>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Key Package Card
// ============================================================================

/** A component that renders top-level key package info from Nostr event */
function KeyPackageTopLevelInfo(props: { event: NostrEvent }) {
  const mlsVersion = getKeyPackageMLSVersion(props.event);
  const cipherSuiteId = getKeyPackageCipherSuiteId(props.event);
  const extensions = getKeyPackageExtensions(props.event);
  const relays = getKeyPackageRelays(props.event);
  const client = getKeyPackageClient(props.event);

  const cipherSuite =
    cipherSuiteId !== undefined
      ? getCiphersuiteFromId(cipherSuiteId)
      : undefined;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">
          Key Package Configuration
        </h3>
        <p className="text-sm text-base-content/60">
          Top-level cipher suite and extensions from the Nostr event
        </p>
      </div>

      {/* Top-level Key Package Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* MLS Version */}
        <DetailsField label="MLS Version">
          <span className="badge badge-outline">
            {mlsVersion || <span className="text-warning">Not specified</span>}
          </span>
        </DetailsField>

        {/* Cipher Suite */}
        <DetailsField label="Cipher Suite">
          {cipherSuiteId !== undefined ? (
            <span className="badge badge-outline font-mono">
              {cipherSuite?.name}
            </span>
          ) : (
            <span className="badge badge-error badge-outline">Unknown</span>
          )}
        </DetailsField>

        {/* Client Info */}
        <DetailsField label="Client">{client?.name || "Unknown"}</DetailsField>
      </div>

      {/* Extensions - Full width */}
      <DetailsField label="Extensions">
        <div className="flex flex-wrap gap-2">
          {extensions && extensions.length > 0 ? (
            extensions.map((extension) => (
              <ExtensionBadge key={extension} extensionType={extension} />
            ))
          ) : (
            <span className="badge badge-error badge-outline">None</span>
          )}
        </div>
      </DetailsField>

      {/* Relays - Full width */}
      <DetailsField label="Relays">
        <div className="flex flex-wrap gap-2">
          {relays && relays.length > 0 ? (
            relays.map((relay) => (
              <span key={relay} className="badge badge-outline">
                {relay}
              </span>
            ))
          ) : (
            <span className="badge badge-error badge-outline">None</span>
          )}
        </div>
      </DetailsField>

      {/* Raw Nostr Event Collapsible */}
      <div className="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-medium py-2 min-h-0">
          Raw Nostr Event
        </div>
        <div className="collapse-content">
          <JsonBlock value={props.event} />
        </div>
      </div>
    </div>
  );
}

function CredentialSection({
  credential,
  event,
}: {
  credential: CredentialBasic;
  event: NostrEvent;
}) {
  const pubkey = getCredentialPubkey(credential);
  const isValid = pubkey === event.pubkey;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Credential</h3>
        <p className="text-sm text-base-content/60">
          Identity information from the leaf node credential
        </p>
      </div>

      {/* Credential Details */}
      <div className="flex gap-3 items-start">
        <UserAvatar pubkey={pubkey} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold">
              <UserName pubkey={pubkey} />
            </h4>
            {isValid ? (
              <span className="badge badge-success">Valid</span>
            ) : (
              <span className="badge badge-error">Invalid</span>
            )}
          </div>
          <code className="text-xs text-base-content/60 break-all block">
            {pubkey}
          </code>
          {!isValid && (
            <div className="text-xs text-error mt-2">
              ⚠️ Credential pubkey does not match event publisher
            </div>
          )}
        </div>
      </div>

      {/* Credential Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DetailsField label="Credential Type">
          <span className="badge badge-success badge-outline">
            {credential.credentialType}
          </span>
        </DetailsField>

        <DetailsField label="Identity (hex)">
          <p className="break-all select-all font-mono text-xs">
            {bytesToHex(credential.identity)}
          </p>
        </DetailsField>
      </div>
    </div>
  );
}

/** A component that renders decoded MLS key package details */
function MLSKeyPackageContent({
  keyPackage,
  event,
}: {
  keyPackage: KeyPackage;
  event: NostrEvent;
}) {
  const [showKeyPackageData, setShowKeyPackageData] = useState(false);

  return (
    <div className="space-y-8">
      {/* Credential Section */}
      {keyPackage.leafNode.credential.credentialType === "basic" && (
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="alert alert-error">
              <div className="font-bold">Error: {error.message}</div>
              <button className="btn btn-xs" onClick={resetErrorBoundary}>
                Try Again
              </button>
            </div>
          )}
        >
          <CredentialSection
            credential={keyPackage.leafNode.credential}
            event={event}
          />
        </ErrorBoundary>
      )}

      {/* Divider */}
      <div className="divider" />

      {/* Leaf Node Capabilities */}
      <LeafNodeCapabilitiesSection leafNode={keyPackage.leafNode} />

      {/* Full Key Package Data Collapsible */}
      <div className="collapse collapse-arrow bg-base-200 mt-6">
        <input
          type="checkbox"
          checked={showKeyPackageData}
          onChange={(e) => setShowKeyPackageData(e.target.checked)}
        />
        <div className="collapse-title text-sm font-medium py-2 min-h-0">
          Full Key Package Data (Advanced)
        </div>
        <div className="collapse-content">
          <KeyPackageDataView keyPackage={keyPackage} />
        </div>
      </div>
    </div>
  );
}

/** A component that renders a key package card content */
function KeyPackageCardContent(props: { event: NostrEvent }) {
  // Parse the key package data
  const keyPackage = useMemo<KeyPackage>(
    () => getKeyPackage(props.event),
    [props.event],
  );

  return (
    <div className="bg-base-100 p-6 rounded-lg">
      {/* Header with user info */}
      <div className="mb-4 flex gap-3 items-start">
        <UserAvatar pubkey={props.event.pubkey} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-1">
            <UserName pubkey={props.event.pubkey} />
          </h3>
          <div className="text-xs text-base-content/60 space-y-1">
            <div className="font-mono break-all">
              Event ID: {props.event.id}
            </div>
            <div>{formatDate(props.event.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-lift">
        <input
          type="radio"
          name={props.event.id}
          className="tab"
          aria-label="Nostr Event"
          defaultChecked
        />
        <div className="tab-content bg-base-100 border-base-300 p-6">
          <KeyPackageTopLevelInfo event={props.event} />
        </div>

        <input
          type="radio"
          name={props.event.id}
          className="tab"
          aria-label="MLS Key Package"
        />
        <div className="tab-content bg-base-100 border-base-300 p-6">
          <MLSKeyPackageContent keyPackage={keyPackage} event={props.event} />
        </div>
      </div>
    </div>
  );
}

function KeyPackageCard(props: { event: NostrEvent }) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="bg-base-100 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-error mb-2">
            Failed to Parse Key Package
          </h3>
          <p className="text-sm text-base-content/60 mb-4">
            Event ID: {props.event.id}
          </p>
          <div className="alert alert-error p-4 mb-4">
            <div className="flex-1">
              <div className="font-bold">Error: {error.message}</div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs">
                  Show details
                </summary>
                <pre className="text-xs mt-2 overflow-auto max-h-40">
                  {error.stack}
                </pre>
              </details>
            </div>
          </div>
          <div className="collapse collapse-arrow bg-base-200 mb-4">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium py-2 min-h-0">
              Raw Event (for debugging)
            </div>
            <div className="collapse-content">
              <JsonBlock value={props.event} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-sm" onClick={resetErrorBoundary}>
              Try Again
            </button>
            <a
              href={`https://njump.me/${props.event.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-ghost"
            >
              View on njump.me
            </a>
          </div>
        </div>
      )}
    >
      <KeyPackageCardContent event={props.event} />
    </ErrorBoundary>
  );
}

// ============================================================================
// Main Explorer Component
// ============================================================================

export default function KeyPackageExplorer() {
  const relayUrl = useObservable(relay);
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Subscribe to key package events from relay
  const events = useObservableMemo(
    () =>
      relay.pipe(
        switchMap((url) =>
          pool
            .subscription([url], { kinds: [KEY_PACKAGE_KIND], limit: 100 })
            .pipe(
              onlyEvents(),
              mapEventsToTimeline(),
              map((arr) => [...arr]),
            ),
        ),
      ),
    [],
  );

  // Get unique users from events with their counts
  const users = useMemo(() => {
    const allEvents = events || [];
    const userCounts = new Map<string, number>();

    allEvents.forEach((e: any) => {
      userCounts.set(e.pubkey, (userCounts.get(e.pubkey) || 0) + 1);
    });

    return userCounts;
  }, [events]);

  // Filter events based on selected user
  const filteredEvents = useMemo(() => {
    const allEvents = events || [];
    const selected = selectedUser;
    if (selected === "all") return Array.from(allEvents);

    return allEvents.filter((e: any) => e.pubkey === selected);
  }, [events, selectedUser]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Key Package Explorer</h1>
        <p className="text-base-content/70">
          Browse and debug MLS key packages published to Nostr (kind 443 events)
        </p>
      </div>

      {/* Relay Picker */}
      <RelayPicker value={relayUrl ?? ""} onChange={(v) => relay.next(v)} />

      {/* User Filter */}
      <div className="form-control w-full max-w-xs">
        <label className="label">
          <span className="label-text font-semibold">Filter by User</span>
        </label>
        <select
          className="select select-bordered"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="all">All Users ({(events || []).length})</option>
          {Array.from(users.entries()).map(([pubkey, count]) => (
            <option key={pubkey} value={pubkey}>
              <UserName pubkey={pubkey} /> ({count})
            </option>
          ))}
        </select>
      </div>

      {/* Event Count */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          Key Packages ({filteredEvents.length})
        </h2>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.map((event: any) => (
          <KeyPackageCard key={event.id} event={event as NostrEvent} />
        ))}
      </div>
    </div>
  );
}
