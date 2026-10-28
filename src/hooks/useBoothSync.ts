import { useEffect, useState, useCallback, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { BoothSyncMessage, BoothSyncOptions, BoothSyncState } from '@/types/booth';
import { calculateTargetCaptureTime } from '@/lib/sync-clock';

export function useBoothSync(
  room: Room | null,
  isHost: boolean,
  options?: BoothSyncOptions | ((slotIndex: number) => void)
): BoothSyncState & { onCapture?: (slotIndex: number) => void } {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number>(1);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const countdownIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);
  const onCaptureRef = useRef<((slotIndex: number) => void) | undefined>(undefined);

  const serverOffsetMs =
    typeof options === 'object' && typeof options?.serverOffsetMs === 'number'
      ? options.serverOffsetMs
      : 0;

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

  const triggerCapture = useCallback(
    (slot: number) => {
      clearTimers();
      setCurrentSlot(slot);
      setCountdown(null);
      setIsCapturing(true);
      onCaptureRef.current?.(slot);

      captureTimeoutRef.current = setTimeout(() => {
        setIsCapturing(false);
        captureTimeoutRef.current = null;
      }, 500);
    },
    [clearTimers]
  );

  const triggerLocalCountdown = useCallback(
    (slot: number, seconds: number) => {
      clearTimers();
      setCurrentSlot(slot);

      if (seconds <= 0) {
        triggerCapture(slot);
        return;
      }

      setCountdown(seconds);
      let remaining = seconds;

      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current as NodeJS.Timeout);
            countdownIntervalRef.current = null;
          }
          triggerCapture(slot);
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    },
    [clearTimers, triggerCapture]
  );

  const startCountdown = useCallback(
    (slot: number) => {
      if (!room || !isHost) return;
      const targetTimestamp = calculateTargetCaptureTime(Date.now(), serverOffsetMs, 3000);
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
    [room, isHost, serverOffsetMs, triggerLocalCountdown]
  );

  const retakeSlot = useCallback(
    (slot: number) => {
      clearTimers();
      setCountdown(null);
      setIsCapturing(false);
      setCurrentSlot(slot);

      if (!room) return;
      const payload: BoothSyncMessage = {
        type: 'RETAKE_SLOT',
        slotIndex: slot,
      };
      const encoder = new TextEncoder();
      room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
        reliable: true,
      });
    },
    [room, clearTimers]
  );

  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const msg: BoothSyncMessage = JSON.parse(decoder.decode(payload));
        if (msg.type === 'COUNTDOWN_START') {
          const currentEpoch = Date.now() + serverOffsetMs;
          const delayRemaining = msg.targetTimestamp - currentEpoch;
          if (delayRemaining <= 0) {
            triggerCapture(msg.slotIndex);
          } else {
            const seconds = Math.max(1, Math.ceil(delayRemaining / 1000));
            triggerLocalCountdown(msg.slotIndex, seconds);
          }
        } else if (msg.type === 'RETAKE_SLOT') {
          clearTimers();
          setCountdown(null);
          setIsCapturing(false);
          setCurrentSlot(msg.slotIndex);
        }
      } catch {
        // Ignore unparseable or irrelevant data packets
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, serverOffsetMs, clearTimers, triggerCapture, triggerLocalCountdown]);

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
    retakeSlot,
    onCapture: onCaptureRef.current,
  };
}
