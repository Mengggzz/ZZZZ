import { useEffect, useState, useCallback, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { BoothSyncMessage, BoothSyncOptions } from '@/types/booth';

export function useBoothSync(
  room: Room | null,
  isHost: boolean,
  options?: BoothSyncOptions | ((slotIndex: number) => void)
) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number>(1);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const countdownIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);
  const onCaptureRef = useRef<((slotIndex: number) => void) | undefined>(undefined);

  useEffect(() => {
    if (typeof options === 'function') {
      onCaptureRef.current = options;
    } else {
      onCaptureRef.current = options?.onCapture;
    }
  }, [options]);

  const clearTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current as NodeJS.Timeout);
      countdownIntervalRef.current = null;
    }
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current as NodeJS.Timeout);
      captureTimeoutRef.current = null;
    }
  }, []);

  const triggerLocalCountdown = useCallback(
    (slot: number, seconds: number) => {
      clearTimers();
      setCurrentSlot(slot);
      setCountdown(seconds);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current as NodeJS.Timeout);
              countdownIntervalRef.current = null;
            }
            setIsCapturing(true);
            onCaptureRef.current?.(slot);

            captureTimeoutRef.current = setTimeout(() => {
              setIsCapturing(false);
              captureTimeoutRef.current = null;
            }, 500);

            return null;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearTimers]
  );

  const startCountdown = useCallback(
    (slot: number) => {
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
    },
    [room, isHost, triggerLocalCountdown]
  );

  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const msg: BoothSyncMessage = JSON.parse(decoder.decode(payload));
        if (msg.type === 'COUNTDOWN_START') {
          const delayRemaining = Math.max(0, msg.targetTimestamp - Date.now());
          const seconds = Math.round(delayRemaining / 1000) || 3;
          triggerLocalCountdown(msg.slotIndex, seconds);
        }
      } catch {
        // Ignore unparseable or irrelevant data packets
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, triggerLocalCountdown]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    countdown,
    currentSlot,
    isCapturing,
    startCountdown,
    onCapture: onCaptureRef.current,
  };
}
