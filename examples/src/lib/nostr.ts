import { EventStore } from "applesauce-core";
import {
  createAddressLoader,
  createEventLoader,
} from "applesauce-loaders/loaders";
import { RelayPool } from "applesauce-relay";
import { extraRelays$, lookupRelays$ } from "./settings";

// Create in-memory event store
export const eventStore = new EventStore();

// Create relay connection pool
export const pool = new RelayPool();

// Create loaders for loading events and replaceable events
const addressLoader = createAddressLoader(pool, {
  lookupRelays: lookupRelays$,
  // Pass extra relays to the loader so they are always used
  extraRelays: extraRelays$,
});
const eventLoader = createEventLoader(pool, {
  // Pass extra relays to the loader so they are always used
  extraRelays: extraRelays$,
});

// Attach loaders to event store
eventStore.replaceableLoader = addressLoader;
eventStore.addressableLoader = addressLoader;
eventStore.eventLoader = eventLoader;

if (import.meta.env.DEV) {
  // @ts-ignore
  window.eventStore = eventStore;
}
