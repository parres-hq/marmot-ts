import examples from "../examples";
import { createSignal, For } from "solid-js";
import useHash from "../hooks/use-hash";

export default function SideNav() {
  const [searchTerm, setSearchTerm] = createSignal<string>("");
  const hash = useHash();

  const filtered = examples.filter((item) =>
    item.id.toLowerCase().includes(searchTerm().toLowerCase()),
  );

  return (
    <div class="drawer-side">
      <label
        for="drawer"
        aria-label="open sidebar"
        class="drawer-overlay"
      ></label>
      <div class="menu bg-base-200 text-base-content min-h-full">
        <input
          type="text"
          placeholder="Search..."
          class="input input-bordered w-full"
          value={searchTerm()}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <ul class="menu menu-lg px-0 font-mono w-xs">
          <For each={filtered}>
            {(item) => (
              <li>
                <a
                  href={"#" + item.id}
                  class={
                    "text-sm " + (hash() === "#" + item.id ? "menu-active" : "")
                  }
                >
                  {item.name}
                </a>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}
