# SignFlow — E-Signature Workflow & Digital Signatures: Design

**Status:** Proposal for review · **Author:** Engineering · **Audience:** SignFlow owner

This document designs the one capability that turns SignFlow from a *PDF editor* into a *signing platform* able to compete with Adobe Acrobat Sign / DocuSign — and the architectural decision it forces.

---

## 1. What we're building

Three related capabilities, in increasing order of effort:

1. **Cryptographic digital signatures** — sign a PDF with a certificate so the signature is tamper-evident and verifiable (not just a drawn image). This is the legal difference between "a picture of a signature" and a **legally binding** signed document.
2. **Send-for-signature** — email a document to one or more recipients, who sign it in their browser; the completed document comes back to the sender. (This is DocuSign's core product.)
3. **Audit trail / certificate of completion** — a verifiable record of who signed, when, from what IP, with what authentication — appended to the document.

---

## 2. The architectural decision (read this first)

SignFlow today is **100% client-side** — "your documents never leave your device." That is a real competitive advantage and a core marketing promise.

**Send-for-signature fundamentally breaks this model.** To send a document to *someone else* and track their action, the document (or a reference to it) must live somewhere both parties can reach — i.e. **a server**. There is no way around this: a second person on a different device cannot receive a document that exists only in the sender's browser.

So this feature is a **strategic fork**, not just an engineering task:

| | Keep | Trade away |
|---|---|---|
| **Stay 100% client-side** | Privacy promise intact; no infra cost; no liability for stored documents | Can't do send-for-signature at all. Can still do *self-signing* with certificates. |
| **Add a backend** | Full DocuSign-style workflow; the real revenue product | Must store documents (encrypted); privacy promise becomes "private except documents you send for signature"; infra + compliance cost |

**Recommendation:** Adopt a **hybrid** posture and message it honestly:
- Keep all existing tools (sign, split, watermark, OCR, etc.) 100% client-side — that promise stays true and stays the headline.
- Add a **separate, clearly-labelled "Request Signature" product** that uses a backend, with end-to-end encryption so SignFlow servers store only ciphertext they cannot read.

This preserves the brand for the 90% of usage that's local, while unlocking the high-value workflow.

---

## 3. Phase 1 — Self-signing with certificates (NO backend)

Deliverable that needs **zero server** and can ship first. The user applies a real cryptographic signature to their own document, entirely in-browser.

- **Standard:** PAdES (PDF Advanced Electronic Signatures) — the ETSI standard for PDF signing, recognised across the EU and compatible with how Acrobat verifies signatures.
- **How:** generate or import a signing key; compute the PDF byte-range digest; sign it; embed a PKCS#7/CMS signature dictionary into the PDF.
- **Client-side libraries (all run in-browser):**
  - `@signpdf/signpdf` + `@signpdf/signer-p12` — sign a PDF with a `.p12`/`.pfx` certificate. Pure JS.
  - `node-forge` — generate self-signed certificates and key pairs in the browser, handle PKCS#12.
  - `pdf-lib` (already a dependency) — to add the signature placeholder/widget before signing.
- **UX:** "Digitally sign" option in Fill & Sign → user picks/creates a certificate → signature + visual appearance embedded → downloaded. Verifiable in Acrobat ("Signed and all signatures are valid").
- **Caveat to message honestly:** a *self-signed* certificate is cryptographically valid but not chained to a trusted CA, so verifiers see "validity unknown" rather than a green check. For trusted identity you need a CA-issued certificate (see Phase 3 / Maldives section).

**This is the highest-leverage first step** — it delivers "legally binding digital signature" while staying true to the client-side promise.

---

## 4. Phase 2 — Send-for-signature (backend required)

### 4.1 High-level flow
```
Sender (browser)                 SignFlow backend                Recipient (browser)
─────────────────                ────────────────                ───────────────────
1. Prepare doc, place
   signature fields
2. Encrypt doc client-side ───▶  3. Store ciphertext + envelope
   with a random key             metadata; generate signing
                                  token per recipient
                                  4. Email link w/ token ──────▶ 5. Open link, decrypt doc
                                                                    with key in URL fragment
                                                                 6. Sign in browser
                                  7. Store signed ciphertext ◀── 8. Upload signed result
9. Notified, downloads  ◀──────  10. Assemble + audit trail
   completed document
```

### 4.2 End-to-end encryption (preserves privacy promise)
- Document is encrypted **in the sender's browser** with a freshly generated symmetric key (AES-GCM via WebCrypto).
- The key is **never sent to the server** — it travels in the URL fragment (`#key=...`) of the signing link, which browsers do not transmit to servers. Only someone with the link can decrypt.
- The backend stores **ciphertext only** → SignFlow cannot read customer documents even if breached. This is the technical backbone of the "private even when shared" message.

### 4.3 Backend components
- **API**: REST/tRPC service. Recommended stack given the React/TS codebase: **a thin Node/TypeScript service** (Hono or Fastify) — or serverless functions (Cloudflare Workers / Vercel) to minimise ops.
- **Storage**: object storage for ciphertext blobs (Cloudflare R2 / S3); a small relational DB (Postgres) for envelopes, recipients, status, audit events.
- **Email**: transactional email (Resend / SES / Postmark) for signing invitations and completion notices.
- **Auth**: signer identity via emailed magic-link token (sufficient for most); optional SMS OTP for higher assurance.

### 4.4 Data model (sketch)
```
Envelope      { id, senderId, status, createdAt, expiresAt, ciphertextRef }
Recipient     { id, envelopeId, email, order, status, signedAt, token }
Field         { id, envelopeId, recipientId, type, page, x, y, w, h }
AuditEvent    { id, envelopeId, type, actorEmail, ip, userAgent, timestamp }
```

---

## 5. Phase 3 — Audit trail & certificate of completion

On completion, append a generated **Certificate of Completion** page to the PDF (using `pdf-lib`) containing, for each signer:
- Name / email, authentication method
- Timestamp (with a trusted timestamp authority / RFC 3161 token if available)
- IP address and user agent
- Document hash before and after each signature

Store the same events immutably server-side (append-only) so the trail is independently verifiable. This is what makes the signature defensible in a dispute.

---

## 6. Maldives-specific: legal validity (the moat)

This is where SignFlow beats Adobe locally.

- **Align with the Maldives' electronic transactions law** so signatures produced by SignFlow are recognised domestically. Research the current Electronic Transactions Act / regulations and document exactly which signature assurance levels are legally recognised. *(Action item: confirm current statute with a local legal advisor before marketing "legally valid.")*
- **Trusted certificates:** for the green-check trusted identity, integrate with a CA. Options: a recognised local/regional CA, or a commercial one (e.g. a publicly-trusted issuer). Market "legally valid e-signatures in the Maldives" once the legal alignment is confirmed.
- **Dhivehi-first signing experience** — the entire signer flow available in Thaana, which DocuSign/Adobe do not offer. (The i18n engine added in this project — `src/i18n/` — is the foundation for this.)
- **Local pricing in MVR** — undercut Adobe's USD subscription.

---

## 7. Recommended sequencing

1. **Phase 1 (self-signing, client-side)** — ship first. High value, zero infra, keeps the privacy promise. Validates demand for "real" signatures.
2. **Confirm Maldives legal requirements** — in parallel; gates the marketing claims.
3. **Phase 2 (send-for-signature, E2E-encrypted backend)** — the revenue product. Build only after Phase 1 validates demand and the backend/privacy trade-off is explicitly accepted.
4. **Phase 3 (audit trail + trusted CA)** — hardening that makes signatures legally defensible.

---

## 8. Open decisions for the owner

1. **Do we accept a backend** for the send-for-signature product, given it changes the privacy story to "private, including documents you share, via end-to-end encryption"? (Phases 2–3 are blocked on this.)
2. **Hosting jurisdiction** — should document ciphertext be stored in-region (Maldives/nearby) for trust/latency, or is global object storage acceptable since it's E2E-encrypted?
3. **Certificate authority** — self-signed only (Phase 1), or invest in a trusted CA integration for the green-check (needed for the strongest legal claims)?
4. **Budget/appetite** for the recurring infra + email + compliance cost of running a signing service.

---

*Phase 1 needs no decision — it can start now and is the recommended next build. Phases 2–3 are gated on decision #1.*
