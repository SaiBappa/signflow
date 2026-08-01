import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import React, { useState } from 'react';

// --- Mocks ---
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
        render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      }),
      destroy: vi.fn(),
    }),
  }),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'mock-worker-url',
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      getPages: vi.fn().mockReturnValue([]),
      copyPages: vi.fn().mockResolvedValue([{
        getRotation: vi.fn().mockReturnValue({ angle: 0 }),
        setRotation: vi.fn(),
      }]),
      addPage: vi.fn(),
      save: vi.fn().mockResolvedValue(new Uint8Array()),
      getPageCount: vi.fn().mockReturnValue(1),
    }),
    create: vi.fn().mockResolvedValue({
      addPage: vi.fn(),
      copyPages: vi.fn().mockResolvedValue([{
        getRotation: vi.fn().mockReturnValue({ angle: 0 }),
        setRotation: vi.fn(),
      }]),
      save: vi.fn().mockResolvedValue(new Uint8Array()),
      getPageCount: vi.fn().mockReturnValue(1),
      embedPng: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
      embedJpg: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
    }),
  },
  degrees: vi.fn().mockReturnValue(0),
}));

vi.mock('jszip', () => {
  const mockZip = {
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(new Blob(['mock-zip'])),
  };
  return { default: vi.fn(() => mockZip) };
});

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn().mockReturnValue({}),
  useSensors: vi.fn().mockReturnValue([]),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  rectSortingStrategy: vi.fn(),
  useSortable: vi.fn().mockReturnValue({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn((arr: any[], from: number, to: number) => {
    const newArr = [...arr];
    const [item] = newArr.splice(from, 1);
    newArr.splice(to, 0, item);
    return newArr;
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn().mockReturnValue(''),
    },
  },
}));

// IntersectionObserver mock
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(globalThis as any).IntersectionObserver = MockIntersectionObserver;

afterEach(() => {
  cleanup();
});

import { DocumentViewer } from '../components/DocumentViewer';
import type {
  DocumentFile,
  RedactInstance,
  SignatureState,
  StampInstance,
  TextInstance,
} from '../types';

// Wrapper component that manages state like App.tsx does.
// Text placement mode is owned by App and passed down to the viewer, so the
// harness plays App's part: it holds the flag and exposes a toggle.
function TestWrapper({ initialTexts = [] }: { initialTexts?: TextInstance[] }) {
  const [texts, setTexts] = useState<TextInstance[]>(initialTexts);
  const [signature, setSignature] = useState<SignatureState | null>(null);
  const [stamps, setStamps] = useState<StampInstance[]>([]);
  const [redacts, setRedacts] = useState<RedactInstance[]>([]);
  const [textPlacementMode, setTextPlacementMode] = useState(false);

  const mockDocument: DocumentFile = {
    type: 'pdf',
    name: 'test.pdf',
    url: 'blob:test-url',
    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
  };

  return (
    <div style={{ width: 800, height: 600 }}>
      <button data-testid="toggle-placement" onClick={() => setTextPlacementMode(v => !v)}>
        toggle
      </button>
      <DocumentViewer
        document={mockDocument}
        signature={signature}
        setSignature={setSignature}
        texts={texts}
        setTexts={setTexts}
        stamps={stamps}
        setStamps={setStamps}
        redacts={redacts}
        setRedacts={setRedacts}
        textPlacementMode={textPlacementMode}
        onTextPlacementModeChange={setTextPlacementMode}
      />
      {/* Expose state for assertions */}
      <div data-testid="text-count">{texts.length}</div>
      <div data-testid="placement-mode">{String(textPlacementMode)}</div>
      <div data-testid="text-data">{JSON.stringify(texts)}</div>
    </div>
  );
}

describe('Add Text placement', () => {
  it('should start with no texts and placement mode off', async () => {
    render(<TestWrapper />);

    await waitFor(() => {
      expect(screen.getByTestId('text-count')).toBeInTheDocument();
    });

    expect(screen.getByTestId('text-count').textContent).toBe('0');
    expect(screen.getByTestId('placement-mode').textContent).toBe('false');
  });

  it('should not create a text while placement mode is off', async () => {
    render(<TestWrapper />);

    const pageEl = await waitFor(
      () => {
        const el = document.querySelector('[data-page-number]');
        if (!el) throw new Error('page not rendered yet');
        return el;
      },
      { timeout: 3000 }
    );

    await act(async () => {
      fireEvent.click(pageEl);
    });

    expect(screen.getByTestId('text-count').textContent).toBe('0');
  });

  it('should place a text and leave placement mode when the page is clicked', async () => {
    render(<TestWrapper />);

    const pageEl = await waitFor(
      () => {
        const el = document.querySelector('[data-page-number]');
        if (!el) throw new Error('page not rendered yet');
        return el;
      },
      { timeout: 3000 }
    );

    // App turns placement mode on…
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-placement'));
    });
    expect(screen.getByTestId('placement-mode').textContent).toBe('true');

    // …then a click on the page creates the text instance.
    await act(async () => {
      fireEvent.click(pageEl);
    });

    await waitFor(() => {
      expect(screen.getByTestId('text-count').textContent).toBe('1');
    });

    // The viewer reports back that placement is done.
    expect(screen.getByTestId('placement-mode').textContent).toBe('false');

    const placed = JSON.parse(screen.getByTestId('text-data').textContent || '[]');
    expect(placed[0]).toMatchObject({ text: '', fontSize: 18, fontFamily: 'Helvetica' });
  });
});
