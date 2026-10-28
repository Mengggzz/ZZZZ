// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterSelector } from '../../src/components/editor/FilterSelector';
import { StickerPalette, STICKER_PALETTE } from '../../src/components/editor/StickerPalette';
import {
  StripEditor,
  type CaptureSlotData,
  type PlacedSticker,
} from '../../src/components/editor/StripEditor';

const mockCaptures: CaptureSlotData[] = [
  { slotIndex: 0, hostImgUrl: 'https://example.com/host-0.jpg', guestImgUrl: 'https://example.com/guest-0.jpg' },
  { slotIndex: 1, hostImgUrl: 'https://example.com/host-1.jpg', guestImgUrl: 'https://example.com/guest-1.jpg' },
  { slotIndex: 2, hostImgUrl: 'https://example.com/host-2.jpg', guestImgUrl: 'https://example.com/guest-2.jpg' },
  { slotIndex: 3, hostImgUrl: 'https://example.com/host-3.jpg', guestImgUrl: 'https://example.com/guest-3.jpg' },
];

const mockSoloCaptures: CaptureSlotData[] = [
  { slotIndex: 0, hostImgUrl: 'https://example.com/solo-0.jpg' },
  { slotIndex: 1, hostImgUrl: 'https://example.com/solo-1.jpg' },
  { slotIndex: 2, hostImgUrl: 'https://example.com/solo-2.jpg' },
  { slotIndex: 3, hostImgUrl: 'https://example.com/solo-3.jpg' },
];

describe('FilterSelector Component', () => {
  it('renders all filter presets and marks selected preset', () => {
    const onSelect = vi.fn();
    render(<FilterSelector selected="bw" onSelect={onSelect} />);

    const bwButton = screen.getByTestId('filter-option-bw');
    expect(bwButton.getAttribute('aria-pressed')).toBe('true');

    const originalButton = screen.getByTestId('filter-option-original');
    expect(originalButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(originalButton);
    expect(onSelect).toHaveBeenCalledWith('original');
  });
});

describe('StickerPalette Component', () => {
  it('renders at least 20 sticker emoji options', () => {
    const onAdd = vi.fn();
    render(<StickerPalette onAddSticker={onAdd} />);

    expect(STICKER_PALETTE.length).toBeGreaterThanOrEqual(20);
    const firstSticker = STICKER_PALETTE[0];
    const button = screen.getByTestId(`sticker-btn-0`);
    expect(button.textContent).toBe(firstSticker);

    fireEvent.click(button);
    expect(onAdd).toHaveBeenCalledWith(firstSticker);
  });
});

describe('StripEditor Component', () => {
  describe('Rendering & Slot Modes', () => {
    it('renders 4 slots in Duo mode with host and guest split images', () => {
      render(<StripEditor captures={mockCaptures} mode="duo" />);

      for (let i = 0; i < 4; i++) {
        const slotEl = screen.getByTestId(`strip-slot-${i}`);
        expect(slotEl).toBeDefined();

        const hostImg = screen.getByTestId(`slot-${i}-host`) as HTMLImageElement;
        const guestImg = screen.getByTestId(`slot-${i}-guest`) as HTMLImageElement;
        expect(hostImg.src).toContain(`host-${i}.jpg`);
        expect(guestImg.src).toContain(`guest-${i}.jpg`);
      }
    });

    it('renders 4 slots in Solo mode with only host image', () => {
      render(<StripEditor captures={mockSoloCaptures} mode="solo" />);

      for (let i = 0; i < 4; i++) {
        const hostImg = screen.getByTestId(`slot-${i}-host`) as HTMLImageElement;
        expect(hostImg.src).toContain(`solo-${i}.jpg`);
        expect(screen.queryByTestId(`slot-${i}-guest`)).toBeNull();
      }
    });
  });

  describe('Filter Mapping & Application', () => {
    it('applies default original filter (none) and updates to bw when selected', () => {
      const onFilterChange = vi.fn();
      render(<StripEditor captures={mockCaptures} onFilterChange={onFilterChange} />);

      const hostImg = screen.getByTestId('slot-0-host');
      expect(hostImg.style.filter).toBe('none');

      const bwOption = screen.getByTestId('filter-option-bw');
      fireEvent.click(bwOption);

      expect(onFilterChange).toHaveBeenCalledWith('bw');
      expect(hostImg.style.filter).toContain('grayscale(100%)');
    });

    it('applies vintage filter to all slot images', () => {
      render(<StripEditor captures={mockCaptures} filter="vintage" />);

      for (let i = 0; i < 4; i++) {
        const hostImg = screen.getByTestId(`slot-${i}-host`);
        expect(hostImg.style.filter).toContain('contrast(120%)');
      }
    });
  });

  describe('Layout Switching', () => {
    it('switches layout between STRIP_4X1 and GRID_2X2', () => {
      const onLayoutChange = vi.fn();
      render(<StripEditor captures={mockCaptures} onLayoutChange={onLayoutChange} />);

      const canvas = screen.getByTestId('strip-canvas');
      expect(canvas.getAttribute('data-layout')).toBe('STRIP_4X1');

      const gridBtn = screen.getByTestId('layout-btn-GRID_2X2');
      fireEvent.click(gridBtn);

      expect(onLayoutChange).toHaveBeenCalledWith('GRID_2X2');
      expect(canvas.getAttribute('data-layout')).toBe('GRID_2X2');

      const stripBtn = screen.getByTestId('layout-btn-STRIP_4X1');
      fireEvent.click(stripBtn);
      expect(onLayoutChange).toHaveBeenCalledWith('STRIP_4X1');
      expect(canvas.getAttribute('data-layout')).toBe('STRIP_4X1');
    });
  });

  describe('Frame Themes', () => {
    it('renders newspaper theme with Momoto LDR header by default and allows switching', () => {
      const onThemeChange = vi.fn();
      render(<StripEditor captures={mockCaptures} onThemeChange={onThemeChange} />);

      const canvas = screen.getByTestId('strip-canvas');
      expect(canvas.getAttribute('data-theme')).toBe('newspaper');
      expect(screen.getByTestId('newspaper-header')).toBeDefined();

      const pastelBtn = screen.getByTestId('theme-btn-pastel');
      fireEvent.click(pastelBtn);
      expect(onThemeChange).toHaveBeenCalledWith('pastel');
      expect(canvas.getAttribute('data-theme')).toBe('pastel');

      const cleanBtn = screen.getByTestId('theme-btn-clean');
      fireEvent.click(cleanBtn);
      expect(onThemeChange).toHaveBeenCalledWith('clean');
      expect(canvas.getAttribute('data-theme')).toBe('clean');
    });
  });

  describe('Slot Reordering', () => {
    it('moves slot down and notifies onReorderSlots callback', () => {
      const onReorder = vi.fn();
      render(<StripEditor captures={mockCaptures} onReorderSlots={onReorder} />);

      // Move slot 0 down
      const moveDownBtn = screen.getByTestId('slot-move-down-0');
      fireEvent.click(moveDownBtn);

      expect(onReorder).toHaveBeenCalled();
      const updatedSlots: CaptureSlotData[] = onReorder.mock.calls[0][0];
      // Index 0 should now be slotIndex 1
      expect(updatedSlots[0].slotIndex).toBe(1);
      expect(updatedSlots[1].slotIndex).toBe(0);
    });

    it('moves slot up and notifies onReorderSlots callback', () => {
      const onReorder = vi.fn();
      render(<StripEditor captures={mockCaptures} onReorderSlots={onReorder} />);

      // Move slot 1 up
      const moveUpBtn = screen.getByTestId('slot-move-up-1');
      fireEvent.click(moveUpBtn);

      expect(onReorder).toHaveBeenCalled();
      const updatedSlots: CaptureSlotData[] = onReorder.mock.calls[0][0];
      expect(updatedSlots[0].slotIndex).toBe(1);
      expect(updatedSlots[1].slotIndex).toBe(0);
    });
  });

  describe('Retake Controls', () => {
    it('calls onRetakeSlot when retake slot button is clicked', () => {
      const onRetakeSlot = vi.fn();
      render(<StripEditor captures={mockCaptures} onRetakeSlot={onRetakeSlot} />);

      const retakeBtn = screen.getByTestId('retake-slot-2');
      fireEvent.click(retakeBtn);

      expect(onRetakeSlot).toHaveBeenCalledWith(2);
    });

    it('calls onRetakeAll when retake all button is clicked', () => {
      const onRetakeAll = vi.fn();
      render(<StripEditor captures={mockCaptures} onRetakeAll={onRetakeAll} />);

      const retakeAllBtn = screen.getByTestId('retake-all-btn');
      fireEvent.click(retakeAllBtn);

      expect(onRetakeAll).toHaveBeenCalled();
    });
  });

  describe('Stickers Overlay & Positioning', () => {
    it('adds sticker to canvas when clicked in StickerPalette', () => {
      const onStickersChange = vi.fn();
      render(<StripEditor captures={mockCaptures} onStickersChange={onStickersChange} />);

      const stickerBtn = screen.getByTestId('sticker-btn-0');
      const emoji = STICKER_PALETTE[0];
      fireEvent.click(stickerBtn);

      expect(onStickersChange).toHaveBeenCalled();
      const stickers: PlacedSticker[] = onStickersChange.mock.calls[0][0];
      expect(stickers.length).toBe(1);
      expect(stickers[0].emoji).toBe(emoji);
      expect(stickers[0].x).toBe(50);
      expect(stickers[0].y).toBe(50);

      const placedSticker = screen.getByTestId(`placed-sticker-${stickers[0].id}`);
      expect(placedSticker.textContent).toContain(emoji);
    });

    it('allows updating sticker position coordinates', () => {
      const initialStickers: PlacedSticker[] = [
        { id: 'stk-1', emoji: '❤️', x: 20, y: 30 },
      ];
      const onStickersChange = vi.fn();
      render(
        <StripEditor
          captures={mockCaptures}
          stickers={initialStickers}
          onStickersChange={onStickersChange}
        />
      );

      const stickerEl = screen.getByTestId('placed-sticker-stk-1');
      expect(stickerEl.style.left).toBe('20%');
      expect(stickerEl.style.top).toBe('30%');

      // Update position via move controls
      const moveRightBtn = screen.getByTestId('sticker-move-right-stk-1');
      fireEvent.click(moveRightBtn);

      expect(onStickersChange).toHaveBeenCalled();
      const lastCall = onStickersChange.mock.calls[onStickersChange.mock.calls.length - 1][0];
      expect(lastCall[0].x).toBe(25); // moved by 5%
    });

    it('removes sticker when remove button is clicked', () => {
      const initialStickers: PlacedSticker[] = [
        { id: 'stk-1', emoji: '❤️', x: 20, y: 30 },
      ];
      const onStickersChange = vi.fn();
      render(
        <StripEditor
          captures={mockCaptures}
          stickers={initialStickers}
          onStickersChange={onStickersChange}
        />
      );

      const removeBtn = screen.getByTestId('sticker-remove-stk-1');
      fireEvent.click(removeBtn);

      expect(onStickersChange).toHaveBeenCalledWith([]);
      expect(screen.queryByTestId('placed-sticker-stk-1')).toBeNull();
    });
  });
});
