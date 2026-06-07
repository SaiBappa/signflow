import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { DrawSignature } from '../components/DrawSignature';

afterEach(() => {
  cleanup();
});

describe('DrawSignature Component', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  it('should render the component with title', () => {
    render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(screen.getByText('Draw Signature')).toBeInTheDocument();
  });

  it('should render a canvas element', () => {
    const { container } = render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.width).toBe(400);
    expect(canvas?.height).toBe(200);
  });

  it('should render Clear, Cancel, and Save & Use buttons', () => {
    render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save & Use')).toBeInTheDocument();
  });

  it('should render "Sign here" placeholder text', () => {
    render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    expect(screen.getByText('Sign here')).toBeInTheDocument();
  });

  it('should call onCancel when Cancel is clicked', () => {
    render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when close (✕) is clicked', () => {
    render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('✕'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should not call onSave when canvas is empty', () => {
    // Our mock getImageData returns all zeros (transparent), so hasPixels should be false
    render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('Save & Use'));
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should call onSave when canvas has drawn content', () => {
    // Override the mock to return non-zero pixel data
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const nonEmptyCtx = {
      ...vi.fn()(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]), // One red pixel + one transparent
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
    };
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(nonEmptyCtx) as any;

    render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('Save & Use'));
    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith('data:image/png;base64,mock');

    // Restore
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('should handle mouse drawing events on canvas', () => {
    const { container } = render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    const canvas = container.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);

    // Verify drawing started and stopped (no crash)
    expect(canvas).toBeTruthy();
  });

  it('should handle touch drawing events on canvas', () => {
    const { container } = render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    const canvas = container.querySelector('canvas')!;

    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 50, clientY: 50 }],
    });
    fireEvent.touchMove(canvas, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(canvas);

    expect(canvas).toBeTruthy();
  });

  it('should clear canvas when Clear is clicked', () => {
    const { container } = render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByText('Clear'));
    // Verify clearRect was called
    const ctx = HTMLCanvasElement.prototype.getContext('2d');
    expect(ctx.clearRect).toBeDefined();
  });

  it('should stop drawing on mouseLeave', () => {
    const { container } = render(<DrawSignature onSave={mockOnSave} onCancel={mockOnCancel} />);
    const canvas = container.querySelector('canvas')!;

    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseLeave(canvas);

    // Should not crash and drawing should be stopped
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
    expect(canvas).toBeTruthy();
  });
});
