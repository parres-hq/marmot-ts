import { bytesToHex } from "@noble/ciphers/utils";
import { BehaviorSubject, mapEventsToTimeline } from "applesauce-core";
import { onlyEvents } from "applesauce-relay";
import { useMemo, useState, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { map, switchMap } from "rxjs/operators";

import { defaultExtensionTypes, KeyPackage } from "ts-mls";
import { getCiphersuiteFromId } from "ts-mls/crypto/ciphersuite.js";
import { LeafNode } from "ts-mls/leafNode.js";
import { protocolVersions } from "ts-mls/protocolVersion.js";

import {
  getKeyPackage,
  getKeyPackageCipherSuiteId,
  getKeyPackageClient,
  getKeyPackageExtensions,
  getKeyPackageMLSVersion,
  getKeyPackageRelays,
  KEY_PACKAGE_KIND,
} from "../../../../src";
import { NostrEvent } from "../../../../src/lib/nostr";
import { useObservable, useObservableMemo } from "../../hooks/use-observable";
import { pool } from "../../lib/nostr";

import JsonBlock from "../../components/json-block";
import { UserAvatar, UserName } from "../../components/nostr-user";
import RelayPicker from "../../components/relay-picker";

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

function LeafNodeInfo(props: { leafNode: LeafNode }) {
  return (
    <div className="mt-2 space-y-2">
      {/* Public Keys and Credential Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* HPKE Public Key */}
        <DetailsField label="HPKE Public Key">
          <p className="break-all select-all font-mono">
            {bytesToHex(props.leafNode.hpkePublicKey)}
          </p>
        </DetailsField>

        {/* Signature Public Key */}
        <DetailsField label="Signature Public Key">
          <p className="break-all select-all font-mono">
            {bytesToHex(props.leafNode.signaturePublicKey)}
          </p>
        </DetailsField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DetailsField label="Credential Type">
          <span className="badge badge-success badge-outline">
            {props.leafNode.credential.credentialType}
          </span>
        </DetailsField>

        {props.leafNode.credential.credentialType === "basic" && (
          <DetailsField label="Identity">
            <p className="break-all select-all font-mono">
              {bytesToHex(props.leafNode.credential.identity)}
            </p>
          </DetailsField>
        )}
      </div>

      {/* Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Versions */}
        <DetailsField label="Versions">
          <div className="flex flex-wrap gap-2">
            {props.leafNode.capabilities.versions.map((version) => (
              <span key={version} className="badge badge-primary badge-outline">
                {version} ({protocolVersions[version]})
              </span>
            ))}
          </div>
        </DetailsField>

        {/* Ciphersuites */}
        <DetailsField label="Ciphersuites">
          {props.leafNode.capabilities.ciphersuites.map((suite) => (
            <span key={suite} className="badge badge-outline">
              {suite}
            </span>
          ))}
        </DetailsField>

        {/* Extensions */}
        <DetailsField label="Extensions">
          <div className="flex flex-wrap gap-2">
            {props.leafNode.capabilities.extensions.length > 0 ? (
              props.leafNode.capabilities.extensions.map((ext) => (
                <span key={ext} className="badge badge-outline">
                  {Object.entries(defaultExtensionTypes).find(
                    ([_, v]) => v === ext,
                  )?.[0] ?? "Unknown"}{" "}
                  ({ext})
                </span>
              ))
            ) : (
              <span className="badge badge-error badge-outline">None</span>
            )}
          </div>
        </DetailsField>

        {/* Credentials */}
        <DetailsField label="Credentials">
          <div className="flex flex-wrap gap-2">
            {props.leafNode.capabilities.credentials.map((cred) => (
              <span key={cred} className="badge badge-success badge-outline">
                {cred}
              </span>
            ))}
          </div>
        </DetailsField>

        {/* Proposals */}
        <DetailsField label="Proposals">
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
    </div>
  );
}

// ============================================================================
// Key Package Data Renderer (handles BigInt)
// ============================================================================

function renderValue(value: any, depth = 0): any {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  // Handle BigInt
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }

  // Handle Uint8Array
  if (value instanceof Uint8Array) {
    return bytesToHex(value);
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return (
      <div className="ml-4">
        {value.map((item, index) => (
          <div key={index}>
            <span className="text-base-content/60">[{index}]:</span>{" "}
            {renderValue(item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  // Handle Objects
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return (
      <div className={depth > 0 ? "ml-4 space-y-1" : "space-y-1"}>
        {entries.map(([key, val]) => (
          <div key={key}>
            <span className="text-primary font-semibold">{key}:</span>{" "}
            {renderValue(val, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  // Handle primitives
  if (typeof value === "string") {
    return `"${value}"`;
  }

  return String(value);
}

function KeyPackageDataView(props: { keyPackage: KeyPackage }) {
  return (
    <div className="font-mono text-xs bg-base-200 py-4 rounded">
      {renderValue(props.keyPackage)}
    </div>
  );
}

// ============================================================================
// Key Package Card
// ============================================================================

/** A component that renders a Nostr event details */
function NostrEventTab(props: { event: NostrEvent }) {
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
    <div className="space-y-3">
      {/* Nostr Event Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
        {/* MLS Version */}
        <DetailsField label="MLS Version">
          <span className="badge badge-outline">
            {mlsVersion || <span className="text-warning">Not specified</span>}
          </span>
        </DetailsField>

        {/* Client Info */}
        <DetailsField label="Client">{client?.name || "Unknown"}</DetailsField>

        {/* Extensions */}
        <DetailsField label="Extensions">
          <div className="flex flex-wrap gap-2">
            {extensions && extensions.length > 0 ? (
              extensions.map((extension) => (
                <span key={extension} className="badge badge-outline">
                  {extension}
                </span>
              ))
            ) : (
              <span className="badge badge-error badge-outline">None</span>
            )}
          </div>
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

        {/* Relays */}
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
      </div>

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

/** A component that renders a MLS key package details */
function MLSKeyPackageTab(props: { keyPackage: KeyPackage }) {
  const [showKeyPackageData, setShowKeyPackageData] = useState(false);

  return (
    <div className="space-y-3">
      {/* Leaf Node Information */}
      <LeafNodeInfo leafNode={props.keyPackage.leafNode} />

      {/* Full Key Package Data Collapsible */}
      <div className="collapse collapse-arrow bg-base-200">
        <input
          type="checkbox"
          checked={showKeyPackageData}
          onChange={(e) => setShowKeyPackageData(e.target.checked)}
        />
        <div className="collapse-title text-sm font-medium py-2 min-h-0">
          Full Key Package Data
        </div>
        <div className="collapse-content">
          <KeyPackageDataView keyPackage={props.keyPackage} />
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
    <div className="card card-border">
      <div className="card-body p-4">
        {/* Header with user info */}
        <div className="mb-3 flex gap-2">
          <UserAvatar pubkey={props.event.pubkey} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">
              <UserName pubkey={props.event.pubkey} />
            </h3>
            <code className="text-xs text-base-content/60 truncate">
              Event ID: {props.event.id}
            </code>
          </div>
          <div className="text-xs text-base-content/60 whitespace-nowrap">
            {formatDate(props.event.created_at)}
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
          <div className="tab-content bg-base-100 border-base-300 p-2">
            <NostrEventTab event={props.event} />
          </div>

          <input
            type="radio"
            name={props.event.id}
            className="tab"
            aria-label="MLS Key Package"
          />
          <div className="tab-content bg-base-100 border-base-300 p-2">
            <MLSKeyPackageTab keyPackage={keyPackage} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyPackageCard(props: { event: NostrEvent }) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="card bg-base-100 card-border">
          <div className="card-body p-4">
            <h3 className="card-title text-error">
              Failed to Parse Key Package
            </h3>
            <p className="text-sm">Event ID: {props.event.id}</p>
            <div className="alert alert-error mt-2 p-3">
              <div>
                <div className="font-bold">Error: {error.message}</div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs">
                    Show details
                  </summary>
                  <pre className="text-xs mt-1 overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </details>
              </div>
            </div>
            <div className="collapse collapse-arrow bg-base-200 mt-2">
              <input type="checkbox" />
              <div className="collapse-title text-sm font-medium py-2 min-h-0">
                Raw Event (for debugging)
              </div>
              <div className="collapse-content">
                <JsonBlock value={props.event} />
              </div>
            </div>
            <div className="card-actions justify-end mt-2">
              <button className="btn btn-xs" onClick={resetErrorBoundary}>
                Try Again
              </button>
              <a
                href={`https://njump.me/${props.event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-ghost"
              >
                View on njump.me
              </a>
            </div>
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
