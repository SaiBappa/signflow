import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

// Mock heavy dependencies
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

// We need to mock DnD kit for Organize
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

afterEach(() => {
  cleanup();
});

import { Compress } from '../components/Compress';
import { Convert } from '../components/Convert';
import { Organize } from '../components/Organize';

// ---------------------------------------------------------------------------
// Compress Component
// ---------------------------------------------------------------------------
describe('Compress Component', () => {
  it('should render the compression heading', () => {
    render(<Compress />);
    expect(screen.getByText('Compress PDF')).toBeInTheDocument();
  });

  it('should render the description text', () => {
    render(<Compress />);
    expect(screen.getByText('Reduce file size while preserving document fidelity.')).toBeInTheDocument();
  });

  it('should render three compression levels', () => {
    render(<Compress />);
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Aggressive')).toBeInTheDocument();
  });

  it('should show Balanced as default selected level', () => {
    render(<Compress />);
    const desc = screen.getByText('Removes unused objects and metadata');
    expect(desc).toBeInTheDocument();
  });

  it('should switch description when level changes', () => {
    render(<Compress />);
    fireEvent.click(screen.getByText('Light'));
    expect(screen.getByText('Compact structure, keeps all metadata & quality')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Aggressive'));
    expect(screen.getByText('Maximum reduction — strips everything possible')).toBeInTheDocument();
  });

  it('should show the upload dropzone when no file is loaded', () => {
    render(<Compress />);
    expect(screen.getByText('Drop PDF here or click to select')).toBeInTheDocument();
    expect(screen.getByText('PDF files only')).toBeInTheDocument();
  });

  it('should accept only PDF files', () => {
    const { container } = render(<Compress />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input?.accept).toBe('application/pdf');
  });

  it('should display file info after upload', async () => {
    const { container } = render(<Compress />);
    const file = new File(['test-content'.repeat(100)], 'large-doc.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('large-doc.pdf')).toBeInTheDocument();
      expect(screen.getByText('Compress PDF', { selector: 'button' })).toBeInTheDocument();
    });
  });

  it('should show Remove button after file upload', async () => {
    const { container } = render(<Compress />);
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });
  });

  it('should clear file when Remove is clicked', async () => {
    const { container } = render(<Compress />);
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remove'));

    await waitFor(() => {
      expect(screen.getByText('Drop PDF here or click to select')).toBeInTheDocument();
    });
  });

  it('should ignore non-PDF files', () => {
    const { container } = render(<Compress />);
    const file = new File(['content'], 'image.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    // Should still show dropzone since PNG is rejected
    expect(screen.getByText('Drop PDF here or click to select')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Convert Component
// ---------------------------------------------------------------------------
describe('Convert Component', () => {
  it('should render the conversion heading', () => {
    render(<Convert />);
    expect(screen.getByText('Convert Documents')).toBeInTheDocument();
  });

  it('should render the description text', () => {
    render(<Convert />);
    expect(screen.getByText('Convert images to PDF, or extract pages from a PDF as images.')).toBeInTheDocument();
  });

  it('should show the upload dropzone', () => {
    render(<Convert />);
    expect(screen.getByText('Drag & drop files or click to browse')).toBeInTheDocument();
    expect(screen.getByText('Supports PDF, JPG, PNG')).toBeInTheDocument();
  });

  it('should accept PDF, JPG, and PNG files', () => {
    const { container } = render(<Convert />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input?.accept).toBe('image/jpeg,image/png,application/pdf');
    expect(input?.multiple).toBe(true);
  });

  it('should show "Convert Images to PDF" button when images are uploaded', async () => {
    const { container } = render(<Convert />);
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Convert Images to PDF')).toBeInTheDocument();
    });
  });

  it('should show "Convert PDF to Images" button when PDF is uploaded', async () => {
    const { container } = render(<Convert />);
    const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Convert PDF to Images (ZIP)')).toBeInTheDocument();
    });
  });

  it('should show file count after upload', async () => {
    const { container } = render(<Convert />);
    const files = [
      new File(['img1'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['img2'], 'b.png', { type: 'image/png' }),
    ];
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', { value: files });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('2 file(s) selected')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Organize Component
// ---------------------------------------------------------------------------
describe('Organize Component', () => {
  it('should render the organize heading', () => {
    render(<Organize />);
    expect(screen.getByText('Organize PDF Pages')).toBeInTheDocument();
  });

  it('should render the description text', () => {
    render(<Organize />);
    expect(screen.getByText(/Drag to reorder/)).toBeInTheDocument();
  });

  it('should show the upload dropzone when no PDFs are loaded', () => {
    render(<Organize />);
    expect(screen.getByText('Upload PDF files to organize pages')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop files here, or click to browse')).toBeInTheDocument();
  });

  it('should accept only PDF files', () => {
    const { container } = render(<Organize />);
    const inputs = container.querySelectorAll('input[type="file"]');
    // There can be multiple file inputs (dropzone + "Add PDFs" button)
    inputs.forEach(input => {
      expect((input as HTMLInputElement).accept).toBe('application/pdf');
    });
  });
});
