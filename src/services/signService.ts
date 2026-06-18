// Client-side cryptographic PDF signing (PAdES-style) — runs entirely in the
// browser, no server. Uses node-forge for certificate/key handling and
// @signpdf for embedding the PKCS#7 signature into the PDF.
import { Buffer } from 'buffer';
import forge from 'node-forge';
import {
  PDFDocument,
  PDFArray,
  PDFName,
  PDFNumber,
  PDFString,
  PDFHexString,
  PDFInvalidObject,
  PDFDict,
} from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import {
  DEFAULT_SIGNATURE_LENGTH,
  DEFAULT_BYTE_RANGE_PLACEHOLDER,
  SUBFILTER_ADOBE_PKCS7_DETACHED,
  ANNOTATION_FLAGS,
  SIG_FLAGS,
} from '@signpdf/utils';

// @signpdf relies on Node's Buffer; make it available in the browser.
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

export interface CertSubject {
  name: string;
  organization?: string;
  country?: string;
  email?: string;
}

export interface SignMeta {
  reason?: string;
  location?: string;
  contactInfo?: string;
}

/**
 * DocMDP permission level for a certification ("certified document") signature.
 * Mirrors Adobe Acrobat's "Permitted actions after certifying":
 *   1 = No changes allowed       (full lock — the document is sealed)
 *   2 = Form fill-in + signatures allowed
 *   3 = Annotations + form fill-in + signatures allowed
 * See PDF 32000-1 §12.8.2.2 (DocMDP).
 */
export type CertifyLevel = 1 | 2 | 3;

export interface SignOptions extends SignMeta {
  /**
   * When set, produce a *certification* signature (DocMDP) instead of a plain
   * approval signature. Only the first signature in a PDF may certify it, and a
   * reader will warn/invalidate if the document is changed beyond what the level
   * permits — this is the vendor-standard "lock after sign".
   */
  certify?: CertifyLevel;
}

/**
 * Generate a self-signed certificate + key and export it as a password-protected
 * PKCS#12 (.p12) blob the user can reuse. Self-signed certs are cryptographically
 * valid but show as "validity unknown" in readers (no trusted CA chain).
 */
export function generateSelfSignedP12(subject: CertSubject, passphrase: string): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = String(Date.now());
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  const attrs: forge.pki.CertificateField[] = [{ name: 'commonName', value: subject.name }];
  if (subject.organization) attrs.push({ name: 'organizationName', value: subject.organization });
  if (subject.country) attrs.push({ name: 'countryName', value: subject.country });
  if (subject.email) attrs.push({ name: 'emailAddress', value: subject.email });

  cert.setSubject(attrs);
  cert.setIssuer(attrs); // self-signed → issuer == subject
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: '3des',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Uint8Array.from(der, (c) => c.charCodeAt(0));
}

/**
 * Add a *certification* signature placeholder with a DocMDP transform, then wire
 * the document catalog's /Perms entry to it. This is what turns an ordinary
 * signature into a "certified document": the reader treats the signing
 * certificate as the document's author and enforces the chosen permission level.
 *
 * This is a fork of @signpdf's pdflibAddPlaceholder — the upstream helper has no
 * DocMDP support, and its signature dictionary is serialized to bytes up front
 * (so it can't be amended afterwards). We therefore build the dictionary
 * ourselves with /Reference baked in before serialization.
 */
export function addCertificationPlaceholder(
  pdfDoc: PDFDocument,
  opts: { reason: string; name: string; location: string; contactInfo: string; level: CertifyLevel },
): void {
  const { context } = pdfDoc;
  const page = pdfDoc.getPages()[0];

  // ByteRange placeholder — @signpdf rewrites the last three entries at sign time.
  const byteRange = PDFArray.withContext(context);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(DEFAULT_BYTE_RANGE_PLACEHOLDER));

  const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(DEFAULT_SIGNATURE_LENGTH));

  // The signature dictionary, including the DocMDP transform reference. Bare
  // strings become PDFName via context.obj; PDFString.of forces a text string.
  const signatureDict = context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: SUBFILTER_ADOBE_PKCS7_DETACHED,
    ByteRange: byteRange,
    Contents: placeholder,
    Reason: PDFString.of(opts.reason),
    M: PDFString.fromDate(new Date()),
    ContactInfo: PDFString.of(opts.contactInfo),
    Name: PDFString.of(opts.name),
    Location: PDFString.of(opts.location),
    Reference: [
      {
        Type: 'SigRef',
        TransformMethod: 'DocMDP',
        TransformParams: {
          Type: 'TransformParams',
          P: opts.level,
          V: '1.2',
        },
      },
    ],
    Prop_Build: { Filter: { Name: 'Adobe.PPKLite' } },
  });

  // Serialize the dict to raw bytes so pdf-lib never folds it into an object
  // stream (which would break byte-range signing).
  const sigBytes = new Uint8Array(signatureDict.sizeInBytes());
  signatureDict.copyBytesInto(sigBytes, 0);
  const signatureDictRef = context.register(PDFInvalidObject.of(sigBytes));

  // Invisible signature widget (rect of zero size) on the first page.
  const rect = PDFArray.withContext(context);
  [0, 0, 0, 0].forEach((c) => rect.push(PDFNumber.of(c)));
  const apStream = context.formXObject([], { BBox: [0, 0, 0, 0], Resources: {} });

  const widgetDict = context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: rect,
    V: signatureDictRef,
    T: PDFString.of('Signature1'),
    F: ANNOTATION_FLAGS.PRINT,
    P: page.ref,
    AP: { N: context.register(apStream) },
  });
  const widgetDictRef = context.register(widgetDict);

  let annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (typeof annotations === 'undefined') annotations = context.obj([]);
  annotations.push(widgetDictRef);
  page.node.set(PDFName.of('Annots'), annotations);

  // AcroForm with the signature field + SigFlags (signatures exist, append-only).
  let form = pdfDoc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (typeof form === 'undefined') {
    form = context.obj({ Fields: [] });
    pdfDoc.catalog.set(PDFName.of('AcroForm'), context.register(form));
  }
  const existingFlags = form.has(PDFName.of('SigFlags'))
    ? (form.get(PDFName.of('SigFlags')) as PDFNumber).asNumber()
    : 0;
  form.set(
    PDFName.of('SigFlags'),
    PDFNumber.of(existingFlags | SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY),
  );
  let fields = form.get(PDFName.of('Fields'));
  if (!(fields instanceof PDFArray)) {
    fields = context.obj([]);
    form.set(PDFName.of('Fields'), fields);
  }
  (fields as PDFArray).push(widgetDictRef);

  // The keystone of a certified document: catalog /Perms → /DocMDP → this signature.
  const perms = PDFDict.withContext(context);
  perms.set(PDFName.of('DocMDP'), signatureDictRef);
  pdfDoc.catalog.set(PDFName.of('Perms'), perms);
}

/**
 * Embed a digital signature into a PDF using a PKCS#12 (.p12) certificate.
 * Returns the signed PDF bytes.
 *
 * Pass `opts.certify` to produce a certification ("certified document")
 * signature with a DocMDP permission level instead of a plain approval signature.
 */
export async function signPdfWithP12(
  pdfBytes: ArrayBuffer | Uint8Array,
  p12: Uint8Array,
  passphrase: string,
  subjectName: string,
  opts: SignOptions = {},
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  if (opts.certify && pdfDoc.catalog.lookupMaybe(PDFName.of('Perms'), PDFDict)) {
    throw new Error('This PDF is already certified — a document can only be certified once.');
  }

  const placeholderArgs = {
    reason: opts.reason || (opts.certify ? 'I certify this document' : 'I approve this document'),
    name: subjectName,
    location: opts.location || '',
    contactInfo: opts.contactInfo || '',
  };

  if (opts.certify) {
    addCertificationPlaceholder(pdfDoc, { ...placeholderArgs, level: opts.certify });
  } else {
    pdflibAddPlaceholder({ pdfDoc, ...placeholderArgs });
  }

  // Object streams must be off for the byte-range signing to work.
  const withPlaceholder = await pdfDoc.save({ useObjectStreams: false });

  const signer = new P12Signer(Buffer.from(p12), { passphrase });
  const signed: Buffer = await signpdf.sign(Buffer.from(withPlaceholder), signer);
  return new Uint8Array(signed);
}
