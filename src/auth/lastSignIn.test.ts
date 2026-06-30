import { describe, expect, it } from "vitest";
import { parseMethod } from "./lastSignIn";

describe("parseMethod", () => {
  it("accepts known methods", () => {
    expect(parseMethod("password")).toBe("password");
    expect(parseMethod("google")).toBe("google");
    expect(parseMethod("apple")).toBe("apple");
  });

  it("rejects junk and null", () => {
    expect(parseMethod(null)).toBeNull();
    expect(parseMethod("")).toBeNull();
    expect(parseMethod("Password")).toBeNull();
    expect(parseMethod("facebook")).toBeNull();
  });
});
