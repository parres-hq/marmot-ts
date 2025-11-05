import localforage from "localforage";
import { KeyPackageStore } from "../../../src/core/key-package-store";

// Create a localforage instance for key packages
const localForageInstance = localforage.createInstance({
  name: "marmot-ts",
  storeName: "keyPackages",
  description: "Storage for MLS key packages",
});

// Create and export a shared KeyPackageStore instance
export const keyPackageStore = new KeyPackageStore(localForageInstance);
