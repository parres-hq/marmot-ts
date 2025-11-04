import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core";
import { NostrEvent, getSeenRelays, kinds } from "applesauce-core/helpers";
import {
  BehaviorSubject,
  EMPTY,
  combineLatest,
  map,
  switchMap,
  throttleTime,
} from "rxjs";
import {
  KEY_PACKAGE_KIND,
  KEY_PACKAGE_RELAY_LIST_KIND,
  getKeyPackageClient,
  getKeyPackageRelayList,
} from "../../../../src";
import { UserAvatar, UserName } from "../../components/nostr-user";
import { withSignIn } from "../../components/with-signIn";
import { useObservableMemo } from "../../hooks/use-observable";
import accounts from "../../lib/accounts";
import { eventStore, pool } from "../../lib/nostr";

const contacts$ = accounts.active$.pipe(
  switchMap((account) =>
    account ? eventStore.contacts(account.pubkey) : EMPTY,
  ),
);

const preview$ = new BehaviorSubject<NostrEvent | null>(null);

function KeyPackageItem({
  pkg,
  relays,
}: {
  pkg: NostrEvent;
  relays: string[];
}) {
  const client = getKeyPackageClient(pkg);
  const date = new Date(pkg.created_at * 1000).toLocaleDateString();
  const seenRelays = getSeenRelays(pkg);

  return (
    <div key={pkg.id} className="text-xs bg-base-300 rounded px-2 py-1.5">
      <div className="flex justify-between items-center gap-2">
        <span>
          ({seenRelays?.size ?? 0}/{relays.length})
        </span>
        {client ? (
          <span
            className="font-mono truncate flex-1 text-success font-bold"
            title={pkg.id}
          >
            {client.name}
          </span>
        ) : (
          <span className="font-mono truncate flex-1" title={pkg.id}>
            {pkg.id.slice(0, 16) + "..."}
          </span>
        )}
        <span className="text-base-content/60 whitespace-nowrap">{date}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-base-content/60 space-x-1">
          {seenRelays &&
            Array.from(seenRelays).map((relay) => (
              <span
                key={relay}
                className="text-xs bg-base-300 rounded font-mono truncate"
                title={relay}
              >
                {relay.replace(/wss?:\/\//, "").replace(/\/$/, "")}
              </span>
            ))}
        </div>
        <button
          onClick={() => preview$.next(pkg)}
          className="btn btn-xs btn-ghost ms-auto"
        >
          View
        </button>
      </div>
    </div>
  );
}

function ContactCard(props: { pubkey: string; relays: string[] }) {
  const keyPackages = useObservableMemo(
    () =>
      pool
        .request(props.relays, [
          {
            kinds: [KEY_PACKAGE_KIND],
            authors: [props.pubkey],
          },
          {
            // Also fetch the event deletions for the key packages
            kinds: [kinds.EventDeletion],
            authors: [props.pubkey],
            "#k": [String(KEY_PACKAGE_KIND)],
          },
        ])
        .pipe(
          mapEventsToStore(eventStore),
          mapEventsToTimeline(),
          throttleTime(100),
        ),
    [props.relays.join(","), props.pubkey],
  );

  return (
    <div className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        <div className="flex items-center gap-3">
          <UserAvatar pubkey={props.pubkey} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              <UserName pubkey={props.pubkey} />
            </h3>
          </div>
        </div>

        <div className="divider my-2">Relays ({props.relays.length})</div>
        <div className="space-y-1.5">
          {props.relays.map((relay, idx) => (
            <div
              key={idx}
              className="text-xs bg-base-300 rounded px-2 py-1.5 font-mono truncate"
              title={relay}
            >
              {relay}
            </div>
          ))}
        </div>

        <div className="divider my-2">
          Key Packages ({keyPackages?.length ?? 0})
        </div>

        {keyPackages && keyPackages.length > 0 ? (
          <div className="space-y-2 overflow-y-auto max-h-[300px]">
            {keyPackages.map((pkg) => (
              <KeyPackageItem key={pkg.id} pkg={pkg} relays={props.relays} />
            ))}
          </div>
        ) : (
          <div className="text-xs text-base-content/60 text-center py-2">
            No key packages found
          </div>
        )}
      </div>
    </div>
  );
}

function JsonPreviewModal() {
  const previewEvent = useObservableMemo(() => preview$, []);

  if (!previewEvent) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <h3 className="font-bold text-lg mb-4">Key Package Event</h3>
        <pre className="bg-base-300 p-4 rounded-lg overflow-auto max-h-[60vh] text-xs">
          {JSON.stringify(previewEvent, null, 2)}
        </pre>
        <div className="modal-action">
          <button className="btn" onClick={() => preview$.next(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default withSignIn(() => {
  const contacts = useObservableMemo(() => contacts$, []);

  // Subscribe to all contact relay lists
  const contactsWithRelays = useObservableMemo(() => {
    return contacts$.pipe(
      switchMap((contacts) => {
        const relayLists$ = contacts.map((user) =>
          eventStore.replaceable(KEY_PACKAGE_RELAY_LIST_KIND, user.pubkey).pipe(
            map((event) => {
              if (!event) return null;
              const relays = getKeyPackageRelayList(event);
              if (relays.length === 0) return null;
              return { pubkey: user.pubkey, relays };
            }),
          ),
        );

        return combineLatest(relayLists$).pipe(
          map((results) => results.filter((r) => r !== null)),
        );
      }),
    );
  }, []);

  return (
    <>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Contact Key Package Relays</h1>
          <p className="text-base-content/70">
            Contacts who have published a kind 10051 key package relay list.
          </p>
        </div>

        {/* Stats */}
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Total Contacts</div>
            <div className="stat-value text-primary">
              {contacts?.length ?? 0}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">With Relay Lists</div>
            <div className="stat-value text-secondary">
              {contactsWithRelays?.length ?? 0}
            </div>
          </div>
        </div>

        {/* Empty State */}
        {contactsWithRelays && contactsWithRelays.length === 0 && (
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
              />
            </svg>
            <span>
              None of your contacts have published a key package relay list yet.
            </span>
          </div>
        )}

        {/* Grid of Contacts */}
        {contactsWithRelays && contactsWithRelays.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contactsWithRelays.map((contact) => (
              <ContactCard
                key={contact.pubkey}
                pubkey={contact.pubkey}
                relays={contact.relays}
              />
            ))}
          </div>
        )}
      </div>

      <JsonPreviewModal />
    </>
  );
});
