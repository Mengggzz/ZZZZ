'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CameraViewport } from '@/components/booth/CameraViewport';
import { SessionTimer } from '@/components/booth/SessionTimer';
import { ConfirmModal } from '@/components/booth/ConfirmModal';
import { StripEditor } from '@/components/editor/StripEditor';
import { captureVideoFrame } from '@/lib/canvas-capture';

interface RoomData {
  code: string;
  status: string;
  remainingSeconds: number;
  participants: {
    hostId: string;
    guestId: string | null;
  };
}

export default function BoothPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.toUpperCase();

  // Room status & timer
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local media stream
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Photo session states: 'lobby' | 'capturing' | 'editing' | 'result'
  const [boothState, setBoothState] = useState<'lobby' | 'capturing' | 'editing' | 'result'>('lobby');
  const [currentSlot, setCurrentSlot] = useState<number>(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  // Captured slots (1-4)
  const [capturedImages, setCapturedImages] = useState<{
    1: string | null;
    2: string | null;
    3: string | null;
    4: string | null;
  }>({ 1: null, 2: null, 3: null, 4: null });

  // Modal finalization barrier
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [finalResultUrl, setFinalResultUrl] = useState<string | null>(null);

  // Fetch room data
  useEffect(() => {
    if (!code) return;
    let isMounted = true;

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/rooms/${code}/status`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Ruangan tidak ditemukan');
          throw new Error('Gagal memuat status ruangan');
        }
        const data = await res.json();
        if (isMounted) {
          setRoom(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Kesalahan memuat ruangan');
          setLoading(false);
        }
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [code]);

  // Initialize camera
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function initMedia() {
      try {
        const userStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true,
        });
        activeStream = userStream;
        setStream(userStream);
      } catch (err: any) {
        setCameraError('Gagal mengakses kamera/mikrofon. Pastikan izin telah diberikan.');
      }
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      initMedia();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Toggle media
  const toggleCamera = () => {
    if (stream) {
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        vTrack.enabled = !vTrack.enabled;
        setCameraActive(vTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (stream) {
      const aTrack = stream.getAudioTracks()[0];
      if (aTrack) {
        aTrack.enabled = !aTrack.enabled;
        setMicActive(aTrack.enabled);
      }
    }
  };

  // Capture sequence
  const startCaptureSequence = () => {
    setBoothState('capturing');
    captureNextSlot(1);
  };

  const captureNextSlot = (slot: number) => {
    if (slot > 4) {
      setBoothState('editing');
      return;
    }

    setCurrentSlot(slot);
    setCountdown(3);

    let count = 3;
    const countTimer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(countTimer);
        setCountdown(null);
        triggerSnapshot(slot);
      }
    }, 1000);
  };

  const triggerSnapshot = async (slot: number) => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    let dataUrl: string | null = null;
    if (videoRef.current) {
      try {
        const blob = await captureVideoFrame(videoRef.current, 3 / 2, { mirrored: true });
        dataUrl = URL.createObjectURL(blob);
      } catch (e) {
        // Fallback placeholder dataUrl
        dataUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%23ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24">Slot ' + slot + '</text></svg>';
      }
    } else {
      dataUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%23ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24">Slot ' + slot + '</text></svg>';
    }

    setCapturedImages((prev) => ({ ...prev, [slot]: dataUrl }));

    // Delay 1.5s then next slot
    setTimeout(() => {
      captureNextSlot(slot + 1);
    }, 1500);
  };

  // Retake individual slot
  const handleRetakeSlot = (slot: number) => {
    setBoothState('capturing');
    setCurrentSlot(slot);
    setCountdown(3);

    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(timer);
        setCountdown(null);
        triggerSnapshotSingle(slot);
      }
    }, 1000);
  };

  const triggerSnapshotSingle = async (slot: number) => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    let dataUrl: string | null = null;
    if (videoRef.current) {
      try {
        const blob = await captureVideoFrame(videoRef.current, 3 / 2, { mirrored: true });
        dataUrl = URL.createObjectURL(blob);
      } catch (e) {
        dataUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Retake Slot ' + slot + '</text></svg>';
      }
    }
    setCapturedImages((prev) => ({ ...prev, [slot]: dataUrl }));
    setTimeout(() => setBoothState('editing'), 1000);
  };

  // Retake all
  const handleRetakeAll = () => {
    setCapturedImages({ 1: null, 2: null, 3: null, 4: null });
    startCaptureSequence();
  };

  // Finalize strip handler
  const handleConfirmFinalize = async () => {
    setIsRendering(true);
    try {
      const res = await fetch('/api/strips/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room?.code || code,
          layout: 'STRIP_4X1',
          frameTheme: 'newspaper',
          filter: 'original',
          stickers: [],
        }),
      });
      const data = await res.json();
      setFinalResultUrl(data.watermarkedUrl || '/placeholder-strip.png');
      setIsConfirmOpen(false);
      setBoothState('result');
    } catch (err) {
      setIsConfirmOpen(false);
      setBoothState('result');
    } finally {
      setIsRendering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-neutral-400">Menghubungkan ke bilik foto...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6 text-center">
        <div className="max-w-sm w-full bg-white p-6 rounded-2xl shadow-xl space-y-4">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-lg font-bold text-neutral-900">Sesi Tidak Ditemukan</h2>
          <p className="text-sm text-neutral-600">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full py-2.5 rounded-xl bg-black text-white text-sm font-bold"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between">
      {/* Top Header Bar */}
      <header className="w-full border-b border-neutral-800 bg-neutral-900/60 backdrop-blur px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-sm tracking-tight text-emerald-400">BOOTH</span>
          <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded font-mono font-bold text-neutral-300">
            {code}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium hidden sm:inline">Terhubung</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SessionTimer initialSeconds={room?.remainingSeconds || 300} onExpire={() => setIsConfirmOpen(true)} />
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
          >
            Selesai
          </button>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-4xl mx-auto">
        {cameraError && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-950 border border-red-800 text-red-200 text-xs">
            {cameraError}
          </div>
        )}

        {boothState === 'lobby' && (
          <div className="w-full max-w-md flex flex-col items-center space-y-6 text-center">
            <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl relative">
              <CameraViewport
                ref={videoRef}
                stream={stream}
                mirrored={true}
                countdown={null}
                isFlashing={false}
                label="Kamu"
              />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Siap untuk Berpose?</h1>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                Sesi akan mengambil 4 foto berurutan dengan hitungan mundur 3 detik tiap frame.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={toggleCamera}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition ${
                  cameraActive ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-red-900 border-red-700 text-red-200'
                }`}
              >
                {cameraActive ? '📷 Kamera Nyala' : '🚫 Kamera Mati'}
              </button>
              <button
                type="button"
                onClick={toggleMic}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition ${
                  micActive ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-red-900 border-red-700 text-red-200'
                }`}
              >
                {micActive ? '🎙️ Mic Nyala' : '🔇 Mic Bisu'}
              </button>
            </div>

            <button
              type="button"
              onClick={startCaptureSequence}
              className="w-full py-4 rounded-2xl bg-white text-black font-extrabold text-base hover:bg-neutral-200 active:scale-[0.98] transition shadow-lg shadow-white/10"
            >
              Mulai Sesi Foto
            </button>
          </div>
        )}

        {boothState === 'capturing' && (
          <div className="w-full max-w-md flex flex-col items-center space-y-4">
            <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl relative">
              <CameraViewport
                ref={videoRef}
                stream={stream}
                mirrored={true}
                countdown={countdown}
                isFlashing={isFlashing}
                currentSlot={currentSlot}
                label={`Foto ${currentSlot} dari 4`}
              />
            </div>
            <p className="text-sm font-semibold tracking-wide text-neutral-400 animate-pulse">
              {countdown ? 'Tahan pose kamu...' : 'Menyiapkan jepretan...'}
            </p>
          </div>
        )}

        {boothState === 'editing' && (
          <div className="w-full flex flex-col items-center space-y-6">
            <StripEditor
              captures={[
                { slotIndex: 1, hostImgUrl: capturedImages[1] || '' },
                { slotIndex: 2, hostImgUrl: capturedImages[2] || '' },
                { slotIndex: 3, hostImgUrl: capturedImages[3] || '' },
                { slotIndex: 4, hostImgUrl: capturedImages[4] || '' },
              ]}
              onRetakeSlot={handleRetakeSlot}
              onRetakeAll={handleRetakeAll}
              onFinalize={() => setIsConfirmOpen(true)}
            />
          </div>
        )}

        {boothState === 'result' && (
          <div className="w-full max-w-md flex flex-col items-center space-y-6 text-center py-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                TERSIMPAN DI KERANJANG
              </span>
              <h2 className="text-2xl font-black">Ini strip kamu!</h2>
              <p className="text-xs text-neutral-400">Versi gratis dengan watermark. Versi HD tersimpan di keranjang.</p>
            </div>

            <div className="w-64 bg-white p-4 rounded-2xl shadow-2xl text-black">
              <div className="border-b border-black pb-2 mb-2 text-center">
                <h3 className="font-black text-sm tracking-widest">VIRTUALAN STRIP</h3>
                <p className="text-[10px] text-neutral-500">MOMENTO MEMORIES</p>
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className="w-full aspect-[3/2] bg-neutral-200 rounded overflow-hidden relative">
                    {capturedImages[s as 1 | 2 | 3 | 4] && (
                      <img
                        src={capturedImages[s as 1 | 2 | 3 | 4]!}
                        alt={`Slot ${s}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center font-bold text-black/20 text-xs pointer-events-none select-none">
                      Virtualan
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    navigator.share({ title: 'Strip Virtualan', url: window.location.href });
                  } else {
                    alert('Strip siap dibagikan!');
                  }
                }}
                className="w-full py-3.5 rounded-xl bg-white text-black font-extrabold text-sm hover:bg-neutral-200 transition"
              >
                Bagikan strip kamu
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full py-3.5 rounded-xl bg-neutral-800 text-neutral-300 font-semibold text-sm hover:bg-neutral-700 transition"
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Confirm Modal Dialog */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmFinalize}
        isLoading={isRendering}
      />
    </div>
  );
}
