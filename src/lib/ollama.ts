import { Ollama } from "ollama";

let _client: Ollama | null = null;

export function getOllama(): Ollama {
  if (!_client) {
    const apiKey = process.env.OLLAMA_API_KEY;

    if (apiKey) {
      _client = new Ollama({
        host: "https://ollama.com",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } else {
      const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
      _client = new Ollama({ host });
    }
  }
  return _client;
}

export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
