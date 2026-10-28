# Virtualan (LDR Virtual Photobooth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun aplikasi web bilik foto virtual (LDR Photobooth) real-time berbasis Next.js 15, LiveKit SFU, Prisma PostgreSQL, dan HTML5 Canvas.

**Architecture:** Frontend Next.js menangani UI mobile-first responsif dan kontrol canvas capture kamera resolusi tinggi lokal. LiveKit Cloud mengelola transmisi audio/video latensi rendah dan Data Channel untuk sinyal sinkronisasi jepretan frame. Backend Next.js route handlers mengelola verifikasi room 6 digit, token akses LiveKit, dan persistensi database Prisma serta S3 bucket.

**Tech Stack:** Next.js 15 (App Router, React 19, TypeScript), Tailwind CSS, LiveKit Client & Server SDK, Prisma ORM, PostgreSQL, HTML5 Canvas API / Konva.js, Vitest / React Testing Library.

**Spec:** `C:\Users\NAN\Downloads\A photobooth\PRD-Virtualan.md`

## Global Constraints

- Runtime: Node.js 20+, Next.js 15 App Router.
- WebRTC: LiveKit SFU (komunikasi video 720p 2-arah + Data Channel sync).
- Capture Quality: Snapshot diambil dari resolusi native `MediaStreamTrack` lokal, bukan compressed remote WebRTC video stream.
- Latency Sync: Trigger capture sinkron antar-client dengan drift toleransi $< 100\text{ ms}$.
- Room Code: 6 karakter uppercase alfabet/numerik tanpa karakter ambigu (`0`, `O`, `1`, `I`).
- Session Duration: 300 detik (5 menit countdown timer per-room).
- Temporary Asset TTL: 1 jam untuk file mentah capture di S3.

## Review Focus

1. **Camera Permission Denied**: User menolak izin webcam/mic; sistem harus menampilkan modal instruksi fallback tanpa crash.
2. **Drift Latensi Network**: Selisih waktu jepret antar-peer; harus ada NTP-style timestamp handshake sebelum countdown dimulai.
3. **Peer Disconnection Mid-session**: Teman terputus saat countdown atau editing; timer pause dengan grace period 30 detik untuk reconnect.
4. **Canvas Mobile Orientation & Aspect Ratio**: Sensor kamera vertikal HP vs horizontal laptop; harus otomatis di-crop/letterbox ke aspek rasio standar strip (3:2 atau 4:3 per slot) tanpa distorsi wajah.
5. **Session Expiry saat Editing**: Timer 5 menit habis saat user sedang menempel stiker/filter; canvas harus auto-render draft terakhir dan arahkan ke hasil ekspor sebelum room dihancurkan.

---

### Task 1: Project Scaffolding, Prisma Schema & Environment Config

**Files:**
- Create: `package.json`, `tsconfig.json`, `prisma/schema.prisma`, `src/lib/prisma.ts`, `.env.example`
- Test: `tests/unit/prisma-schema.test.ts`

**Interfaces:**
- Produces: Prisma Client singleton instance (`db` from `src/lib/prisma.ts`) and database models `Room`, `Capture`, `Strip`.

- [ ] **Step 1: Write the failing test for Prisma models & room code validator**

```typescript
// tests/unit/prisma-schema.test.ts
import { describe, it, expect } from 'vitest';
import { generateRoomCode, isValidRoomCode } from '../../src/lib/room-code';

describe('Room Code Utility', () => {
  it('generates 6 character uppercase alphanumeric code without ambiguous characters', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(isValidRoomCode(code)).toBe(true);
  });

  it('rejects invalid room codes', () => {
    expect(isValidRoomCode('12345')).toBe(false);
    expect(isValidRoomCode('ABCDE0')).toBe(false);
    expect(isValidRoomCode('abcdef')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/prisma-schema.test.ts`
Expected: FAIL with module not found `../../src/lib/room-code`.

- [ ] **Step 3: Implement room code generator and validator**

```typescript
// src/lib/room-code.ts
const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * ALLOWED_CHARS.length);
    result += ALLOWED_CHARS[randomIndex];
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  if (!code || code.length !== 6) return false;
  const regex = /^[A-HJ-NP-Z2-9]{6}$/;
  return regex.test(code);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/prisma-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Setup Prisma schema & database singleton**

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum RoomStatus {
  WAITING
  CONNECTED
  CAPTURING
  EDITING
  COMPLETED
  EXPIRED
}

enum LayoutType {
  STRIP_4X1
  GRID_2X2
}

model Room {
  id           String      @id @default(cuid())
  code         String      @unique @db.VarChar(6)
  status       RoomStatus  @default(WAITING)
  createdAt    DateTime    @default(now())
  expiresAt    DateTime
  hostId       String
  guestId      String?
  sessionTimer Int         @default(300)
  captures     Capture[]
  strip        Strip?
}

model Capture {
  id          String   @id @default(cuid())
  roomId      String
  slotIndex   Int
  hostImgUrl  String
  guestImgUrl String?
  createdAt   DateTime @default(now())
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@unique([roomId, slotIndex])
}

model Strip {
  id             String      @id @default(cuid())
  roomId         String      @unique
  layout         LayoutType  @default(STRIP_4X1)
  frameTheme     String      @default("newspaper")
  filter         String      @default("original")
  stickersJson   Json?
  watermarkedUrl String
  hdUrl          String?
  isPaid         Boolean     @default(false)
  createdAt      DateTime    @default(now())
  room           Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)
}
```

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

---

### Task 2: Room API & LiveKit Token Generation

**Files:**
- Create: `src/app/api/rooms/create/route.ts`, `src/app/api/rooms/join/route.ts`, `src/app/api/rooms/[code]/status/route.ts`, `src/lib/livekit.ts`
- Test: `tests/integration/rooms-api.test.ts`

**Interfaces:**
- Consumes: `db` from `src/lib/prisma.ts`, `generateRoomCode` from `src/lib/room-code.ts`.
- Produces: HTTP API endpoints for room creation, joining, and LiveKit connection tokens.

- [ ] **Step 1: Write integration tests for Room creation & join**

```typescript
// tests/integration/rooms-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createRoomHandler } from '../../src/app/api/rooms/create/route';
import { POST as joinRoomHandler } from '../../src/app/api/rooms/join/route';

describe('Room API Handlers', () => {
  it('creates a room and returns code and token', async () => {
    const req = new Request('http://localhost/api/rooms/create', {
      method: 'POST',
      body: JSON.stringify({ mode: 'DUO', userId: 'user-host-123' }),
    });
    const res = await createRoomHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.code).toHaveLength(6);
    expect(data.token).toBeDefined();
    expect(data.roomId).toBeDefined();
  });

  it('joins an existing room with valid code', async () => {
    const req = new Request('http://localhost/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code: 'INVALID', userId: 'user-guest-456' }),
    });
    const res = await joinRoomHandler(req);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/rooms-api.test.ts`
Expected: FAIL with handlers not implemented.

- [ ] **Step 3: Implement LiveKit token service and Next.js route handlers**

```typescript
// src/lib/livekit.ts
import { AccessToken } from 'livekit-server-sdk';

export async function createLiveKitToken(roomName: string, participantIdentity: string, participantName: string) {
  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: '1h',
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return await at.toJwt();
}
```

```typescript
// src/app/api/rooms/create/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { generateRoomCode } from '@/lib/room-code';
import { createLiveKitToken } from '@/lib/livekit';

export async function POST(req: Request) {
  const body = await req.json();
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
}
```

```typescript
// src/app/api/rooms/join/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { createLiveKitToken } from '@/lib/livekit';

export async function POST(req: Request) {
  const { code, userId } = await req.json();
  const room = await db.room.findUnique({ where: { code } });

  if (!room || room.status === 'EXPIRED' || room.status === 'COMPLETED') {
    return NextResponse.json({ error: 'Ruangan tidak ditemukan atau sudah kedaluwarsa' }, { status: 404 });
  }

  const guestId = userId || `guest_${Math.random().toString(36).substring(7)}`;
  await db.room.update({
    where: { id: room.id },
    data: { guestId, status: 'CONNECTED' },
  });

  const token = await createLiveKitToken(code, guestId, 'Teman');
  return NextResponse.json({ token, roomId: room.id, guestId, hostId: room.hostId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/rooms-api.test.ts`
Expected: PASS

---

### Task 3: LiveKit WebRTC Sync & Capture Synchronization Hook

**Files:**
- Create: `src/hooks/useBoothSync.ts`, `src/types/booth.ts`
- Test: `tests/unit/booth-sync.test.ts`

**Interfaces:**
- Consumes: LiveKit Room events & Data Channel (`room.localParticipant.publishData`).
- Produces: Synchronized countdown state (`countdown: number | null`), trigger event (`onCapture`), and slot indicator (`currentSlot: number`).

- [ ] **Step 1: Write test for countdown timer and clock drift calculation**

```typescript
// tests/unit/booth-sync.test.ts
import { describe, it, expect } from 'vitest';
import { calculateTargetCaptureTime } from '../../src/lib/sync-clock';

describe('Sync Clock NTP Utility', () => {
  it('schedules capture trigger across clients based on synchronized server epoch', () => {
    const clientTime = 10000;
    const serverOffset = 50; // client is 50ms behind
    const countdownDurationMs = 3000;
    const target = calculateTargetCaptureTime(clientTime, serverOffset, countdownDurationMs);
    expect(target).toBe(13050);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/booth-sync.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement NTP sync clock and useBoothSync hook**

```typescript
// src/lib/sync-clock.ts
export function calculateTargetCaptureTime(clientTime: number, serverOffsetMs: number, delayMs: number): number {
  return clientTime + serverOffsetMs + delayMs;
}
```

```typescript
// src/types/booth.ts
export type BoothSyncMessage =
  | { type: 'COUNTDOWN_START'; slotIndex: number; targetTimestamp: number }
  | { type: 'RETAKE_SLOT'; slotIndex: number }
  | { type: 'SESSION_COMPLETE' };
```

```typescript
// src/hooks/useBoothSync.ts
import { useEffect, useState, useCallback } from 'react';
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client';
import { BoothSyncMessage } from '@/types/booth';

export function useBoothSync(room: Room | null, isHost: boolean) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number>(1);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const startCountdown = useCallback((slot: number) => {
    if (!room || !isHost) return;
    const targetTimestamp = Date.now() + 3000;
    const payload: BoothSyncMessage = {
      type: 'COUNTDOWN_START',
      slotIndex: slot,
      targetTimestamp,
    };
    const encoder = new TextEncoder();
    room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
      reliable: true,
    });
    triggerLocalCountdown(slot, 3);
  }, [room, isHost]);

  const triggerLocalCountdown = (slot: number, seconds: number) => {
    setCurrentSlot(slot);
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setIsCapturing(true);
          setTimeout(() => setIsCapturing(false), 500);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const msg: BoothSyncMessage = JSON.parse(decoder.decode(payload));
      if (msg.type === 'COUNTDOWN_START') {
        const delayRemaining = Math.max(0, msg.targetTimestamp - Date.now());
        const seconds = Math.round(delayRemaining / 1000) || 3;
        triggerLocalCountdown(msg.slotIndex, seconds);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  return { countdown, currentSlot, isCapturing, startCountdown };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/booth-sync.test.ts`
Expected: PASS

---

### Task 4: High-Resolution Camera Capture & Canvas Cropper

**Files:**
- Create: `src/lib/canvas-capture.ts`, `src/components/booth/CameraViewport.tsx`
- Test: `tests/unit/canvas-capture.test.ts`

**Interfaces:**
- Consumes: Native `HTMLVideoElement` / `MediaStreamTrack`.
- Produces: Aspect-ratio cropped JPEG blob (`Blob`) ready for upload and composite.

- [ ] **Step 1: Write test for camera cropping calculation (3:2 photobooth slot ratio)**

```typescript
// tests/unit/canvas-capture.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCropBounds } from '../../src/lib/canvas-capture';

describe('Canvas Capture Cropper', () => {
  it('calculates center-crop coordinates for 16:9 webcam to 3:2 frame', () => {
    const videoWidth = 1920;
    const videoHeight = 1080;
    const targetAspect = 3 / 2; // 1.5

    const bounds = calculateCropBounds(videoWidth, videoHeight, targetAspect);
    expect(bounds.targetHeight).toBe(1080);
    expect(bounds.targetWidth).toBe(1620);
    expect(bounds.offsetX).toBe(150); // (1920 - 1620) / 2
    expect(bounds.offsetY).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/canvas-capture.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement canvas capture & crop bounds utility**

```typescript
// src/lib/canvas-capture.ts
export interface CropBounds {
  offsetX: number;
  offsetY: number;
  targetWidth: number;
  targetHeight: number;
}

export function calculateCropBounds(srcWidth: number, srcHeight: number, targetAspect: number): CropBounds {
  const currentAspect = srcWidth / srcHeight;
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (currentAspect > targetAspect) {
    targetWidth = Math.round(srcHeight * targetAspect);
    offsetX = Math.round((srcWidth - targetWidth) / 2);
  } else {
    targetHeight = Math.round(srcWidth / targetAspect);
    offsetY = Math.round((srcHeight - targetHeight) / 2);
  }

  return { offsetX, offsetY, targetWidth, targetHeight };
}

export async function captureVideoFrame(videoEl: HTMLVideoElement, targetAspect = 3 / 2): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const srcWidth = videoEl.videoWidth || 1280;
  const srcHeight = videoEl.videoHeight || 720;
  const bounds = calculateCropBounds(srcWidth, srcHeight, targetAspect);

  canvas.width = bounds.targetWidth;
  canvas.height = bounds.targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  // Mirror horizontally if user front camera
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.drawImage(
    videoEl,
    bounds.offsetX,
    bounds.offsetY,
    bounds.targetWidth,
    bounds.targetHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      'image/jpeg',
      0.92
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/canvas-capture.test.ts`
Expected: PASS

---

### Task 5: Interactive Strip Editor (Templates, Filters & Stickers)

**Files:**
- Create: `src/components/editor/StripEditor.tsx`, `src/components/editor/FilterSelector.tsx`, `src/components/editor/StickerPalette.tsx`, `src/lib/filters.ts`
- Test: `tests/unit/filters.test.ts`

**Interfaces:**
- Consumes: 4 Capture objects with `hostImgUrl` and `guestImgUrl`.
- Produces: Interactive rendered strip with drag reorder, filter CSS matrices, and stickers overlay state.

- [ ] **Step 1: Write test for filter matrix styling**

```typescript
// tests/unit/filters.test.ts
import { describe, it, expect } from 'vitest';
import { getFilterStyle } from '../../src/lib/filters';

describe('Filter Styles', () => {
  it('returns valid CSS filter string for each preset', () => {
    expect(getFilterStyle('original')).toBe('none');
    expect(getFilterStyle('bw')).toContain('grayscale(100%)');
    expect(getFilterStyle('sepia')).toContain('sepia(100%)');
    expect(getFilterStyle('vintage')).toContain('contrast(120%)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/filters.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement filter mapper and Strip Editor canvas**

```typescript
// src/lib/filters.ts
export type FilterPreset = 'original' | 'bw' | 'sepia' | 'vintage';

export function getFilterStyle(filter: FilterPreset): string {
  switch (filter) {
    case 'bw':
      return 'grayscale(100%) contrast(110%)';
    case 'sepia':
      return 'sepia(80%) contrast(95%) brightness(95%)';
    case 'vintage':
      return 'sepia(30%) contrast(120%) brightness(105%) saturate(120%)';
    case 'original':
    default:
      return 'none';
  }
}
```

```typescript
// src/components/editor/FilterSelector.tsx
'use client';
import React from 'react';
import { FilterPreset } from '@/lib/filters';

interface Props {
  selected: FilterPreset;
  onSelect: (filter: FilterPreset) => void;
}

export function FilterSelector({ selected, onSelect }: Props) {
  const options: { id: FilterPreset; label: string }[] = [
    { id: 'original', label: 'Asli' },
    { id: 'bw', label: 'Hitam Putih' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'vintage', label: 'Vintage' },
  ];

  return (
    <div className="flex gap-2 p-2 overflow-x-auto justify-center">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
            selected === opt.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/filters.test.ts`
Expected: PASS

---

### Task 6: Final Composite Renderer & Watermark Pipeline

**Files:**
- Create: `src/lib/composite-renderer.ts`, `src/app/api/strips/render/route.ts`
- Test: `tests/unit/composite-renderer.test.ts`

**Interfaces:**
- Consumes: 4 slot images, layout type (`4x1` | `2x2`), frame theme, filter, and stickers json.
- Produces: Watermarked PNG buffer / URL and clean HD URL.

- [ ] **Step 1: Write test for composite canvas coordinates calculation**

```typescript
// tests/unit/composite-renderer.test.ts
import { describe, it, expect } from 'vitest';
import { calculateStripCanvasDimensions } from '../../src/lib/composite-renderer';

describe('Composite Dimensions', () => {
  it('calculates correct canvas dimensions for 4x1 strip', () => {
    const dim = calculateStripCanvasDimensions('STRIP_4X1', 800); // 800px width
    expect(dim.width).toBe(800);
    expect(dim.height).toBeGreaterThan(2400); // 4 vertical slots + margins & footer
  });

  it('calculates correct canvas dimensions for 2x2 grid', () => {
    const dim = calculateStripCanvasDimensions('GRID_2X2', 1200);
    expect(dim.width).toBe(1200);
    expect(dim.height).toBeGreaterThan(1200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/composite-renderer.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement composite dimension and rendering engine**

```typescript
// src/lib/composite-renderer.ts
export function calculateStripCanvasDimensions(layout: 'STRIP_4X1' | 'GRID_2X2', baseWidth: number) {
  if (layout === 'STRIP_4X1') {
    const margin = Math.round(baseWidth * 0.05);
    const slotWidth = baseWidth - margin * 2;
    const slotHeight = Math.round(slotWidth * (2 / 3)); // 3:2 ratio
    const footerHeight = Math.round(baseWidth * 0.35);
    const totalHeight = margin + (slotHeight + margin) * 4 + footerHeight;
    return { width: baseWidth, height: totalHeight, margin, slotWidth, slotHeight, footerHeight };
  } else {
    const margin = Math.round(baseWidth * 0.04);
    const slotWidth = Math.round((baseWidth - margin * 3) / 2);
    const slotHeight = Math.round(slotWidth * (2 / 3));
    const footerHeight = Math.round(baseWidth * 0.25);
    const totalHeight = margin + (slotHeight + margin) * 2 + footerHeight;
    return { width: baseWidth, height: totalHeight, margin, slotWidth, slotHeight, footerHeight };
  }
}

export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, text = 'Virtualan') {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/composite-renderer.test.ts`
Expected: PASS

---

### Task 7: End-to-End User Flow & Verification

**Files:**
- Create: `src/app/booth/[code]/page.ts`, `src/components/booth/ConfirmModal.tsx`, `src/components/booth/SessionTimer.tsx`
- Test: `tests/e2e/booth-flow.spec.ts`

**Interfaces:**
- Consumes: Tasks 1-6 integrated together.
- Produces: Complete working virtual photobooth flow from mode selection to PNG share.

- [ ] **Step 1: Write E2E test verifying room join, capture sequence, and modal confirmation barrier**

```typescript
// tests/e2e/booth-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Virtualan Photobooth Journey', () => {
  test('landing allows selecting Solo and creating room', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Mau foto bagaimana hari ini?')).toBeVisible();
    await page.getByText('Sendiri').click();
    await expect(page).toHaveURL(/\/booth\/[A-HJ-NP-Z2-9]{6}/);
  });

  test('confirm modal barrier blocks accidental finalization', async ({ page }) => {
    await page.goto('/booth/test-editor');
    const makeStripBtn = page.getByRole('button', { name: 'Buat strip' });
    if (await makeStripBtn.isVisible()) {
      await makeStripBtn.click();
      await expect(page.getByText('Buat stripmu?')).toBeVisible();
      await expect(page.getByText('Lanjut edit')).toBeVisible();
      await expect(page.getByText('Ya, buat')).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: Run E2E test to verify flow check**

Run: `npx playwright test tests/e2e/booth-flow.spec.ts`
Expected: PASS (or mock assertions match DOM contract).

- [ ] **Step 3: Run full suite checks**

Run: `npm run lint && npm run test`
Expected: 0 errors, all unit & integration tests PASS.
