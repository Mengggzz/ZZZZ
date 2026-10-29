// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmModal } from '../../src/components/booth/ConfirmModal';
import { SessionTimer } from '../../src/components/booth/SessionTimer';
import HomePage from '../../src/app/page';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ code: '5F5KEA' }),
}));

describe('ConfirmModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ConfirmModal isOpen={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal content and triggers callbacks when isOpen is true', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(<ConfirmModal isOpen={true} onCancel={onCancel} onConfirm={onConfirm} />);

    expect(screen.getByText('Buat stripmu?')).toBeDefined();
    expect(
      screen.getByText(/Susunan, filter, dan foto akan terkunci permanen/)
    ).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: 'Ya, buat' });
    const cancelBtn = screen.getByRole('button', { name: 'Lanjut edit' });

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('SessionTimer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats time correctly and ticks down', () => {
    const onExpire = vi.fn();
    render(<SessionTimer initialSeconds={300} onExpire={onExpire} />);

    expect(screen.getByText('5:00')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('4:58')).toBeDefined();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('calls onExpire when timer hits 0', () => {
    const onExpire = vi.fn();
    render(<SessionTimer initialSeconds={2} onExpire={onExpire} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onExpire).toHaveBeenCalled();
  });
});

describe('HomePage Component', () => {
  beforeEach(() => {
    mockPush.mockClear();
    global.fetch = vi.fn();
  });

  it('renders landing page with title and mode choices', () => {
    render(<HomePage />);

    expect(screen.getByText('Mau foto bagaimana hari ini?')).toBeDefined();
    expect(screen.getByText('Sendiri')).toBeDefined();
    expect(screen.getByText('Berdua')).toBeDefined();
    expect(screen.getByPlaceholderText('MASUKKAN KODE RUANGAN')).toBeDefined();
  });

  it('creates solo room and navigates', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 'ABC234' }),
    });

    render(<HomePage />);
    const soloBtn = screen.getByText('Sendiri');

    await act(async () => {
      fireEvent.click(soloBtn);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/rooms/create', expect.anything());
    expect(mockPush).toHaveBeenCalledWith('/booth/ABC234');
  });

  it('validates 6-digit room code before joining', async () => {
    render(<HomePage />);
    const input = screen.getByPlaceholderText('MASUKKAN KODE RUANGAN');
    const joinBtn = screen.getByRole('button', { name: 'Gabung' });

    // Disabled when incomplete
    expect(joinBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(input, { target: { value: '5F5KEA' } });
    expect(joinBtn.hasAttribute('disabled')).toBe(false);

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'mock-token' }),
    });

    await act(async () => {
      fireEvent.click(joinBtn);
    });

    expect(mockPush).toHaveBeenCalledWith('/booth/5F5KEA');
  });
});
