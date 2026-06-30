// Build the supporting documents attached to a US Bank order from a record: an
// audit summary (.txt, always) plus the receipt image when the record has a
// resolvable one. Kept out of the component so the summary encoding is unit-
// testable and so a future iOS shell can reuse it.

import { toStructuredText } from "./exportRecord";
import type { UsBankDocument } from "./usbankClient";
import type { PurchaseRecord } from "../core/types";

/** Unicode-safe base64 of a UTF-8 string (btoa alone breaks on non-Latin1). */
export function utf8ToBase64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

/** The always-available audit summary document. Pure. */
export function summaryDocument(record: PurchaseRecord): UsBankDocument {
  return {
    filename: `autogpc-summary-${record.id}.txt`,
    contentType: "text/plain",
    dataBase64: utf8ToBase64(toStructuredText(record)),
  };
}

/** Read a resolvable image/blob URI into a US Bank document, or null. */
async function uriToDocument(
  uri: string,
  filename: string,
  contentType: string | undefined,
  resolveImage: (uri: string) => Promise<string | null>,
): Promise<UsBankDocument | null> {
  if (!uri) return null;
  const src = await resolveImage(uri);
  if (!src) return null;
  const blob = await (await fetch(src)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
  const dataBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { filename, contentType: contentType || blob.type || "application/octet-stream", dataBase64 };
}

/** The receipt image, if the record has a resolvable one. Reads the bytes. */
export async function receiptDocument(
  record: PurchaseRecord,
  resolveImage: (uri: string) => Promise<string | null>,
): Promise<UsBankDocument | null> {
  if (!record.imageUri) return null;
  const src = await resolveImage(record.imageUri);
  if (!src) return null;
  const blob = await (await fetch(src)).blob();
  const contentType = blob.type || "image/jpeg";
  const ext = (contentType.split("/")[1] || "jpg").split("+")[0];
  return uriToDocument(record.imageUri, `receipt-${record.id}.${ext}`, contentType, resolveImage);
}

/**
 * Summary always; receipt + every supporting document (GPC purchase request,
 * VAT form, non-receipt memo, mandatory-authorization approvals) when each is
 * resolvable. A single broken document never blocks the order.
 */
export async function buildUsBankDocuments(
  record: PurchaseRecord,
  resolveImage: (uri: string) => Promise<string | null>,
): Promise<UsBankDocument[]> {
  const docs: UsBankDocument[] = [summaryDocument(record)];
  try {
    const receipt = await receiptDocument(record, resolveImage);
    if (receipt) docs.push(receipt);
  } catch {
    // A receipt that won't load shouldn't block submission; summary still goes.
  }
  for (const att of record.attachments ?? []) {
    try {
      const doc = await uriToDocument(att.uri, att.filename, att.contentType, resolveImage);
      if (doc) docs.push(doc);
    } catch {
      // Skip a broken attachment rather than failing the whole submission.
    }
  }
  return docs;
}
