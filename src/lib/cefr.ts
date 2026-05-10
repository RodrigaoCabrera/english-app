export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const CEFR_DESCRIPTIONS: Record<CefrLevel, string> = {
  A1: "Beginner — very basic vocabulary, simple present tense",
  A2: "Elementary — common everyday expressions, simple sentences",
  B1: "Intermediate — familiar topics, connected text, basic opinions",
  B2: "Upper-intermediate — complex text, abstract topics, fluency",
  C1: "Advanced — complex ideas, flexible, effective language use",
  C2: "Proficient — near-native, nuanced, sophisticated expression",
};

export const CEFR_WORD_COUNT: Record<CefrLevel, { min: number; max: number }> = {
  A1: { min: 80, max: 120 },
  A2: { min: 120, max: 180 },
  B1: { min: 180, max: 250 },
  B2: { min: 250, max: 350 },
  C1: { min: 350, max: 500 },
  C2: { min: 450, max: 650 },
};

export function cefrSystemPrompt(level: CefrLevel): string {
  return `You are an English language learning content creator. Write content appropriate for CEFR level ${level}: ${CEFR_DESCRIPTIONS[level]}. Use vocabulary and grammar structures natural for that level. Never exceed the complexity of the specified level.`;
}
