import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createRoomHandler } from '../../src/app/api/rooms/create/route';
import { POST as joinRoomHandler } from '../../src/app/api/rooms/join/route';
import { GET as getRoomStatusHandler } from '../../src/app/api/rooms/[code]/status/route';
import { createLiveKitToken } from '../../src/lib/livekit';

// In-memory mock database for room operations
const mockRooms = new Map<string, any>();

vi.mock('@/lib/prisma', () => ({
  db: {
    room: {
      create: vi.fn(async ({ data }: { data: any }) => {
        const room = {
          id: `room_${Math.random().toString(36).substring(7)}`,
          code: data.code,
          status: data.status,
          hostId: data.hostId,
          guestId: data.guestId ?? null,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
          sessionTimer: 300,
        };
        mockRooms.set(room.code, room);
        return room;
      }),
      findUnique: vi.fn(async ({ where }: { where: { code?: string; id?: string } }) => {
        if (where.code) {
          return mockRooms.get(where.code) ?? null;
        }
        for (const room of mockRooms.values()) {
          if (room.id === where.id) return room;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        for (const [code, room] of mockRooms.entries()) {
          if (room.id === where.id) {
            const updated = { ...room, ...data };
            mockRooms.set(code, updated);
            return updated;
          }
        }
        throw new Error('Room not found for update');
      }),
    },
  },
}));

describe('LiveKit Token Service', () => {
  it('generates a valid non-empty JWT token for participant', async () => {
    const token = await createLiveKitToken('ROOM12', 'user_123', 'Host');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    // JWT has 3 parts separated by dots
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('Room API Handlers', () => {
  beforeEach(() => {
    mockRooms.clear();
  });

  describe('POST /api/rooms/create', () => {
    it('creates a DUO room and returns code and token', async () => {
      const req = new Request('http://localhost/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'DUO', userId: 'user-host-123' }),
      });
      const res = await createRoomHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.code).toHaveLength(6);
      expect(data.token).toBeDefined();
      expect(data.roomId).toBeDefined();
      expect(data.hostId).toBe('user-host-123');

      // Verify room stored in DB
      const stored = mockRooms.get(data.code);
      expect(stored).toBeDefined();
      expect(stored.status).toBe('WAITING');
    });

    it('creates a SOLO room with CONNECTED status', async () => {
      const req = new Request('http://localhost/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'SOLO' }),
      });
      const res = await createRoomHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.code).toHaveLength(6);
      expect(data.token).toBeDefined();
      expect(data.hostId).toBeDefined();

      const stored = mockRooms.get(data.code);
      expect(stored.status).toBe('CONNECTED');
    });
  });

  describe('POST /api/rooms/join', () => {
    it('joins an existing room with valid code', async () => {
      // First create a room
      const createReq = new Request('http://localhost/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'DUO', userId: 'user-host-123' }),
      });
      const createRes = await createRoomHandler(createReq);
      const { code, roomId } = await createRes.json();

      // Now join the room
      const joinReq = new Request('http://localhost/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId: 'user-guest-456' }),
      });
      const joinRes = await joinRoomHandler(joinReq);
      expect(joinRes.status).toBe(200);
      const joinData = await joinRes.json();
      expect(joinData.token).toBeDefined();
      expect(joinData.roomId).toBe(roomId);
      expect(joinData.guestId).toBe('user-guest-456');
      expect(joinData.hostId).toBe('user-host-123');

      // Verify status updated to CONNECTED
      const stored = mockRooms.get(code);
      expect(stored.status).toBe('CONNECTED');
      expect(stored.guestId).toBe('user-guest-456');
    });

    it('returns 404 when joining with invalid code', async () => {
      const req = new Request('http://localhost/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'INVALID', userId: 'user-guest-456' }),
      });
      const res = await joinRoomHandler(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('returns 404 when room is EXPIRED or COMPLETED', async () => {
      // Create expired room manually
      mockRooms.set('EXP123', {
        id: 'room-exp',
        code: 'EXP123',
        status: 'EXPIRED',
        hostId: 'host-1',
        guestId: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      const req = new Request('http://localhost/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'EXP123', userId: 'guest-1' }),
      });
      const res = await joinRoomHandler(req);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/rooms/[code]/status', () => {
    it('returns 404 for non-existent room', async () => {
      const req = new Request('http://localhost/api/rooms/NOTFND/status');
      const res = await getRoomStatusHandler(req, {
        params: Promise.resolve({ code: 'NOTFND' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns room status, remainingSeconds, and participants for valid room', async () => {
      const expiresAt = new Date(Date.now() + 240 * 1000); // 240 seconds remaining
      mockRooms.set('ABCDEF', {
        id: 'room-abc',
        code: 'ABCDEF',
        status: 'CONNECTED',
        hostId: 'host-abc',
        guestId: 'guest-abc',
        expiresAt,
      });

      const req = new Request('http://localhost/api/rooms/ABCDEF/status');
      const res = await getRoomStatusHandler(req, {
        params: Promise.resolve({ code: 'ABCDEF' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('CONNECTED');
      expect(data.remainingSeconds).toBeGreaterThan(230);
      expect(data.remainingSeconds).toBeLessThanOrEqual(240);
      expect(data.participants.host).toBe('host-abc');
      expect(data.participants.guest).toBe('guest-abc');
    });
  });
});
