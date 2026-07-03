import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { cn } from '../../utils';

/* ============================================================================
 * ToolLayout — the shared shell that gives every tool the same "Fill & Sign"
 * structure: a left functions panel (controls + a sticky primary action) and a
 * main work area (upload zone, live preview, or results). Visual language is the
 * indigo/violet glass system used across the app.
 * ========================================================================== */

interface ToolLayoutProps {
  /** Small icon shown in the panel header badge. */
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** Tailwind gradient classes for the header icon badge. */
  accentClass?: string;
  /** The tool's controls / functions — rendered in the scrollable left panel. */
  panel: React.ReactNode;
  /** Sticky action area at the bottom of the panel (usually a PrimaryButton). */
  panelFooter?: React.ReactNode;
  /** Hide the default "100% local" security badge. */
  hideSecurityNote?: boolean;
  /** Main work area: dropzone when empty, preview/results once a file is loaded. */
  children: React.ReactNode;
}

export function ToolLayout({
  icon,
  title,
  description,
  accentClass = 'from-indigo-500 to-violet-500',
  panel,
  panelFooter,
  hideSecurityNote,
  children,
}: ToolLayoutProps) {
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
      {/* ── Left functions panel ── */}
      <aside className="w-full md:w-80 md:max-w-[20rem] shrink-0 bg-white/95 backdrop-blur-xl border-b md:border-b-0 md:border-r border-slate-200/60 flex flex-col max-h-[55vh] md:max-h-none md:h-full z-10">
        {/* Header */}
        <div className="px-5 py-4 flex items-start gap-3 border-b border-slate-100 shrink-0">
          <div className={cn('w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm bg-gradient-to-tr relative overflow-hidden', accentClass)}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
            <span className="relative">{icon}</span>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-slate-800 tracking-tight leading-tight">{title}</h2>
            {description && <p className="text-xs text-slate-400 font-medium mt-0.5 leading-snug">{description}</p>}
          </div>
        </div>

        {/* Scrollable controls */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">{panel}</div>

        {/* Footer: primary action + security badge. The aside is height-capped on
            mobile with a scrollable controls area above, so this footer (the primary
            action) stays pinned to the panel base and always reachable; at md+ it sits
            at the bottom of the full-height panel as before. */}
        <div className="px-4 py-4 border-t border-slate-100 space-y-3 shrink-0 bg-white/95">
          {panelFooter}
          {!hideSecurityNote && (
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5 flex gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
              <p className="text-[10px] text-emerald-800 leading-normal font-semibold">100% private. Everything runs locally in your browser — nothing is uploaded.</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main work area ── */}
      <main className="flex-1 min-h-0 surface-aurora relative overflow-y-auto flex flex-col">
        {/* Subtle local dot grid for depth (no external assets). */}
        <div
          className="hidden md:block absolute inset-0 pointer-events-none opacity-[0.6]"
          style={{
            backgroundImage: 'radial-gradient(rgba(99,102,241,0.08) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, #000 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, #000 40%, transparent 100%)',
          }}
        />
        <div className="relative flex-1 flex flex-col">{children}</div>
      </main>
    </div>
  );
}

/* ============================================================================
 * Control primitives — shared so every tool's panel is visually identical.
 * ========================================================================== */

export function ToolSection({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{label}</span>}
      {children}
    </div>
  );
}

export function ToolField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-slate-400 font-medium block">{hint}</span>}
    </label>
  );
}

const inputBase =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors';

export function ToolInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export function ToolSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, 'cursor-pointer', props.className)} />;
}

export function PrimaryButton({
  loading,
  loadingText,
  children,
  className,
  ...props
}: { loading?: boolean; loadingText?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        'w-full px-5 py-3 text-sm font-bold text-white rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] disabled:shadow-none bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0',
        className,
      )}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> {loadingText || 'Working…'}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Pill segmented control (e.g. White / Black / Auto). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-1 p-1 bg-slate-100 rounded-xl text-[11px] font-semibold"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'py-1.5 rounded-lg text-center cursor-pointer transition-all',
            value === o.id ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Labeled slider with a live value readout. */
export function RangeRow({
  label,
  value,
  suffix = '',
  ...inputProps
}: { label: string; value: number; suffix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const min = Number(inputProps.min ?? 0);
  const max = Number(inputProps.max ?? 100);
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xs text-indigo-600 font-bold font-mono tabular-nums bg-indigo-50 px-1.5 py-0.5 rounded-md">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        value={value}
        {...inputProps}
        className="range-premium w-full"
        style={{ ['--range-fill' as any]: `${fill}%`, ...inputProps.style }}
      />
    </div>
  );
}

/** Row of preset color swatches with an optional native custom-color picker. */
export function ColorSwatches({
  value,
  onChange,
  colors,
  allowCustom = true,
}: {
  value: string;
  onChange: (hex: string) => void;
  colors: { name: string; value: string }[];
  allowCustom?: boolean;
}) {
  return (
    <div className="flex gap-2 flex-wrap items-center">
      {colors.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          title={c.name}
          className={cn(
            'w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 cursor-pointer',
            value.toLowerCase() === c.value.toLowerCase() ? 'border-indigo-500 scale-110 shadow-md' : 'border-slate-200',
          )}
          style={{ backgroundColor: c.value }}
        />
      ))}
      {allowCustom && (
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          title="Custom color"
          className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
        />
      )}
    </div>
  );
}

/** Compact file chip shown in a panel once a document is selected. */
export function FileChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-2.5">
      <span className="text-lg shrink-0">📄</span>
      <span className="flex-1 min-w-0 truncate text-xs font-semibold text-slate-700" title={name}>
        {name}
      </span>
      <button onClick={onRemove} className="text-slate-400 hover:text-rose-500 text-xs font-semibold px-1.5 cursor-pointer transition-colors">
        Remove
      </button>
    </div>
  );
}
