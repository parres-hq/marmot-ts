import fs from "fs";
import { createRequire } from "module";
import path from "path";

// This is a very ugly hack to update the ts-mls package.json exports field to include all the files in the dist directory.
// THIS SHOULD BE REMOVED WHEN PR #130 is merged
// https://github.com/LukaJCB/ts-mls/pull/130

const require = createRequire(import.meta.url);

try {
  // Use Node.js module resolution to find the ts-mls package
  const packagePath = path.resolve(
    require.resolve("ts-mls"),
    "../../package.json",
  );

  console.log("Found ts-mls package.json at:", packagePath);

  // Read the current package.json
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  console.log(
    "Current exports field:",
    JSON.stringify(packageJson.exports, null, 2),
  );

  // Fix the exports field - add proper subpath exports
  packageJson.exports = {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
      default: "./dist/index.js",
    },
    "./*.js": {
      types: "./dist/*.d.ts",
      import: "./dist/*.js",
      default: "./dist/*.js",
    },
  };

  // Write the modified package.json back
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

  console.log("✅ Successfully updated ts-mls package.json exports field");
  console.log(
    "New exports field:",
    JSON.stringify(packageJson.exports, null, 2),
  );
} catch (error) {
  console.error("❌ Error modifying ts-mls package.json:", error.message);
  process.exit(1);
}
