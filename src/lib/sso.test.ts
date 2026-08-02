// validateRedirectUri is a security boundary: it decides which origins may
// receive a signed-in user's access token. The default allow-list plus the
// https/localhost rule are pinned here.
import { describe, expect, it } from "vitest";
import { validateRedirectUri } from "./sso";

describe("validateRedirectUri", () => {
  it("allows the default partner origin", () => {
    const r = validateRedirectUri("https://test.autogpc.com/callback");
    expect(r).toMatchObject({ ok: true, origin: "https://test.autogpc.com" });
  });

  it("rejects unlisted origins — even https ones", () => {
    expect(validateRedirectUri("https://evil.example/steal").ok).toBe(false);
    // Subdomain of an allowed origin is a DIFFERENT origin.
    expect(validateRedirectUri("https://sub.test.autogpc.com/cb").ok).toBe(false);
  });

  it("rejects http (except localhost), junk, and empty", () => {
    expect(validateRedirectUri("http://test.autogpc.com/cb").ok).toBe(false);
    expect(validateRedirectUri("not a url").ok).toBe(false);
    expect(validateRedirectUri("").ok).toBe(false);
  });
});
