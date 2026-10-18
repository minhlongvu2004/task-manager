import { afterEach, describe, expect, it, vi } from "vitest";
import { localToday } from "@/lib/today";

afterEach(() => vi.unstubAllEnvs());

describe("localToday", () => {
  it("uses the app time zone, not UTC, around local midnight", () => {
    const d = new Date("2026-10-19T02:30:00Z"); // 22:30 on Oct 18 in Toronto (EDT)
    expect(localToday(d, "America/Toronto")).toBe("2026-10-18");
    expect(localToday(d, "UTC")).toBe("2026-10-19");
  });
  it("defaults to America/Toronto and honours APP_TIME_ZONE", () => {
    const d = new Date("2026-10-19T02:30:00Z");
    vi.stubEnv("APP_TIME_ZONE", "");
    expect(localToday(d)).toBe("2026-10-18");
    vi.stubEnv("APP_TIME_ZONE", "Asia/Tokyo");
    expect(localToday(d)).toBe("2026-10-19");
  });
});
