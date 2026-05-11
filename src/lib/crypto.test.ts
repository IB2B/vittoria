import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { decryptToken, encryptToken } from "./crypto";

const originalKey = process.env.APP_ENCRYPTION_KEY;

beforeAll(() => {
  // Ensure tests don't depend on the dev key; they generate their own.
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterAll(() => {
  process.env.APP_ENCRYPTION_KEY = originalKey;
});

describe("encryptToken / decryptToken", () => {
  it("round-trips arbitrary strings", () => {
    const plain = "EAAB1234567|secret-token_with-symbols!?";
    const enc = encryptToken(plain);
    expect(enc).not.toContain(plain);
    const dec = decryptToken(enc);
    expect(dec).toBe(plain);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const plain = "static-token";
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plain);
    expect(decryptToken(b)).toBe(plain);
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptToken("not-base64-or-too-short")).toThrow();
  });

  it("rejects payloads encrypted with a different key", () => {
    const enc = encryptToken("some token");
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptToken(enc)).toThrow();
  });
});
