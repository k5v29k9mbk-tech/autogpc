// Section 889 compliance — pure, UI-free mapping of the GSA SmartPay 889 tool's
// SAM.gov response into the shape Nexus needs: a clean entity summary, a
// compliance verdict, and the FAR 52.204-26(c) representation text that the
// downloadable "Record of Section 889 Representations" reproduces.
//
// FAR Section 889 bars the Government from buying covered telecommunications
// equipment/services (e.g. Huawei, ZTE). A GPC order's "889 Designation" records
// that the cardholder checked the vendor's representation in SAM.gov. We never
// decide compliance ourselves — we surface what the vendor represented.

/** The raw SmartPay/SAM.gov entity, narrowed to the sections we request. */
export type RawEntity = {
  entityRegistration?: {
    ueiSAM?: string | null;
    cageCode?: string | null;
    legalBusinessName?: string | null;
    registrationStatus?: string | null;
    activationDate?: string | null;
    registrationExpirationDate?: string | null;
    exclusionStatusFlag?: string | null; // "Y" | "N"
  } | null;
  coreData?: {
    entityInformation?: { entityURL?: string | null } | null;
    physicalAddress?: {
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      stateOrProvinceCode?: string | null;
      zipCode?: string | null;
      countryCode?: string | null;
    } | null;
  } | null;
  samToolsData?: {
    isSelectable?: boolean;
    eightEightNine?: {
      isCompliant?: boolean;
      statusText?: string | null; // "COMPLIANT" | "NONCOMPLIANT - ..." | "NO REPS & CERTS" ...
      elaboratedStatusText?: string | null;
      farProvisionDate?: string | null; // "OCT 2020"
      farText?: Record<string, string> | null; // keys "52.204-26.c.1", "52.204-26.c.2"
    } | null;
  } | null;
};

export type Section889Compliance = {
  /** True only when the vendor represented "DOES NOT" to both 52.204-26(c)(1) and (2). */
  isCompliant: boolean;
  /** SmartPay's verdict, e.g. "COMPLIANT" or "NONCOMPLIANT - USES COVERED TELECOMMUNICATIONS". */
  statusText: string;
  /** FAR provision revision date, e.g. "OCT 2020". */
  farProvisionDate: string | null;
  /** The two representation paragraphs, when present. */
  farC1: string | null;
  farC2: string | null;
};

export type Section889Entity = {
  uei: string | null;
  cage: string | null;
  legalName: string;
  url: string | null;
  /** Address as display-ready lines (empty when SAM withheld the address). */
  addressLines: string[];
  registrationStatus: string | null;
  /** Dates formatted MM-DD-YYYY to match the SmartPay record; null when absent. */
  activationDate: string | null;
  expirationDate: string | null;
  hasActiveExclusion: boolean;
  /** SmartPay's flag for whether this row is a pickable parent entity. */
  isSelectable: boolean;
  compliance: Section889Compliance;
};

/** ISO "2026-01-02" -> "01-02-2026" (the format the SmartPay PDF prints). */
function toUsDate(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? "").trim());
  return m ? `${m[2]}-${m[3]}-${m[1]}` : null;
}

function addressLines(addr: NonNullable<RawEntity["coreData"]>["physicalAddress"]): string[] {
  if (!addr) return [];
  const lines: string[] = [];
  if (addr.addressLine1?.trim()) lines.push(addr.addressLine1.trim());
  if (addr.addressLine2?.trim()) lines.push(addr.addressLine2.trim());
  const city = addr.city?.trim() ?? "";
  const state = addr.stateOrProvinceCode?.trim() ?? "";
  const zip = addr.zipCode?.trim() ?? "";
  const cityLine = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (addr.countryCode?.trim()) lines.push(addr.countryCode.trim());
  return lines;
}

export function summarizeEntity(raw: RawEntity): Section889Entity {
  const reg = raw.entityRegistration ?? {};
  const nine = raw.samToolsData?.eightEightNine ?? {};
  const far = nine.farText ?? {};
  return {
    uei: reg.ueiSAM ?? null,
    cage: reg.cageCode ?? null,
    legalName: (reg.legalBusinessName ?? "").trim(),
    url: raw.coreData?.entityInformation?.entityURL?.trim() || null,
    addressLines: addressLines(raw.coreData?.physicalAddress),
    registrationStatus: reg.registrationStatus ?? null,
    activationDate: toUsDate(reg.activationDate),
    expirationDate: toUsDate(reg.registrationExpirationDate),
    hasActiveExclusion: (reg.exclusionStatusFlag ?? "N").toUpperCase() === "Y",
    isSelectable: raw.samToolsData?.isSelectable ?? true,
    compliance: {
      isCompliant: nine.isCompliant === true,
      statusText: (nine.statusText ?? nine.elaboratedStatusText ?? "UNSPECIFIED").trim(),
      farProvisionDate: nine.farProvisionDate ?? null,
      farC1: far["52.204-26.c.1"] ?? null,
      farC2: far["52.204-26.c.2"] ?? null,
    },
  };
}

export function summarizeEntities(raw: RawEntity[]): Section889Entity[] {
  return raw.map(summarizeEntity);
}

/** Strip punctuation, collapse whitespace, drop common entity suffixes. */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(GMBH|LLC|L\.?L\.?C|INC|CORP(ORATION)?|CO|LTD|LP|LLP|PLC|AG|SA|SARL)\b/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick the candidate that best matches the extracted vendor name. Prefers an
 * exact normalized match, then a prefix match, then a substring match; among
 * equals, selectable entities win. Returns null when nothing reasonably matches
 * (the caller then asks the cardholder to choose or flags a manual lookup).
 */
export function pickBestMatch(
  entities: Section889Entity[],
  vendor: string,
): Section889Entity | null {
  const target = normalizeName(vendor);
  if (!target || entities.length === 0) return entities[0] ?? null;

  const scored = entities.map((e) => {
    const name = normalizeName(e.legalName);
    let score = 0;
    if (name && name === target) score = 4;
    else if (name && (name.startsWith(target) || target.startsWith(name))) score = 3;
    else if (name && (name.includes(target) || target.includes(name))) score = 2;
    if (e.isSelectable) score += 0.5;
    return { e, score };
  });

  scored.sort((a, b) => b.score - a.score);
  // Require at least a substring hit; otherwise it's not a confident match.
  return scored[0].score >= 2 ? scored[0].e : null;
}
