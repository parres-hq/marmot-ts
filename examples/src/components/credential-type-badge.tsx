import { CredentialTypeName } from "ts-mls/credentialType.js";
import { greaseValues } from "ts-mls/grease.js";

// Credential types from ts-mls
const credentialTypes = {
  basic: 1,
  x509: 2,
} as const;

interface CredentialTypeBadgeProps {
  credentialType: CredentialTypeName | number;
  className?: string;
}

/**
 * A badge component that displays a credential type with its name and hex ID
 */
export default function CredentialTypeBadge({
  credentialType,
  className = "",
}: CredentialTypeBadgeProps) {
  // Handle both string names and numeric IDs
  let credentialTypeId: number;
  let credentialTypeName: string;

  if (typeof credentialType === "string") {
    // It's a string name like "basic" or "x509"
    credentialTypeName = credentialType;
    credentialTypeId =
      credentialTypes[credentialType as keyof typeof credentialTypes] ?? 0;
  } else {
    // It's a numeric ID
    credentialTypeId = credentialType;
    const isGrease = greaseValues.includes(credentialTypeId);
    credentialTypeName =
      Object.entries(credentialTypes).find(
        ([_, value]) => value === credentialTypeId,
      )?.[0] ?? (isGrease ? "GREASE" : "Unknown");
  }

  // Format the hex ID with 0x prefix
  const hexId = `0x${credentialTypeId.toString(16).padStart(4, "0")}`;

  return (
    <span
      className={`badge badge-outline font-mono whitespace-pre ${className}`}
    >
      {credentialTypeName} ({hexId})
    </span>
  );
}
