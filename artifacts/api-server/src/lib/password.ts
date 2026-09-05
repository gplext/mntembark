import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

/**
 * Hashes a plain-text password using scrypt with a unique random salt.
 * Returns in format: "<saltHex>:<keyHex>"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plain-text password against a stored hashed password.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split(":");
    if (!salt || !keyHex) return false;

    const keyBuffer = Buffer.from(keyHex, "hex");
    const derivedKey = scryptSync(password, salt, keyBuffer.length);

    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}
