import { useState } from "react";
import { NostrConnectSigner } from "applesauce-signers";
import { NostrConnectAccount } from "applesauce-accounts/accounts";
import accountManager from "../lib/accounts";

export default function BunkerUrlForm() {
  const [bunkerUrl, setBunkerUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!bunkerUrl) return;

    try {
      setIsConnecting(true);
      setError(null);

      // Create signer from bunker URL
      const signer = await NostrConnectSigner.fromBunkerURI(bunkerUrl);

      // Get the public key
      const pubkey = await signer.getPublicKey();

      // Create a NostrConnectAccount
      const account = new NostrConnectAccount(pubkey, signer);

      // Add the account to the account manager
      accountManager.addAccount(account);

      // Set it as the active account
      accountManager.setActive(account.id);

      // Close the modal
      (document.getElementById("signin_modal") as HTMLDialogElement)?.close();

      // Clear the form
      setBunkerUrl("");
    } catch (err) {
      console.error("Connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Connect with Bunker URL</h3>
        <p className="text-sm text-base-content/70 mb-4">
          Enter your bunker:// URL to connect
        </p>
      </div>

      <div className="form-control">
        <input
          type="text"
          placeholder="bunker://..."
          className="input input-bordered w-full"
          value={bunkerUrl}
          onChange={(e) => setBunkerUrl(e.target.value)}
          disabled={isConnecting}
        />
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="text-sm">{error}</span>
        </div>
      )}

      <button
        className="btn btn-primary w-full"
        onClick={handleConnect}
        disabled={!bunkerUrl || isConnecting}
      >
        {isConnecting ? (
          <>
            <span className="loading loading-spinner"></span>
            Connecting...
          </>
        ) : (
          "Connect"
        )}
      </button>
    </div>
  );
}
