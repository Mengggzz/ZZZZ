# Product Requirements Document (PRD): Virtualan (LDR Virtual Photobooth)

- **Product Name**: Virtualan
- **Document Version**: v1.0.0
- **Status**: Validated Design / Spec
- **Date**: 2026-10-29
- **Platform**: Responsive Web App (Mobile-first & Desktop)
- **Primary Stack**: Next.js 15 (App Router), Tailwind CSS, LiveKit (WebRTC SFU), Prisma ORM, PostgreSQL, AWS S3 / Supabase Storage

---

## 1. Executive Summary & Problem Statement

### 1.1 Problem Statement
Pasangan jarak jauh (LDR), teman beda kota, dan komunitas online sulit memiliki momen foto bersama bergaya bilik foto (photobooth strip) tanpa bertemu fisik. Tangkapan layar panggilan video konvensional berkualitas rendah, tidak simetris, dan tidak memiliki estetika photobooth strip.

### 1.2 Solution
**Virtualan** menghadirkan pengalaman bilik foto virtual real-time langsung dari peramban tanpa install aplikasi. Pengguna dapat memilih mode sendiri (Solo) atau berdua (Duo) menggunakan kode ruangan 6 digit, terhubung via video-audio 2 arah berlatensi rendah, mengambil 4 pose beruntun secara tersinkronisasi, mengedit layout/filter/stiker secara kolaboratif, serta mengekspor hasil foto beresolusi tinggi.

---

## 2. User Personas & Core Use Cases

| Persona | Profil & Kebutuhan | Skenario Penggunaan |
|---|---|---|
| **Pasangan LDR** | Menjalin hubungan jarak jauh, aktif di media sosial, ingin kenang-kenangan estetik. | Membuat room berdua, berpose bareng di depan webcam, memakai tema koran Momoto LDR, lalu membagikan strip foto ke Instagram Stories. |
| **Sahabat Virtual** | Teman daring dari game/komunitas, merayakan ulang tahun / momen online. | Masuk room via kode 6 digit, mengobrol santai sambil menjepret 4 frame, menambahkan stiker lucu bersama. |
| **Pengguna Solo** | Konten kreator kasual yang menginginkan strip foto 4x1 tanpa perlu ke mall. | Masuk mode Solo tanpa kode, berpose mandiri, menerapkan filter B&W/Vintage, mengunduh hasil foto gratis. |

---

## 3. Product Scope: MVP vs Future Scope

### 3.1 In-Scope (MVP)
- **Mode Solo & Duo**: Pengambilan mandiri atau bersama rekan dengan kode sesi 6 digit.
- **WebRTC 2-Arah**: Audio + Video 720p stabil via LiveKit SFU.
- **Sinkronisasi Jepret**: Hitung mundur 3-2-1 tersinkronisasi dengan margin drift < 100ms.
- **Sesi Timer**: Batas durasi ruang 5 menit untuk efisiensi resource WebRTC.
- **Canvas Editor Pascapotret**:
  - Mini video bar (obrolan tetap jalan).
  - Retake per-slot (foto ulang slot tertentu tanpa mengulang semua).
  - Retake total (reset 4 slot).
  - Drag-and-drop urutan frame.
  - Template frame (4x1 vertikal strip dan 2x2 grid).
  - 4 Preset filter warna (Original, B&W, Sepia, Vintage).
  - Pustaka stiker (drag, pinch/scale, rotasi).
- **Konfirmasi Barrier**: Dialog pengunci sebelum finalisasi strip.
- **Ekspor & Monetisasi**:
  - Unduh / Web Share API versi standar ber-watermark transparan.
  - Opsi simpan di keranjang belanja untuk unlock versi HD tanpa watermark.

### 3.2 Out-of-Scope (Future Phases)
- Cetak fisik langsung kirim ke kurir logistik.
- Sesi foto grup lebih dari 2 orang (3–4 peserta).
- AI background removal dan AI beauty filter real-time.

---

## 4. User Journey & Feature Specifications

### 4.1 Landing Page & Pemilihan Mode (`/`)
- Header: Logo Virtualan, switcher bahasa (ID/EN), ikon keranjang belanja, avatar akun.
- Pilihan Kartu:
  - **Sendiri (Solo)**: Masuk langsung ke ruang foto mandiri tanpa kode.
  - **Berdua (Duo)**: Menghasilkan kode ruang baru 6 karakter alfa-numerik unik.
- Input Gabung: Form teks kapital `MASUKKAN KODE RUANGAN` + tombol "Gabung".

### 4.2 Ruang Tunggu & Sesi Koneksi (`/booth/[code]`)
- Kode Ruang: Tampil besar dengan tombol salin instan satu ketukan.
- Modal "Tips Singkat":
  1. Bagikan kode ke rekan.
  2. Waktu baru berjalan setelah rekan masuk.
  3. Siapkan izin kamera dan mikrofon.
  4. Checkbox "Saya sudah pernah coba, jangan tampilkan tips lagi" (`localStorage`).
- Status Koneksi: Kapsul indikator "Menghubungkan..." $\rightarrow$ "Teman terhubung" (titik hijau).

### 4.3 Bilik Foto & Alur Jepret Sinkron
- Timer Sesi: `SISA 5:00` di bar atas, hitung mundur otomatis sejak kedua pihak terkoneksi.
- Kontrol Media: Sakelar Toggle Kamera (On/Off) & Mikrofon (On/Off).
- Hak Akses Host: Tombol "Mulai Sesi" hanya aktif di pihak pembuat ruang (host).
- Siklus Pengambilan:
  - Broadcast sinyal `SESSION_START`.
  - Hitungan mundur audio-visual serentak: 3, 2, 1, FLASH.
  - Klien menangkap frame lokal resolusi kamera asli (Webcam HTML5 Video Element $\rightarrow$ Offscreen Canvas).
  - Transfer payload gambar via Data Channel / S3 upload.
  - Jeda pose 3 detik antar-frame, berulang hingga 4 slot terisi penuh.

### 4.4 Editor Pascapotret
- **Komunikasi Berlanjut**: Avatar video mini di bar atas tetap aktif ("Kamera masih menyala — lanjut mengobrol").
- **Koreksi Frame**:
  - Tombol reload (`↻`) pada tiap slot foto untuk foto ulang lokal slot tersebut.
  - Tombol sekunder "Ambil ulang semua" untuk reset ke tahap jepret awal.
- **Pengaturan Tata Letak**: Pilihan tombol `4x1` (vertikal strip klasik) atau `2x2` (grid modern).
- **Tema Frame**: Newspaper / Momoto LDR theme, pastel pink, clean minimalist, retro film.
- **Filter**: Asli, B&W (Monochrome), Sepia, Vintage (Warm grain).
- **Stiker**: Palet 20+ varian stiker interaktif dengan layer kanvas bebas geser dan ubah ukuran.

### 4.5 Konfirmasi & Ekspor
- **Modal Dialog Permanen**: "Buat stripmu? Susunan, filter, dan pengambilan ulang terkunci permanen setelah dibuat." Tombol: "Lanjut edit" vs "Ya, buat".
- **Halaman Hasil**:
  - Tampilan pratinjau strip yang telah di-render.
  - Tombol utama: "Bagikan strip kamu" (memicu Web Share API pada mobile atau unduh file PNG).
  - Watermark: Teks transparan "Virtualan" pada strip versi gratis.
  - Kartu Monetisasi: Notifikasi "TERSIMPAN DI KERANJANG" untuk pembelian strip versi HD tanpa watermark.

---

## 5. Technical Architecture & Tech Stack

```
                          ┌───────────────────────────┐
                          │   Next.js 15 App Router   │
                          │   (Tailwind, Zustand,     │
                          │    Konva.js / Canvas API) │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│    LiveKit Cloud     │     │    Next.js Server    │     │   PostgreSQL + S3    │
│  - WebRTC SFU Audio  │     │  - Session Signaling │     │  - Prisma ORM        │
│  - WebRTC Video 720p │     │  - Room Auth Tokens  │     │  - S3 Temp Frames    │
│  - Data Channels     │     │  - Sharp.js Renderer │     │  - Final Strip Asset │
└──────────────────────┘     └──────────────────────┘     └──────────────────────┘
```

### 5.1 Tech Stack
- **Frontend Framework**: Next.js 15 (React 19), App Router, TypeScript.
- **Styling**: Tailwind CSS, Lucide React (ikonografi).
- **State Management**: Zustand (sinkronisasi state booth & editor).
- **Media & WebRTC**: `@livekit/components-react`, `livekit-client`, `livekit-server-sdk`.
- **Kanvas & Grafika**: HTML5 Canvas API murni atau Konva.js untuk layer filter, frame, stiker, dan composite split-screen.
- **Image Processing Server**: Sharp.js (generate strip HD di server saat checkout).
- **Database & Storage**: PostgreSQL via Prisma ORM, S3-compatible object storage (AWS S3 atau Supabase Storage) dengan lifecycle rule hapus file temp setelah 1 jam.

---

## 6. Data Model (Prisma Schema)

```prisma
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
  sessionTimer Int         @default(300) // 5 menit durasi sesi (detik)
  captures     Capture[]
  strip        Strip?
}

model Capture {
  id          String   @id @default(cuid())
  roomId      String
  slotIndex   Int      // Slot 1 sampai 4
  hostImgUrl  String   // URL S3 frame sisi host
  guestImgUrl String?  // URL S3 frame sisi guest (null jika Solo)
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
  stickersJson   Json?       // Format: [{ id, x, y, scale, rotation }]
  watermarkedUrl String      // File PNG gratis dengan watermark
  hdUrl          String?     // File PNG HD tanpa watermark
  isPaid         Boolean     @default(false)
  createdAt      DateTime    @default(now())
  room           Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)
}
```

---

## 7. API & Real-time Protocol

### 7.1 REST Endpoints

| Method | Endpoint | Fungsi | Payload / Respon |
|---|---|---|---|
| `POST` | `/api/rooms/create` | Buat sesi & token LiveKit Host | Body: `{ mode: "SOLO" \| "DUO" }` $\rightarrow$ `{ code, token, roomId }` |
| `POST` | `/api/rooms/join` | Gabung sesi via kode 6 digit | Body: `{ code }` $\rightarrow$ `{ token, roomId, hostId }` |
| `GET` | `/api/rooms/[code]/status` | Ambil status sesi & sisa timer | Respon: `{ status, remainingSeconds, participants }` |
| `POST` | `/api/rooms/[code]/captures` | Upload snapshot kamera lokal | Multipart/Form: `slotIndex`, `file` $\rightarrow$ `{ success, url }` |
| `POST` | `/api/strips/render` | Render final strip canvas | Body: `{ roomId, layout, theme, filter, stickers }` $\rightarrow$ `{ watermarkedUrl }` |
| `POST` | `/api/cart/add` | Tambah strip HD ke keranjang | Body: `{ stripId }` $\rightarrow$ `{ cartId, totalItems }` |

### 7.2 LiveKit Data Channel Events

- `SESSION_START`: `{ initiator: hostId, timestamp: number }`
- `COUNTDOWN_TICK`: `{ count: 3 | 2 | 1 | 0 }`
- `CAPTURE_TRIGGER`: `{ slotIndex: number, timestamp: number }`
- `SLOT_RETAKE_REQUEST`: `{ slotIndex: number }`
- `SLOT_RETAKE_START`: `{ slotIndex: number }`
- `EDITOR_STATE_SYNC`: `{ layout, theme, filter, stickers }` (Sinkronisasi perubahan antar-klien).

---

## 8. Non-Functional Requirements & Security

1. **Latensi Sinkronisasi**: Drift jepretan kamera antar dua pengguna wajib $< 100\text{ ms}$ menggunakan timestamp NTP-offset handshake pada Data Channel.
2. **Kualitas Gambar**: Pengambilan gambar frame tidak boleh mengambil stream video terkompresi WebRTC 720p, melainkan mengekstrak langsung dari `MediaStreamTrack` lokal dengan resolusi kamera tertinggi yang didukung sensor perangkat (hingga 1080p).
3. **Penyimpanan & Privasi**:
   - File foto mentah (`Capture`) memiliki TTL otomatis di S3 selama 1 jam.
   - Sesi WebRTC dienkripsi end-to-end (DTLS/SRTP).
4. **Resiliensi Jaringan**: Reconnection grace period 30 detik saat terjadi gangguan jaringan pada salah satu perangkat sebelum status diubah menjadi `DISCONNECTED`.
5. **Dukungan Peramban**: Kompatibel dengan Safari iOS 16+, Chrome Android/Desktop, Safari macOS, dan Edge.

---

## 9. Next Steps & Development Roadmap

1. **Sprint 1 (Fondasi)**: Setup Next.js, Tailwind, integrasi LiveKit Cloud, sistem generate room kode 6 digit, verifikasi kamera/mic ganda.
2. **Sprint 2 (Capture Pipeline)**: Sinkronisasi countdown 3-2-1, local high-res capture, transfer buffer frame, split-screen composite.
3. **Sprint 3 (Editor & Creative Canvas)**: Tab filter warna, layout 4x1 & 2x2, frame koran Momoto LDR, sistem manipulasi stiker.
4. **Sprint 4 (Finalisasi, Ekspor & Keranjang)**: Konfirmasi modal, render strip ber-watermark, Web Share API, integrasi keranjang belanja.
