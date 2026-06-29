// Golden-set harness — runs mapAnalyzeExpense against REAL (scrubbed) Textract
// JSON saved as fixtures, so every future change is verified against the actual
// documents that broke instead of hand-built fakes.
//
// To add a case: capture a raw response (set EXTRACT_DEBUG=1 on /api/extract and
// copy `_rawTextract` from the response), scrub PII, save it as
//   api/fixtures/<case>.input.json
// then save the EXPECTED mapped output (verify it's correct first!) as
//   api/fixtures/<case>.expected.json
// See api/fixtures/README.md.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mapAnalyzeExpense } from "./extract";

const dir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const inputs = readdirSync(dir).filter((f) => f.endsWith(".input.json"));

describe("golden set — mapAnalyzeExpense against saved Textract JSON", () => {
  if (inputs.length === 0) {
    it.skip("no fixtures yet — see api/fixtures/README.md", () => {});
    return;
  }
  for (const file of inputs) {
    const name = file.replace(".input.json", "");
    it(name, () => {
      const input = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const expected = JSON.parse(readFileSync(join(dir, `${name}.expected.json`), "utf8"));
      expect(mapAnalyzeExpense(input)).toEqual(expected);
    });
  }
});
