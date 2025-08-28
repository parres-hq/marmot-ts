import {describe, it, expect} from "vitest"
import {f} from "../src/index"

describe("f", () => {
  it("should return undefined", () => {
    expect(f()).toBeUndefined()
  })
})
