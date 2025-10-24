import { relaySet } from "applesauce-core/helpers";
import { createMemo, createSignal, For } from "solid-js";

// Common relay URLs that users might want to use
const COMMON_RELAYS = relaySet([
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
  "wss://nostr.wine",
  "wss://relay.snort.social",
]);

function RelayPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (relay: string) => void;
}) {
  const [customRelayUrl, setCustomRelayUrl] = createSignal("");

  const handleCustomRelaySubmit = () => {
    if (customRelayUrl) {
      props.onSelect(customRelayUrl());
      setCustomRelayUrl("");
    }
  };

  return (
    <dialog class={`modal ${props.isOpen ? "modal-open" : ""}`}>
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Custom Relay</h3>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Custom Relay URL</span>
          </label>
          <div class="join w-full mb-4">
            <input
              type="text"
              placeholder="wss://your-relay.com"
              class="input input-bordered join-item flex-1"
              value={customRelayUrl()}
              onInput={(e) => setCustomRelayUrl(e.currentTarget.value)}
            />
            <button
              class="btn btn-primary join-item"
              onClick={handleCustomRelaySubmit}
              disabled={customRelayUrl() === ""}
            >
              Set
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button onClick={props.onClose}>close</button>
      </form>
    </dialog>
  );
}

export default function RelayPicker(props: {
  value: string;
  onChange: (relay: string) => void;
  common?: string[];
}) {
  const [isModalOpen, setIsModalOpen] = createSignal(false);

  const allRelayOptions = createMemo(() => {
    const common = props.common || COMMON_RELAYS;
    if (!props.value || common.includes(props.value)) return common;
    else return [props.value, ...common];
  });

  const handleSelectChange = (e: Event) => {
    props.onChange((e.target as HTMLSelectElement).value);
  };

  const handleModalSelect = (relay: string) => {
    props.onChange(relay);
    setIsModalOpen(false);
  };

  return (
    <>
      <div class="join">
        <select
          class="select select-bordered join-item"
          value={props.value}
          onChange={handleSelectChange}
        >
          <option value="" disabled>
            Select a relay
          </option>
          <For each={allRelayOptions()}>
            {(relay) => <option value={relay}>{relay}</option>}
          </For>
        </select>
        <button class="btn join-item" onClick={() => setIsModalOpen(true)}>
          Custom
        </button>
      </div>

      <RelayPickerModal
        isOpen={isModalOpen()}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleModalSelect}
      />
    </>
  );
}
