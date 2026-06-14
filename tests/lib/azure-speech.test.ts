import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { assessPronunciation } from "@/lib/azure-speech";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const res = {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
}

describe("assessPronunciation", () => {
  beforeEach(() => {
    vi.stubEnv("AZURE_SPEECH_KEY", "test-key");
    vi.stubEnv("AZURE_SPEECH_REGION", "eastus");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("maps a successful Azure response to a PronunciationScore", async () => {
    mockFetchOnce({
      RecognitionStatus: "Success",
      DisplayText: "Hello world",
      NBest: [
        {
          AccuracyScore: 92,
          FluencyScore: 88,
          CompletenessScore: 100,
          PronScore: 90,
          Words: [
            { Word: "hello", AccuracyScore: 95, ErrorType: "None" },
            { Word: "world", AccuracyScore: 80, ErrorType: "Mispronunciation" },
          ],
        },
      ],
    });

    const score = await assessPronunciation(Buffer.from("fake-wav"), "Hello world");

    expect(score.recognizedText).toBe("Hello world");
    expect(score.accuracyScore).toBe(92);
    expect(score.fluencyScore).toBe(88);
    expect(score.completenessScore).toBe(100);
    expect(score.pronScore).toBe(90);
    expect(score.words).toHaveLength(2);
    expect(score.words[1]).toEqual({
      word: "world",
      accuracyScore: 80,
      errorType: "Mispronunciation",
    });
  });

  it("defaults missing word fields to 0 / None", async () => {
    mockFetchOnce({
      RecognitionStatus: "Success",
      DisplayText: "hi",
      NBest: [{ Words: [{ Word: "hi" }] }],
    });

    const score = await assessPronunciation(Buffer.from("x"), "hi");
    expect(score.words[0]).toEqual({ word: "hi", accuracyScore: 0, errorType: "None" });
    expect(score.accuracyScore).toBe(0);
  });

  it("throws when recognition did not succeed", async () => {
    mockFetchOnce({ RecognitionStatus: "NoMatch", NBest: [] });
    await expect(assessPronunciation(Buffer.from("x"), "hi")).rejects.toThrow(
      /Recognition failed/
    );
  });

  it("throws on a non-OK HTTP response", async () => {
    mockFetchOnce({ error: "bad" }, false, 401);
    await expect(assessPronunciation(Buffer.from("x"), "hi")).rejects.toThrow(
      /Azure Speech API error 401/
    );
  });

  it("throws when credentials are missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("AZURE_SPEECH_KEY", "");
    vi.stubEnv("AZURE_SPEECH_REGION", "");
    await expect(assessPronunciation(Buffer.from("x"), "hi")).rejects.toThrow(
      /AZURE_SPEECH_KEY/
    );
  });
});
