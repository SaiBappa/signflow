import '@testing-library/jest-dom';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';

// --- localStorage / sessionStorage ---
// Node exposes an experimental Web Storage global that shadows jsdom's
// implementation but is unusable without --localstorage-file, so a component
// calling localStorage.getItem() throws "getItem is not a function".
// Install a plain in-memory Storage instead.
function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const storage = createStorage();
  for (const target of new Set<object>([window, globalThis])) {
    Object.defineProperty(target, name, { value: storage, writable: true, configurable: true });
  }
}

// Keep storage from leaking between tests.
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

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

// --- matchMedia mock ---
// jsdom does not implement matchMedia; useIsMobile() relies on it.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any;
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
