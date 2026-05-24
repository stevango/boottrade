import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { ENV } from "./_core/env";

// AES-256-GCM encryption for secrets at rest (e.g. broker API credentials).
// The key is derived from JWT_SECRET so no extra env var is required, but the
// derivation is namespaced so the encryption key never equals the cookie key.
const ALGO = "aes-256-gcm";
const KEY_SALT = "boottrade.broker.credentials.v1";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is required to encrypt broker credentials");
  }
  cachedKey = scryptSync(ENV.cookieSecret, KEY_SALT, 32);
  return cachedKey;
}

// Returns a self-describing token: v1:<iv>:<authTag>:<ciphertext> (all base64).
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(token: string): string {
  const parts = token.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Malformed encrypted secret");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
