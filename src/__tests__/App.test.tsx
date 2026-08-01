import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ---------------------------------------------------------------------------
// NOTE: App.tsx imports pdf.js and pdf-lib which are heavy. We mock them.
// ---------------------------------------------------------------------------
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 3,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 600, height: 800, convertToPdfPoint: vi.fn().mockReturnValue([0, 0]) }),
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
      embedPng: vi.fn().mockResolvedValue({}),
      embedJpg: vi.fn().mockResolvedValue({}),
      embedFont: vi.fn().mockResolvedValue({}),
      save: vi.fn().mockResolvedValue(new Uint8Array()),
      create: vi.fn(),
    }),
    create: vi.fn().mockResolvedValue({
      addPage: vi.fn(),
      embedPng: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
      embedJpg: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
      save: vi.fn().mockResolvedValue(new Uint8Array()),
    }),
  },
  rgb: vi.fn().mockReturnValue({}),
  StandardFonts: { Helvetica: 'Helvetica', TimesRoman: 'TimesRoman', Courier: 'Courier' },
  degrees: vi.fn().mockReturnValue(0),
}));

vi.mock('jszip', () => {
  const mockZip = {
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(new Blob(['mock-zip'])),
  };
  return { default: vi.fn(() => mockZip) };
});

vi.mock('react-rnd', () => ({
  Rnd: ({ children, ...props }: any) => <div data-testid="rnd-wrapper">{children}</div>,
}));

vi.mock('motion/react', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} data-testid="motion-div" {...filterDOMProps(props)}>
        {children}
      </div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Helper to filter out non-DOM props from motion
function filterDOMProps(props: Record<string, any>) {
  const nonDom = ['initial', 'animate', 'exit', 'transition', 'layoutId', 'whileHover', 'whileTap'];
  const filtered: Record<string, any> = {};
  for (const key in props) {
    if (!nonDom.includes(key)) filtered[key] = props[key];
  }
  return filtered;
}

// Mock the components that have complex internals
vi.mock('../components/DocumentViewer', () => ({
  DocumentViewer: (props: any) => (
    <div data-testid="document-viewer">
      <div id="document-canvas-container">
        <div id="document-canvas-content" style={{ width: 600, height: 800 }} />
      </div>
    </div>
  ),
}));

vi.mock('../components/DrawSignature', () => ({
  DrawSignature: ({ onSave, onCancel }: any) => (
    <div data-testid="draw-signature">
      <button onClick={() => onSave('data:image/png;base64,drawn')}>Save Drawing</button>
      <button onClick={onCancel}>Cancel Drawing</button>
    </div>
  ),
}));

vi.mock('../components/Organize', () => ({
  Organize: () => <div data-testid="organize-tab">Organize Content</div>,
}));

vi.mock('../components/Compress', () => ({
  Compress: () => <div data-testid="compress-tab">Compress Content</div>,
}));

vi.mock('../components/Convert', () => ({
  Convert: () => <div data-testid="convert-tab">Convert Content</div>,
}));

vi.mock('../components/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

// Clear localStorage before tests
beforeEach(() => {
  // jsdom's localStorage may be broken/non-standard.
  // Provide a simple in-memory polyfill that matches the Storage API.
  const store: Record<string, string> = {};
  const storageMock: Storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
  Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true, configurable: true });
});

afterEach(() => {
  cleanup();
});

import App from '../App';

// ---------------------------------------------------------------------------
// App Component Tests
// ---------------------------------------------------------------------------
describe('App Component', () => {
  // --- Rendering ---
  describe('Initial Rendering', () => {
    it('should render the app header with SignFlow title', () => {
      render(<App />);
      expect(screen.getByText('SignFlow')).toBeInTheDocument();
    });

    it('should render "No document selected" when no file uploaded', () => {
      render(<App />);
      expect(screen.getByText('No document selected')).toBeInTheDocument();
    });

    it('should display the upload dropzone by default', () => {
      render(<App />);
      expect(screen.getByText('Upload your document')).toBeInTheDocument();
    });

    it('should show supported file types in the dropzone', () => {
      render(<App />);
      expect(screen.getByText('📄 PDF')).toBeInTheDocument();
      expect(screen.getByText('🖼️ PNG / JPG')).toBeInTheDocument();
    });

    it('should display the privacy/security badge', () => {
      render(<App />);
      expect(screen.getByText('100% secure. Processing is fully local in your browser.')).toBeInTheDocument();
    });

    it('should render the Footer component', () => {
      render(<App />);
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });
  });

  // --- Navigation Tabs ---
  describe('Tab Navigation', () => {
    it('should render all navigation tabs (desktop + mobile)', () => {
      render(<App />);
      // Desktop and mobile nav both render these labels, so expect multiple
      expect(screen.getAllByText('Fill & Sign').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Organize').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Compress').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Convert').length).toBeGreaterThanOrEqual(2);
    });

    it('should start on Fill & Sign tab by default', () => {
      render(<App />);
      expect(screen.getByText('Upload your document')).toBeInTheDocument();
    });

    it('should switch to Organize tab when clicked', async () => {
      render(<App />);
      const tabs = screen.getAllByText('Organize');
      fireEvent.click(tabs[0]);
      expect(screen.getByTestId('organize-tab')).toBeInTheDocument();
    });

    it('should switch to Compress tab when clicked', async () => {
      render(<App />);
      const tabs = screen.getAllByText('Compress');
      fireEvent.click(tabs[0]);
      expect(screen.getByTestId('compress-tab')).toBeInTheDocument();
    });

    it('should switch to Convert tab when clicked', async () => {
      render(<App />);
      const tabs = screen.getAllByText('Convert');
      fireEvent.click(tabs[0]);
      expect(screen.getByTestId('convert-tab')).toBeInTheDocument();
    });

    it('should switch back to Fill & Sign from another tab', async () => {
      render(<App />);
      // Go to Organize
      const organizeTabs = screen.getAllByText('Organize');
      fireEvent.click(organizeTabs[0]);
      expect(screen.getByTestId('organize-tab')).toBeInTheDocument();

      // Go back to Fill & Sign
      const signTabs = screen.getAllByText('Fill & Sign');
      fireEvent.click(signTabs[0]);
      expect(screen.getByText('Upload your document')).toBeInTheDocument();
    });
  });

  // --- Mobile Bottom Navigation ---
  describe('Mobile Bottom Navigation', () => {
    it('should render mobile tab labels', () => {
      render(<App />);
      expect(screen.getByText('Sign')).toBeInTheDocument();
      // "Organize", "Compress", "Convert" already tested above
    });
  });

  // --- Document Upload ---
  describe('Document Upload', () => {
    it('should display the document name after upload', async () => {
      render(<App />);
      const file = new File(['pdf-content'], 'my-doc.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"][accept*="application/pdf"]') as HTMLInputElement;
      expect(input).toBeTruthy();

      await userEvent.upload(input!, file);

      await waitFor(() => {
        expect(screen.getByText('my-doc.pdf')).toBeInTheDocument();
      });
    });

    it('should show the document viewer after uploading a PDF', async () => {
      render(<App />);
      const file = new File(['pdf-content'], 'test.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"][accept*="application/pdf"]') as HTMLInputElement;

      await userEvent.upload(input!, file);

      await waitFor(() => {
        expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
      });
    });

    it('should show the signature creation area after uploading a document', async () => {
      render(<App />);
      const file = new File(['pdf-content'], 'doc.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"][accept*="application/pdf"]') as HTMLInputElement;

      await userEvent.upload(input!, file);

      await waitFor(() => {
        expect(screen.getByText('Signatures')).toBeInTheDocument();
      });
    });

    it('should show Upload and Draw signature options', async () => {
      render(<App />);
      const file = new File(['pdf-content'], 'doc.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"][accept*="application/pdf"]') as HTMLInputElement;

      await userEvent.upload(input!, file);

      await waitFor(() => {
        expect(screen.getByText('Upload')).toBeInTheDocument();
      });
      // 'Draw' is also a tool-rail and mobile-bar action, so more than one exists.
      expect(screen.getAllByRole('button', { name: 'Draw' }).length).toBeGreaterThan(0);
    });
  });

  // --- Saved Signatures / localStorage ---
  describe('Saved Signatures (localStorage)', () => {
    it('should initialize with empty savedAssets if localStorage is empty', () => {
      render(<App />);
      // No saved assets badges should be visible
      expect(screen.queryByText('Saved:')).not.toBeInTheDocument();
    });

    it('should load saved signatures from localStorage on mount', () => {
      const mockAssets = [
        { id: 'asset-1', url: 'data:image/png;base64,saved1', originalUrl: 'data:image/png;base64,saved1', aspectRatio: 2.0 },
      ];
      localStorage.setItem('signflow_saved_signatures', JSON.stringify(mockAssets));
      render(<App />);
      // Saved assets are only visible when a document is open, so this test
      // just verifies the component doesn't crash.
      expect(screen.getByText('SignFlow')).toBeInTheDocument();
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('signflow_saved_signatures', 'not-valid-json{{{');
      expect(() => render(<App />)).not.toThrow();
    });
  });

  // --- Export button ---
  describe('Download / Export', () => {
    it('should render a disabled download button when no document is loaded', () => {
      render(<App />);
      // The download button is always rendered in the Fill & Sign tab header.
      // Without a document and signature, it should be disabled.
      const btn = screen.getByText('Finish & Download');
      expect(btn).toBeInTheDocument();
      const button = btn.closest('button');
      expect(button).toBeDisabled();
    });
  });
});
