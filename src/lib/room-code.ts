const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * ALLOWED_CHARS.length);
    result += ALLOWED_CHARS[randomIndex];
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  if (!code || code.length !== 6) return false;
  const regex = /^[A-HJ-NP-Z2-9]{6}$/;
  return regex.test(code);
}
