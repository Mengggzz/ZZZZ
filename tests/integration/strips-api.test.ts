import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as renderStripHandler } from '../../src/app/api/strips/render/route';

const mockRooms = new Map<string, any>();
const mockStrips = new Map<string, any>();

vi.mock('@/lib/prisma', () => ({
  db: {
    room: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
        if (where.id) return mockRooms.get(where.id) ?? null;
        for (const room of mockRooms.values()) {
          if (room.code === where.code) return room;
        }
        return null;
      }),
    },
    strip: {
      upsert: vi.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: { roomId: string };
          update: any;
          create: any;
        }) => {
          const existing = mockStrips.get(where.roomId);
          if (existing) {
            const updated = { ...existing, ...update, updatedAt: new Date() };
            mockStrips.set(where.roomId, updated);
            return updated;
          }
          const created = {
            id: `strip_${Math.random().toString(36).substring(7)}`,
            ...create,
            createdAt: new Date(),
          };
          mockStrips.set(where.roomId, created);
          return created;
        }
      ),
      findUnique: vi.fn(async ({ where }: { where: { roomId?: string; id?: string } }) => {
        if (where.roomId) return mockStrips.get(where.roomId) ?? null;
        for (const strip of mockStrips.values()) {
          if (strip.id === where.id) return strip;
        }
        return null;
      }),
    },
  },
}));

describe('Strip Render API Handlers', () => {
  beforeEach(() => {
    mockRooms.clear();
    mockStrips.clear();
  });

  describe('POST /api/strips/render', () => {
    it('returns 400 when roomId is missing', async () => {
      const req = new Request('http://localhost/api/strips/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: 'STRIP_4X1',
        }),
      });

      const res = await renderStripHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('returns 404 when room does not exist', async () => {
      const req = new Request('http://localhost/api/strips/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: 'non-existent-room-id',
          layout: 'STRIP_4X1',
        }),
      });

      const res = await renderStripHandler(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Room not found');
    });

    it('successfully creates strip and returns watermarked and hd URLs', async () => {
      const roomId = 'room_12345';
      mockRooms.set(roomId, {
        id: roomId,
        code: 'TEST01',
        status: 'CONNECTED',
      });

      const req = new Request('http://localhost/api/strips/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          layout: 'STRIP_4X1',
          frameTheme: 'newspaper',
          filter: 'vintage',
          stickers: [{ id: 'stk-1', emoji: '✨', x: 50, y: 50 }],
        }),
      });

      const res = await renderStripHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.stripId).toBeDefined();
      expect(data.watermarkedUrl).toContain(`/api/strips/${roomId}/watermarked.png`);
      expect(data.hdUrl).toContain(`/api/strips/${roomId}/hd.png`);

      // Verify strip saved in DB
      const stored = mockStrips.get(roomId);
      expect(stored).toBeDefined();
      expect(stored.layout).toBe('STRIP_4X1');
      expect(stored.frameTheme).toBe('newspaper');
      expect(stored.filter).toBe('vintage');
      expect(stored.stickersJson).toBeDefined();
    });

    it('upserts existing strip when re-rendered for the same room', async () => {
      const roomId = 'room_multi_render';
      mockRooms.set(roomId, {
        id: roomId,
        code: 'TEST02',
        status: 'CONNECTED',
      });

      // First render
      const req1 = new Request('http://localhost/api/strips/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          layout: 'STRIP_4X1',
          frameTheme: 'newspaper',
        }),
      });
      const res1 = await renderStripHandler(req1);
      const data1 = await res1.json();
      const firstStripId = data1.stripId;

      // Second render with different layout & theme
      const req2 = new Request('http://localhost/api/strips/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          layout: 'GRID_2X2',
          frameTheme: 'pastel',
          filter: 'sepia',
        }),
      });
      const res2 = await renderStripHandler(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();

      expect(data2.success).toBe(true);
      expect(data2.stripId).toBe(firstStripId);

      const stored = mockStrips.get(roomId);
      expect(stored.layout).toBe('GRID_2X2');
      expect(stored.frameTheme).toBe('pastel');
      expect(stored.filter).toBe('sepia');
    });
  });
});
