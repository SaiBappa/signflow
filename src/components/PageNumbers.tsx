import React, { useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Hash } from 'lucide-react';
import { downloadBlob, hexToRgb, parsePageRange } from '../utils';
import { ToolLayout, ToolField, ToolInput, ToolSelect, ToolSection, RangeRow, ColorSwatches, Segmented, PrimaryButton, FileChip } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';
import { PdfPagePreview, PreviewBox } from './shared/PdfPagePreview';

type Mode = 'pageNumber' | 'bates';
type Pos = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';

const PRESET_COLORS = [
  { name: 'Gray', value: '#444444' },
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Red', value: '#dc2626' },
];

export function PageNumbers() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>('pageNumber');
  const [format, setFormat] = useState('Page {n} of {total}');
  const [prefix, setPrefix] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [padding, setPadding] = useState(6);
  const [position, setPosition] = useState<Pos>('bottom-center');
  const [fontSize, setFontSize] = useState(11);
  const [color, setColor] = useState('#444444');
  const [pageRange, setPageRange] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const labelFor = (counter: number, total: number) =>
    mode === 'bates'
      ? `${prefix}${String(counter).padStart(padding, '0')}`
      : format.replace('{n}', String(counter)).replace('{total}', String(total));

  const handleApply = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { r, g, b } = hexToRgb(color);
      const pages = pdfDoc.getPages();
      const total = pages.length;
      const targetPages = new Set(parsePageRange(pageRange, total));

      let counter = startNumber;
      pages.forEach((page, i) => {
        if (!targetPages.has(i + 1)) return;
        const label = labelFor(counter, total);
        counter++;

        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, fontSize);
        const margin = 28;
        const isTop = position.startsWith('top');
        const y = isTop ? height - margin : margin - fontSize / 2;
        let x: number;
        if (position.endsWith('center')) x = (width - textWidth) / 2;
        else if (position.endsWith('right')) x = width - textWidth - margin;
        else x = margin;

        page.drawText(label, { x, y, size: fontSize, font, color: rgb(r, g, b) });
      });

      const out = await pdfDoc.save();
      downloadBlob(new Blob([out], { type: 'application/pdf' }), `numbered-${file.name}`);
    } catch (e) {
      console.error(e);
      alert('Error adding page numbers.');
    } finally {
      setIsProcessing(false);
    }
  };

  /* Live preview of the numbering on the currently-viewed page. Assumes the
   * page is within range (the common case) for a representative preview. */
  const renderOverlay = (box: PreviewBox) => {
    const counter = startNumber + (box.pageNumber - 1);
    const label = labelFor(counter, box.totalPages);
    const m = 28 * box.scale;
    const fs = fontSize * box.scale;
    const isTop = position.startsWith('top');
    const style: React.CSSProperties = {
      position: 'absolute',
      whiteSpace: 'nowrap',
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: fs,
      lineHeight: 1,
      color,
    };
    if (isTop) style.top = Math.max(2, m - fs);
    else style.bottom = Math.max(2, m - fs / 2);
    if (position.endsWith('center')) {
      style.left = '50%';
      style.transform = 'translateX(-50%)';
    } else if (position.endsWith('right')) style.right = m;
    else style.left = m;
    return <span style={style}>{label}</span>;
  };

  const panel = (
    <>
      {file && <FileChip name={file.name} onRemove={() => setFile(null)} />}

      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { id: 'pageNumber', label: 'Page numbers' },
          { id: 'bates', label: 'Bates' },
        ]}
      />

      {mode === 'pageNumber' ? (
        <ToolField label="Format" hint="Use {n} for the number and {total} for the page count.">
          <ToolInput value={format} onChange={e => setFormat(e.target.value)} />
        </ToolField>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ToolField label="Prefix">
            <ToolInput value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="ABC" />
          </ToolField>
          <ToolField label="Digits">
            <ToolInput type="number" min={1} max={12} value={padding} onChange={e => setPadding(+e.target.value)} />
          </ToolField>
          <ToolField label="Start">
            <ToolInput type="number" min={0} value={startNumber} onChange={e => setStartNumber(+e.target.value)} />
          </ToolField>
        </div>
      )}

      <ToolField label="Position">
        <ToolSelect value={position} onChange={e => setPosition(e.target.value as Pos)}>
          <option value="bottom-center">Bottom center</option>
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="top-center">Top center</option>
          <option value="top-right">Top right</option>
          <option value="top-left">Top left</option>
        </ToolSelect>
      </ToolField>

      <ToolSection label="Color">
        <ColorSwatches value={color} onChange={setColor} colors={PRESET_COLORS} />
      </ToolSection>

      <RangeRow label="Font size" value={fontSize} suffix="px" min={7} max={24} onChange={e => setFontSize(+e.target.value)} />

      <ToolField label="Pages" hint="Blank = all pages. e.g. 1, 3-5">
        <ToolInput value={pageRange} onChange={e => setPageRange(e.target.value)} placeholder="All pages" />
      </ToolField>
    </>
  );

  return (
    <ToolLayout
      icon={<Hash size={20} strokeWidth={2} />}
      title="Page Numbers & Bates"
      description="Add page numbers or legal Bates numbering to every page."
      accentClass="from-amber-500 to-orange-500"
      panel={panel}
      panelFooter={
        <PrimaryButton onClick={handleApply} disabled={!file} loading={isProcessing} loadingText="Applying…">
          <Hash size={16} /> Add Numbering
        </PrimaryButton>
      }
    >
      {!file ? (
        <UploadDropzone
          onFiles={fs => {
            const f = fs.find(x => x.type === 'application/pdf');
            if (f) setFile(f);
          }}
          accept="application/pdf"
          title="Add a PDF to number"
          subtitle={
            <>
              Drag &amp; drop a PDF here, or <span className="text-indigo-600 font-semibold">browse</span>. Numbering previews live.
            </>
          }
          chips={['📄 PDF only']}
          icon={<Hash className="w-9 h-9" strokeWidth={2} />}
        />
      ) : (
        <PdfPagePreview file={file} overlay={renderOverlay} />
      )}
    </ToolLayout>
  );
}
