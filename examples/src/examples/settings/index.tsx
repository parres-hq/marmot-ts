import { npubEncode } from "nostr-tools/nip19";
import { RelayListCreator } from "../../components/form/relay-list-creator";
import { UserAvatar, UserName } from "../../components/nostr-user";
import QRButton from "../../components/qr-button";
import { useObservable } from "../../hooks/use-observable";
import accountManager from "../../lib/accounts";
import { extraRelays$, lookupRelays$ } from "../../lib/settings";

function AccountManagement() {
  const accounts = useObservable(accountManager.accounts$) || [];
  const activeAccount = useObservable(accountManager.active$);

  const handleAddAccount = () => {
    (document.getElementById("signin_modal") as HTMLDialogElement)?.showModal();
  };

  const handleSwitchAccount = (accountId: string) => {
    accountManager.setActive(accountId);
  };

  const handleRemoveAccount = (accountId: string) => {
    if (confirm("Are you sure you want to remove this account?")) {
      accountManager.removeAccount(accountId);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">Accounts</h2>
        <p className="text-base-content/70 text-sm">
          Manage your accounts. Switch between accounts or add new ones.
        </p>
      </div>
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="text-base-content/70 text-sm">
            No accounts configured. Add an account to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const isActive = activeAccount?.id === account.id;
              return (
                <div
                  key={account.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-base-300 bg-base-200"
                  }`}
                >
                  <UserAvatar pubkey={account.pubkey} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      <UserName pubkey={account.pubkey} />
                    </div>
                    <div className="text-xs text-base-content/60 truncate">
                      {account.pubkey.slice(0, 8)}...{account.pubkey.slice(-8)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="join">
                      <QRButton
                        data={npubEncode(account.pubkey)}
                        label="npub"
                        className="btn-ghost btn-sm join-item"
                      />
                      <QRButton
                        data={account.pubkey}
                        label="hex"
                        className="btn-ghost btn-sm join-item"
                      />
                    </div>
                    <button
                      className={`btn ${isActive ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => handleSwitchAccount(account.id)}
                      disabled={isActive}
                    >
                      Switch
                    </button>
                    <button
                      className="btn btn-ghost text-error"
                      onClick={() => handleRemoveAccount(account.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button className="btn btn-primary w-full" onClick={handleAddAccount}>
          Add Account
        </button>
      </div>
    </div>
  );
}

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

      {/* Account Management Section */}
      <AccountManagement />

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
