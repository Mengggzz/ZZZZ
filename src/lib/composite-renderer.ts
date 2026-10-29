export type StripLayout = 'STRIP_4X1' | 'GRID_2X2';

export interface StripCanvasDimensions {
  width: number;
  height: number;
  margin: number;
  slotWidth: number;
  slotHeight: number;
  footerHeight: number;
  headerHeight: number;
}

export interface SlotCoordinates {
  slotIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompositeSticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export interface CompositeRenderConfig {
  roomId: string;
  layout?: StripLayout;
  frameTheme?: string;
  filter?: string;
  stickers?: CompositeSticker[];
}

export function calculateStripCanvasDimensions(
  layout: StripLayout,
  baseWidth: number
): StripCanvasDimensions {
  if (layout === 'STRIP_4X1') {
    const margin = Math.round(baseWidth * 0.05);
    const headerHeight = Math.round(baseWidth * 0.12);
    const slotWidth = baseWidth - margin * 2;
    const slotHeight = Math.round(slotWidth * (2 / 3)); // 3:2 ratio
    const footerHeight = Math.round(baseWidth * 0.35);
    const totalHeight = headerHeight + margin + (slotHeight + margin) * 4 + footerHeight;
    return {
      width: baseWidth,
      height: totalHeight,
      margin,
      slotWidth,
      slotHeight,
      footerHeight,
      headerHeight,
    };
  } else {
    const margin = Math.round(baseWidth * 0.04);
    const headerHeight = Math.round(baseWidth * 0.1);
    const slotWidth = Math.round((baseWidth - margin * 3) / 2);
    const slotHeight = Math.round(slotWidth * (2 / 3));
    const footerHeight = Math.round(baseWidth * 0.25);
    const totalHeight = headerHeight + margin + (slotHeight + margin) * 2 + footerHeight;
    return {
      width: baseWidth,
      height: totalHeight,
      margin,
      slotWidth,
      slotHeight,
      footerHeight,
      headerHeight,
    };
  }
}

export function calculateSlotCoordinates(
  layout: StripLayout,
  baseWidth: number
): SlotCoordinates[] {
  const dim = calculateStripCanvasDimensions(layout, baseWidth);
  const startY = dim.margin + dim.headerHeight;
  const slots: SlotCoordinates[] = [];

  if (layout === 'STRIP_4X1') {
    for (let i = 0; i < 4; i++) {
      const y = startY + i * (dim.slotHeight + dim.margin);
      slots.push({
        slotIndex: i,
        x: dim.margin,
        y,
        width: dim.slotWidth,
        height: dim.slotHeight,
      });
    }
  } else {
    // GRID_2X2: 0=(row0, col0), 1=(row0, col1), 2=(row1, col0), 3=(row1, col1)
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = dim.margin + col * (dim.slotWidth + dim.margin);
      const y = startY + row * (dim.slotHeight + dim.margin);
      slots.push({
        slotIndex: i,
        x,
        y,
        width: dim.slotWidth,
        height: dim.slotHeight,
      });
    }
  }

  return slots;
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text = 'Virtualan'
) {
  ctx.save();
  ctx.font = `bold ${Math.round(width * 0.045)}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw diagonally repeated pattern
  for (let y = height * 0.2; y < height * 0.8; y += height * 0.2) {
    ctx.fillText(text, width / 2, y);
  }
  ctx.restore();
}

export function generateCompositeAssetUrls(roomId: string, layout: StripLayout = 'STRIP_4X1') {
  const timestamp = Date.now();
  return {
    watermarkedUrl: `/api/strips/${roomId}/watermarked.png?t=${timestamp}&layout=${layout}`,
    hdUrl: `/api/strips/${roomId}/hd.png?t=${timestamp}&layout=${layout}`,
  };
}
