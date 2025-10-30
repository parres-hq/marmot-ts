import { useRef, useState } from "react";
import BunkerUrlForm from "./BunkerUrlForm";
import SignerConnectQR from "./SignerConnectQR";
import ExtensionSignIn from "./ExtensionSignIn";

export default function SignInModal() {
  const ref = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<"extension" | "bunker" | "qr">(
    "extension",
  );

  const handleSuccess = () => {
    ref.current?.close();
  };

  return (
    <dialog id="signin_modal" className="modal" ref={ref}>
      <div className="modal-box max-w-lg">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </form>

        <h3 className="font-bold text-lg mb-4">Sign In</h3>

        {/* Tabs */}
        <div role="tablist" className="tabs tabs-border mb-6">
          <button
            role="tab"
            className={`tab ${activeTab === "extension" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("extension")}
          >
            Extension
          </button>
          <button
            role="tab"
            className={`tab ${activeTab === "bunker" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("bunker")}
          >
            Bunker
          </button>
          <button
            role="tab"
            className={`tab ${activeTab === "qr" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("qr")}
          >
            QR Code
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "extension" && (
            <ExtensionSignIn onSuccess={handleSuccess} />
          )}

          {activeTab === "bunker" && <BunkerUrlForm />}

          {activeTab === "qr" && <SignerConnectQR />}
        </div>
      </div>
    </dialog>
  );
}
