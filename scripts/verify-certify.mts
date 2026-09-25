// One-off verification: build a PDF, certify it (DocMDP), and confirm the output
// is a real certified document with a valid embedded PKCS#7 signature.
// Run with: npx tsx scripts/verify-certify.mts
//
// NOTE: under tsx the default import of @signpdf/signpdf resolves to the module
// namespace (not the instance), so we reach through `.default` here. The app runs
// under Vite, where `import signpdf from '@signpdf/signpdf'` already yields the
// instance — hence signService.ts is correct as written.
import { Buffer } from 'buffer';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as signpdfNs from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { generateSelfSignedP12, addCertificationPlaceholder } from '../src/services/signService';

function resolveSignpdf(m: any): any {
  for (const c of [m, m?.default, m?.default?.default]) {
    if (c && typeof c.sign === 'function') return c;
  }
  throw new Error('could not resolve signpdf.sign');
}
const signpdf: any = resolveSignpdf(signpdfNs);

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('  ok:', msg);
}

async function makeSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Maldives Customs — Official Receipt', { x: 20, y: 250, size: 14, font });
  return doc.save();
}

async function certify(pdf: Uint8Array, p12: Uint8Array, level: 1 | 2 | 3): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdf);
  addCertificationPlaceholder(pdfDoc, {
    reason: 'I certify this document',
    name: 'Aishath Mohamed',
    location: '',
    contactInfo: '',
    level,
  });
  const withPlaceholder = await pdfDoc.save({ useObjectStreams: false });
  const signer = new P12Signer(Buffer.from(p12), { passphrase: 'secret123' });
  const signed = await signpdf.sign(Buffer.from(withPlaceholder), signer);
  return new Uint8Array(signed);
}

async function main() {
  const pdf = await makeSamplePdf();
  const p12 = generateSelfSignedP12({ name: 'Aishath Mohamed', organization: 'Clouds Pvt Ltd' }, 'secret123');

  const certified = await certify(pdf, p12, 1);
  const text = Buffer.from(certified).toString('latin1');
  console.log('Certified output:', certified.length, 'bytes');
  assert(certified.length > pdf.length, 'certified PDF larger than source (signature embedded)');
  assert(text.includes('/DocMDP'), 'contains DocMDP transform method');
  assert(text.includes('/Perms'), 'catalog has /Perms entry');
  assert(text.includes('/TransformParams'), 'contains TransformParams dict');
  assert(/\/P\s+1\b/.test(text), 'DocMDP permission level P=1 present');
  assert(text.includes('/SigRef'), 'signature reference (SigRef) present');
  assert(text.includes('adbe.pkcs7.detached'), 'PKCS#7 detached signature embedded (crypto signing succeeded)');
  assert(text.includes('/ByteRange'), 'ByteRange present');
  assert(/\/SigFlags\s+3\b/.test(text), 'SigFlags = 3 (signatures-exist + append-only)');

  const lvl2 = await certify(pdf, p12, 2);
  assert(/\/P\s+2\b/.test(Buffer.from(lvl2).toString('latin1')), 'level 2 embeds P=2');

  const lvl3 = await certify(pdf, p12, 3);
  assert(/\/P\s+3\b/.test(Buffer.from(lvl3).toString('latin1')), 'level 3 embeds P=3');

  console.log('\nALL CHECKS PASSED ✅');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
