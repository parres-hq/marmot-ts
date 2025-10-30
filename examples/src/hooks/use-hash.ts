import { useState, useEffect } from "react";

export default function useHash() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const listener = () => setHash(window.location.hash);

    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);

  return hash;
}
