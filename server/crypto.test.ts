import { beforeAll, describe, expect, it } from "vitest";

// Set the secret before importing the module so ENV picks it up.
process.env.JWT_SECRET = "test-secret-for-crypto-roundtrip";

let encryptSecret: (s: string) => string;
let decryptSecret: (s: string) => string;

beforeAll(async () => {
  const mod = await import("./crypto");
  encryptSecret = mod.encryptSecret;
  decryptSecret = mod.decryptSecret;
});

describe("broker credential encryption", () => {
  it("round-trips plaintext through encrypt/decrypt", () => {
    const secret = JSON.stringify({ apiKey: "abc123", apiSecret: "s3cr3t", accountId: "001" });
    const token = encryptSecret(secret);
    expect(token.startsWith("v1:")).toBe(true);
    expect(token).not.toContain("abc123");
    expect(decryptSecret(token)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-input");
    expect(decryptSecret(b)).toBe("same-input");
  });

  it("rejects a tampered token", () => {
    const token = encryptSecret("do-not-tamper");
    const parts = token.split(":");
    const data = Buffer.from(parts[3], "base64");
    data[0] ^= 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${data.toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects malformed tokens", () => {
    expect(() => decryptSecret("not-a-valid-token")).toThrow();
  });
});
