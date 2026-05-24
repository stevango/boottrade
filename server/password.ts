import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Password hashing with Node's built-in scrypt (no extra dependency).
// Stored format: scrypt$<saltHex>$<hashHex>
const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  // Lengths must match before timingSafeEqual or it throws.
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
