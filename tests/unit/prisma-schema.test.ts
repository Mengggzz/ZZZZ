import { describe, it, expect } from 'vitest';
import { generateRoomCode, isValidRoomCode } from '../../src/lib/room-code';
import { db } from '../../src/lib/prisma';

describe('Room Code Utility', () => {
  it('generates 6 character uppercase alphanumeric code without ambiguous characters', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(isValidRoomCode(code)).toBe(true);
  });

  it('rejects invalid room codes', () => {
    expect(isValidRoomCode('12345')).toBe(false);
    expect(isValidRoomCode('ABCDE0')).toBe(false);
    expect(isValidRoomCode('abcdef')).toBe(false);
  });
});

describe('Prisma Client Instance', () => {
  it('exports db client with room, capture, and strip delegates', () => {
    expect(db).toBeDefined();
    expect(db.room).toBeDefined();
    expect(db.capture).toBeDefined();
    expect(db.strip).toBeDefined();
  });
});
