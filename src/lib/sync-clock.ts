export function calculateTargetCaptureTime(
  clientTime: number,
  serverOffsetMs: number,
  delayMs: number
): number {
  return clientTime + serverOffsetMs + delayMs;
}
