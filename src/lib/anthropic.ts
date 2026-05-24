import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");
    _client = new Anthropic({
      apiKey,
      baseURL: "https://api.deepseek.com/anthropic",
    });
  }
  return _client;
}
