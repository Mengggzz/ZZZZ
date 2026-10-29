'use client';
import React, { useEffect, useState } from 'react';

interface SessionTimerProps {
  initialSeconds: number;
  onExpire?: () => void;
  className?: string;
}

export function SessionTimer({ initialSeconds, onExpire, className = '' }: SessionTimerProps) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remaining, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const isLowTime = remaining <= 60;

  return (
    <div
      role="timer"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider ${
        isLowTime
          ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
          : 'bg-gray-100 text-gray-700 border border-gray-200'
      } ${className}`}
    >
      <span className="opacity-75">SISA</span>
      <span className="font-mono">{formattedTime}</span>
    </div>
  );
}
