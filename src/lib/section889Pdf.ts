// Generate the downloadable "Record of Section 889 Representations" PDF from a
// Section889Entity — mirroring the GSA SmartPay tool's own SAM.gov summary so a
// cardholder can attach it to the US Bank order as the 889 designation evidence.
//
// jsPDF is loaded lazily (dynamic import) so it only enters the bundle when a
// cardholder actually downloads a record.

import type { Section889Entity } from "./section889";

const PAGE = { w: 612, h: 792 }; // US Letter, points
const MARGIN = 64;
const CONTENT_W = PAGE.w - MARGIN * 2;
const GRAY = 110;

/** Filename matching SmartPay's: "Record of Section 889 Representations - <name>.pdf". */
function fileName(entity: Section889Entity): string {
  const safe = (entity.legalName || "entity").replace(/[\\/:*?"<>|]+/g, " ").trim();
  return `Record of Section 889 Representations - ${safe}.pdf`;
}

export async function download889Record(entity: Section889Entity): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = MARGIN;

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE.h - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const text = (
    s: string,
    opts: { size?: number; bold?: boolean; gray?: boolean; align?: "left" | "center"; gap?: number } = {},
  ) => {
    const size = opts.size ?? 11;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(opts.gray ? GRAY : 20);
    const lines = doc.splitTextToSize(s, CONTENT_W) as string[];
    const lineH = size * 1.35;
    ensureSpace(lines.length * lineH);
    const x = opts.align === "center" ? PAGE.w / 2 : MARGIN;
    doc.text(lines, x, y, { align: opts.align ?? "left", baseline: "top" });
    y += lines.length * lineH + (opts.gap ?? 4);
  };

  const rule = (gap = 10) => {
    ensureSpace(gap * 2);
    y += gap;
    doc.setDrawColor(200);
    doc.setLineWidth(1);
    doc.line(MARGIN, y, PAGE.w - MARGIN, y);
    y += gap;
  };

  // ── Header ────────────────────────────────────────────────────────────────
  text("Summary of SAM.gov Data", { size: 22, bold: true, gap: 8 });
  text(
    `Generated on ${today} by Nexus from SAM.gov data using the GSA SmartPay 889 Representations tool (openGSA SAM.gov Entity Management API).`,
    { size: 9, gray: true, gap: 2 },
  );
  rule();

  // ── Entity Registration Summary ─────────────────────────────────────────────
  text("Entity Registration Summary", { size: 14, bold: true, align: "center", gap: 10 });
  text("Summary for:", { size: 9, gray: true, gap: 1 });
  text(entity.legalName || "—", { size: 15, bold: true, gap: 2 });
  if (entity.url) text(entity.url, { size: 10, gray: true, gap: 6 });
  text(`SAM.gov UEI: ${entity.uei ?? "—"}`, { size: 11, gap: 1 });
  text(`CAGE: ${entity.cage ?? "—"}`, { size: 11, gap: 8 });
  for (const line of entity.addressLines) text(line, { size: 11, gap: 1 });
  if (entity.addressLines.length) y += 6;
  text(`Registration Status: ${entity.registrationStatus ?? "—"}`, { size: 11, gap: 1 });
  text(`Has Active Exclusion? ${entity.hasActiveExclusion ? "Yes" : "No"}`, { size: 11, gap: 1 });
  text(`Activation Date: ${entity.activationDate ?? "—"}`, { size: 11, gap: 1 });
  text(`Expiration Date: ${entity.expirationDate ?? "—"}`, { size: 11, gap: 10 });
  text("(End of Entity Registration Summary)", { size: 10, bold: true, align: "center", gap: 4 });
  rule();

  // ── 889 Representations Section ─────────────────────────────────────────────
  text("889 Representations Section", { size: 14, bold: true, align: "center", gap: 10 });
  text(`889 Representations Summary: ${entity.compliance.statusText}`, { size: 11, bold: true, gap: 8 });
  const prov = entity.compliance.farProvisionDate ? ` (${entity.compliance.farProvisionDate})` : "";
  text(
    `The contractor has represented as follows in FAR 52.204-26 (c)${prov}, Covered Telecommunications Equipment or Services-Representation:`,
    { size: 11, bold: true, gap: 8 },
  );
  if (entity.compliance.farC1) text(entity.compliance.farC1, { size: 11, gap: 6 });
  if (entity.compliance.farC2) text(entity.compliance.farC2, { size: 11, gap: 6 });
  if (!entity.compliance.farC1 && !entity.compliance.farC2) {
    text("No FAR 52.204-26 representation is on file for this entity.", { size: 11, gray: true, gap: 6 });
  }
  text("(End of 889 Representations Section)", { size: 10, bold: true, align: "center", gap: 4 });
  rule();

  text("The full entity record can be accessed at: https://SAM.gov/", { size: 10, gray: true });

  doc.save(fileName(entity));
}
