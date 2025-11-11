import localforage from "localforage";
import { map } from "rxjs";
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
