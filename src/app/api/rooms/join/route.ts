import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { createLiveKitToken } from '@/lib/livekit';

export async function POST(req: Request) {
  try {
    const { code, userId } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Kode ruangan diperlukan' }, { status: 400 });
    }

    const room = await db.room.findUnique({ where: { code } });

    if (!room) {
      return NextResponse.json({ error: 'Ruangan tidak ditemukan atau sudah kedaluwarsa' }, { status: 404 });
    }

    if (room.status === 'EXPIRED' || new Date() > room.expiresAt) {
      return NextResponse.json({ error: 'Ruangan tidak ditemukan atau sudah kedaluwarsa' }, { status: 404 });
    }

    if (room.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Sesi ruangan sudah selesai' }, { status: 404 });
    }

    const guestId = userId || `guest_${Math.random().toString(36).substring(7)}`;

    // Guard against 3rd participant overwrite
    if (room.guestId && room.guestId !== guestId) {
      return NextResponse.json({ error: 'Ruangan sudah penuh' }, { status: 409 });
    }

    await db.room.update({
      where: { id: room.id },
      data: { guestId, status: 'CONNECTED' },
    });

    const token = await createLiveKitToken(code, guestId, 'Teman');
    return NextResponse.json({ token, roomId: room.id, guestId, hostId: room.hostId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal bergabung ke ruangan' }, { status: 500 });
  }
}
