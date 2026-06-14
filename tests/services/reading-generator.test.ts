import { describe, it, expect, vi, beforeEach } from "vitest";

const chatMock = vi.fn();

vi.mock("@/lib/ollama", () => ({
  getOllama: () => ({ chat: chatMock }),
  OLLAMA_MODEL: "test-model",
}));

// Avoid the token-budget throwing or polluting logs across tests.
vi.mock("@/lib/token-budget", () => ({
  recordUsage: vi.fn(),
}));

import { generateReading } from "@/services/reading-generator";

function ollamaReply(content: string) {
  return {
    message: { content },
    prompt_eval_count: 10,
    eval_count: 20,
  };
}

describe("generateReading", () => {
  beforeEach(() => {
    chatMock.mockReset();
  });

  it("parses well-formed JSON from the model", async () => {
    chatMock.mockResolvedValue(
      ollamaReply(
        JSON.stringify({ markdown: "## Title\n\nBody.", keyWords: ["body", "title"] })
      )
    );

    const result = await generateReading("B1", "travel");
    expect(result.markdown).toContain("## Title");
    expect(result.keyWords).toEqual(["body", "title"]);
  });

  it("extracts JSON even when the model wraps it in prose", async () => {
    chatMock.mockResolvedValue(
      ollamaReply(
        'Sure! Here you go:\n{"markdown":"## A","keyWords":["a"]}\nHope that helps.'
      )
    );

    const result = await generateReading("A2", "food");
    expect(result.keyWords).toEqual(["a"]);
  });

  it("throws when the response contains no JSON", async () => {
    chatMock.mockResolvedValue(ollamaReply("no json here"));
    await expect(generateReading("A1", "x")).rejects.toThrow(/No JSON found/);
  });

  it("throws when the response is empty", async () => {
    chatMock.mockResolvedValue(ollamaReply(""));
    await expect(generateReading("A1", "x")).rejects.toThrow(/Empty response/);
  });

  it("throws when JSON is missing required fields", async () => {
    chatMock.mockResolvedValue(ollamaReply('{"markdown":"only md"}'));
    await expect(generateReading("C1", "x")).rejects.toThrow();
  });
});
