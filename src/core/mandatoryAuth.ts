// The Ramstein 700 CONS "Mandatory Authorization Directory" as data.
//
// Each entry is an item type that needs extra authorization before a GPC
// purchase: which approval/doc is required, who approves, and the keywords that
// flag it on a receipt/quote. Detection is a deliberately simple keyword match
// the reviewer corrects after the fact (see detectAuthCategories) — auditable,
// no model call. Source: GPC Mandatory Authorization Listing v1 (Aug 2023).
//
// ponytail: keyword heuristic with a known ceiling. The catalog is the upgrade
// path — tune keywords / add entries here; swap in a classifier only if misses
// become a real cost.

import type { DocCategory, LineItem } from "./types";

/** Which US Bank "Special Pre-Approval Obtained" value this item maps to. */
type SpecialPreApproval = "Yes-IT" | "Yes-Hazardous Material" | "Yes-Other-Identify in Comments Fields";

export type AuthCategory = {
  id: string;
  /** Item type as the directory names it. */
  label: string;
  /** Lowercase match terms, tested with word boundaries against item text. */
  keywords: string[];
  /** The document / approval the cardholder must obtain and attach. */
  requiredDoc: string;
  /** Who grants it. */
  authority: string;
  phone?: string;
  /** DAFI 64-117 (or other) reference. */
  reference?: string;
  /** US Bank Special-Pre-Approval value to suggest when this is detected. */
  specialPreApproval: SpecialPreApproval;
};

const CS = "86 CS — Ramstein CIPS Manager";
const CES = "786 CES";

export const AUTH_CATALOG: AuthCategory[] = [
  // ── IT assets (CIPS / 86 CS) ──────────────────────────────────────────────
  {
    id: "it-computers",
    label: "Laptops, desktops & monitors",
    keywords: ["laptop", "notebook", "desktop", "computer", "monitor", "workstation", "all-in-one", "tablet", "ipad"],
    requiredDoc: "CIPS waiver + BECO approval (CCS-3 is the mandatory source)",
    authority: CS,
    phone: "478-2666",
    reference: "DAFI 64-117 Para 7.12.5",
    specialPreApproval: "Yes-IT",
  },
  {
    id: "it-printers",
    label: "Printers & scanners",
    keywords: ["printer", "scanner", "toner", "multifunction", "mfp"],
    requiredDoc: "CIPS waiver (DPI is the mandatory source)",
    authority: CS,
    phone: "478-2666",
    reference: "DAFI 64-117 Para 7.12.5",
    specialPreApproval: "Yes-IT",
  },
  {
    id: "it-peripherals",
    label: "Software, peripherals, networking",
    keywords: [
      "software", "license", "subscription", "keyboard", "mouse", "mice", "headset",
      "speaker", "webcam", "cable", "switch", "router", "server", "docking station",
      "hard drive", "smart tv", "usb",
    ],
    requiredDoc: "CIPS approval (GSA 2GIT mandatory source)",
    authority: CS,
    phone: "478-2666",
    reference: "DAFI 64-117 Para 7.12.5",
    specialPreApproval: "Yes-IT",
  },
  {
    id: "it-cellular",
    label: "Cellular telephones",
    keywords: ["cellular", "cell phone", "smartphone", "iphone", "mobile phone"],
    requiredDoc: "CIPS approval from 86 CS",
    authority: CS,
    phone: "478-2666",
    reference: "DAFI 64-117 Para 7.12.5",
    specialPreApproval: "Yes-IT",
  },
  {
    id: "it-voip",
    label: "VOIP phones",
    keywords: ["voip", "ip phone", "voip phone"],
    requiredDoc: "CIPS approval (GSA 2GIT mandatory source)",
    authority: CS,
    phone: "478-2666",
    reference: "DAFI 64-117 Para 7.12.5",
    specialPreApproval: "Yes-IT",
  },
  {
    id: "it-radios",
    label: "Land Mobile Radios & batteries",
    keywords: ["land mobile radio", "lmr", "two-way radio", "handheld radio"],
    requiredDoc: "CIPS approval from 86 CS (via your unit PWCS manager)",
    authority: "86 CS PWCS manager",
    phone: "480-5137",
    reference: "DAFI 64-117 Para 7.12.5",
    specialPreApproval: "Yes-IT",
  },
  {
    id: "visual-imaging",
    label: "Cameras & video equipment",
    keywords: ["camera", "camcorder", "video equipment", "dslr", "visual information"],
    requiredDoc: "Pre-approval from 86 AW/PA",
    authority: "86 AW/PA",
    phone: "480-9196",
    reference: "DAFI 64-117 Para 7.12.11",
    specialPreApproval: "Yes-IT",
  },
  // ── Hazardous material (EESOH-MIS / 86 LRS) ───────────────────────────────
  {
    id: "hazmat",
    label: "Hazardous / potentially hazardous material",
    keywords: ["fire extinguisher", "battery", "batteries", "hazardous", "hazmat", "aerosol", "paint", "solvent", "chemical"],
    requiredDoc: "Submit through EESOH-MIS",
    authority: "86 LRS/LGRMH (EESOH-MIS access required)",
    phone: "480-6311",
    reference: "DAFI 64-117 Para 7.12.4",
    specialPreApproval: "Yes-Hazardous Material",
  },
  {
    id: "respirators",
    label: "Respirators",
    keywords: ["respirator", "respirators"],
    requiredDoc: "Pre-approval from 86 AMDS/SGPD Bioenvironmental",
    authority: "86 AMDS/SGPD Bioenvironmental",
    phone: "479-2425",
    reference: "DAFI 64-117 Para 7.12.6",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  // ── Other purchases ───────────────────────────────────────────────────────
  {
    id: "appliances",
    label: "Appliances & furnishings",
    keywords: ["microwave", "refrigerator", "fridge", "freezer", "dishwasher", "furnishings", "stove"],
    requiredDoc: "Upload a compliance MFR (DAFMAN 65-605V1 para 5.38). Stoves: 786 CES",
    authority: "786 CES (stoves only)",
    phone: "489-6623",
    reference: "DAFMAN 65-605V1",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "books",
    label: "Books, periodicals & manuals",
    keywords: ["book", "periodical", "magazine", "manual", "publication", "dvd", "online license"],
    requiredDoc: "Pre-approval from 86 FSS/FSDL",
    authority: "86 FSS/FSDL",
    phone: "480-6293",
    reference: "DAFI 64-117 Para 7.12.14",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "clothing",
    label: "Clothing & individual equipment",
    keywords: ["clothing", "uniform", "boots", "apparel", "individual equipment"],
    requiredDoc: "Pre-approval from 86 LRS",
    authority: "86 LRS",
    phone: "480-2400",
    reference: "DAFI 64-117 Para 7.1.13",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "construction",
    label: "Construction / real property (≤ $10k)",
    keywords: ["construction", "carpet", "fence", "landscaping", "shed", "awning", "wallpaper", "flooring", "kitchen installation", "real property"],
    requiredDoc: "Approved AF Form 332 (propriety approval) from 786 CES",
    authority: CES,
    phone: "489-6623",
    reference: "DAFI 64-117 Para 7.12.2",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "safety-equip",
    label: "Material-handling / industrial / PPE / lasers",
    keywords: ["material handling", "forklift", "industrial equipment", "eye-wash", "eyewash", "laser", "ppe", "protective equipment"],
    requiredDoc: "Pre-approval from 86 AW Safety Office",
    authority: "86 AW/SE",
    phone: "480-7233",
    reference: "DAFI 64-117 Para 7.12.17",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "fitness",
    label: "Fitness equipment",
    keywords: ["fitness equipment", "treadmill", "dumbbell", "exercise equipment", "elliptical", "weights"],
    requiredDoc: "Pre-approval from 786 FSS Fitness Manager",
    authority: "786 FSS Fitness Manager",
    phone: "480-0396",
    reference: "DAFI 64-117 Para 7.12.8",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "medical",
    label: "Medical items",
    keywords: ["first aid", "defibrillator", "aed", "medical supply", "bandage"],
    requiredDoc: "Pre-approval from Base Medical Supply Officer",
    authority: "Base Medical Supply Officer",
    phone: "479-2222",
    reference: "DAFI 64-117 Para 7.12.6",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "printing-services",
    label: "Printing / copying services",
    keywords: ["printing service", "copying service", "duplicating", "print service"],
    requiredDoc: "DLA-DS (Document Services) is the mandatory source",
    authority: "DLA-DS (Document Services)",
    phone: "324-408-9509",
    reference: "DAFI 64-117 Para 7.12.12",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "professional-services",
    label: "Professional services",
    keywords: ["accountant", "lawyer", "attorney", "architect", "engineer", "physician", "dentist", "professional service"],
    requiredDoc: "Pre-approval from 700 CONS/PKA",
    authority: "700 CONS/PKA",
    phone: "489-6800",
    reference: "DAFI 64-117 Para 7.12.15",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "climate",
    label: "Space heaters / air conditioning",
    keywords: ["space heater", "air conditioner", "air conditioning"],
    requiredDoc: "Fill out AF Form 679 (A/C: submit in TRIRIGA)",
    authority: CES,
    phone: "489-6623",
    reference: "RAB Instruction 32-9001",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "tmde",
    label: "Test, Measuring & Diagnostic Equipment",
    keywords: ["tmde", "multimeter", "oscilloscope", "caliper", "torque wrench", "calibration"],
    requiredDoc: "Pre-approval from 86 MXS/MXMD (PMEL)",
    authority: "86 MXS/MXMD (PMEL)",
    phone: "480-5525",
    reference: "DAFI 64-117 Para 7.12.19",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "training",
    label: "Commercial off-the-shelf training",
    keywords: ["training", "course", "certification", "sf-182", "seminar"],
    requiredDoc: "SF-182 approval from Base Training Manager",
    authority: "86 FSS",
    phone: "480-0147",
    reference: "DAFI 64-117 Para 7.1.12",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
  {
    id: "vehicles",
    label: "Vehicles & vehicular equipment",
    keywords: ["vehicle", "motorcycle", "atv", "utv", "all-terrain", "golf cart", "gator", "trailer", "low speed vehicle"],
    requiredDoc: "Approved AF 1768 + pre-approval from 86 AW Safety Office",
    authority: "86 VRS / 86 LRS",
    phone: "480-2472",
    reference: "DAFI 64-117 Para 7.12.17",
    specialPreApproval: "Yes-Other-Identify in Comments Fields",
  },
];

/** Value-based rule the directory adds on top of item type (Para 7.12.22). */
export const EQUIPMENT_OVER_5000: AuthCategory = {
  id: "equip-over-5000",
  label: "Equipment asset exceeding $5,000",
  keywords: [], // detected by amount, not keyword
  requiredDoc: "Pre-approval from 86 LRS; after receipt, contact 86 LRS to record the asset",
  authority: "86 LRS",
  phone: "480-4425",
  reference: "DAFI 64-117 Para 7.12.22",
  specialPreApproval: "Yes-Other-Identify in Comments Fields",
};

/** Every category a reviewer can pick from (keyword catalog + the value rule). */
export const ALL_AUTH_CATEGORIES: AuthCategory[] = [...AUTH_CATALOG, EQUIPMENT_OVER_5000];

const BY_ID = new Map<string, AuthCategory>(ALL_AUTH_CATEGORIES.map((c) => [c.id, c]));

export function authCategory(id: string): AuthCategory | undefined {
  return BY_ID.get(id);
}

/** Escape a keyword for a word-boundary regex. */
function matcher(keyword: string): RegExp {
  const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b doesn't fire next to non-word chars (e.g. "a/c"), so bound on edges loosely.
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i");
}

/**
 * Best-guess catalog ids for a capture, from its line items + raw text. A loose
 * keyword match; the reviewer adds/removes after. `amount` triggers the
 * value-based >$5,000 rule when parseable.
 */
export function detectAuthCategories(
  lineItems: LineItem[],
  rawText: string,
  amount?: string | number | null,
): string[] {
  const haystack = (
    lineItems.map((li) => li.description).join("\n") + "\n" + rawText
  ).toLowerCase();
  const hits = new Set<string>();
  for (const cat of AUTH_CATALOG) {
    if (cat.keywords.some((k) => matcher(k).test(haystack))) hits.add(cat.id);
  }
  const n = typeof amount === "number" ? amount : Number.parseFloat(String(amount ?? "").replace(/[^0-9.]/g, ""));
  if (Number.isFinite(n) && n > 5000) hits.add(EQUIPMENT_OVER_5000.id);
  return [...hits];
}

/**
 * The US Bank "Special Pre-Approval Obtained" value implied by the detected
 * categories: the single mapped value, "Yes-Multiple…" when they disagree, or
 * "" when nothing was detected (reviewer still confirms).
 */
export function suggestSpecialPreApproval(categoryIds: string[]): string {
  const values = new Set(
    categoryIds.map((id) => authCategory(id)?.specialPreApproval).filter(Boolean) as string[],
  );
  if (values.size === 0) return "";
  if (values.size === 1) return [...values][0];
  return "Yes-Multiple-Identify All in Comments Fields";
}

/** A document slot the order must carry, with the id an attachment binds to. */
export type RequiredDoc = {
  id: string; // attachment.slotId
  category: DocCategory;
  label: string;
  note?: string;
};

/**
 * Every supporting document this order should carry: the always-required base
 * (receipt, GPC purchase request), the conditional ones (VAT form for German
 * vendors, non-receipt memo when undelivered), and one approval slot per
 * detected mandatory-authorization category.
 */
export function requiredDocuments(
  categoryIds: string[],
  opts: { germanVendor: boolean; delivered: boolean },
): RequiredDoc[] {
  const docs: RequiredDoc[] = [
    { id: "receipt", category: "receipt", label: "Receipt or invoice" },
    {
      id: "purchase_request",
      category: "purchase_request",
      label: "GPC purchase request",
      note: "Internal request listing the items, signed by supervisor and RA.",
    },
  ];
  if (opts.germanVendor)
    docs.push({
      id: "vat_form",
      category: "vat_form",
      label: "VAT-relief (Abwicklungsschein) form",
      note: "Required for purchases from a German business.",
    });
  if (!opts.delivered)
    docs.push({
      id: "non_receipt_memo",
      category: "non_receipt_memo",
      label: "Non-receipt memo",
      note: "Item not yet delivered — memo stands in for the receipt.",
    });
  for (const id of categoryIds) {
    const cat = authCategory(id);
    if (!cat) continue;
    docs.push({
      id: `approval:${id}`,
      category: "approval",
      label: `${cat.label} — approval`,
      note: `${cat.requiredDoc} (${cat.authority}).`,
    });
  }
  return docs;
}
