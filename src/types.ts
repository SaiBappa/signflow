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
  tintColor?: string;
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

