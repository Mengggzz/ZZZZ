// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { calculateTargetCaptureTime } from '../../src/lib/sync-clock';
import { useBoothSync } from '../../src/hooks/useBoothSync';
import { BoothSyncMessage } from '../../src/types/booth';

describe('Sync Clock NTP Utility', () => {
  it('schedules capture trigger across clients based on synchronized server epoch', () => {
    const clientTime = 10000;
    const serverOffset = 50; // client is 50ms behind
    const countdownDurationMs = 3000;
    const target = calculateTargetCaptureTime(clientTime, serverOffset, countdownDurationMs);
    expect(target).toBe(13050);
  });

  it('handles negative server offset when client clock is ahead', () => {
    const clientTime = 10000;
    const serverOffset = -50; // client is 50ms ahead
    const countdownDurationMs = 3000;
    const target = calculateTargetCaptureTime(clientTime, serverOffset, countdownDurationMs);
    expect(target).toBe(12950);
  });

  it('handles zero offset', () => {
    const clientTime = 10000;
    const serverOffset = 0;
    const countdownDurationMs = 3000;
    const target = calculateTargetCaptureTime(clientTime, serverOffset, countdownDurationMs);
    expect(target).toBe(13000);
  });
});

describe('useBoothSync Hook', () => {
  let mockRoom: any;
  let eventListeners: Record<string, (payload: any) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    eventListeners = {};
    mockRoom = {
      localParticipant: {
        publishData: vi.fn(),
      },
      on: vi.fn((event: string, handler: any) => {
        eventListeners[event] = handler;
      }),
      off: vi.fn((event: string, handler: any) => {
        if (eventListeners[event] === handler) {
          delete eventListeners[event];
        }
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useBoothSync(null, false));
    expect(result.current.countdown).toBeNull();
    expect(result.current.currentSlot).toBe(1);
    expect(result.current.isCapturing).toBe(false);
  });

  it('host can start countdown and publishes data to room participants', () => {
    const onCaptureMock = vi.fn();
    const { result } = renderHook(() => useBoothSync(mockRoom, true, { onCapture: onCaptureMock }));

    act(() => {
      result.current.startCountdown(2);
    });

    expect(mockRoom.localParticipant.publishData).toHaveBeenCalledTimes(1);
    const publishArgs = mockRoom.localParticipant.publishData.mock.calls[0];
    const decodedMessage: BoothSyncMessage = JSON.parse(new TextDecoder().decode(publishArgs[0]));
    expect(decodedMessage.type).toBe('COUNTDOWN_START');
    if (decodedMessage.type === 'COUNTDOWN_START') {
      expect(decodedMessage.slotIndex).toBe(2);
    }
    expect(publishArgs[1]).toEqual({ reliable: true });

    expect(result.current.currentSlot).toBe(2);
    expect(result.current.countdown).toBe(3);

    // Fast forward 1 second -> countdown 2
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBe(2);

    // Fast forward 1 second -> countdown 1
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBe(1);

    // Fast forward 1 second -> countdown triggers capture
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBeNull();
    expect(result.current.isCapturing).toBe(true);
    expect(onCaptureMock).toHaveBeenCalledWith(2);

    // Fast forward 500ms -> isCapturing resets
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.isCapturing).toBe(false);
  });

  it('non-host cannot initiate startCountdown', () => {
    const { result } = renderHook(() => useBoothSync(mockRoom, false));

    act(() => {
      result.current.startCountdown(1);
    });

    expect(mockRoom.localParticipant.publishData).not.toHaveBeenCalled();
    expect(result.current.countdown).toBeNull();
  });

  it('receives COUNTDOWN_START event from peer over data channel', () => {
    const onCaptureMock = vi.fn();
    const { result } = renderHook(() => useBoothSync(mockRoom, false, { onCapture: onCaptureMock }));

    const targetTimestamp = Date.now() + 3000;
    const payload: BoothSyncMessage = {
      type: 'COUNTDOWN_START',
      slotIndex: 3,
      targetTimestamp,
    };
    const encoded = new TextEncoder().encode(JSON.stringify(payload));

    act(() => {
      eventListeners['dataReceived']?.(encoded);
    });

    expect(result.current.currentSlot).toBe(3);
    expect(result.current.countdown).toBe(3);

    // Fast forward timers
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.isCapturing).toBe(true);
    expect(onCaptureMock).toHaveBeenCalledWith(3);
  });

  it('unregisters room event listener on unmount', () => {
    const { unmount } = renderHook(() => useBoothSync(mockRoom, false));
    expect(mockRoom.on).toHaveBeenCalledWith('dataReceived', expect.any(Function));

    unmount();
    expect(mockRoom.off).toHaveBeenCalledWith('dataReceived', expect.any(Function));
  });
});
