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

  it('retakeSlot updates local currentSlot, clears active countdown, and publishes RETAKE_SLOT', () => {
    const { result } = renderHook(() => useBoothSync(mockRoom, true));

    // Start countdown for slot 1
    act(() => {
      result.current.startCountdown(1);
    });
    expect(result.current.countdown).toBe(3);

    // Call retakeSlot(4)
    act(() => {
      result.current.retakeSlot(4);
    });

    expect(result.current.currentSlot).toBe(4);
    expect(result.current.countdown).toBeNull();
    expect(result.current.isCapturing).toBe(false);

    expect(mockRoom.localParticipant.publishData).toHaveBeenCalledTimes(2);
    const publishArgs = mockRoom.localParticipant.publishData.mock.calls[1];
    const decodedMessage: BoothSyncMessage = JSON.parse(new TextDecoder().decode(publishArgs[0]));
    expect(decodedMessage).toEqual({
      type: 'RETAKE_SLOT',
      slotIndex: 4,
    });
    expect(publishArgs[1]).toEqual({ reliable: true });
  });

  it('receives RETAKE_SLOT event from peer and updates currentSlot and clears timers', () => {
    const { result } = renderHook(() => useBoothSync(mockRoom, false));

    const payload: BoothSyncMessage = {
      type: 'RETAKE_SLOT',
      slotIndex: 2,
    };
    const encoded = new TextEncoder().encode(JSON.stringify(payload));

    act(() => {
      eventListeners['dataReceived']?.(encoded);
    });

    expect(result.current.currentSlot).toBe(2);
    expect(result.current.countdown).toBeNull();
    expect(result.current.isCapturing).toBe(false);
  });

  it('triggers immediate capture when peer receives late packet with non-positive delayRemaining', () => {
    const onCaptureMock = vi.fn();
    const { result } = renderHook(() =>
      useBoothSync(mockRoom, false, { onCapture: onCaptureMock, serverOffsetMs: 0 })
    );

    // Packet arrived with targetTimestamp in the past (e.g. 500ms late)
    const targetTimestamp = Date.now() - 500;
    const payload: BoothSyncMessage = {
      type: 'COUNTDOWN_START',
      slotIndex: 2,
      targetTimestamp,
    };
    const encoded = new TextEncoder().encode(JSON.stringify(payload));

    act(() => {
      eventListeners['dataReceived']?.(encoded);
    });

    expect(result.current.countdown).toBeNull();
    expect(result.current.isCapturing).toBe(true);
    expect(onCaptureMock).toHaveBeenCalledWith(2);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.isCapturing).toBe(false);
  });

  it('calculates countdown with Math.ceil when peer receives positive delayRemaining', () => {
    const onCaptureMock = vi.fn();
    const { result } = renderHook(() =>
      useBoothSync(mockRoom, false, { onCapture: onCaptureMock, serverOffsetMs: 0 })
    );

    // 1400ms remaining -> Math.ceil(1.4) = 2s countdown
    const targetTimestamp = Date.now() + 1400;
    const payload: BoothSyncMessage = {
      type: 'COUNTDOWN_START',
      slotIndex: 3,
      targetTimestamp,
    };
    const encoded = new TextEncoder().encode(JSON.stringify(payload));

    act(() => {
      eventListeners['dataReceived']?.(encoded);
    });

    expect(result.current.countdown).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBeNull();
    expect(result.current.isCapturing).toBe(true);
    expect(onCaptureMock).toHaveBeenCalledWith(3);
  });

  it('host integrates calculateTargetCaptureTime with serverOffsetMs', () => {
    const clientNow = 20000;
    vi.setSystemTime(clientNow);
    const serverOffsetMs = 150; // client behind server

    const { result } = renderHook(() =>
      useBoothSync(mockRoom, true, { serverOffsetMs })
    );

    act(() => {
      result.current.startCountdown(1);
    });

    const publishArgs = mockRoom.localParticipant.publishData.mock.calls[0];
    const decodedMessage: BoothSyncMessage = JSON.parse(new TextDecoder().decode(publishArgs[0]));
    expect(decodedMessage.type).toBe('COUNTDOWN_START');
    if (decodedMessage.type === 'COUNTDOWN_START') {
      // 20000 + 150 + 3000 = 23150
      expect(decodedMessage.targetTimestamp).toBe(23150);
    }
  });
});
