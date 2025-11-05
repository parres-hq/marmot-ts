import { useEffect, useState } from "react";
import { combineLatest, EMPTY, map, switchMap } from "rxjs";
import {
  defaultCryptoProvider,
  defaultLifetime,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
} from "ts-mls";
import { CiphersuiteName } from "ts-mls/crypto/ciphersuite.js";

import {
  defaultExtensions,
  defaultCapabilities,
  getKeyPackageRelayList,
} from "../../../../src";
import { createCredential } from "../../../../src/core/credential";
import { createKeyPackageEvent } from "../../../../src/core/key-package";
import { KEY_PACKAGE_RELAY_LIST_KIND } from "../../../../src/core/protocol";
import {
  CIPHER_SUITES,
  CipherSuitePicker,
} from "../../components/form/cipher-suite-picker";
import JsonBlock from "../../components/json-block";
import { withSignIn } from "../../components/with-signIn";
import { useObservable } from "../../hooks/use-observable";
import accounts, { mailboxes$ } from "../../lib/accounts";
import { keyPackageStore } from "../../lib/key-package-store";
import { eventStore, pool } from "../../lib/nostr";

/** Observable of current accounts key package relays */
const keyPackageRelays$ = combineLatest([accounts.active$, mailboxes$]).pipe(
  switchMap(([account, mailboxes]) =>
    account
      ? eventStore
          .replaceable({
            kind: KEY_PACKAGE_RELAY_LIST_KIND,
            pubkey: account.pubkey,
            relays: mailboxes?.outboxes,
          })
          .pipe(
            map((event) => (event ? getKeyPackageRelayList(event) : undefined)),
          )
      : EMPTY,
  ),
);

// ============================================================================
// Component: ConfigurationForm
// ============================================================================

interface ConfigurationFormProps {
  relays: string;
  cipherSuite: CiphersuiteName;
  isCreating: boolean;
  onRelaysChange: (relays: string) => void;
  onCipherSuiteChange: (suite: CiphersuiteName) => void;
  onSubmit: () => void;
}

function ConfigurationForm({
  relays,
  cipherSuite,
  isCreating,
  onRelaysChange,
  onCipherSuiteChange,
  onSubmit,
}: ConfigurationFormProps) {
  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        <h2 className="card-title">Configuration</h2>

        {/* Cipher Suite Selector */}
        <CipherSuitePicker
          value={cipherSuite}
          onChange={onCipherSuiteChange}
          disabled={isCreating}
        />

        {/* Relays Input */}
        <div className="w-full">
          <label className="block mb-2">
            <span className="font-semibold">
              Relays
              <span className="text-xs text-base-content/60 ml-2">
                (one per line)
              </span>
            </span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-24"
            placeholder="wss://relay.damus.io&#10;wss://relay.nostr.band"
            value={relays}
            onChange={(e) => onRelaysChange(e.target.value)}
            disabled={isCreating}
          />
          <div className="mt-1">
            <span className="text-sm text-base-content/60">
              Where to publish the key package (kind 443 event)
            </span>
          </div>
        </div>

        {/* Create Button */}
        <div className="card-actions justify-end mt-4">
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={isCreating || !relays}
          >
            {isCreating ? (
              <>
                <span className="loading loading-spinner"></span>
                Creating...
              </>
            ) : (
              "Create & Publish Key Package"
            )}
          </button>
        </div>
      </div>
    </div>
  );
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
// Component: SuccessDisplay
// ============================================================================

interface SuccessDisplayProps {
  event: any;
  storageKey: string;
}

function SuccessDisplay({ event, storageKey }: SuccessDisplayProps) {
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
          <div className="font-bold">Key package created successfully!</div>
          <div className="text-sm">
            Event ID: {event.id}
            <br />
            Storage Key: {storageKey.slice(0, 16)}...
          </div>
        </div>
      </div>

      {/* Event Details */}
      <div className="card bg-base-200 shadow-md">
        <div className="card-body">
          <h2 className="card-title">Published Event</h2>
          <div className="divider my-1"></div>
          <JsonBlock value={event} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component: InfoSection
// ============================================================================

function InfoSection() {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body">
        <h3 className="font-bold">ℹ️ About Key Packages</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-base-content/80">
          <li>Key packages are published as kind 443 events on Nostr relays</li>
          <li>
            They enable others to add you to encrypted MLS group conversations
          </li>
          <li>
            The private key is stored locally in your browser using IndexedDB
          </li>
          <li>
            Choose from {CIPHER_SUITES.length} different MLS cipher suites with
            various cryptographic algorithms
          </li>
          <li>Includes Marmot Group Data Extension for Nostr integration</li>
          <li>Tagged with "client" for identification purposes</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Hook: useKeyPackageCreation
// ============================================================================

interface CreateKeyPackageParams {
  relays: string;
  cipherSuite: CiphersuiteName;
}

function useKeyPackageCreation() {
  const [isCreating, setIsCreating] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  const createKeyPackage = async ({
    relays,
    cipherSuite,
  }: CreateKeyPackageParams) => {
    try {
      setIsCreating(true);
      setError(null);
      setCreatedEvent(null);
      setStorageKey(null);

      const account = accounts.active;
      if (!account) {
        throw new Error("No active account");
      }

      const pubkey = account.pubkey;

      // Get cipher suite implementation
      const selectedCiphersuite = getCiphersuiteFromName(cipherSuite);
      const ciphersuiteImpl = await getCiphersuiteImpl(
        selectedCiphersuite,
        defaultCryptoProvider,
      );

      // Create credential and key package
      console.log("Creating credential for pubkey:", pubkey);
      const credential = createCredential(pubkey);

      console.log("Generating key package with cipher suite:", cipherSuite);
      const keyPackage = await generateKeyPackage(
        credential,
        defaultCapabilities(),
        defaultLifetime,
        defaultExtensions,
        ciphersuiteImpl,
      );

      // Store the key package locally
      console.log("Storing key package locally...");
      const key = await keyPackageStore.add(keyPackage);
      setStorageKey(key);
      console.log("Stored with key:", key);

      // Parse relay URLs
      const relayList = relays
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      // Create the unsigned event using the library function
      console.log("Creating key package event...");
      const unsignedEvent = createKeyPackageEvent({
        keyPackage: keyPackage.publicPackage,
        pubkey,
        relays: relayList,
        client: "marmot-examples",
      });

      console.log("Signing event...");
      const signedEvent = await account.signEvent(unsignedEvent);
      console.log("Signed event:", signedEvent);

      // Publish to relays
      console.log("Publishing to relays:", relayList);
      for (const relay of relayList) {
        try {
          await pool.publish([relay], signedEvent);
          console.log("Published to", relay);
        } catch (err) {
          console.error("Failed to publish to", relay, err);
        }
      }

      setCreatedEvent(signedEvent);
      console.log("✅ Key package created and published successfully!");
    } catch (err) {
      console.error("Error creating key package:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    createdEvent,
    error,
    storageKey,
    createKeyPackage,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default withSignIn(function KeyPackageCreate() {
  // Subscribe to the user's key package relays
  const keyPackageRelays = useObservable(keyPackageRelays$);

  const [relays, setRelays] = useState<string>("wss://relay.damus.io");
  const [cipherSuite, setCipherSuite] = useState<CiphersuiteName>(
    "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
  );

  // Update relays when saved relays change
  useEffect(() => {
    if (keyPackageRelays && keyPackageRelays.length > 0) {
      setRelays(keyPackageRelays.join("\n"));
    }
  }, [keyPackageRelays]);

  const { isCreating, createdEvent, error, storageKey, createKeyPackage } =
    useKeyPackageCreation();

  const handleCreate = () => {
    createKeyPackage({ relays, cipherSuite });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Create Key Package</h1>
        <p className="text-base-content/70">
          Generate and publish a new MLS key package to enable encrypted group
          messaging.
        </p>
      </div>

      {/* Configuration Form */}
      <ConfigurationForm
        relays={relays}
        cipherSuite={cipherSuite}
        isCreating={isCreating}
        onRelaysChange={setRelays}
        onCipherSuiteChange={setCipherSuite}
        onSubmit={handleCreate}
      />

      {/* Error Display */}
      <ErrorAlert error={error} />

      {/* Success Display */}
      {createdEvent && storageKey && (
        <SuccessDisplay event={createdEvent} storageKey={storageKey} />
      )}

      {/* Info Section */}
      <InfoSection />
    </div>
  );
});
