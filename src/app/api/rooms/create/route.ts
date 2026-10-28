import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { generateRoomCode } from '@/lib/room-code';
import { createLiveKitToken } from '@/lib/livekit';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { mode = 'DUO', userId } = body;
    const hostId = userId || `host_${Math.random().toString(36).substring(7)}`;
    const code = generateRoomCode();
    const expiresAt = new Date(Date.now() + 300 * 1000); // 5 menit

    const room = await db.room.create({
      data: {
        code,
        hostId,
        expiresAt,
        status: mode === 'SOLO' ? 'CONNECTED' : 'WAITING',
      },
    });

    const token = await createLiveKitToken(code, hostId, 'Host');
    return NextResponse.json({ code, token, roomId: room.id, hostId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat ruangan' }, { status: 500 });
  }
}
