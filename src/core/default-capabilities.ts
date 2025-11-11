import {
  Capabilities,
  defaultCapabilities as mlsDefaultCapabilities,
} from "ts-mls";
import { ensureMarmotCapabilities } from "./capabilities.js";

/**
 * Default capabilities for Marmot key packages.
 *
 * According to MIP-01, key packages MUST signal support for the Marmot Group Data Extension
 * and ratchet_tree in their capabilities to pass validation when being added to groups.
 */
export function defaultCapabilities(): Capabilities {
  let capabilities = mlsDefaultCapabilities();

  // Ensure capabilities include the Marmot Group Data Extension
  capabilities = ensureMarmotCapabilities(capabilities);

  // Only include "basic" credential type (remove "x509" since we don't support it)
  capabilities.credentials = capabilities.credentials.filter(
    (c) => c !== "x509",
  );

  return capabilities;
}
