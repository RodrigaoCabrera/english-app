/**
 * Pure SM-2 spaced-repetition scheduler. No DB, no clock — given the current
 * card state and a grade, returns the next state. The service layer computes
 * the concrete due date from `intervalDays`.
 *
 * `easeFactor` is stored ×100 as an integer (250 = EF 2.50) to avoid float
 * drift in Postgres.
 */

export type Grade = "again" | "hard" | "good" | "easy";

export interface Sm2State {
  easeFactor: number; // ×100 integer
  intervalDays: number;
  repetitions: number;
}

// Anki-style grades mapped to the classic SM-2 quality 0–5.
const Q: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const MIN_EF = 130; // EF 1.30 ×100

export function schedule(state: Sm2State, grade: Grade): Sm2State {
  const q = Q[grade];

  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const easeFactor = Math.max(MIN_EF, Math.round(state.easeFactor + efDelta * 100));

  // q < 3 is a lapse: reset progress, review again tomorrow (not same session).
  if (q < 3) {
    return { easeFactor, intervalDays: 1, repetitions: 0 };
  }

  const repetitions = state.repetitions + 1;
  let intervalDays: number;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  // Uses the updated EF (Anki-style), not the prior EF (strict SM-2 paper).
  // Effect: 'hard' schedules slightly shorter than strict SM-2; 'easy' slightly longer.
  else intervalDays = Math.round(state.intervalDays * (easeFactor / 100));

  return { easeFactor, intervalDays, repetitions };
}
