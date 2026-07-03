# In-Place Text Editing

Lets a user click existing text in a PDF and edit it directly — the #1 table-stakes
gap vs. Acrobat / iLovePDF / Smallpdf, and done **100% client-side** so it compounds
SignFlow's privacy moat (the file never leaves the browser). Dhivehi/Thaana text is
editable in place too, which no competitor offers.

## How it works — "Cover & Redraw"

Rather than rewriting the PDF's content-stream text operators (fragile; pdf-lib has no
API for it), an edit is modeled with the two primitives the app **already** renders and
exports through every path:

- a **`RedactInstance`** — a background-coloured rectangle that masks the original glyphs
- a **`TextInstance`** — the reprinted, editable text placed on top

Because both already flow through the live render (`DocumentViewer`) and both export paths
(pdf-lib vector + canvas raster), the feature needed **zero changes to the fragile,
duplicated export code**.

### Pipeline

```
pdf.js getTextContent()  ─►  extractPageRuns()  ─►  edit hotspots over each line
  (per page)                 (group into lines,      (DocumentViewer / PdfPage)
                              display-px coords)              │
                                                       click a run
                                                              │
                                            enrichRunFromCanvas()  ── sample bg/ink
                                                              │       colour + width-fit
                                            handleEditTextRun()  ──► RedactInstance(bg cover)
                                                                     + TextInstance(reprint)
                                                              │
                                            (existing) render + export, unchanged
```

## Key files

- `src/services/textExtraction.ts` — `extractPageRuns()`: pdf.js text items → line-grouped
  runs in the app's display-pixel space. Pure + unit-tested (`src/__tests__/textExtraction.test.ts`).
- `src/utils/fontMatch.ts` — `matchStandardFont()`: font family/class → `Helvetica | Times | Courier`.
- `src/components/DocumentViewer.tsx` — edit hotspots in `PdfPage`; `enrichRunFromCanvas()`
  (colour sampling + width-fit), wired into `PdfPage` / `DocumentViewer` props.
- `src/App.tsx` — `editText` tool (palette + panel) and `handleEditTextRun()`.

## Version history

| Ver | Scope | Status |
|----|-------|--------|
| v1.0 | Click-to-edit via cover+reprint; standard-font mapping; all pages | ✅ shipped |
| v1.1 | Line grouping (whole line edits at once); background/ink colour sampling; width-fit auto-shrink | ✅ shipped |
| v1.2 | Real font-**class** resolution (serif/sans/mono) via pdf.js `styles` map — serif/mono docs no longer collapse to Helvetica | ✅ shipped |
| v2 | Spike: true binary embedded-font re-embedding | ⛔ assessed — not reliably shippable (see below) |
| v2.0 | **Weight/style fidelity via bundled metric-compatible TTFs** — bold/italic recovery per run + Liberation Sans/Serif/Mono embedded through `@pdf-lib/fontkit` (the pragmatic path recommended below) | ✅ shipped |

## Coordinate recipe (the load-bearing math)

For a text item with transform matrix `M`:

```
displayScale = displayWidth / viewport(scale=1).width
vp           = page.getViewport({ scale: displayScale })   // device space, top-left origin
t            = pdfjsLib.Util.transform(vp.transform, M)     // [a,b,c,d,e,f]
fontPx       = hypot(t[2], t[3])      // font height, display px
x            = t[4]                    // left edge
baselineY    = t[5]
topY         = baselineY - fontPx
widthPx      = item.width * displayScale
```

This places `pos` in the exact display-pixel space `TextInstance` / `RedactInstance`
already use, so export reproduces it at the original location with no extra mapping.

## v2.0 — weight/style fidelity (shipped)

Implements the recommendation at the bottom of this doc:

- **Style recovery** (`textExtraction.ts`): each run now carries `bold`/`italic`,
  recovered from the pdf.js translated font object in `page.commonObjs`
  (`bold`/`italic`/`black` flags + BaseFont name) with a name-suffix heuristic
  fallback (`detectFontStyle()` in `fontMatch.ts`). Class resolution (serif/sans/mono)
  is unchanged from v1.2.
- **Embedded export** (`src/services/fontRegistry.ts`): the pdf-lib export path embeds
  the bundled, metric-compatible **Liberation Sans/Serif/Mono** TTFs
  (`public/fonts/liberation/`, SIL OFL) per (family, bold, italic) combination via
  `@pdf-lib/fontkit` with subsetting; Standard-14 styled variants remain the fallback
  when a TTF can't be fetched/embedded. Faruma is embedded the same way, which makes
  **Thaana text survive PDF export** (Standard-14 fonts can't encode it).
- **Screen = export**: `TEXT_FONTS` css stacks now lead with the Liberation faces
  (declared via `@font-face` in `index.css`), the canvas raster export paths draw with
  `canvasFontString()` after `ensureTextFontsLoaded()`, and the width-fit measurement
  in `enrichRunFromCanvas()` measures with the recovered weight/style.
- **UI**: the text-overlay toolbar gained Bold/Italic toggles, so recovered styles are
  user-editable.

## v2 feasibility — true binary font embedding (assessed, deferred)

Goal: reprint with the *exact* original glyphs instead of a Standard-14 substitute. A
bounded spike (generated PDFs, real code) found:

- **`@cantoo/pdf-lib` supports fontkit embedding** (`registerFontkit` + `embedFont`), but
  **no fontkit package is installed** — shipping needs `@pdf-lib/fontkit`.
- **Full (non-subset) embedded fonts** can be extracted byte-identical from the PDF
  (Resources → Font → FontDescriptor → `FontFile2`, after Flate-decoding) and re-embedded. ✅
- **Subset fonts — the real-world default — strip the `name`/`cmap` tables**, so
  `embedFont()` rejects them. ⛔ This makes byte-identical re-embedding **unreliable in
  practice.**
- **Weight/style is cheaply recoverable** from the BaseFont name suffix (`-Bold`/`-Italic`)
  and `FontDescriptor` flags (`ItalicAngle`, `Flags`).

**Recommendation for a future v2 (moderate effort):** add `@pdf-lib/fontkit`; recover
family + weight + style per run; embed a **bundled, metric-compatible TTF** (e.g. Liberation
Sans/Serif/Mono + Bold/Italic) via fontkit; keep byte-identical re-embedding only as a
best-effort fast path when a full (`name`-table-present) embedded font is detected.

## Known limitations (current)

- Cover-and-redraw leaves the original text in the content stream beneath the cover
  rectangle (visually hidden, but present to text extraction) — acceptable for editing;
  use the Redact tool for true removal.
- Colour seam can appear on textured/photographic backgrounds (cover rect is a solid fill).
- Font fidelity is family-class + weight/style accurate (Liberation metric-compatible
  faces, v2.0), not the exact original glyphs (byte-identical re-embedding deferred, see below).
- Scanned PDFs have no text layer — the panel directs users to run OCR first.
