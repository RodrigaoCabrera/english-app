import { describe, it, expect } from "vitest";
import {
  CEFR_LEVELS,
  CEFR_DESCRIPTIONS,
  CEFR_WORD_COUNT,
  cefrSystemPrompt,
} from "@/lib/cefr";

describe("CEFR constants", () => {
  it("defines the six standard levels in order", () => {
    expect(CEFR_LEVELS).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
  });

  it("has a description for every level", () => {
    for (const level of CEFR_LEVELS) {
      expect(CEFR_DESCRIPTIONS[level]).toBeTruthy();
    }
  });

  it("has a valid word-count range for every level", () => {
    for (const level of CEFR_LEVELS) {
      const { min, max } = CEFR_WORD_COUNT[level];
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThan(min);
    }
  });

  it("increases word counts monotonically with level", () => {
    for (let i = 1; i < CEFR_LEVELS.length; i++) {
      const prev = CEFR_WORD_COUNT[CEFR_LEVELS[i - 1]];
      const cur = CEFR_WORD_COUNT[CEFR_LEVELS[i]];
      expect(cur.min).toBeGreaterThanOrEqual(prev.min);
    }
  });
});

describe("cefrSystemPrompt", () => {
  it("embeds the level and its description", () => {
    const prompt = cefrSystemPrompt("B2");
    expect(prompt).toContain("B2");
    expect(prompt).toContain(CEFR_DESCRIPTIONS.B2);
  });
});
