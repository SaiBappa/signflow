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
import type { DocumentFile, SignatureState, TextInstance } from '../types';

// Wrapper component that manages state like App.tsx does
function TestWrapper({ initialTexts = [] }: { initialTexts?: TextInstance[] }) {
  const [texts, setTexts] = useState<TextInstance[]>(initialTexts);
  const [signature, setSignature] = useState<SignatureState | null>(null);

  const mockDocument: DocumentFile = {
    type: 'pdf',
    name: 'test.pdf',
    url: 'blob:test-url',
    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
  };

  return (
    <div style={{ width: 800, height: 600 }}>
      <DocumentViewer
        document={mockDocument}
        signature={signature}
        setSignature={setSignature}
        texts={texts}
        setTexts={setTexts}
      />
      {/* Expose texts count for assertions */}
      <div data-testid="text-count">{texts.length}</div>
      <div data-testid="text-data">{JSON.stringify(texts)}</div>
    </div>
  );
}

describe('Add Text button', () => {
  it('should toggle text placement mode when clicked', async () => {
    render(<TestWrapper />);

    // Wait for the button to appear
    const addTextButton = await waitFor(() => {
      return screen.getByTitle('Add text field to page');
    }, { timeout: 3000 });

    expect(addTextButton).toBeTruthy();
    expect(addTextButton.textContent).toContain('Add Text');

    // Before click: no texts
    expect(screen.getByTestId('text-count').textContent).toBe('0');

    // Click Add Text — should enter placement mode
    await act(async () => {
      fireEvent.click(addTextButton);
    });

    // Button should now show placement mode text
    expect(addTextButton.textContent).toContain('Click on page');

    // No text created yet (need to click on page)
    expect(screen.getByTestId('text-count').textContent).toBe('0');

    // Click again to cancel placement mode
    await act(async () => {
      fireEvent.click(addTextButton);
    });

    expect(addTextButton.textContent).toContain('Add Text');
  });

  it('should start with no texts and placement mode off', async () => {
    render(<TestWrapper />);

    const addTextButton = await waitFor(() => {
      return screen.getByTitle('Add text field to page');
    }, { timeout: 3000 });

    expect(screen.getByTestId('text-count').textContent).toBe('0');
    expect(addTextButton.textContent).toContain('Add Text');
  });
});
