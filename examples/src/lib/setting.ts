import { BehaviorSubject } from "rxjs";

const DEFAULT_LOOKUP_RELAYS = [
  "wss://purplepag.es/",
  "wss://index.hzrd149.com/",
  "wss://relay.damus.io/",
];

export const lookupRelays$ = new BehaviorSubject<string[]>(
  (localStorage["lookup-relays"] &&
    JSON.parse(localStorage["lookup-relays"])) ||
    DEFAULT_LOOKUP_RELAYS,
);

lookupRelays$.subscribe((relays) => {
  localStorage["lookup-relays"] = JSON.stringify(relays);
});
