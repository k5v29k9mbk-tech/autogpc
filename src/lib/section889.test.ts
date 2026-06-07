import { describe, expect, it } from "vitest";
import { summarizeEntity, pickBestMatch, type RawEntity } from "./section889";

// Shaped after the live SmartPay 889 response for "sarcom".
function sarcomGmbH(over: Partial<RawEntity> = {}): RawEntity {
  return {
    entityRegistration: {
      ueiSAM: "DPNYTAABVXL6",
      cageCode: "D3255",
      legalBusinessName: "SARCOM GmbH",
      registrationStatus: "Active",
      activationDate: "2026-01-02",
      registrationExpirationDate: "2027-01-02",
      exclusionStatusFlag: "N",
    },
    coreData: {
      entityInformation: { entityURL: "sarcom.de" },
      physicalAddress: {
        addressLine1: "Katharina-Loth-Str. 7",
        city: "St. Ingbert",
        zipCode: "66386",
        countryCode: "DEU",
      },
    },
    samToolsData: {
      isSelectable: true,
      eightEightNine: {
        isCompliant: true,
        statusText: "COMPLIANT",
        farProvisionDate: "OCT 2020",
        farText: {
          "52.204-26.c.1": "(1) The Offeror represents that it DOES NOT provide covered telecommunications equipment...",
          "52.204-26.c.2": "(2) After conducting a reasonable inquiry... the offeror represents that it DOES NOT use...",
        },
      },
    },
    ...over,
  };
}

describe("summarizeEntity", () => {
  it("maps registration, address, dates, and the 889 verdict", () => {
    const e = summarizeEntity(sarcomGmbH());
    expect(e.legalName).toBe("SARCOM GmbH");
    expect(e.uei).toBe("DPNYTAABVXL6");
    expect(e.cage).toBe("D3255");
    expect(e.url).toBe("sarcom.de");
    expect(e.addressLines).toEqual(["Katharina-Loth-Str. 7", "St. Ingbert, 66386", "DEU"]);
    expect(e.activationDate).toBe("01-02-2026"); // ISO -> MM-DD-YYYY
    expect(e.expirationDate).toBe("01-02-2027");
    expect(e.hasActiveExclusion).toBe(false);
    expect(e.compliance.isCompliant).toBe(true);
    expect(e.compliance.statusText).toBe("COMPLIANT");
    expect(e.compliance.farProvisionDate).toBe("OCT 2020");
    expect(e.compliance.farC1).toMatch(/DOES NOT provide/);
    expect(e.compliance.farC2).toMatch(/DOES NOT use/);
  });

  it("passes a noncompliant verdict and an active exclusion through", () => {
    const e = summarizeEntity(
      sarcomGmbH({
        entityRegistration: {
          ...sarcomGmbH().entityRegistration!,
          exclusionStatusFlag: "Y",
        },
        samToolsData: {
          isSelectable: true,
          eightEightNine: {
            isCompliant: false,
            statusText: "NONCOMPLIANT - USES COVERED TELECOMMUNICATIONS",
          },
        },
      }),
    );
    expect(e.compliance.isCompliant).toBe(false);
    expect(e.compliance.statusText).toBe("NONCOMPLIANT - USES COVERED TELECOMMUNICATIONS");
    expect(e.hasActiveExclusion).toBe(true);
  });
});

describe("pickBestMatch", () => {
  const gmbh = summarizeEntity(sarcomGmbH());
  const metrics = summarizeEntity(
    sarcomGmbH({ entityRegistration: { ...sarcomGmbH().entityRegistration!, legalBusinessName: "SARCOMETRICS, LLC", ueiSAM: "N78GZLL66276" } }),
  );

  it("prefers the exact-ish vendor over a longer near-name", () => {
    expect(pickBestMatch([metrics, gmbh], "SARCOM GmbH")?.uei).toBe("DPNYTAABVXL6");
    expect(pickBestMatch([metrics, gmbh], "sarcom")?.uei).toBe("DPNYTAABVXL6");
  });

  it("returns null when nothing reasonably matches", () => {
    expect(pickBestMatch([metrics, gmbh], "Walmart")).toBeNull();
  });
});
