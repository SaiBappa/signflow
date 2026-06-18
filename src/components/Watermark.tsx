import React, { useState } from 'react';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { Droplet } from 'lucide-react';
import { downloadBlob, hexToRgb, parsePageRange } from '../utils';
import { ToolLayout, ToolField, ToolInput, ToolSelect, ToolSection, RangeRow, ColorSwatches, PrimaryButton, FileChip } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';
import { PdfPagePreview, PreviewBox } from './shared/PdfPagePreview';

type Position = 'center' | 'top' | 'bottom' | 'tile';

const PRESET_COLORS = [
  { name: 'Red', value: '#ff0000' },
  { name: 'Gray', value: '#9ca3af' },
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#2563eb' },
];

export function Watermark() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('CONFIDENTIAL');
  const [color, setColor] = useState('#ff0000');
  const [opacity, setOpacity] = useState(20); // percent
  const [angle, setAngle] = useState(45);
  const [fontSize, setFontSize] = useState(48);
  const [position, setPosition] = useState<Position>('center');
  const [pageRange, setPageRange] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApply = async () => {
    if (!file || !text.trim()) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const { r, g, b } = hexToRgb(color);
      const targetPages = new Set(parsePageRange(pageRange, pdfDoc.getPageCount()));
      const op = Math.max(0, Math.min(1, opacity / 100));

      pdfDoc.getPages().forEach((page, i) => {
        if (!targetPages.has(i + 1)) return;
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        const drawAt = (cx: number, cy: number) => {
          const rad = (angle * Math.PI) / 180;
          // rotate around the text's visual center
          const x = cx - (textWidth / 2) * Math.cos(rad) + (textHeight / 2) * Math.sin(rad);
          const y = cy - (textWidth / 2) * Math.sin(rad) - (textHeight / 2) * Math.cos(rad);
          page.drawText(text, {
            x, y, size: fontSize, font,
            color: rgb(r, g, b),
            rotate: degrees(angle),
            opacity: op,
          });
        };

        if (position === 'tile') {
          const stepX = Math.max(textWidth, 120) + 80;
          const stepY = 140;
          for (let py = stepY / 2; py < height + stepY; py += stepY) {
            for (let px = stepX / 2; px < width + stepX; px += stepX) {
              drawAt(px, py);
            }
          }
        } else {
          const cy = position === 'top' ? height - 80 : position === 'bottom' ? 80 : height / 2;
          drawAt(width / 2, cy);
        }
      });

      const out = await pdfDoc.save();
      downloadBlob(new Blob([out], { type: 'application/pdf' }), `watermarked-${file.name}`);
    } catch (e) {
      console.error(e);
      alert('Error applying watermark.');
    } finally {
      setIsProcessing(false);
    }
  };

  /* Faithful live overlay of the watermark on the rendered page. */
  const renderOverlay = (b: PreviewBox) => {
    if (!text.trim()) return null;
    const op = Math.max(0, Math.min(1, opacity / 100));
    const style: React.CSSProperties = {
      position: 'absolute',
      whiteSpace: 'nowrap',
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontWeight: 700,
      color,
      opacity: op,
      fontSize: fontSize * b.scale,
      lineHeight: 1,
    };

    if (position === 'tile') {
      // Mirror the export step math, scaled to the displayed page.
      const stepX = (Math.max(text.length * fontSize * 0.55, 120) + 80) * b.scale;
      const stepY = 140 * b.scale;
      const tiles: React.ReactNode[] = [];
      let key = 0;
      for (let py = stepY / 2; py < b.height + stepY; py += stepY) {
        for (let px = stepX / 2; px < b.width + stepX; px += stepX) {
          tiles.push(
            <span
              key={key++}
              style={{ ...style, left: px, top: b.height - py, transform: `translate(-50%, -50%) rotate(${-angle}deg)` }}
            >
              {text}
            </span>,
          );
        }
      }
      return <>{tiles}</>;
    }

    const cyFromBottom = position === 'top' ? b.height - 80 * b.scale : position === 'bottom' ? 80 * b.scale : b.height / 2;
    return (
      <span style={{ ...style, left: b.width / 2, top: b.height - cyFromBottom, transform: `translate(-50%, -50%) rotate(${-angle}deg)` }}>
        {text}
      </span>
    );
  };

  const panel = (
    <>
      {file && <FileChip name={file.name} onRemove={() => setFile(null)} />}

      <ToolField label="Watermark text">
        <ToolInput value={text} onChange={e => setText(e.target.value)} placeholder="e.g. CONFIDENTIAL" />
      </ToolField>

      <ToolField label="Position">
        <ToolSelect value={position} onChange={e => setPosition(e.target.value as Position)}>
          <option value="center">Center</option>
          <option value="tile">Tiled (repeat)</option>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </ToolSelect>
      </ToolField>

      <ToolSection label="Color">
        <ColorSwatches value={color} onChange={setColor} colors={PRESET_COLORS} />
      </ToolSection>

      <RangeRow label="Opacity" value={opacity} suffix="%" min={5} max={100} onChange={e => setOpacity(+e.target.value)} />
      <RangeRow label="Rotation" value={angle} suffix="°" min={-90} max={90} onChange={e => setAngle(+e.target.value)} />
      <RangeRow label="Font size" value={fontSize} suffix="px" min={12} max={120} onChange={e => setFontSize(+e.target.value)} />

      <ToolField label="Pages" hint="Blank = all pages. e.g. 1, 3-5">
        <ToolInput value={pageRange} onChange={e => setPageRange(e.target.value)} placeholder="All pages" />
      </ToolField>
    </>
  );

  return (
    <ToolLayout
      icon={<Droplet size={20} strokeWidth={2} />}
      title="Watermark PDF"
      description="Stamp text across your pages — diagonal, tiled, or positioned."
      accentClass="from-cyan-500 to-blue-500"
      panel={panel}
      panelFooter={
        <PrimaryButton onClick={handleApply} disabled={!file || !text.trim()} loading={isProcessing} loadingText="Applying…">
          <Droplet size={16} /> Apply Watermark
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
          title="Add a PDF to watermark"
          subtitle={
            <>
              Drag &amp; drop a PDF here, or <span className="text-indigo-600 font-semibold">browse</span>. The watermark previews live.
            </>
          }
          chips={['📄 PDF only']}
          icon={<Droplet className="w-9 h-9" strokeWidth={2} />}
        />
      ) : (
        <PdfPagePreview file={file} overlay={renderOverlay} />
      )}
    </ToolLayout>
  );
}
