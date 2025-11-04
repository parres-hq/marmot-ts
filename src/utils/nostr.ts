/** Generic nostr event type */
export interface NostrEvent {
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
  pubkey: string;
  id: string;
  sig: string;
}

/** Returns the value of a name / value tag */
export function getTagValue(
  event: NostrEvent,
  name: string,
): string | undefined {
  return event.tags.find((t) => t[0] === name)?.[1];
}
