import { useRef, useState } from "react";
import SignerBunker from "./bunker";
import SignerConnectQR from "./connect-qr";
import ExtensionSignIn from "./extension";
import NewUser from "./new-user";

export default function SignInModal() {
  const ref = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<
    "extension" | "bunker" | "qr" | "newuser"
  >("newuser");

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
            className={`tab ${activeTab === "newuser" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("newuser")}
          >
            New User
          </button>
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
          {activeTab === "newuser" && <NewUser onSuccess={handleSuccess} />}
          {activeTab === "extension" && (
            <ExtensionSignIn onSuccess={handleSuccess} />
          )}
          {activeTab === "bunker" && <SignerBunker />}
          {activeTab === "qr" && <SignerConnectQR />}
        </div>
      </div>
    </dialog>
  );
}
