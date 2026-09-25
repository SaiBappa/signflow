import React, { useState } from 'react';
// Encryption uses the @cantoo/pdf-lib fork (drop-in pdf-lib API + write encryption).
// Scoped to this tool only so the rest of the app keeps using plain pdf-lib.
import { PDFDocument } from '@cantoo/pdf-lib';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { downloadBlob } from '../utils';
import { ToolLayout, ToolField, ToolInput, ToolSection, PrimaryButton, FileChip } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';
import { PdfPagePreview } from './shared/PdfPagePreview';

export function Protect() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  const [allowModifying, setAllowModifying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const loadFile = (f: File) => {
    if (f.type === 'application/pdf') {
      setFile(f);
      setDone(false);
    }
  };

  const handleProtect = async () => {
    if (!file || password.length < 4) return;
    if (password !== confirm) {
      alert('Passwords do not match.');
      return;
    }
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pdfDoc.encrypt({
        userPassword: password,
        ownerPassword: password,
        permissions: {
          printing: allowPrinting ? 'highResolution' : undefined,
          copying: allowCopying,
          modifying: allowModifying,
        },
      });
      const out = await pdfDoc.save();
      downloadBlob(new Blob([out], { type: 'application/pdf' }), `protected-${file.name}`);
      setDone(true);
    } catch (e) {
      console.error(e);
      alert('Error protecting PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const permissions = [
    { label: 'Allow printing', value: allowPrinting, set: setAllowPrinting },
    { label: 'Allow copying text', value: allowCopying, set: setAllowCopying },
    { label: 'Allow editing', value: allowModifying, set: setAllowModifying },
  ];

  const panel = (
    <>
      {file && <FileChip name={file.name} onRemove={() => { setFile(null); setDone(false); }} />}

      <ToolField label="Password">
        <div className="relative">
          <ToolInput
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Set a password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {password.length > 0 && password.length < 4 && <span className="text-[10px] text-amber-500 font-medium block mt-1">At least 4 characters.</span>}
      </ToolField>

      <ToolField label="Confirm password">
        <ToolInput
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-enter password"
        />
        {confirm.length > 0 && confirm !== password && <span className="text-[10px] text-rose-500 font-medium block mt-1">Passwords do not match.</span>}
      </ToolField>

      <ToolSection label="Permissions (with password)">
        <div className="space-y-2">
          {permissions.map(p => (
            <label key={p.label} className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={p.value}
                onChange={e => p.set(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              {p.label}
            </label>
          ))}
        </div>
      </ToolSection>
    </>
  );

  return (
    <ToolLayout
      icon={<Lock size={20} strokeWidth={2} />}
      title="Protect PDF"
      description="Encrypt with a password — set once, never leaves your device."
      accentClass="from-rose-500 to-red-500"
      panel={panel}
      panelFooter={
        <PrimaryButton
          onClick={handleProtect}
          disabled={!file || !password || password !== confirm}
          loading={isProcessing}
          loadingText="Encrypting…"
        >
          <Lock size={16} /> Protect PDF
        </PrimaryButton>
      }
    >
      {!file ? (
        <UploadDropzone
          onFiles={fs => {
            const f = fs.find(x => x.type === 'application/pdf');
            if (f) loadFile(f);
          }}
          accept="application/pdf"
          title="Add a PDF to protect"
          subtitle={
            <>
              Drag &amp; drop a PDF here, or <span className="text-indigo-600 font-semibold">browse</span>. It's encrypted entirely on your device.
            </>
          }
          chips={['📄 PDF only']}
          icon={<Lock className="w-9 h-9" strokeWidth={2} />}
        />
      ) : done ? (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-10 md:p-12 text-center shadow-[0_20px_50px_-20px_rgba(79,70,229,0.15)]">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-emerald-500 to-green-500 flex items-center justify-center shadow-[0_8px_25px_rgba(16,185,129,0.3)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
              <ShieldCheck className="w-9 h-9 text-white relative" strokeWidth={2} />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">Protected &amp; downloaded</h2>
            <p className="mt-3 text-slate-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
              <span className="font-semibold text-slate-700">{file.name}</span> is now encrypted. Keep your password safe — it cannot be recovered.
            </p>
          </div>
        </div>
      ) : (
        <PdfPagePreview file={file} />
      )}
    </ToolLayout>
  );
}
