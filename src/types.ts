export interface DocumentFile {
  type: 'pdf' | 'image';
  name: string;
  url: string;
  file: File;
}

export interface Coordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SavedAsset {
  id: string;
  url: string;
  originalUrl: string;
  aspectRatio: number;
  tintColor?: string;
}

export interface SignatureInstance {
  id: string;
  pos: Coordinates;
  pageIndex: number;
  canvasWidth?: number;
  canvasHeight?: number;
  url: string;
  aspectRatio: number;
  rotation?: number;
}

export interface SignatureState {
  url: string;
  originalUrl: string;
  bgRemovalTolerance: number;
  bgRemovalMode?: 'white' | 'black' | 'auto';
  tintColor?: string;
  enhanceEnabled?: boolean;
  enhanceStrength?: number;  // 0-100, default 50
  pos: Coordinates;
  applyMode: 'single' | 'all' | 'custom';
  customPages: string; // Pages range input (e.g. "1, 3-5")
  excludedPages: string; // Excluded pages input
  instances: SignatureInstance[];
  aspectRatio: number;
}

export interface TextInstance {
  id: string;
  text: string;
  pageIndex: number;
  pos: Coordinates;
  fontSize: number;
  color: string;
  fontFamily?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface StampAsset {
  id: string;
  url: string;
  label: string;
}

export interface StampInstance {
  id: string;
  assetId: string;
  url: string;
  pageIndex: number;
  pos: Coordinates;
  rotation?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  aspectRatio: number;
}

export interface RedactInstance {
  id: string;
  pageIndex: number;
  pos: Coordinates;
  color: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

// A user-created template: a blank document plus the layout of form fields and
// text boxes placed on it, so the same form can be reopened and filled without
// re-placing anything. Stored locally (see useTemplatesStore).
export interface UserTemplate {
  id: string;
  name: string;
  nameDv?: string;
  category: string;
  docType: 'pdf' | 'image';
  docName: string;
  docDataUrl: string;   // the blank document encoded as a data URL
  thumbnail?: string;   // small preview image (data URL)
  createdAt: string;    // ISO date
  updatedAt: string;    // ISO date
  formFields: FormFieldInstance[];
  texts: TextInstance[];
}

// A sticky-note style comment placed on the document. Rendered with a tinted
// background + colored accent so readers immediately recognise it as a note left
// by a person (as opposed to part of the document).
export interface CommentInstance {
  id: string;
  pageIndex: number;
  pos: Coordinates;
  text: string;
  author?: string;
  color: string;       // accent / theme colour (hex). Background is a light tint of this.
  createdAt: string;   // ISO timestamp
  resolved?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

// Markup drawn freely on top of the document.
export type DrawShape = 'rectangle' | 'ellipse' | 'highlight' | 'line' | 'arrow' | 'freehand';

export interface DrawInstance {
  id: string;
  pageIndex: number;
  shape: DrawShape;
  pos: Coordinates;       // bounding box in display pixels
  color: string;          // stroke / fill colour (hex)
  strokeWidth: number;    // stroke thickness in display pixels
  opacity?: number;       // 0-1, used mainly for highlight (default 0.4)
  // Points normalised to the bounding box (0-1), flat [x0,y0,x1,y1,...].
  // line/arrow: two points (start, end). freehand: the captured path.
  // rectangle/ellipse/highlight: derived from the box, points optional.
  points?: number[];
  canvasWidth?: number;
  canvasHeight?: number;
}

export type FormFieldType = 'checkbox' | 'radio' | 'textarea';

export interface FormFieldInstance {
  id: string;
  type: FormFieldType;
  pageIndex: number;
  pos: Coordinates;
  canvasWidth?: number;
  canvasHeight?: number;
  // Checkbox / Radio
  checked?: boolean;
  label?: string;
  groupName?: string; // for radio button grouping
  color?: string;
  // Textarea
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  placeholder?: string;
  comment?: string;
}

