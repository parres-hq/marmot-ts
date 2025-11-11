import { bytesToHex } from "@noble/hashes/utils.js";
import { useEffect, useRef, useState } from "react";
import { KeyPackage, PrivateKeyPackage } from "ts-mls";
import { makeHashImpl } from "ts-mls/crypto/implementation/noble/makeHashImpl.js";
import { makeKeyPackageRef } from "ts-mls/keyPackage.js";
import { useObservable } from "../hooks/use-observable";
import { keyPackageStore$ } from "../lib/key-package-store";
import JsonBlock from "./json-block";
import KeyPackageDataView from "./key-package/data-view";

interface StoredKeyPackage {
  hash: string;
  publicPackage: KeyPackage;
  privatePackage: PrivateKeyPackage;
}

export default function KeyPackageStoreModal() {
  const ref = useRef<HTMLDialogElement>(null);
  const keyPackageStore = useObservable(keyPackageStore$);

  const [packages, setPackages] = useState<StoredKeyPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Load packages when modal opens or store changes
  useEffect(() => {
    if (!keyPackageStore) return;

    const loadPackages = async () => {
      setLoading(true);
      try {
        const publicPackages = await keyPackageStore.list();
        const hash = makeHashImpl("SHA-256");

        // Load complete packages with their hashes
        const completePackages = await Promise.all(
          publicPackages.map(async (publicPackage) => {
            const privatePackage =
              await keyPackageStore.getPrivateKey(publicPackage);
            const hashBytes = await makeKeyPackageRef(publicPackage, hash);
            const hashHex = bytesToHex(hashBytes);

            return {
              hash: hashHex,
              publicPackage,
              privatePackage: privatePackage!,
            };
          }),
        );

        setPackages(completePackages);
      } catch (error) {
        console.error("Failed to load key packages:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPackages();
  }, [keyPackageStore]);

  const handleClearAll = async () => {
    if (!keyPackageStore) return;

    const confirmed = window.confirm(
      `Are you sure you want to clear all ${packages.length} key package${packages.length !== 1 ? "s" : ""}? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setClearing(true);
    try {
      await keyPackageStore.clear();
      setPackages([]);
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("keyPackageStoreChanged"));
    } catch (error) {
      console.error("Failed to clear key packages:", error);
      alert("Failed to clear key packages. Check console for details.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <dialog id="key_package_store_modal" className="modal" ref={ref}>
      <div className="modal-box max-w-4xl">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </form>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Local Key Package Store</h3>
          {packages.length > 0 && (
            <button
              className="btn btn-error btn-sm"
              onClick={handleClearAll}
              disabled={clearing}
            >
              {clearing ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Clearing...
                </>
              ) : (
                "Clear All"
              )}
            </button>
          )}
        </div>

        <p className="text-sm opacity-70 mb-4">
          These are the key packages stored locally in your browser for the
          current account.
        </p>

        {/* Content */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : packages.length === 0 ? (
            <div className="alert alert-info">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-current shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span>No key packages stored locally.</span>
            </div>
          ) : (
            <>
              <div className="text-sm opacity-70 mb-2">
                {packages.length} key package{packages.length !== 1 ? "s" : ""}{" "}
                stored
              </div>

              {packages.map((pkg, index) => (
                <details
                  key={pkg.hash}
                  className="collapse bg-base-100 border-base-300 border"
                >
                  <summary className="collapse-title font-semibold">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">
                        Package #{index + 1}
                      </span>
                      <span className="font-mono text-xs opacity-60 truncate ml-2">
                        {pkg.hash.slice(0, 16)}...{pkg.hash.slice(-16)}
                      </span>
                    </div>
                  </summary>

                  <div className="collapse-content text-sm space-y-4">
                    {/* Hash */}
                    <div>
                      <div className="font-semibold mb-1">Hash Reference</div>
                      <code className="text-xs break-all select-all bg-base-200 p-2 rounded block">
                        {pkg.hash}
                      </code>
                    </div>

                    {/* Public Package */}
                    <div>
                      <div className="font-semibold mb-2">Public Package</div>
                      <div className="bg-base-200 p-4 rounded-lg overflow-auto max-h-96">
                        <KeyPackageDataView keyPackage={pkg.publicPackage} />
                      </div>
                    </div>

                    {/* Private Package - Nested expandable */}
                    <details className="collapse bg-base-200 border-base-300 border">
                      <summary className="collapse-title font-semibold text-error">
                        Private Package (Sensitive Data)
                      </summary>
                      <div className="collapse-content">
                        <div className="alert alert-warning mb-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="stroke-current shrink-0 h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          <span className="text-xs">
                            This contains your private keys. Do not share this
                            data.
                          </span>
                        </div>
                        <div className="bg-base-300 p-4 rounded-lg overflow-auto max-h-96 font-mono text-xs">
                          <JsonBlock value={pkg.privatePackage} />
                        </div>
                      </div>
                    </details>
                  </div>
                </details>
              ))}
            </>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
