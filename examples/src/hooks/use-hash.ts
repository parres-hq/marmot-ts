import { createSignal, onCleanup, onMount } from "solid-js";

export default function useHash() {
  const [hash, setHash] = createSignal(window.location.hash);

  onMount(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", handleHashChange);

    onCleanup(() => {
      window.removeEventListener("hashchange", handleHashChange);
    });
  });

  return hash;
}
