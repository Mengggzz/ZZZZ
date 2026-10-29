'use client';
import React, { useState, useEffect } from 'react';
import { FilterPreset, getFilterStyle } from '@/lib/filters';
import { FilterSelector } from './FilterSelector';
import { StickerPalette } from './StickerPalette';

export type LayoutType = 'STRIP_4X1' | 'GRID_2X2';
export type FrameTheme = 'newspaper' | 'pastel' | 'clean';

export interface CaptureSlotData {
  id?: string;
  slotIndex: number;
  hostImgUrl: string;
  guestImgUrl?: string | null;
}

export interface PlacedSticker {
  id: string;
  emoji: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  scale?: number;
  rotation?: number;
}

export interface StripEditorProps {
  captures: CaptureSlotData[];
  mode?: 'solo' | 'duo';
  layout?: LayoutType;
  filter?: FilterPreset;
  frameTheme?: FrameTheme;
  stickers?: PlacedSticker[];
  onLayoutChange?: (layout: LayoutType) => void;
  onFilterChange?: (filter: FilterPreset) => void;
  onThemeChange?: (theme: FrameTheme) => void;
  onStickersChange?: (stickers: PlacedSticker[]) => void;
  onReorderSlots?: (newSlots: CaptureSlotData[]) => void;
  onRetakeSlot?: (slotIndex: number) => void;
  onRetakeAll?: () => void;
  onFinalize?: () => void;
  disabled?: boolean;
  className?: string;
}

export function StripEditor({
  captures,
  mode,
  layout: propLayout,
  filter: propFilter,
  frameTheme: propFrameTheme,
  stickers: propStickers,
  onLayoutChange,
  onFilterChange,
  onThemeChange,
  onStickersChange,
  onReorderSlots,
  onRetakeSlot,
  onRetakeAll,
  onFinalize,
  disabled = false,
  className = '',
}: StripEditorProps) {
  // Internal state with prop synchronization
  const [currentLayout, setCurrentLayout] = useState<LayoutType>(propLayout || 'STRIP_4X1');
  const [currentFilter, setCurrentFilter] = useState<FilterPreset>(propFilter || 'original');
  const [currentTheme, setCurrentTheme] = useState<FrameTheme>(propFrameTheme || 'newspaper');
  const [currentStickers, setCurrentStickers] = useState<PlacedSticker[]>(propStickers || []);
  const [slots, setSlots] = useState<CaptureSlotData[]>(captures);

  useEffect(() => {
    if (propLayout) setCurrentLayout(propLayout);
  }, [propLayout]);

  useEffect(() => {
    if (propFilter) setCurrentFilter(propFilter);
  }, [propFilter]);

  useEffect(() => {
    if (propFrameTheme) setCurrentTheme(propFrameTheme);
  }, [propFrameTheme]);

  useEffect(() => {
    if (propStickers) setCurrentStickers(propStickers);
  }, [propStickers]);

  useEffect(() => {
    setSlots(captures);
  }, [captures]);

  // Determine duo or solo
  const isDuo = mode ? mode === 'duo' : slots.some((s) => Boolean(s.guestImgUrl));

  // Layout switcher
  const handleSelectLayout = (layout: LayoutType) => {
    setCurrentLayout(layout);
    onLayoutChange?.(layout);
  };

  // Filter switcher
  const handleSelectFilter = (filter: FilterPreset) => {
    setCurrentFilter(filter);
    onFilterChange?.(filter);
  };

  // Theme switcher
  const handleSelectTheme = (theme: FrameTheme) => {
    setCurrentTheme(theme);
    onThemeChange?.(theme);
  };

  // Slot Reordering
  const handleMoveSlot = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slots.length) return;

    const newSlots = [...slots];
    const temp = newSlots[index];
    newSlots[index] = newSlots[targetIndex];
    newSlots[targetIndex] = temp;

    setSlots(newSlots);
    onReorderSlots?.(newSlots);
  };

  // Stickers management
  const handleAddSticker = (emoji: string) => {
    const newSticker: PlacedSticker = {
      id: `sticker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      emoji,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
    };
    const updated = [...currentStickers, newSticker];
    setCurrentStickers(updated);
    onStickersChange?.(updated);
  };

  const handleUpdateStickerPosition = (id: string, dx: number, dy: number) => {
    const updated = currentStickers.map((s) => {
      if (s.id !== id) return s;
      const nextX = Math.max(0, Math.min(100, s.x + dx));
      const nextY = Math.max(0, Math.min(100, s.y + dy));
      return { ...s, x: nextX, y: nextY };
    });
    setCurrentStickers(updated);
    onStickersChange?.(updated);
  };

  const handleRemoveSticker = (id: string) => {
    const updated = currentStickers.filter((s) => s.id !== id);
    setCurrentStickers(updated);
    onStickersChange?.(updated);
  };

  const cssFilter = getFilterStyle(currentFilter);

  // Theme background & border styles
  const getThemeClasses = (theme: FrameTheme) => {
    switch (theme) {
      case 'newspaper':
        return 'bg-[#f4ecd8] border-4 border-neutral-800 text-neutral-900 shadow-xl';
      case 'pastel':
        return 'bg-pink-50 border-4 border-pink-300 text-pink-900 shadow-xl';
      case 'clean':
      default:
        return 'bg-white border-4 border-neutral-300 text-neutral-900 shadow-xl';
    }
  };

  return (
    <div className={`w-full flex flex-col items-center gap-6 ${className}`}>
      {/* Top Toolbar: Layout, Theme & Retake All */}
      <div className="w-full max-w-2xl flex flex-wrap items-center justify-between gap-4 p-4 bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm">
        {/* Layout Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">Layout:</span>
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            <button
              type="button"
              data-testid="layout-btn-STRIP_4X1"
              disabled={disabled}
              onClick={() => handleSelectLayout('STRIP_4X1')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                currentLayout === 'STRIP_4X1'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Strip 4x1
            </button>
            <button
              type="button"
              data-testid="layout-btn-GRID_2X2"
              disabled={disabled}
              onClick={() => handleSelectLayout('GRID_2X2')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                currentLayout === 'GRID_2X2'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Grid 2x2
            </button>
          </div>
        </div>

        {/* Theme Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">Tema:</span>
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            <button
              type="button"
              data-testid="theme-btn-newspaper"
              disabled={disabled}
              onClick={() => handleSelectTheme('newspaper')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                currentTheme === 'newspaper'
                  ? 'bg-neutral-800 text-amber-50 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Koran LDR
            </button>
            <button
              type="button"
              data-testid="theme-btn-pastel"
              disabled={disabled}
              onClick={() => handleSelectTheme('pastel')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                currentTheme === 'pastel'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pastel
            </button>
            <button
              type="button"
              data-testid="theme-btn-clean"
              disabled={disabled}
              onClick={() => handleSelectTheme('clean')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                currentTheme === 'clean'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clean
            </button>
          </div>
        </div>

        {/* Retake All Button */}
        {onRetakeAll && (
          <button
            type="button"
            data-testid="retake-all-btn"
            disabled={disabled}
            onClick={onRetakeAll}
            className="px-4 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition cursor-pointer"
          >
            Ulang Semua (Retake)
          </button>
        )}
      </div>

      {/* Filter Selector */}
      <div className="w-full max-w-2xl">
        <FilterSelector
          selected={currentFilter}
          onSelect={handleSelectFilter}
          disabled={disabled}
        />
      </div>

      {/* Main Strip Canvas Container */}
      <div className="relative flex justify-center p-4 w-full">
        <div
          data-testid="strip-canvas"
          data-layout={currentLayout}
          data-theme={currentTheme}
          className={`relative p-5 transition-all duration-300 ${getThemeClasses(
            currentTheme
          )} ${
            currentLayout === 'STRIP_4X1'
              ? 'w-full max-w-xs sm:max-w-sm flex flex-col gap-3'
              : 'w-full max-w-md sm:max-w-lg grid grid-cols-2 gap-3'
          }`}
        >
          {/* Newspaper Header for newspaper theme */}
          {currentTheme === 'newspaper' && (
            <div
              data-testid="newspaper-header"
              className={`text-center pb-2 border-b-2 border-neutral-800 ${
                currentLayout === 'GRID_2X2' ? 'col-span-2' : ''
              }`}
            >
              <h2 className="font-serif tracking-widest text-lg sm:text-xl font-black uppercase">
                The Virtualan Chronicle
              </h2>
              <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider border-t border-b border-neutral-700 py-0.5 mt-1">
                <span>Special Momoto LDR Edition</span>
                <span suppressHydrationWarning>{new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                <span>Vol. 1 No. 4</span>
              </div>
            </div>
          )}

          {/* Slots Rendering */}
          {slots.map((slot, index) => (
            <div
              key={slot.id || `slot-${slot.slotIndex}-${index}`}
              data-testid={`strip-slot-${index}`}
              className="relative group bg-neutral-900 rounded overflow-hidden aspect-[3/2] flex flex-col border border-neutral-700/50"
            >
              {/* Image Container (Split-screen Duo or Full Solo) */}
              <div className="relative w-full h-full flex overflow-hidden">
                {isDuo && slot.guestImgUrl ? (
                  <>
                    {/* Host Side */}
                    <div className="relative w-1/2 h-full overflow-hidden border-r border-white/20">
                      <img
                        data-testid={`slot-${index}-host`}
                        src={slot.hostImgUrl}
                        alt={`Slot ${index + 1} Host`}
                        style={{ filter: cssFilter }}
                        className="w-full h-full object-cover transition duration-200"
                      />
                    </div>
                    {/* Guest Side */}
                    <div className="relative w-1/2 h-full overflow-hidden">
                      <img
                        data-testid={`slot-${index}-guest`}
                        src={slot.guestImgUrl}
                        alt={`Slot ${index + 1} Guest`}
                        style={{ filter: cssFilter }}
                        className="w-full h-full object-cover transition duration-200"
                      />
                    </div>
                  </>
                ) : (
                  /* Solo Mode (Host Only) */
                  <div className="relative w-full h-full overflow-hidden">
                    <img
                      data-testid={`slot-${index}-host`}
                      src={slot.hostImgUrl}
                      alt={`Slot ${index + 1}`}
                      style={{ filter: cssFilter }}
                      className="w-full h-full object-cover transition duration-200"
                    />
                  </div>
                )}
              </div>

              {/* Slot Overlay Controls (Reorder & Retake) */}
              <div className="absolute top-1 right-1 flex items-center gap-1 z-10 opacity-90 sm:opacity-0 group-hover:opacity-100 transition">
                {/* Reorder Up / Left */}
                {index > 0 && (
                  <button
                    type="button"
                    data-testid={`slot-move-up-${index}`}
                    aria-label={`Pindah slot ${index + 1} ke atas`}
                    disabled={disabled}
                    onClick={() => handleMoveSlot(index, 'up')}
                    className="p-1 bg-black/70 hover:bg-black text-white text-xs rounded transition cursor-pointer"
                  >
                    ▲
                  </button>
                )}
                {/* Reorder Down / Right */}
                {index < slots.length - 1 && (
                  <button
                    type="button"
                    data-testid={`slot-move-down-${index}`}
                    aria-label={`Pindah slot ${index + 1} ke bawah`}
                    disabled={disabled}
                    onClick={() => handleMoveSlot(index, 'down')}
                    className="p-1 bg-black/70 hover:bg-black text-white text-xs rounded transition cursor-pointer"
                  >
                    ▼
                  </button>
                )}
                {/* Retake Slot */}
                {onRetakeSlot && (
                  <button
                    type="button"
                    data-testid={`retake-slot-${slot.slotIndex}`}
                    aria-label={`Ulangi pose slot ${slot.slotIndex + 1}`}
                    disabled={disabled}
                    onClick={() => onRetakeSlot(slot.slotIndex)}
                    className="px-1.5 py-1 bg-red-600/90 hover:bg-red-700 text-white text-[10px] font-bold rounded uppercase tracking-wider transition cursor-pointer"
                  >
                    Ulang
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Newspaper Footer / Watermark Text */}
          <div
            className={`text-center pt-2 border-t border-neutral-700/60 font-mono text-[9px] uppercase tracking-widest text-neutral-600 ${
              currentLayout === 'GRID_2X2' ? 'col-span-2' : ''
            }`}
          >
            Virtualan Photobooth • Momoto LDR Strip
          </div>

          {/* Placed Stickers Layer */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {currentStickers.map((sticker) => (
              <div
                key={sticker.id}
                data-testid={`placed-sticker-${sticker.id}`}
                style={{
                  left: `${sticker.x}%`,
                  top: `${sticker.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute pointer-events-auto group/stk cursor-move select-none flex flex-col items-center"
              >
                <span className="text-3xl sm:text-4xl filter drop-shadow">
                  {sticker.emoji}
                </span>

                {/* Sticker controls (Move & Remove) */}
                <div className="hidden group-hover/stk:flex items-center gap-1 bg-black/80 rounded-md p-0.5 text-white shadow-lg text-[9px] mt-0.5">
                  <button
                    type="button"
                    data-testid={`sticker-move-left-${sticker.id}`}
                    aria-label="Geser kiri"
                    onClick={() => handleUpdateStickerPosition(sticker.id, -5, 0)}
                    className="px-1 hover:bg-white/20 rounded cursor-pointer"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    data-testid={`sticker-move-right-${sticker.id}`}
                    aria-label="Geser kanan"
                    onClick={() => handleUpdateStickerPosition(sticker.id, 5, 0)}
                    className="px-1 hover:bg-white/20 rounded cursor-pointer"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    data-testid={`sticker-move-up-${sticker.id}`}
                    aria-label="Geser atas"
                    onClick={() => handleUpdateStickerPosition(sticker.id, 0, -5)}
                    className="px-1 hover:bg-white/20 rounded cursor-pointer"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    data-testid={`sticker-move-down-${sticker.id}`}
                    aria-label="Geser bawah"
                    onClick={() => handleUpdateStickerPosition(sticker.id, 0, 5)}
                    className="px-1 hover:bg-white/20 rounded cursor-pointer"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    data-testid={`sticker-remove-${sticker.id}`}
                    aria-label="Hapus stiker"
                    onClick={() => handleRemoveSticker(sticker.id)}
                    className="px-1 text-red-400 hover:text-red-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticker Palette Selector */}
      <div className="w-full max-w-2xl">
        <StickerPalette onAddSticker={handleAddSticker} disabled={disabled} />
      </div>

      {/* Finalize Button if provided */}
      {onFinalize && (
        <button
          type="button"
          data-testid="finalize-strip-btn"
          disabled={disabled}
          onClick={onFinalize}
          className="px-6 py-3 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50"
        >
          Finalisasi Strip Foto
        </button>
      )}
    </div>
  );
}
