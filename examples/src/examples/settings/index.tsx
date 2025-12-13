import { useObservable } from "../../hooks/use-observable";
import { lookupRelays$, extraRelays$ } from "../../lib/settings";
import { RelayListCreator } from "../../components/form/relay-list-creator";

export default function Settings() {
  const lookupRelays = useObservable(lookupRelays$) || [];
  const extraRelays = useObservable(extraRelays$) || [];

  const handleLookupRelaysChange = (relays: string[]) => {
    lookupRelays$.next(relays);
  };

  const handleExtraRelaysChange = (relays: string[]) => {
    extraRelays$.next(relays);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p>Manage your relay configurations for the application.</p>
      </div>

      {/* Lookup Relays Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Lookup Relays</h2>
          <p className="text-base-content/70 text-sm">
            Relays used for discovering user profiles and relay lists. These
            relays are queried when looking up user information.
          </p>
        </div>
        <RelayListCreator
          relays={lookupRelays}
          label="Lookup Relays"
          placeholder="wss://relay.example.com"
          emptyMessage="No lookup relays configured. Add relays below to enable user discovery."
          onRelaysChange={handleLookupRelaysChange}
        />
      </div>

      {/* Extra Relays Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Extra Relays</h2>
          <p className="text-base-content/70 text-sm">
            Extra relays that are always used when fetching events across the
            application. These relays are included in addition to any other
            specified relays.
          </p>
        </div>
        <RelayListCreator
          relays={extraRelays}
          label="Extra Relays"
          placeholder="wss://relay.example.com"
          emptyMessage="No extra relays configured. Add relays below to always include them when fetching events."
          onRelaysChange={handleExtraRelaysChange}
        />
      </div>
    </div>
  );
}
