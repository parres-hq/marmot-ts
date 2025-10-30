import { BehaviorSubject } from "rxjs";

export function parse<T>(value?: string | null): T | undefined {
  if (value === undefined || value === null) return;
  try {
    return JSON.parse(value);
  } catch {}
  return;
}

const DEFAULT_LOOKUP_RELAYS = [
  "wss://purplepag.es/",
  "wss://index.hzrd149.com/",
  "wss://relay.damus.io/",
];

export const lookupRelays$ = new BehaviorSubject<string[]>(
  parse(localStorage["lookup-relays"]) || DEFAULT_LOOKUP_RELAYS,
);

lookupRelays$.subscribe((relays) => {
  localStorage["lookup-relays"] = JSON.stringify(relays);
});
