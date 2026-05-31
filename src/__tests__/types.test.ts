import { describe, it, expect } from 'vitest';
import type { DocumentFile, Coordinates, SavedAsset, SignatureInstance, SignatureState, TextInstance } from '../types';

// ---------------------------------------------------------------------------
// Type structure validation tests
// These tests verify that the TypeScript interfaces match expected shapes.
// We do this by constructing valid objects and checking property access.
// ---------------------------------------------------------------------------

describe('DocumentFile type', () => {
  it('should accept pdf type', () => {
    const doc: DocumentFile = {
      type: 'pdf',
      name: 'test.pdf',
      url: 'blob:test',
      file: new File([''], 'test.pdf', { type: 'application/pdf' }),
    };
    expect(doc.type).toBe('pdf');
    expect(doc.name).toBe('test.pdf');
    expect(doc.url).toBe('blob:test');
    expect(doc.file).toBeInstanceOf(File);
  });

  it('should accept image type', () => {
    const doc: DocumentFile = {
      type: 'image',
      name: 'photo.png',
      url: 'blob:photo',
      file: new File([''], 'photo.png', { type: 'image/png' }),
    };
    expect(doc.type).toBe('image');
  });
});

describe('Coordinates type', () => {
  it('should store x, y, width, height as numbers', () => {
    const coords: Coordinates = { x: 10, y: 20, width: 100, height: 50 };
    expect(coords.x).toBe(10);
    expect(coords.y).toBe(20);
    expect(coords.width).toBe(100);
    expect(coords.height).toBe(50);
  });

  it('should allow zero values', () => {
    const coords: Coordinates = { x: 0, y: 0, width: 0, height: 0 };
    expect(coords.x).toBe(0);
  });

  it('should allow negative positions', () => {
    const coords: Coordinates = { x: -10, y: -20, width: 100, height: 50 };
    expect(coords.x).toBe(-10);
    expect(coords.y).toBe(-20);
  });
});

describe('SavedAsset type', () => {
  it('should store all required properties', () => {
    const asset: SavedAsset = {
      id: 'asset-123',
      url: 'data:image/png;base64,abc',
      originalUrl: 'data:image/png;base64,abc',
      aspectRatio: 2.5,
    };
    expect(asset.id).toBe('asset-123');
    expect(asset.url).toBe('data:image/png;base64,abc');
    expect(asset.originalUrl).toBe('data:image/png;base64,abc');
    expect(asset.aspectRatio).toBe(2.5);
  });
});

describe('SignatureInstance type', () => {
  it('should store all required properties', () => {
    const instance: SignatureInstance = {
      id: 'sig-1',
      pos: { x: 50, y: 100, width: 150, height: 60 },
      pageIndex: 1,
      url: 'data:image/png;base64,sig',
      aspectRatio: 2.5,
    };
    expect(instance.id).toBe('sig-1');
    expect(instance.pageIndex).toBe(1);
    expect(instance.aspectRatio).toBe(2.5);
  });

  it('should allow optional canvasWidth, canvasHeight, rotation', () => {
    const instance: SignatureInstance = {
      id: 'sig-2',
      pos: { x: 0, y: 0, width: 100, height: 40 },
      pageIndex: 2,
      canvasWidth: 800,
      canvasHeight: 600,
      url: 'data:image/png;base64,sig',
      aspectRatio: 2.5,
      rotation: 45,
    };
    expect(instance.canvasWidth).toBe(800);
    expect(instance.canvasHeight).toBe(600);
    expect(instance.rotation).toBe(45);
  });
});

describe('SignatureState type', () => {
  it('should store all required properties', () => {
    const state: SignatureState = {
      url: 'data:image/png;base64,processed',
      originalUrl: 'data:image/png;base64,original',
      bgRemovalTolerance: 50,
      pos: { x: 100, y: 100, width: 150, height: 60 },
      applyMode: 'single',
      customPages: '',
      excludedPages: '',
      instances: [],
      aspectRatio: 2.5,
    };
    expect(state.applyMode).toBe('single');
    expect(state.bgRemovalTolerance).toBe(50);
    expect(state.instances).toHaveLength(0);
  });

  it('should accept all valid applyMode values', () => {
    const modes: Array<'single' | 'all' | 'custom'> = ['single', 'all', 'custom'];
    modes.forEach(mode => {
      const state: SignatureState = {
        url: 'test',
        originalUrl: 'test',
        bgRemovalTolerance: 50,
        pos: { x: 0, y: 0, width: 100, height: 40 },
        applyMode: mode,
        customPages: '1, 3-5',
        excludedPages: '2',
        instances: [],
        aspectRatio: 2.0,
      };
      expect(state.applyMode).toBe(mode);
    });
  });

  it('should accept all valid bgRemovalMode values', () => {
    const modes: Array<'white' | 'black' | 'auto'> = ['white', 'black', 'auto'];
    modes.forEach(mode => {
      const state: SignatureState = {
        url: 'test',
        originalUrl: 'test',
        bgRemovalTolerance: 50,
        bgRemovalMode: mode,
        pos: { x: 0, y: 0, width: 100, height: 40 },
        applyMode: 'single',
        customPages: '',
        excludedPages: '',
        instances: [],
        aspectRatio: 2.0,
      };
      expect(state.bgRemovalMode).toBe(mode);
    });
  });

  it('should allow tintColor as optional string', () => {
    const state: SignatureState = {
      url: 'test',
      originalUrl: 'test',
      bgRemovalTolerance: 50,
      tintColor: '#ff0000',
      pos: { x: 0, y: 0, width: 100, height: 40 },
      applyMode: 'single',
      customPages: '',
      excludedPages: '',
      instances: [],
      aspectRatio: 2.0,
    };
    expect(state.tintColor).toBe('#ff0000');
  });

  it('should hold multiple signature instances', () => {
    const instances: SignatureInstance[] = [
      { id: '1', pos: { x: 10, y: 10, width: 100, height: 40 }, pageIndex: 1, url: 'sig1', aspectRatio: 2.5 },
      { id: '2', pos: { x: 50, y: 50, width: 120, height: 48 }, pageIndex: 2, url: 'sig2', aspectRatio: 2.5, rotation: 90 },
    ];
    const state: SignatureState = {
      url: 'test',
      originalUrl: 'test',
      bgRemovalTolerance: 50,
      pos: { x: 0, y: 0, width: 100, height: 40 },
      applyMode: 'all',
      customPages: '',
      excludedPages: '',
      instances,
      aspectRatio: 2.0,
    };
    expect(state.instances).toHaveLength(2);
    expect(state.instances[1].rotation).toBe(90);
  });
});

describe('TextInstance type', () => {
  it('should store all required properties', () => {
    const text: TextInstance = {
      id: 'text-1',
      text: 'Hello World',
      pageIndex: 1,
      pos: { x: 50, y: 100, width: 200, height: 40 },
      fontSize: 24,
      color: '#000000',
    };
    expect(text.id).toBe('text-1');
    expect(text.text).toBe('Hello World');
    expect(text.fontSize).toBe(24);
    expect(text.color).toBe('#000000');
  });

  it('should allow optional fontFamily, canvasWidth, canvasHeight', () => {
    const text: TextInstance = {
      id: 'text-2',
      text: 'With Font',
      pageIndex: 1,
      pos: { x: 0, y: 0, width: 100, height: 30 },
      fontSize: 16,
      color: '#2563eb',
      fontFamily: 'Courier',
      canvasWidth: 800,
      canvasHeight: 600,
    };
    expect(text.fontFamily).toBe('Courier');
    expect(text.canvasWidth).toBe(800);
    expect(text.canvasHeight).toBe(600);
  });
});
