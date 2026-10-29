import crypto from 'crypto';

const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let result = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    result += ALLOWED_CHARS[randomBytes[i] % ALLOWED_CHARS.length];
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  if (!code || code.length !== 6) return false;
  const regex = /^[A-HJ-NP-Z2-9]{6}$/;
  return regex.test(code);
}
