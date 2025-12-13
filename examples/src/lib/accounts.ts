import { AccountManager, SerializedAccount } from "applesauce-accounts";
import { registerCommonAccountTypes } from "applesauce-accounts/accounts";
import { NostrConnectSigner } from "applesauce-signers";
import { eventStore, pool } from "./nostr";
import { combineLatest, EMPTY, map, of, switchMap } from "rxjs";
import {
  getKeyPackageRelayList,
  KEY_PACKAGE_RELAY_LIST_KIND,
} from "../../../src";
import { safeParse } from "applesauce-core/helpers";

// create an account manager instance
const accounts = new AccountManager();

// register common account types
registerCommonAccountTypes(accounts);

// Setup nostr connect signer
NostrConnectSigner.pool = pool;

// first load all accounts from localStorage
const json = safeParse<SerializedAccount[]>(
  localStorage.getItem("accounts") ?? "[]",
);
if (json) accounts.fromJSON(json, true);

// next, subscribe to any accounts added or removed
accounts.accounts$.subscribe(() => {
  // save all the accounts into the "accounts" field
  localStorage.setItem("accounts", JSON.stringify(accounts.toJSON()));
});

// load active account from storage
const active = localStorage.getItem("active");
if (active) {
  try {
    accounts.setActive(active);
  } catch (error) {}
}

// subscribe to active changes
accounts.active$.subscribe((account) => {
  if (account) localStorage.setItem("active", account.id);
  else localStorage.removeItem("active");
});

/** An observable of the current account's mailboxes */
export const mailboxes$ = accounts.active$.pipe(
  switchMap((account) =>
    account ? eventStore.mailboxes(account.pubkey) : EMPTY,
  ),
);

/** Observable of current user's key package relay list */
export const keyPackageRelays$ = combineLatest([
  accounts.active$,
  mailboxes$,
]).pipe(
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
      : of(undefined),
  ),
);

export default accounts;
