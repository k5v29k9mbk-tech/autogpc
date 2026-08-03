import { describe, expect, it } from "vitest";
import { usBankOrderUrl } from "./usbankClient";

const APP = "https://test.autogpc.com/app.html#/orders";

describe("usBankOrderUrl", () => {
  it("deep-links to the order, replacing whatever hash the env var carries", () => {
    expect(usBankOrderUrl("AUTO123", APP)).toBe(
      "https://test.autogpc.com/app.html#/orders/view/AUTO123",
    );
  });

  it("falls back to the order list when there is no control number", () => {
    // #/orders is not a route in the clone — it renders the dashboard instead.
    expect(usBankOrderUrl("", APP)).toBe("https://test.autogpc.com/app.html#/orders/manage");
  });

  it("is null when the app URL isn't configured", () => {
    // "" not undefined: an explicit undefined falls back to the env default.
    expect(usBankOrderUrl("AUTO123", "")).toBeNull();
  });
});
