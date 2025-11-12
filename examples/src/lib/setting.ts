import { BehaviorSubject, map } from "rxjs";
import { relaySet } from "applesauce-core/helpers";

export function parse<T>(value?: string | null): T | undefined {
  if (value === undefined || value === null) return;
  try {
    return JSON.parse(value);
  } catch {}
  return;
}

// Default relay configurations
const DEFAULT_LOOKUP_RELAYS = [
  "wss://purplepag.es/",
  "wss://index.hzrd149.com/",
];

const DEFAULT_COMMON_RELAYS = relaySet([
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
  "wss://nostr.wine",
  "wss://relay.snort.social",
]);

// Global relay configuration
export interface RelayConfig {
  lookupRelays: string[];
  commonRelays: string[];
  manualRelays: string[];
}

const DEFAULT_RELAY_CONFIG: RelayConfig = {
  lookupRelays: DEFAULT_LOOKUP_RELAYS,
  commonRelays: DEFAULT_COMMON_RELAYS,
  manualRelays: [],
};

// Load relay configuration from localStorage
const storedConfig = parse<RelayConfig>(localStorage["relay-config"]);
const initialConfig = storedConfig || DEFAULT_RELAY_CONFIG;

// Observable for the global relay configuration
export const relayConfig$ = new BehaviorSubject<RelayConfig>(initialConfig);

// Subscribe to save changes to localStorage
relayConfig$.subscribe((config) => {
  localStorage["relay-config"] = JSON.stringify(config);
});

// Helper functions for updating specific parts of the configuration
export function updateLookupRelays(relays: string[]) {
  const current = relayConfig$.value;
  relayConfig$.next({
    ...current,
    lookupRelays: relays,
  });
}

export function updateCommonRelays(relays: string[]) {
  const current = relayConfig$.value;
  relayConfig$.next({
    ...current,
    commonRelays: relays,
  });
}

export function updateManualRelays(relays: string[]) {
  const current = relayConfig$.value;
  relayConfig$.next({
    ...current,
    manualRelays: relays,
  });
}

export function addManualRelay(relay: string) {
  const current = relayConfig$.value;
  const newManualRelays = [...new Set([...current.manualRelays, relay])];
  relayConfig$.next({
    ...current,
    manualRelays: newManualRelays,
  });
}

export function removeManualRelay(relay: string) {
  const current = relayConfig$.value;
  const newManualRelays = current.manualRelays.filter((r) => r !== relay);
  relayConfig$.next({
    ...current,
    manualRelays: newManualRelays,
  });
}

// Reset functions for each relay type
export function resetLookupRelays() {
  const current = relayConfig$.value;
  relayConfig$.next({
    ...current,
    lookupRelays: DEFAULT_LOOKUP_RELAYS,
  });
}

export function resetCommonRelays() {
  const current = relayConfig$.value;
  relayConfig$.next({
    ...current,
    commonRelays: DEFAULT_COMMON_RELAYS,
  });
}

export function resetManualRelays() {
  const current = relayConfig$.value;
  relayConfig$.next({
    ...current,
    manualRelays: DEFAULT_RELAY_CONFIG.manualRelays,
  });
}

// Backward compatibility - keep lookupRelays$ for existing code
export const lookupRelays$ = relayConfig$.pipe(
  map((config) => config.lookupRelays),
);
