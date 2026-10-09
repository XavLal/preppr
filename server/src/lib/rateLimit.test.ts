import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RateLimiter } from "./rateLimit.js";

describe("limite de tentatives", () => {
  it("bloque au-delà du seuil, puis accepte après la fenêtre", () => {
    const limiter = new RateLimiter();
    const now = Date.now();
    const original = Date.now;
    Date.now = () => now;
    try {
      assert.equal(limiter.isBlocked("login", 2, 1000), false);
      limiter.record("login", 1000);
      limiter.record("login", 1000);
      assert.equal(limiter.isBlocked("login", 2, 1000), true);
      Date.now = () => now + 1001;
      assert.equal(limiter.isBlocked("login", 2, 1000), false);
    } finally {
      Date.now = original;
    }
  });
});
