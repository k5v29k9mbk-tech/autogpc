# Golden-set fixtures

Real (scrubbed) AWS Textract `AnalyzeExpense` responses, frozen as regression
tests. `api/extract.golden.test.ts` runs `mapAnalyzeExpense` over each
`*.input.json` and asserts the result equals the matching `*.expected.json`.

The unit tests in `extract.test.ts` use hand-built fakes; these use the real
shapes Textract returns (which keep surprising us). Add the receipts that
actually broke and no refactor can silently regress them.

## Adding a case

1. **Capture the raw response.** Set `EXTRACT_DEBUG=1` in the function's env,
   scan the problem receipt, and copy `_rawTextract` from the JSON response
   (browser devtools → Network → `/api/extract`).
2. **Scrub PII.** Real cardholder data must never land in the repo. Replace
   names / card digits / addresses with synthetic equivalents — keep the
   structure (Blocks, confidences, SummaryFields) intact, that's what's tested.
3. Save it as `<case>.input.json`.
4. **Verify the mapped output is correct**, then freeze it as
   `<case>.expected.json`. Don't paste output you haven't eyeballed — a golden
   file is only as good as the first review.

`<case>` is any kebab-case name describing the failure (e.g.
`bleedthrough-vendor`).
