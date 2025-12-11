import { firstValueFrom } from "rxjs";
import { groupStore$ } from "./group-store";
import { keyPackageStore$ } from "./key-package-store";
import { pool } from "./nostr";
import accounts from "./accounts";
import { MarmotClient } from "../../../src";
import { NostrPool, PublishResponse } from "../../../src/client/interfaces";
import { Filter, NostrEvent } from "applesauce-core/helpers";
import { RelayPool } from "applesauce-relay";

/**
 * Simple adapter to convert RelayPool to NostrPool interface
 */
class NostrPoolAdapter implements NostrPool {
  constructor(private relayPool: RelayPool) {}

  async publish(
    relays: string[],
    event: NostrEvent,
  ): Promise<Record<string, PublishResponse>> {
    const responses = await this.relayPool.publish(relays, event);

    // Convert array to record format
    const record: Record<string, PublishResponse> = {};
    for (const response of responses) {
      record[response.from] = response;
    }
    return record;
  }

  async request(relays: string[], filters: Filter): Promise<NostrEvent[]> {
    // Use firstValueFrom to convert Observable to Promise
    const result = await firstValueFrom(
      this.relayPool.request(relays, filters),
    );
    return Array.isArray(result)
      ? (result as NostrEvent[])
      : [result as NostrEvent];
  }

  subscription(relays: string[], filters: Filter) {
    const relayPool = this.relayPool;
    return {
      subscribe(observer: any) {
        // Create a subscription using the relay pool
        const subscription = relayPool.subscription(relays, filters).subscribe({
          next: (value: any) =>
            observer.next?.(Array.isArray(value) ? value : [value]),
          error: (err: any) => observer.error?.(err),
          complete: () => observer.complete?.(),
        });

        return {
          unsubscribe: () => subscription.unsubscribe(),
        };
      },
    };
  }
}

/**
 * Creates a MarmotClient instance using the current active account and stores.
 * This is a helper for the examples to avoid recreating the client.
 */
export async function getMarmotClient() {
  const account = accounts.active;
  if (!account) {
    throw new Error("No active account");
  }

  const groupStore = await firstValueFrom(groupStore$);
  const keyPackageStore = await firstValueFrom(keyPackageStore$);

  if (!groupStore || !keyPackageStore) {
    throw new Error("Stores not initialized");
  }

  return new MarmotClient({
    signer: account.signer,
    groupStore,
    keyPackageStore,
    pool: new NostrPoolAdapter(pool),
  });
}
