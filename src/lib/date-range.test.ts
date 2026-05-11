import { describe, expect, it } from "vitest";

import {
  delta,
  parseRangeFromSearchParams,
  presetToRange,
  previousRange,
} from "./date-range";

describe("presetToRange", () => {
  const today = new Date("2026-05-15T12:00:00Z");

  it("7d preset returns last 7 days", () => {
    const r = presetToRange("7d", today);
    expect(r.until).toBe("2026-05-15");
    expect(r.since).toBe("2026-05-09");
  });

  it("30d preset returns last 30 days", () => {
    const r = presetToRange("30d", today);
    expect(r.until).toBe("2026-05-15");
    expect(r.since).toBe("2026-04-16");
  });

  it("month preset is start-of-month → today", () => {
    const r = presetToRange("month", today);
    expect(r.since).toBe("2026-05-01");
    expect(r.until).toBe("2026-05-15");
  });

  it("last-month is full previous month", () => {
    const r = presetToRange("last-month", today);
    expect(r.since).toBe("2026-04-01");
    expect(r.until).toBe("2026-04-30");
  });
});

describe("previousRange", () => {
  it("returns equal-length window immediately preceding the input", () => {
    const r = previousRange({ since: "2026-05-01", until: "2026-05-07" });
    // Length = 7 days. Previous window: 2026-04-24 → 2026-04-30.
    expect(r.until).toBe("2026-04-30");
    expect(r.since).toBe("2026-04-24");
  });

  it("works with single-day ranges", () => {
    const r = previousRange({ since: "2026-05-01", until: "2026-05-01" });
    expect(r.since).toBe("2026-04-30");
    expect(r.until).toBe("2026-04-30");
  });
});

describe("parseRangeFromSearchParams", () => {
  const today = new Date("2026-05-15T12:00:00Z");

  it("falls back to 7d preset when nothing is provided", () => {
    const out = parseRangeFromSearchParams({}, today);
    expect(out.preset).toBe("7d");
    expect(out.range.until).toBe("2026-05-15");
    expect(out.range.since).toBe("2026-05-09");
  });

  it("respects from/to when both are valid yyyy-mm-dd", () => {
    const out = parseRangeFromSearchParams(
      { from: "2026-01-01", to: "2026-01-31" },
      today,
    );
    expect(out.preset).toBe("custom");
    expect(out.range.since).toBe("2026-01-01");
    expect(out.range.until).toBe("2026-01-31");
  });

  it("ignores malformed dates and falls back to preset", () => {
    const out = parseRangeFromSearchParams(
      { from: "yesterday", to: "today" },
      today,
    );
    expect(out.preset).toBe("7d");
  });
});

describe("delta", () => {
  it("returns null when either side is null", () => {
    expect(delta(null, 10)).toBeNull();
    expect(delta(10, null)).toBeNull();
  });

  it("returns null when prior is zero (no division by zero)", () => {
    expect(delta(10, 0)).toBeNull();
  });

  it("returns ratio difference for positive values", () => {
    expect(delta(120, 100)).toBeCloseTo(0.2, 5);
    expect(delta(80, 100)).toBeCloseTo(-0.2, 5);
  });
});
