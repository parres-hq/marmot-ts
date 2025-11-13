import { bytesToHex } from "@noble/hashes/utils.js";
import { ReactNode } from "react";
import { KeyPackage, PrivateKeyPackage } from "ts-mls";

// ============================================================================
// Key Package Data Renderer (handles BigInt and Uint8Array)
// ============================================================================

function renderValue(value: any, depth = 0): ReactNode {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  // Handle BigInt
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }

  // Handle Uint8Array
  if (value instanceof Uint8Array) {
    return <code className="select-all">{bytesToHex(value)}</code>;
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return (
      <div className="ml-4">
        {value.map((item, index) => (
          <div key={index}>
            <span className="text-base-content/60">[{index}]:</span>{" "}
            {renderValue(item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  // Handle Objects
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return (
      <div className={depth > 0 ? "ml-4 space-y-1" : "space-y-1"}>
        {entries.map(([key, val]) => (
          <div key={key}>
            <span className="text-primary font-semibold">{key}:</span>{" "}
            {renderValue(val, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  // Handle primitives
  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (typeof value === "number") {
    // Return number as 0x hex string
    return `0x${value.toString(16).padStart(4, "0")}`;
  }

  return String(value);
}

/**
 * A component that displays the raw MLS key package data structure
 * with proper formatting for BigInt and Uint8Array values
 */
export default function KeyPackageDataView(props: {
  keyPackage: KeyPackage | PrivateKeyPackage;
}) {
  return (
    <div className="font-mono text-xs rounded break-all">
      {renderValue(props.keyPackage)}
    </div>
  );
}
