import { bytesToHex } from "@noble/ciphers/utils.js";
import { BehaviorSubject, mapEventsToTimeline } from "applesauce-core";
import { onlyEvents } from "applesauce-relay";
import { switchMap } from "rxjs/operators";
import {
  createMemo,
  createSignal,
  ErrorBoundary,
  For,
  from,
  JSX,
} from "solid-js";
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
import JsonBlock from "../../components/json-block";
import { UserAvatar, UserName } from "../../components/nostr-user";
import RelayPicker from "../../components/relay-picker";
import { pool } from "../../lib/nostr";

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString();
};

const relay = new BehaviorSubject<string>("wss://relay.damus.io/");

function DetailsField(props: { label: string; children: JSX.Element }) {
  return (
    <div class="overflow-hidden">
      <div class="text-sm text-base-content/60 mb-1">{props.label}</div>
      {props.children}
    </div>
  );
}

// ============================================================================
// Leaf Node Info Component
// ============================================================================

function LeafNodeInfo(props: { leafNode: LeafNode }) {
  return (
    <div class="mt-2 space-y-2">
      {/* Public Keys and Credential Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* HPKE Public Key */}
        <DetailsField label="HPKE Public Key">
          <p class="break-all select-all font-mono">
            {bytesToHex(props.leafNode.hpkePublicKey)}
          </p>
        </DetailsField>

        {/* Signature Public Key */}
        <DetailsField label="Signature Public Key">
          <p class="break-all select-all font-mono">
            {bytesToHex(props.leafNode.signaturePublicKey)}
          </p>
        </DetailsField>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DetailsField label="Credential Type">
          <span class="badge badge-success badge-outline">
            {props.leafNode.credential.credentialType}
          </span>
        </DetailsField>

        {props.leafNode.credential.credentialType === "basic" && (
          <DetailsField label="Identity">
            <p class="break-all select-all font-mono">
              {bytesToHex(props.leafNode.credential.identity)}
            </p>
          </DetailsField>
        )}
      </div>

      {/* Capabilities Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Versions */}
        <DetailsField label="Versions">
          <div class="flex flex-wrap gap-2">
            <For each={props.leafNode.capabilities.versions}>
              {(version) => (
                <span class="badge badge-primary badge-outline">
                  {version} ({protocolVersions[version]})
                </span>
              )}
            </For>
          </div>
        </DetailsField>

        {/* Ciphersuites */}
        <DetailsField label="Ciphersuites">
          <For each={props.leafNode.capabilities.ciphersuites}>
            {(suite) => <span class="badge badge-outline">{suite}</span>}
          </For>
        </DetailsField>

        {/* Extensions */}
        <DetailsField label="Extensions">
          <div class="flex flex-wrap gap-2">
            <For
              each={props.leafNode.capabilities.extensions}
              fallback={
                <span class="badge badge-error badge-outline">None</span>
              }
            >
              {(ext) => (
                <span class="badge badge-outline">
                  {Object.entries(defaultExtensionTypes).find(
                    ([_, v]) => v === ext,
                  )?.[0] ?? "Unknown"}{" "}
                  ({ext})
                </span>
              )}
            </For>
          </div>
        </DetailsField>

        {/* Credentials */}
        <DetailsField label="Credentials">
          <div class="flex flex-wrap gap-2">
            <For each={props.leafNode.capabilities.credentials}>
              {(cred) => (
                <span class="badge badge-success badge-outline">{cred}</span>
              )}
            </For>
          </div>
        </DetailsField>

        {/* Proposals */}
        <DetailsField label="Proposals">
          <div class="flex flex-wrap gap-2">
            <For
              each={props.leafNode.capabilities.proposals}
              fallback={<span class="text-base-content/40 italic">None</span>}
            >
              {(proposal) => (
                <span class="badge badge-info badge-outline">{proposal}</span>
              )}
            </For>
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
      <div class="ml-4">
        {value.map((item, index) => (
          <div>
            <span class="text-base-content/60">[{index}]:</span>{" "}
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
      <div class={depth > 0 ? "ml-4 space-y-1" : "space-y-1"}>
        {entries.map(([key, val]) => (
          <div>
            <span class="text-primary font-semibold">{key}:</span>{" "}
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
    <div class="font-mono text-xs bg-base-200 py-4 rounded">
      {renderValue(props.keyPackage)}
    </div>
  );
}

// ============================================================================
// Key Package Card
// ============================================================================

/** A component that renders a Nostr event details */
function NostrEventTab(props: { event: NostrEvent }) {
  const mlsVersion = createMemo(() => getKeyPackageMLSVersion(props.event));
  const cipherSuiteId = createMemo(() =>
    getKeyPackageCipherSuiteId(props.event),
  );
  const extensions = createMemo(() => getKeyPackageExtensions(props.event));
  const relays = createMemo(() => getKeyPackageRelays(props.event));
  const client = createMemo(() => getKeyPackageClient(props.event));

  const cipherSuite = createMemo(() => {
    const id = cipherSuiteId();
    return id !== undefined ? getCiphersuiteFromId(id) : undefined;
  });

  return (
    <div class="space-y-3">
      {/* Nostr Event Metadata */}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
        {/* MLS Version */}
        <DetailsField label="MLS Version">
          <span class="badge badge-outline">
            {mlsVersion() || <span class="text-warning">Not specified</span>}
          </span>
        </DetailsField>

        {/* Client Info */}
        <DetailsField label="Client">
          {client()?.name || "Unknown"}
        </DetailsField>

        {/* Extensions */}
        <DetailsField label="Extensions">
          <div class="flex flex-wrap gap-2">
            <For
              each={extensions()}
              fallback={
                <span class="badge badge-error badge-outline">None</span>
              }
            >
              {(extension) => (
                <span class="badge badge-outline">{extension}</span>
              )}
            </For>
          </div>
        </DetailsField>

        {/* Cipher Suite */}
        <DetailsField label="Cipher Suite">
          {cipherSuiteId() !== undefined ? (
            <span class="badge badge-outline font-mono">
              {cipherSuite()?.name}
            </span>
          ) : (
            <span class="badge badge-error badge-outline">Unknown</span>
          )}
        </DetailsField>

        {/* Relays */}
        <DetailsField label="Relays">
          <div class="flex flex-wrap gap-2">
            <For
              each={relays()}
              fallback={
                <span class="badge badge-error badge-outline">None</span>
              }
            >
              {(relay) => <span class="badge badge-outline">{relay}</span>}
            </For>
          </div>
        </DetailsField>
      </div>

      {/* Raw Nostr Event - Collapsible */}
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div class="collapse-title text-sm font-medium py-2 min-h-0">
          Raw Nostr Event
        </div>
        <div class="collapse-content">
          <JsonBlock value={props.event} />
        </div>
      </div>
    </div>
  );
}

/** A component that renders a MLS key package details */
function MLSKeyPackageTab(props: { keyPackage: KeyPackage }) {
  const [showKeyPackageData, setShowKeyPackageData] = createSignal(false);

  return (
    <div class="space-y-3">
      {/* Leaf Node Information */}
      <LeafNodeInfo leafNode={props.keyPackage.leafNode} />

      {/* Full Key Package Data - Collapsible */}
      <div class="collapse collapse-arrow bg-base-200">
        <input
          type="checkbox"
          checked={showKeyPackageData()}
          onChange={(e) => setShowKeyPackageData(e.target.checked)}
        />
        <div class="collapse-title text-sm font-medium py-2 min-h-0">
          Full Key Package Data
        </div>
        <div class="collapse-content">
          <KeyPackageDataView keyPackage={props.keyPackage} />
        </div>
      </div>
    </div>
  );
}

/** A component that renders a key package card content */
function KeyPackageCardContent(props: { event: NostrEvent }) {
  // Parse the key package data
  const keyPackage = createMemo<KeyPackage>(() => getKeyPackage(props.event));

  return (
    <div class="card shadow-md">
      <div class="card-body p-4">
        {/* Header with user info */}
        <div class="mb-3 flex gap-2">
          <UserAvatar pubkey={props.event.pubkey} />
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold">
              <UserName pubkey={props.event.pubkey} />
            </h3>
            <code class="text-xs text-base-content/60 truncate">
              Event ID: {props.event.id}
            </code>
          </div>
          <div class="text-xs text-base-content/60 whitespace-nowrap">
            {formatDate(props.event.created_at)}
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" class="tabs tabs-lift">
          <input
            type="radio"
            name={props.event.id}
            class="tab"
            aria-label="Nostr Event"
            checked
          />
          <div class="tab-content bg-base-100 border-base-300 p-2">
            <NostrEventTab event={props.event} />
          </div>

          <input
            type="radio"
            name={props.event.id}
            class="tab"
            aria-label="MLS Key Package"
          />
          <div class="tab-content bg-base-100 border-base-300 p-2">
            <MLSKeyPackageTab keyPackage={keyPackage()} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyPackageCard(props: { event: NostrEvent }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div class="card bg-base-100 shadow-md">
          <div class="card-body p-4">
            <h3 class="card-title text-error">Failed to Parse Key Package</h3>
            <p class="text-sm">Event ID: {props.event.id}</p>
            <div class="alert alert-error mt-2 p-3">
              <div>
                <div class="font-bold">Error: {error.message}</div>
                <details class="mt-1">
                  <summary class="cursor-pointer text-xs">Show details</summary>
                  <pre class="text-xs mt-1 overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </details>
              </div>
            </div>
            <div class="collapse collapse-arrow bg-base-200 mt-2">
              <input type="checkbox" />
              <div class="collapse-title text-sm font-medium py-2 min-h-0">
                Raw Event (for debugging)
              </div>
              <div class="collapse-content">
                <JsonBlock value={props.event} />
              </div>
            </div>
            <div class="card-actions justify-end mt-2">
              <button class="btn btn-xs" onClick={reset}>
                Try Again
              </button>
              <a
                href={`https://njump.me/${props.event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-xs btn-ghost"
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
  const relayUrl = from(relay);
  const [selectedUser, setSelectedUser] = createSignal<string>("all");

  // Subscribe to key package events from relay
  const events = from(
    relay.pipe(
      switchMap((url) =>
        pool
          .subscription([url], { kinds: [KEY_PACKAGE_KIND], limit: 100 })
          .pipe(onlyEvents(), mapEventsToTimeline()),
      ),
    ),
  );

  // Get unique users from events with their counts
  const users = createMemo(() => {
    const allEvents = events() || [];
    const userCounts = new Map<string, number>();

    allEvents.forEach((e) => {
      userCounts.set(e.pubkey, (userCounts.get(e.pubkey) || 0) + 1);
    });

    return userCounts;
  });

  // Filter events based on selected user
  const filteredEvents = createMemo(() => {
    const allEvents = events() || [];
    const selected = selectedUser();
    if (selected === "all") return Array.from(allEvents);

    return allEvents.filter((e) => e.pubkey === selected);
  });

  return (
    <div class="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div class="space-y-2">
        <h1 class="text-3xl font-bold">Key Package Explorer</h1>
        <p class="text-base-content/70">
          Browse and debug MLS key packages published to Nostr (kind 443 events)
        </p>
      </div>

      {/* Relay Picker */}
      <RelayPicker value={relayUrl() ?? ""} onChange={(v) => relay.next(v)} />

      {/* User Filter */}
      <div class="form-control w-full max-w-xs">
        <label class="label">
          <span class="label-text font-semibold">Filter by User</span>
        </label>
        <select
          class="select select-bordered"
          value={selectedUser()}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="all">All Users ({(events() || []).length})</option>
          <For each={Array.from(users().entries())}>
            {([pubkey, count]) => (
              <option value={pubkey}>
                <UserName pubkey={pubkey} /> ({count})
              </option>
            )}
          </For>
        </select>
      </div>

      {/* Event Count */}
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">
          Key Packages ({filteredEvents().length})
        </h2>
      </div>

      {/* Events List */}
      <div class="space-y-4">
        <For each={filteredEvents()}>
          {(event) => <KeyPackageCard event={event as NostrEvent} />}
        </For>
      </div>
    </div>
  );
}
