export type BoothSyncMessage =
  | { type: 'COUNTDOWN_START'; slotIndex: number; targetTimestamp: number }
  | { type: 'RETAKE_SLOT'; slotIndex: number }
  | { type: 'SESSION_COMPLETE' };

export interface BoothSyncOptions {
  onCapture?: (slotIndex: number) => void;
  serverOffsetMs?: number;
}

export interface BoothSyncState {
  countdown: number | null;
  currentSlot: number;
  isCapturing: boolean;
  startCountdown: (slot: number) => void;
  retakeSlot: (slot: number) => void;
}
