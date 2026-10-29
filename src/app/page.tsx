'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartSolo = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'SOLO' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat sesi solo');
      router.push(`/booth/${data.code}`);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
      setIsCreating(false);
    }
  };

  const handleStartDuo = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'DUO' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat ruangan duo');
      router.push(`/booth/${data.code}`);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError('Kode ruangan harus terdiri dari 6 karakter');
      return;
    }
    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ruangan tidak valid atau penuh');
      router.push(`/booth/${cleanCode}`);
    } catch (err: any) {
      setError(err.message || 'Gagal bergabung');
      setIsJoining(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-between p-6 max-w-lg mx-auto">
      {/* Header Bar */}
      <header className="w-full flex items-center justify-between py-4 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
            V
          </div>
          <span className="font-extrabold tracking-tight text-lg text-neutral-900">virtualan</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
          <span className="text-neutral-900">ID</span>
          <span>/</span>
          <span>EN</span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="w-full my-auto py-8 space-y-8">
        <div className="space-y-2 text-left">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            PHOTOBOOTH VIRTUAL
          </span>
          <h1 className="text-3xl font-extrabold text-neutral-900 leading-tight">
            Mau foto bagaimana hari ini?
          </h1>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Ambil strip foto empat potongan — sendiri, atau foto bareng teman secara langsung.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 text-sm rounded-xl bg-red-50 text-red-600 border border-red-200"
          >
            {error}
          </div>
        )}

        {/* Mode Cards */}
        <div className="grid grid-cols-1 gap-4">
          {/* Solo Card */}
          <button
            type="button"
            onClick={handleStartSolo}
            disabled={isCreating}
            className="w-full p-5 rounded-2xl border-2 border-neutral-200 hover:border-black bg-white flex items-center justify-between text-left transition shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                👤
              </div>
              <div>
                <h2 className="font-bold text-base text-neutral-900">Sendiri</h2>
                <p className="text-xs text-neutral-500">Hanya kamu — tanpa kode</p>
              </div>
            </div>
            <span className="text-neutral-400 font-bold">&gt;</span>
          </button>

          {/* Duo Card */}
          <button
            type="button"
            onClick={handleStartDuo}
            disabled={isCreating}
            className="w-full p-5 rounded-2xl border-2 border-neutral-200 hover:border-black bg-white flex items-center justify-between text-left transition shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-lg">
                👥
              </div>
              <div>
                <h2 className="font-bold text-base text-neutral-900">Berdua</h2>
                <p className="text-xs text-neutral-500">Undang teman dengan kode</p>
              </div>
            </div>
            <span className="text-neutral-400 font-bold">&gt;</span>
          </button>
        </div>

        {/* Join Code Input Form */}
        <div className="pt-4 border-t border-neutral-200 space-y-3">
          <label htmlFor="room-code-input" className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
            Sudah punya kode?
          </label>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              id="room-code-input"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="MASUKKAN KODE RUANGAN"
              maxLength={6}
              className="flex-1 px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-black font-mono font-bold tracking-widest text-center text-sm uppercase"
            />
            <button
              type="submit"
              disabled={isJoining || roomCode.trim().length !== 6}
              className="px-6 py-3 rounded-xl bg-black text-white text-sm font-bold hover:bg-neutral-800 disabled:opacity-40 transition active:scale-[0.98]"
            >
              {isJoining ? '...' : 'Gabung'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-neutral-400">
        © 2026 Virtualan. Jepret, susun, bagikan.
      </footer>
    </main>
  );
}
