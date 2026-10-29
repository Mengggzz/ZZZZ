import { describe, it, expect, vi } from 'vitest';
import {
  calculateStripCanvasDimensions,
  calculateSlotCoordinates,
  drawWatermark,
  generateCompositeAssetUrls,
} from '../../src/lib/composite-renderer';

describe('Composite Dimensions', () => {
  it('calculates correct canvas dimensions for 4x1 strip', () => {
    const dim = calculateStripCanvasDimensions('STRIP_4X1', 800);
    expect(dim.width).toBe(800);
    expect(dim.height).toBeGreaterThan(2400); // 4 vertical slots + margins & footer
    expect(dim.margin).toBe(40);
    expect(dim.slotWidth).toBe(720);
    expect(dim.slotHeight).toBe(480);
    expect(dim.footerHeight).toBe(280);
  });

  it('calculates correct canvas dimensions for 2x2 grid', () => {
    const dim = calculateStripCanvasDimensions('GRID_2X2', 1200);
    expect(dim.width).toBe(1200);
    expect(dim.height).toBeGreaterThan(1200);
    expect(dim.margin).toBe(48);
    expect(dim.slotWidth).toBe(528);
    expect(dim.slotHeight).toBe(352);
    expect(dim.footerHeight).toBe(300);
  });

  it('calculates slot coordinates for 4x1 and 2x2 layouts', () => {
    const slots4x1 = calculateSlotCoordinates('STRIP_4X1', 800);
    expect(slots4x1).toHaveLength(4);
    expect(slots4x1[0].x).toBe(40);
    expect(slots4x1[0].width).toBe(720);
    expect(slots4x1[0].height).toBe(480);
    expect(slots4x1[1].y).toBeGreaterThan(slots4x1[0].y);

    const slots2x2 = calculateSlotCoordinates('GRID_2X2', 1200);
    expect(slots2x2).toHaveLength(4);
    expect(slots2x2[0].x).toBe(48);
    expect(slots2x2[1].x).toBeGreaterThan(slots2x2[0].x);
    expect(slots2x2[2].y).toBeGreaterThan(slots2x2[0].y);
  });

  it('generates composite asset urls with layout parameter', () => {
    const urls = generateCompositeAssetUrls('room-123', 'STRIP_4X1');
    expect(urls.watermarkedUrl).toContain('/api/strips/room-123/watermarked.png');
    expect(urls.watermarkedUrl).toContain('layout=STRIP_4X1');
    expect(urls.hdUrl).toContain('/api/strips/room-123/hd.png');
    expect(urls.hdUrl).toContain('layout=STRIP_4X1');
  });
});

describe('Watermark Drawing', () => {
  it('draws default Virtualan watermark across canvas', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      font: '',
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
    } as unknown as CanvasRenderingContext2D;

    drawWatermark(ctx, 1000, 2000);

    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
    expect(ctx.textAlign).toBe('center');
    expect(ctx.textBaseline).toBe('middle');
    expect(ctx.fillText).toHaveBeenCalled();
    const calls = (ctx.fillText as any).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call[0]).toBe('Virtualan');
      expect(call[1]).toBe(500); // width / 2
    }
  });

  it('draws custom watermark text', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      font: '',
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
    } as unknown as CanvasRenderingContext2D;

    drawWatermark(ctx, 800, 1600, 'Custom Watermark');

    expect(ctx.fillText).toHaveBeenCalled();
    const calls = (ctx.fillText as any).mock.calls;
    expect(calls[0][0]).toBe('Custom Watermark');
    expect(calls[0][1]).toBe(400);
  });
});
