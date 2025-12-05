import { NostrEvent } from "applesauce-core/helpers/event";
import { Filter } from "applesauce-core/helpers/filter";

// Interop Observable interfaces
export interface Observer<T> {
  next: (value: T) => void;
  error: (err: any) => void;
  complete: () => void;
}
export interface Unsubscribable {
  unsubscribe(): void;
}
export interface Subscribable<T> {
  subscribe(observer: Partial<Observer<T>>): Unsubscribable;
}

// Generic Nostr Pool interface
export interface NostrPool {
  /** Publish an event to the given relays */
  publish(relays: string[], event: NostrEvent): Promise<void>;
  /** Open a subscription to the given relays and filters */
  subscription(
    relays: string[],
    filters: Filter | Filter[],
  ): Subscribable<NostrEvent[]>;
}
