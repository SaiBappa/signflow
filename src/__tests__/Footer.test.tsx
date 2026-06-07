import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import Footer from '../components/Footer';

afterEach(() => {
  cleanup();
});

describe('Footer Component', () => {
  it('should render the footer element', () => {
    render(<Footer />);
    const footer = document.querySelector('footer');
    expect(footer).toBeTruthy();
  });

  it('should display the current year copyright', () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${currentYear}`))).toBeInTheDocument();
  });

  it('should contain a link to clouds.mv', () => {
    render(<Footer />);
    const link = screen.getByText('clouds.mv');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://clouds.mv');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
    expect(link.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should contain a WhatsApp contact link', () => {
    render(<Footer />);
    const whatsappLink = screen.getByText('Chat with us');
    expect(whatsappLink).toBeInTheDocument();
    expect(whatsappLink.closest('a')).toHaveAttribute('href', 'https://wa.me/9607779324');
    expect(whatsappLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(whatsappLink.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render the WhatsApp SVG icon', () => {
    const { container } = render(<Footer />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('should be hidden on mobile (md:flex class)', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer');
    expect(footer?.className).toContain('hidden');
    expect(footer?.className).toContain('md:flex');
  });

  it('should include safe-area-inset padding for notched devices', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer') as HTMLElement;
    expect(footer.style.paddingBottom).toContain('env(safe-area-inset-bottom)');
  });
});
