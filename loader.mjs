/**
 * Custom ES module loader to handle missing .js extensions in ts-mls library imports
 * This fixes compatibility issues between ts-mls and @noble/ciphers packages
 */

export async function resolve(specifier, context, defaultResolve) {
  // Handle @noble/ciphers imports that are missing .js extensions
  if (specifier.startsWith('@noble/ciphers/') && !specifier.endsWith('.js')) {
    const jsSpecifier = specifier + '.js';
    try {
      return await defaultResolve(jsSpecifier, context);
    } catch (error) {
      // If that fails, fall through to default resolution
    }
  }

  // Handle relative imports that are missing .js extensions
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const { parentURL } = context;
    if (parentURL && parentURL.includes('ts-mls')) {
      // For ts-mls internal imports, try adding .js extension
      try {
        const jsSpecifier = specifier + '.js';
        return await defaultResolve(jsSpecifier, context);
      } catch (error) {
        // If that fails, fall through to default resolution
      }
    }
  }

  // Fall back to default resolution
  return defaultResolve(specifier, context);
}
