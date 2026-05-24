import { describe, expect, it } from "vitest";
import { rateLimit } from "./rateLimit";

describe("rateLimit", () => {
  it("allows up to the limit then throws", () => {
    const key = `test-${Math.random()}`;
    expect(() => {
      for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000);
    }).not.toThrow();
    expect(() => rateLimit(key, 3, 60_000)).toThrow(/Limite de requisições/);
  });

  it("isolates counts per key", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(() => rateLimit(a, 1, 60_000)).toThrow();
    expect(() => rateLimit(b, 1, 60_000)).not.toThrow();
  });

  it("resets after the window elapses", () => {
    const key = `w-${Math.random()}`;
    rateLimit(key, 1, 1);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(() => rateLimit(key, 1, 1)).not.toThrow();
        resolve();
      }, 5);
    });
  });
});
