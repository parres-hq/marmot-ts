import { defaultExtensionTypes, ExtensionType } from "ts-mls";
import { greaseValues } from "ts-mls/grease.js";

interface ExtensionBadgeProps {
  extensionType: ExtensionType;
  className?: string;
}

/**
 * A badge component that displays an extension type ID with a tooltip showing its name
 */
export default function ExtensionBadge({
  extensionType,
  className = "",
}: ExtensionBadgeProps) {
  // Convert to number if needed
  const extensionTypeId =
    typeof extensionType === "number"
      ? extensionType
      : defaultExtensionTypes[extensionType];

  const isGrease = greaseValues.includes(extensionTypeId);

  // Find the extension name from the defaultExtensionTypes map
  const extensionName =
    Object.entries(defaultExtensionTypes).find(
      ([_, value]) => value === extensionTypeId,
    )?.[0] ?? (isGrease ? "GREASE" : "Unknown");

  // Format the hex ID with 0x prefix
  const hexId = `0x${extensionTypeId.toString(16).padStart(4, "0")}`;

  return (
    <span
      className={`badge badge-outline font-mono whitespace-pre ${className}`}
    >
      {extensionName} ({hexId})
    </span>
  );
}
