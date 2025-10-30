import { EMPTY, combineLatest, map, switchMap } from "rxjs";
import {
  KEY_PACKAGE_RELAY_LIST_KIND,
  getKeyPackageRelayList,
} from "../../../../src";
import { UserAvatar, UserName } from "../../components/nostr-user";
import { withSignIn } from "../../components/withSignIn";
import { useObservableMemo } from "../../hooks/use-observable";
import accounts from "../../lib/accounts";
import { eventStore } from "../../lib/nostr";

const contacts$ = accounts.active$.pipe(
  switchMap((account) =>
    account ? eventStore.contacts(account.pubkey) : EMPTY,
  ),
);

function ContactCard(props: { pubkey: string; relays: string[] }) {
  return (
    <div className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        <div className="flex items-center gap-3 mb-3">
          <UserAvatar pubkey={props.pubkey} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              <UserName pubkey={props.pubkey} />
            </h3>
          </div>
        </div>
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
          <div className="stat-value text-primary">{contacts?.length ?? 0}</div>
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
  );
});
