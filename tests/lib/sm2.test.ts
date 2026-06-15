import { describe, it, expect } from "vitest";
import { schedule, type Sm2State } from "@/lib/sm2";

const fresh: Sm2State = { easeFactor: 250, intervalDays: 0, repetitions: 0 };

describe("schedule (SM-2)", () => {
  it("first 'good' review sets interval to 1 day and repetitions to 1", () => {
    const next = schedule(fresh, "good");
    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(1);
  });

  it("second 'good' review sets interval to 6 days", () => {
    const after1 = schedule(fresh, "good");
    const after2 = schedule(after1, "good");
    expect(after2.repetitions).toBe(2);
    expect(after2.intervalDays).toBe(6);
  });

  it("third 'good' review multiplies interval by the ease factor", () => {
    const s = schedule(schedule(fresh, "good"), "good"); // interval 6, rep 2
    const next = schedule(s, "good");
    // easeFactor stays 250 on 'good' (q=4): efDelta = 0; interval = round(6 * 2.50)
    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBe(15);
  });

  it("'again' lapses: repetitions reset to 0 and interval to 1 day", () => {
    const mature = schedule(schedule(schedule(fresh, "good"), "good"), "good");
    const lapsed = schedule(mature, "again");
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.intervalDays).toBe(1);
  });

  it("'easy' raises the ease factor, 'hard' lowers it", () => {
    expect(schedule(fresh, "easy").easeFactor).toBeGreaterThan(250);
    expect(schedule(fresh, "hard").easeFactor).toBeLessThan(250);
  });

  it("floors the ease factor at 130 (EF 1.30) under repeated 'again'", () => {
    let s = fresh;
    for (let i = 0; i < 20; i++) s = schedule(s, "again");
    expect(s.easeFactor).toBe(130);
  });

  it("is deterministic: same input yields same output", () => {
    expect(schedule(fresh, "good")).toEqual(schedule(fresh, "good"));
  });
});
