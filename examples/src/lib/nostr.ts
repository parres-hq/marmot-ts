import { EventStore } from "applesauce-core";
import {
  createAddressLoader,
  createEventLoader,
} from "applesauce-loaders/loaders";
import { RelayPool } from "applesauce-relay";
import { lookupRelays$ } from "./setting";

// Create in-memory event store
export const eventStore = new EventStore();

// Create relay connection pool
export const pool = new RelayPool();

// Create loaders for loading events and replaceable events
const addressLoader = createAddressLoader(pool, {
  lookupRelays: lookupRelays$,
});
const eventLoader = createEventLoader(pool);

// Attach loaders to event store
eventStore.replaceableLoader = addressLoader;
eventStore.addressableLoader = addressLoader;
eventStore.eventLoader = eventLoader;

if (import.meta.env.DEV) {
  // @ts-ignore
  window.eventStore = eventStore;
}
