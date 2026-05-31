// Generated SVG "document" thumbnails for the seeded samples. These stand in
// for real scans so the demo is alive on first launch without shipping any PII
// or binary assets. Each is a data: URL, so it drops straight into imageUri.

const PAPER = "#ECE6D8";
const PAPER_EDGE = "#DAD2BE";
const INK = "#2B2820";
const FADE = "#6F6757";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Row = { left: string; right?: string; size?: number; weight?: number; fill?: string };

function rows(startY: number, step: number, width: number, items: Row[]): string {
  return items
    .map((it, i) => {
      const y = startY + i * step;
      const size = it.size ?? 12;
      const weight = it.weight ?? 400;
      const fill = it.fill ?? INK;
      const common = `font-family="ui-monospace, monospace" font-size="${size}" font-weight="${weight}" fill="${fill}"`;
      let s = `<text x="20" y="${y}" ${common}>${esc(it.left)}</text>`;
      if (it.right !== undefined) {
        s += `<text x="${width - 20}" y="${y}" text-anchor="end" ${common}>${esc(it.right)}</text>`;
      }
      return s;
    })
    .join("");
}

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function barcode(x: number, y: number, count: number): string {
  let bars = "";
  let cx = x;
  for (let i = 0; i < count; i++) {
    const w = (i * 37) % 5 < 2 ? 1.5 : 3;
    bars += `<rect x="${cx.toFixed(1)}" y="${y}" width="${w}" height="34" fill="${INK}"/>`;
    cx += w + 2;
  }
  return bars;
}

function thermalReceipt(): string {
  const w = 300;
  const h = 540;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${w}" height="6" fill="${PAPER_EDGE}"/>
  ${rows(46, 22, w, [
    { left: "THE EXCHANGE", size: 16, weight: 700 },
    { left: "Ramstein Main Store", size: 11, fill: FADE },
    { left: "Bldg 2113, Ramstein AB", size: 11, fill: FADE },
  ])}
  <line x1="20" y1="120" x2="${w - 20}" y2="120" stroke="${FADE}" stroke-dasharray="3 3"/>
  ${rows(146, 22, w, [
    { left: "Date 03/14/2026  10:42", size: 11, fill: FADE },
    { left: "Trans #88241007", size: 11, fill: FADE },
  ])}
  ${rows(206, 24, w, [
    { left: "Coffee Maker 12c", right: "49.99" },
    { left: "USB-C Cable 2m", right: "12.49" },
    { left: "Travel Mug", right: "14.99" },
  ])}
  <line x1="20" y1="290" x2="${w - 20}" y2="290" stroke="${FADE}" stroke-dasharray="3 3"/>
  ${rows(316, 24, w, [
    { left: "Subtotal", right: "77.47" },
    { left: "Sales Tax", right: "0.00" },
    { left: "TOTAL", right: "$77.47", size: 15, weight: 700 },
  ])}
  ${rows(404, 22, w, [{ left: "MASTERCARD ****4421", size: 11, fill: FADE }, { left: "AUTH 002914", size: 11, fill: FADE }])}
  ${barcode(20, 460, 46)}
  </svg>`;
  return dataUrl(svg);
}

function germanReceipt(): string {
  const w = 300;
  const h = 540;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${w}" height="6" fill="${PAPER_EDGE}"/>
  ${rows(46, 20, w, [
    { left: "toom Baumarkt GmbH", size: 15, weight: 700 },
    { left: "Merkurstr. 14", size: 11, fill: FADE },
    { left: "67663 Kaiserslautern", size: 11, fill: FADE },
  ])}
  <line x1="20" y1="118" x2="${w - 20}" y2="118" stroke="${FADE}" stroke-dasharray="3 3"/>
  ${rows(142, 20, w, [
    { left: "Datum 22.04.2026  14:08", size: 11, fill: FADE },
    { left: "Beleg-Nr 5567-22", size: 11, fill: FADE },
  ])}
  ${rows(200, 24, w, [
    { left: "Schrauben-Set", right: "8,99" },
    { left: "Akkuschrauber", right: "79,00" },
    { left: "Malervlies 25m  2x", right: "31,00" },
  ])}
  <line x1="20" y1="284" x2="${w - 20}" y2="284" stroke="${FADE}" stroke-dasharray="3 3"/>
  ${rows(310, 24, w, [
    { left: "Zwischensumme", right: "118,99" },
    { left: "MwSt 19%", right: "22,61" },
    { left: "Gesamt", right: "141,60 EUR", size: 15, weight: 700 },
  ])}
  ${rows(398, 22, w, [{ left: "EC-Karte ****8890", size: 11, fill: FADE }, { left: "Vielen Dank", size: 11, fill: FADE }])}
  ${barcode(20, 456, 46)}
  </svg>`;
  return dataUrl(svg);
}

function vendorQuote(): string {
  const w = 420;
  const h = 540;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#F6F2E8"/>
  <rect x="0" y="0" width="${w}" height="64" fill="#26231C"/>
  <text x="24" y="40" font-family="ui-sans-serif, system-ui" font-size="20" font-weight="700" fill="#F4EFE3">Better Direct LLC</text>
  <text x="${w - 24}" y="40" text-anchor="end" font-family="ui-sans-serif, system-ui" font-size="13" fill="#C9C1AE">QUOTATION</text>
  ${rows(100, 20, w, [
    { left: "Quote No: Q-2026-0455", size: 12, fill: FADE },
    { left: "Date: 2026-05-02", size: 12, fill: FADE },
    { left: "Valid for 30 days", size: 12, fill: FADE },
  ])}
  <line x1="24" y1="176" x2="${w - 24}" y2="176" stroke="#C9C1AE"/>
  ${rows(170, 0, w, [{ left: "Item", size: 11, weight: 700 }, { left: "", right: "Ext", size: 11, weight: 700 }])}
  ${rows(204, 28, w, [
    { left: "Rugged Laptop Case 15in  x4", right: "356.00" },
    { left: "USB-C Docking Station  x2", right: "420.00" },
    { left: "Cat6 Patch Cable 3ft  x10", right: "65.00" },
  ])}
  <line x1="24" y1="300" x2="${w - 24}" y2="300" stroke="#C9C1AE"/>
  ${rows(330, 26, w, [
    { left: "Subtotal", right: "841.00" },
    { left: "TOTAL", right: "$841.00", size: 16, weight: 700 },
  ])}
  <rect x="24" y="392" width="180" height="26" rx="4" fill="#E4DCC8"/>
  <text x="34" y="410" font-family="ui-monospace, monospace" font-size="12" fill="${INK}">889 compliant: Yes</text>
  </svg>`;
  return dataUrl(svg);
}

function vatForm(): string {
  const w = 420;
  const h = 540;
  const field = (y: number, label: string, value: string) =>
    `<text x="24" y="${y}" font-family="ui-sans-serif, system-ui" font-size="11" fill="${FADE}">${esc(label)}</text>` +
    `<line x1="150" y1="${y + 4}" x2="${w - 24}" y2="${y + 4}" stroke="#C9C1AE"/>` +
    `<text x="158" y="${y}" font-family="'Comic Sans MS', cursive" font-size="14" fill="#1F3A57" transform="rotate(-1.5 158 ${y})">${esc(value)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#F6F2E8"/>
  <rect x="16" y="16" width="${w - 32}" height="${h - 32}" fill="none" stroke="#B7AE98" stroke-width="1.5"/>
  <text x="${w / 2}" y="56" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="17" font-weight="700" fill="${INK}">ABWICKLUNGSSCHEIN</text>
  <text x="${w / 2}" y="76" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="11" fill="${FADE}">VAT relief form — NATO SOFA</text>
  ${field(130, "Auftragsnummer", "AS-2026-1182")}
  ${field(176, "Datum", "18.05.2026")}
  ${field(222, "Lieferant", "Elektro Hofmann GmbH")}
  ${field(268, "Leistung", "Elektroinstallation Buero")}
  ${field(314, "Nettobetrag", "1.250,00 EUR")}
  ${field(360, "Gesamt", "1.250,00 EUR")}
  <text x="24" y="420" font-family="ui-sans-serif, system-ui" font-size="11" fill="${FADE}">USt befreit gem. NATO-Truppenstatut</text>
  <text x="${w - 30}" y="490" text-anchor="end" font-family="'Comic Sans MS', cursive" font-size="20" fill="#1F3A57" transform="rotate(-4 ${w - 30} 490)">Hofmann</text>
  <line x1="${w - 160}" y1="500" x2="${w - 24}" y2="500" stroke="#B7AE98"/>
  <text x="${w - 160}" y="514" font-family="ui-sans-serif, system-ui" font-size="9" fill="${FADE}">Unterschrift</text>
  </svg>`;
  return dataUrl(svg);
}

export const sampleImages = {
  thermal_us: thermalReceipt(),
  german_vat: germanReceipt(),
  vendor_quote: vendorQuote(),
  vat_form: vatForm(),
};
