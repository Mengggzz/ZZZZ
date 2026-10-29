'use client';
import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmModal({ isOpen, onCancel, onConfirm, isLoading = false }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-gray-900">Buat stripmu?</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Susunan, filter, dan foto akan terkunci permanen setelah dibuat. Pastikan semua gaya sudah sesuai sebelum mencetak!
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 active:scale-[0.98] transition disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : 'Ya, buat'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 active:scale-[0.98] transition disabled:opacity-50"
          >
            Lanjut edit
          </button>
        </div>
      </div>
    </div>
  );
}
