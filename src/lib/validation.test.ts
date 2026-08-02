import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  passwordStrength,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirm,
} from "./validation";

describe("validateName", () => {
  it("requires a non-blank value, naming the field", () => {
    expect(validateName("Ada", "First name")).toBeNull();
    expect(validateName("  ", "First name")).toMatch(/First name/);
  });
});

describe("validateEmail", () => {
  it("accepts a plausible address and rejects junk", () => {
    expect(validateEmail("a@b.co")).toBeNull();
    expect(validateEmail("")).not.toBeNull();
    expect(validateEmail("not-an-email")).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("enforces length + letter + number", () => {
    expect(validatePassword("abcd1234")).toBeNull();
    expect(validatePassword("short1")).not.toBeNull();
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).not.toBeNull(); // no number
    expect(validatePassword("1".repeat(MIN_PASSWORD_LENGTH))).not.toBeNull(); // no letter
  });
});

describe("validatePasswordConfirm", () => {
  it("requires a match", () => {
    expect(validatePasswordConfirm("abcd1234", "abcd1234")).toBeNull();
    expect(validatePasswordConfirm("abcd1234", "different1")).not.toBeNull();
    expect(validatePasswordConfirm("abcd1234", "")).not.toBeNull();
  });
});

describe("passwordStrength", () => {
  it("orders weak < fair < strong", () => {
    expect(passwordStrength("abc")).toBe("weak");
    expect(passwordStrength("abcd1234")).toBe("weak"); // passes validation, still weak
    expect(passwordStrength("Abcd1234")).toBe("fair");
    expect(passwordStrength("Str0ng!Passphrase#2026")).toBe("strong");
  });
});
