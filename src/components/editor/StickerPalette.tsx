'use client';
import React from 'react';

export const STICKER_PALETTE: string[] = [
  '❤️', '💖', '💕', '💘',
  '✨', '⭐', '🌟', '💫',
  '🌸', '🌺', '🌹', '🌻',
  '🥰', '😍', '🥳', '😎',
  '😜', '🥺', '🐱', '🐶',
  '🐰', '🐻', '👑', '🎀',
  '🧸', '🍰', '🍓', '🍀',
];

export interface StickerPaletteProps {
  onAddSticker: (emoji: string) => void;
  stickers?: string[];
  disabled?: boolean;
  className?: string;
}

export function StickerPalette({
  onAddSticker,
  stickers = STICKER_PALETTE,
  disabled = false,
  className = '',
}: StickerPaletteProps) {
  return (
    <div
      role="region"
      aria-label="Sticker Palette"
      className={`p-3 bg-white/80 backdrop-blur rounded-xl border border-gray-200 shadow-sm ${className}`}
    >
      <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
        Pilih Stiker ({stickers.length})
      </div>
      <div className="grid grid-cols-7 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-1">
        {stickers.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            data-testid={`sticker-btn-${index}`}
            aria-label={`Tambah stiker ${emoji}`}
            disabled={disabled}
            onClick={() => onAddSticker(emoji)}
            className="flex items-center justify-center text-2xl p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
