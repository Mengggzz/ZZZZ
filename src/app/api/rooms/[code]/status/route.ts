import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  try {
    const resolvedParams = await params;
    const { code } = resolvedParams;

    const room = await db.room.findUnique({ where: { code } });

    if (!room) {
      return NextResponse.json({ error: 'Ruangan tidak ditemukan' }, { status: 404 });
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(room.expiresAt).getTime() - Date.now()) / 1000)
    );

    return NextResponse.json({
      code: room.code,
      roomId: room.id,
      status: room.status,
      remainingSeconds,
      participants: {
        host: room.hostId,
        guest: room.guestId ?? null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memeriksa status ruangan' },
      { status: 500 }
    );
  }
}
