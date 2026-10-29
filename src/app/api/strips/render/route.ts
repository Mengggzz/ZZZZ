import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { generateCompositeAssetUrls, StripLayout } from '@/lib/composite-renderer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      roomId,
      layout = 'STRIP_4X1',
      frameTheme = 'newspaper',
      filter = 'original',
      stickers = [],
    } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId wajib disertakan' }, { status: 400 });
    }

    const room =
      (await db.room.findUnique({ where: { id: roomId } })) ||
      (await db.room.findUnique({ where: { code: roomId } }));

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const validLayout: StripLayout = layout === 'GRID_2X2' ? 'GRID_2X2' : 'STRIP_4X1';
    const assetUrls = generateCompositeAssetUrls(room.id, validLayout);

    const strip = await db.strip.upsert({
      where: { roomId: room.id },
      update: {
        layout: validLayout,
        frameTheme,
        filter,
        stickersJson: stickers,
        watermarkedUrl: assetUrls.watermarkedUrl,
        hdUrl: assetUrls.hdUrl,
      },
      create: {
        roomId: room.id,
        layout: validLayout,
        frameTheme,
        filter,
        stickersJson: stickers,
        watermarkedUrl: assetUrls.watermarkedUrl,
        hdUrl: assetUrls.hdUrl,
        isPaid: false,
      },
    });

    return NextResponse.json({
      success: true,
      stripId: strip.id,
      watermarkedUrl: strip.watermarkedUrl,
      hdUrl: strip.hdUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memproses strip render' },
      { status: 500 }
    );
  }
}
