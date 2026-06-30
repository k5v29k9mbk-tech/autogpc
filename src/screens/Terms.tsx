// Public Terms of Use & Liability Disclaimer.
//
// This is the document the signup consent checkbox links to. It is a clickwrap
// agreement: users must affirmatively accept it (unchecked by default) before
// an account is created, and acceptance is recorded against their account
// (see src/lib/terms.ts). Reachable at /terms without a session.
//
// NOTE: this is plain-language boilerplate, not reviewed by counsel. Have a
// lawyer review before relying on it in production, and fill in the bracketed
// governing-law / contact fields.

import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { TERMS_EFFECTIVE, TERMS_VERSION } from "../lib/terms";

export function Terms() {
  return (
    <div className="auth-shell">
      <div className="auth-card reveal" style={{ maxWidth: 720, textAlign: "left" }}>
        <div className="auth-brand">
          <Logo size={64} />
          <span className="wordmark">AutoGPC</span>
        </div>

        <div className="auth-head">
          <h1>Terms of Use &amp; Disclaimer</h1>
          <p className="sub">
            Effective {TERMS_EFFECTIVE} · Version {TERMS_VERSION}
          </p>
        </div>

        <div className="stack legal-body">
          <section>
            <h2>1. Acceptance</h2>
            <p>
              By creating an account or using AutoGPC (the “Service”), you agree to these Terms. If
              you do not agree, do not create an account or use the Service.
            </p>
          </section>

          <section>
            <h2>2. What the Service does</h2>
            <p>
              AutoGPC automates work on your behalf: it reads receipts and documents using optical
              character recognition (OCR), extracts fields from them, and can prepare, match, and
              submit data into third-party systems. These operations are automated and may produce
              incorrect, incomplete, or unintended results.
            </p>
          </section>

          <section>
            <h2>3. Provided “as is”</h2>
            <p>
              The Service is provided “AS IS” and “AS AVAILABLE,” without warranties of any kind,
              whether express or implied, including but not limited to warranties of merchantability,
              fitness for a particular purpose, accuracy, and non-infringement. We do not warrant that
              extractions, matches, uploads, or any output will be accurate, complete, timely, or
              error-free.
            </p>
          </section>

          <section>
            <h2>4. Your responsibility to verify</h2>
            <p>
              <strong>
                You are solely responsible for reviewing and verifying every value the Service
                extracts and every action it prepares before you rely on it or allow it to be
                submitted.
              </strong>{" "}
              You must confirm the accuracy of all data and the appropriateness of all actions against
              your source documents and the requirements of any system the data is sent to. The
              Service is a tool that assists you; it does not replace your judgment, and using it does
              not transfer responsibility for the results to us.
            </p>
          </section>

          <section>
            <h2>5. Automated and irreversible actions</h2>
            <p>
              Automated actions — including uploads, matches, submissions, edits, and deletions — may
              be incorrect and may not be reversible once performed. You acknowledge and accept this
              risk and agree that you authorize each such action by using the Service to perform it.
            </p>
          </section>

          <section>
            <h2>6. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, we are not liable for any direct, indirect,
              incidental, consequential, special, or punitive damages, or for any loss of data,
              profits, or business, arising out of or related to your use of the Service. This
              includes, without limitation, damages arising from incorrect or incomplete extractions;
              erroneous, failed, duplicated, or unintended uploads or submissions; and any destructive
              or irreversible action taken through the Service. Your sole and exclusive remedy is to
              stop using the Service.
            </p>
          </section>

          <section>
            <h2>7. Indemnification</h2>
            <p>
              You agree to indemnify and hold us harmless from any claims, losses, liabilities, and
              expenses (including reasonable legal fees) arising from your use of the Service, your
              data, or any action you take or authorize through it.
            </p>
          </section>

          <section>
            <h2>8. No affiliation</h2>
            <p>
              AutoGPC is an independent automation tool. It is not affiliated with, authorized by, or
              endorsed by U.S. Bank, PIEE, or any government agency.
            </p>
          </section>

          <section>
            <h2>9. Changes</h2>
            <p>
              We may update these Terms. Material changes will be assigned a new version, and continued
              use after a change means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2>10. Governing law &amp; contact</h2>
            <p>
              These Terms are governed by the laws of [your jurisdiction]. Questions:{" "}
              <a href="mailto:magzhan.karabekov@us.af.mil">magzhan.karabekov@us.af.mil</a>.
            </p>
          </section>
        </div>

        <div style={{ marginTop: "var(--s5)" }}>
          <Link to="/create-account" className="btn btn-ghost btn-block">
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
