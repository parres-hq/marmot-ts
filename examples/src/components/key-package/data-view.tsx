import { bytesToHex } from "@noble/hashes/utils.js";
import { KeyPackage } from "ts-mls";

// ============================================================================
// Key Package Data Renderer (handles BigInt and Uint8Array)
// ============================================================================

function renderValue(value: any, depth = 0): any {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  // Handle BigInt
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }

  // Handle Uint8Array
  if (value instanceof Uint8Array) {
    return bytesToHex(value);
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

  return String(value);
}

/**
 * A component that displays the raw MLS key package data structure
 * with proper formatting for BigInt and Uint8Array values
 */
export default function KeyPackageDataView(props: { keyPackage: KeyPackage }) {
  return (
    <div className="font-mono text-xs bg-base-200 py-4 rounded">
      {renderValue(props.keyPackage)}
    </div>
  );
}
