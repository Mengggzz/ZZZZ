'use client';

import React, { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';

export interface CameraViewportProps {
  stream?: MediaStream | null;
  videoRef?: React.Ref<HTMLVideoElement>;
  mirrored?: boolean;
  countdown?: number | null;
  isFlashing?: boolean;
  currentSlot?: number;
  totalSlots?: number;
  label?: string;
  muted?: boolean;
  showPlaceholder?: boolean;
  className?: string;
  aspectRatio?: string;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
}

export const CameraViewport = forwardRef<HTMLVideoElement, CameraViewportProps>(
  (
    {
      stream = null,
      mirrored = true,
      countdown = null,
      isFlashing = false,
      currentSlot,
      totalSlots = 4,
      label,
      muted = true,
      showPlaceholder = false,
      className = '',
      aspectRatio = 'aspect-[3/2]',
      onLoadedMetadata,
    },
    forwardedRef
  ) => {
    const localRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(forwardedRef, () => localRef.current as HTMLVideoElement, []);

    useEffect(() => {
      if (localRef.current) {
        localRef.current.srcObject = stream ?? null;
      }
    }, [stream]);

    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-neutral-900 flex items-center justify-center ${aspectRatio} ${className}`}
        data-testid="camera-viewport"
      >
        {/* Video feed */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted={muted}
          onLoadedMetadata={onLoadedMetadata}
          data-testid="camera-video"
          className={`w-full h-full object-cover transition-transform duration-150 ${
            mirrored ? '-scale-x-100' : ''
          }`}
        />

        {/* Placeholder if camera stream not active and requested */}
        {showPlaceholder && !stream && (
          <div
            data-testid="camera-placeholder"
            className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 text-neutral-400 gap-2 z-10"
          >
            <svg
              className="w-12 h-12 stroke-current stroke-1"
              viewBox="0 0 24 24"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span className="text-xs font-medium">Camera Off</span>
          </div>
        )}

        {/* Flash effect overlay */}
        {isFlashing && (
          <div
            data-testid="camera-flash"
            className="absolute inset-0 bg-white pointer-events-none z-30 transition-opacity duration-200"
          />
        )}

        {/* Countdown overlay */}
        {countdown !== null && countdown > 0 && (
          <div
            data-testid="countdown-display"
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-20 bg-black/20"
          >
            <span className="text-white text-8xl md:text-9xl font-black drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] animate-pulse">
              {countdown}
            </span>
          </div>
        )}

        {/* Slot index indicator badge */}
        {currentSlot !== undefined && currentSlot !== null && (
          <div
            data-testid="slot-badge"
            className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-semibold z-10"
          >
            Slot {currentSlot}/{totalSlots}
          </div>
        )}

        {/* Participant / Stream label */}
        {label && (
          <div
            data-testid="viewport-label"
            className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-xs font-medium z-10 flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {label}
          </div>
        )}
      </div>
    );
  }
);

CameraViewport.displayName = 'CameraViewport';
