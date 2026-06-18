import React, { useState } from 'react';
import { FileSignature, ShieldCheck, Upload, Lock } from 'lucide-react';
import { downloadBlob } from '../utils';
import {
  generateSelfSignedP12,
  signPdfWithP12,
  type CertSubject,
  type CertifyLevel,
} from '../services/signService';
import { ToolLayout, ToolField, ToolInput, ToolSelect, ToolSection, Segmented, PrimaryButton, FileChip } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';

type CertMode = 'create' | 'import';
type SigType = 'approval' | 'certify';

// Maps Adobe's "Permitted actions after certifying" to DocMDP permission levels.
const CERTIFY_LEVELS: { value: CertifyLevel; label: string; hint: string }[] = [
  { value: 1, label: 'No changes allowed (full lock)', hint: 'Seals the document — no further signatures, form fill-in or annotations.' },
  { value: 2, label: 'Allow form fill-in & signing', hint: 'Recipients may fill form fields and add their own signatures, nothing else.' },
  { value: 3, label: 'Allow fill-in, signing & comments', hint: 'Recipients may also add annotations and comments.' },
];

export function DigitalSign() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CertMode>('create');

  // Approval signature vs. certifying ("certified document" / lock after sign).
  const [sigType, setSigType] = useState<SigType>('approval');
  const [certifyLevel, setCertifyLevel] = useState<CertifyLevel>(1);

  // Create-certificate fields
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [reason, setReason] = useState('I approve this document');
  const [passphrase, setPassphrase] = useState('');
  const [saveCert, setSaveCert] = useState(true);

  // Import-certificate fields
  const [p12File, setP12File] = useState<File | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [stage, setStage] = useState('');
  const [done, setDone] = useState(false);

  const canSign =
    !!file &&
    !isProcessing &&
    (mode === 'create'
      ? name.trim().length > 0 && passphrase.length >= 4
      : !!p12File && passphrase.length > 0);

  const handleSign = async () => {
    if (!file) return;
    setIsProcessing(true);
    setDone(false);
    try {
      const pdfBytes = await file.arrayBuffer();
      let p12: Uint8Array;
      let signerName: string;

      if (mode === 'create') {
        setStage('Generating your certificate…');
        const subject: CertSubject = { name: name.trim(), organization: organization.trim() || undefined };
        // Yield to the browser so the spinner paints before the blocking keygen.
        await new Promise((r) => setTimeout(r, 30));
        p12 = generateSelfSignedP12(subject, passphrase);
        signerName = subject.name;
        if (saveCert) {
          downloadBlob(new Blob([p12], { type: 'application/x-pkcs12' }), `${name.trim() || 'certificate'}.p12`);
        }
      } else {
        p12 = new Uint8Array(await p12File!.arrayBuffer());
        signerName = p12File!.name.replace(/\.(p12|pfx)$/i, '');
      }

      setStage(sigType === 'certify' ? 'Certifying document…' : 'Signing document…');
      const signed = await signPdfWithP12(pdfBytes, p12, passphrase, signerName, {
        reason,
        certify: sigType === 'certify' ? certifyLevel : undefined,
      });
      const prefix = sigType === 'certify' ? 'certified' : 'signed';
      downloadBlob(new Blob([signed], { type: 'application/pdf' }), `${prefix}-${file.name}`);
      setDone(true);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error && /already certified/.test(e.message)
        ? e.message
        : mode === 'import'
          ? 'Could not sign. Check that the certificate passphrase is correct.'
          : 'Error signing the document.';
      alert(msg);
    } finally {
      setIsProcessing(false);
      setStage('');
    }
  };

  const switchSigType = (next: SigType) => {
    setSigType(next);
    setDone(false);
    // Swap the reason default unless the user has customised it.
    setReason((r) =>
      r === 'I approve this document' && next === 'certify'
        ? 'I certify this document'
        : r === 'I certify this document' && next === 'approval'
          ? 'I approve this document'
          : r,
    );
  };

  const panel = (
    <>
      {file && <FileChip name={file.name} onRemove={() => { setFile(null); setDone(false); }} />}

      <ToolSection label="Signature type">
        <Segmented<SigType>
          value={sigType}
          onChange={switchSigType}
          options={[
            { id: 'approval', label: 'Approval' },
            { id: 'certify', label: 'Certify & lock' },
          ]}
        />
        {sigType === 'certify' && (
          <div className="mt-3 space-y-2">
            <ToolField label="Permitted actions after certifying" hint={CERTIFY_LEVELS.find((l) => l.value === certifyLevel)!.hint}>
              <ToolSelect value={certifyLevel} onChange={(e) => setCertifyLevel(Number(e.target.value) as CertifyLevel)}>
                {CERTIFY_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </ToolSelect>
            </ToolField>
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 leading-relaxed">
              <Lock size={13} className="mt-px shrink-0" />
              A document can be certified only once, and it must be done before any other signatures. Readers flag any change beyond the level above as a modification.
            </p>
          </div>
        )}
      </ToolSection>

      <ToolSection label="Certificate">
        <Segmented<CertMode>
          value={mode}
          onChange={setMode}
          options={[
            { id: 'create', label: 'Create new' },
            { id: 'import', label: 'Import .p12' },
          ]}
        />
      </ToolSection>

      {mode === 'create' ? (
        <>
          <ToolField label="Signer name">
            <ToolInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aishath Mohamed" />
          </ToolField>
          <ToolField label="Organization (optional)">
            <ToolInput value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="e.g. Clouds Pvt Ltd" />
          </ToolField>
          <ToolField label="Certificate passphrase" hint="Protects the .p12 — at least 4 characters.">
            <ToolInput type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Set a passphrase" />
          </ToolField>
          <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={saveCert} onChange={(e) => setSaveCert(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            Also download my certificate (.p12) to reuse
          </label>
        </>
      ) : (
        <>
          <ToolField label="Certificate file (.p12 / .pfx)">
            <label className="relative flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
              <input
                type="file"
                accept=".p12,.pfx,application/x-pkcs12"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setP12File(f); e.currentTarget.value = ''; }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload size={16} /> {p12File ? p12File.name : 'Choose certificate'}
            </label>
          </ToolField>
          <ToolField label="Certificate passphrase">
            <ToolInput type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Certificate passphrase" />
          </ToolField>
        </>
      )}

      <ToolField label="Reason">
        <ToolInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for signing" />
      </ToolField>
    </>
  );

  return (
    <ToolLayout
      icon={sigType === 'certify' ? <ShieldCheck size={20} strokeWidth={2} /> : <FileSignature size={20} strokeWidth={2} />}
      title={sigType === 'certify' ? 'Certify & Lock Document' : 'Digital Signature'}
      description={
        sigType === 'certify'
          ? 'Seal a PDF as a certified document with a DocMDP permission level — any later tampering is detected, just like Adobe Acrobat. Runs entirely on your device.'
          : "Cryptographically sign a PDF so it's tamper-evident and verifiable — entirely on your device."
      }
      accentClass="from-emerald-500 to-green-500"
      panel={panel}
      panelFooter={
        <PrimaryButton onClick={handleSign} disabled={!canSign} loading={isProcessing} loadingText={stage || (sigType === 'certify' ? 'Certifying…' : 'Signing…')}>
          {sigType === 'certify' ? <><ShieldCheck size={16} /> Certify &amp; Lock PDF</> : <><FileSignature size={16} /> Sign PDF</>}
        </PrimaryButton>
      }
    >
      {!file ? (
        <UploadDropzone
          onFiles={(fs) => { const f = fs.find((x) => x.type === 'application/pdf'); if (f) setFile(f); }}
          accept="application/pdf"
          title="Add a PDF to sign"
          subtitle={
            <>
              Drag &amp; drop a PDF here, or <span className="text-indigo-600 font-semibold">browse</span>. Signing happens entirely on your device.
            </>
          }
          chips={['📄 PDF only']}
          icon={<FileSignature className="w-9 h-9" strokeWidth={2} />}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-10 md:p-12 text-center shadow-[0_20px_50px_-20px_rgba(16,185,129,0.18)]">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-white shadow-[0_8px_25px_rgba(16,185,129,0.3)] bg-gradient-to-tr ${done ? 'from-emerald-500 to-green-500' : 'from-slate-400 to-slate-500'}`}>
              {done ? <ShieldCheck className="w-9 h-9" strokeWidth={2} /> : <FileSignature className="w-9 h-9" strokeWidth={2} />}
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
              {done
                ? sigType === 'certify' ? 'Certified & downloaded' : 'Signed & downloaded'
                : sigType === 'certify' ? 'Ready to certify' : 'Ready to sign'}
            </h2>
            <p className="mt-3 text-slate-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
              {done ? (
                sigType === 'certify' ? (
                  <><span className="font-semibold text-slate-700">{file.name}</span> is now a certified document. Acrobat shows a blue ribbon and enforces the permission level you chose.</>
                ) : (
                  <><span className="font-semibold text-slate-700">{file.name}</span> now carries a verifiable digital signature. Open it in Acrobat to see the signature panel.</>
                )
              ) : (
                <>Fill in the certificate details on the left, then {sigType === 'certify' ? 'certify' : 'sign'} <span className="font-semibold text-slate-700">{file.name}</span>.</>
              )}
            </p>
            {done && (
              <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
                Self-signed certificates verify cryptographically but show as “validity unknown” unless your certificate is trusted by the reader.
              </p>
            )}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
