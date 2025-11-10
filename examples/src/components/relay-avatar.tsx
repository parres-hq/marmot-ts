import { useMemo } from "react";
import { useObservableMemo } from "../hooks/use-observable";
import { pool } from "../lib/nostr";

interface RelayAvatarProps {
  relay: string;
  size?: "sm" | "md";
}

export default function RelayAvatar({ relay, size = "md" }: RelayAvatarProps) {
  const info = useObservableMemo(() => pool.relay(relay).information$, [relay]);
  const sizeClass = size === "sm" ? "w-6 h-6" : "w-8 h-8";

  const url = useMemo(() => {
    if (info?.icon) return info.icon;

    // Convert wss:// to https:// and ws:// to http://
    const httpUrl = relay
      .replace(/^wss:\/\//, "https://")
      .replace(/^ws:\/\//, "http://")
      .replace(/\/$/, "");

    return `${httpUrl}/favicon.ico`;
  }, [relay, info]);

  return (
    <div className="avatar">
      <div className={`${sizeClass} rounded`}>
        <img src={url} alt={`${relay}-icon`} />
      </div>
    </div>
  );
}
