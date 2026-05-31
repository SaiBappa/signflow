import '@testing-library/jest-dom';

// --- Canvas mock ---
// HTMLCanvasElement.getContext doesn't work in jsdom, so we provide a minimal mock.
const mockCtx: Partial<CanvasRenderingContext2D> = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({
    data: new Uint8ClampedArray(4 * 100 * 100), // 100x100 transparent black
  }),
  putImageData: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  scale: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  set lineCap(_v: CanvasLineCap) {},
  set lineJoin(_v: CanvasLineJoin) {},
  set lineWidth(_v: number) {},
  set strokeStyle(_v: string | CanvasGradient | CanvasPattern) {},
};

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx) as any;
HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
HTMLCanvasElement.prototype.toBlob = vi.fn(function (this: HTMLCanvasElement, cb: BlobCallback) {
  cb(new Blob(['mock'], { type: 'image/png' }));
}) as any;

// --- URL.createObjectURL / revokeObjectURL ---
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = vi.fn();
}

// --- crypto.randomUUID ---
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }),
    },
  });
}

// --- ResizeObserver mock ---
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = MockResizeObserver as any;

// Suppress console.error noise during tests (optional)
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress React act warnings and expected test errors
    if (typeof args[0] === 'string' && args[0].includes('act(')) return;
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});
