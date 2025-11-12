import localforage from "localforage";
import { BehaviorSubject, combineLatest, map, switchMap } from "rxjs";
import { makeHashImpl } from "ts-mls/crypto/implementation/noble/makeHashImpl.js";
import { KeyPackageStore } from "../../../src/core/key-package-store";
import accounts from "./accounts";

// Create and export a shared KeyPackageStore instance
export const keyPackageStore$ = accounts.active$.pipe(
  map((account) => {
    return new KeyPackageStore(
      localforage.createInstance({
        name: `${account?.pubkey}-key-package-store`,
      }),
      makeHashImpl("SHA-256"),
    );
  }),
);

// Observable that triggers whenever the store changes
const storeChanges$ = new BehaviorSubject<number>(0);

// Helper function to notify about store changes
export function notifyStoreChange() {
  storeChanges$.next(storeChanges$.value + 1);
}

// Observable for the count of key packages in the store
// This will automatically update when the store changes
export const keyPackageCount$ = combineLatest([
  keyPackageStore$,
  storeChanges$,
]).pipe(
  switchMap(([store]) => {
    if (!store) return Promise.resolve(0);
    return store.count();
  }),
);
