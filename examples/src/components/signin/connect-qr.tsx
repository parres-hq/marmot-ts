import { useEffect, useState } from "react";
import { NostrConnectSigner } from "applesauce-signers";
import { NostrConnectAccount } from "applesauce-accounts/accounts";
import accountManager from "../../lib/accounts";

// Simple QR code component using an API
const QRCode = ({ data }: { data: string }) => (
  <div className="flex items-center justify-center p-4 bg-white rounded-lg">
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`}
      alt="QR Code"
      className="w-48 h-48"
    />
  </div>
);

export default function SignerConnectQR() {
  const [nostrConnectUri, setNostrConnectUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Generate QR code automatically when component mounts
    const handleQrCodeLogin = async () => {
      try {
        setError(null);
        setIsConnecting(true);

        // Create a new signer for QR code login
        const signer = new NostrConnectSigner({
          relays: ["wss://relay.nsec.app"],
        });

        // Generate QR code URI with metadata
        const uri = signer.getNostrConnectURI({
          name: "Marmot Examples",
        });

        setNostrConnectUri(uri);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 1 minute timeout

        try {
          // Wait for signer to connect
          await signer.waitForSigner(controller.signal);
          clearTimeout(timeoutId);

          // Get the public key
          const pubkey = await signer.getPublicKey();

          // Create a NostrConnectAccount
          const account = new NostrConnectAccount(pubkey, signer);

          // Add the account to the account manager
          accountManager.addAccount(account);

          // Set it as the active account
          accountManager.setActive(account.id);

          // Close the modal
          (
            document.getElementById("signin_modal") as HTMLDialogElement
          )?.close();

          setNostrConnectUri(null);
        } catch (err) {
          console.error("Wait for signer error:", err);
          if (err instanceof Error && err.message === "Aborted") {
            setError("Connection timeout. Please try again.");
          } else {
            setError(err instanceof Error ? err.message : "Failed to connect");
          }
          setNostrConnectUri(null);
        }
      } catch (err) {
        console.error("QR code login error:", err);
        setError(err instanceof Error ? err.message : "QR code login failed");
        setNostrConnectUri(null);
      } finally {
        setIsConnecting(false);
      }
    };

    handleQrCodeLogin();
  }, []);

  if (isConnecting && !nostrConnectUri) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="font-semibold mb-2">Generating QR Code</h3>
          <p className="text-sm text-base-content/70 mb-4">
            Please wait while we generate your connection code...
          </p>
        </div>

        <div className="flex justify-center items-center h-48">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (nostrConnectUri) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="font-semibold mb-2">Scan with Mobile Signer</h3>
          <p className="text-sm text-base-content/70 mb-4">
            Scan this QR code with your Nostr mobile signer app
          </p>
        </div>

        <a target="_blank" href={nostrConnectUri} rel="noopener noreferrer">
          <QRCode data={nostrConnectUri} />
        </a>

        <p className="text-xs text-base-content/50 text-center">
          Waiting for connection...
        </p>

        {error && (
          <div className="alert alert-error">
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Connect with QR Code</h3>
        <p className="text-sm text-base-content/70 mb-4">
          Use a mobile signer app to scan and connect
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}
