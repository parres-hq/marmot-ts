import { describe, expect, it } from "vitest";
import * as exports from "../index.js";

describe("exports", () => {
  it("should export the expected members", () => {
    expect(Object.keys(exports).sort()).toMatchInlineSnapshot(`
      [
        "Marmot",
        "ciphersuite",
        "defaultExtensions",
      ]
    `);
  });
});
