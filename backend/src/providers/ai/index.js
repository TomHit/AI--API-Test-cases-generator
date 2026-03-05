import { ollamaGenerate } from "../../ollamaClient.js";

function envBool(v, def = false) {
  if (v === undefined || v === null || v === "") return def;
  return String(v).toLowerCase() === "true";
}

export function getAIProvider() {
  const enabled = envBool(process.env.AI_ENABLED, false);
  const provider = (process.env.AI_PROVIDER || "ollama").toLowerCase();

  // If AI not enabled -> return disabled provider (no calls)
  if (!enabled) {
    return {
      name: "disabled",
      enabled: false,
      modelName: null,
      generate: async () => {
        throw new Error("AI is disabled");
      },
    };
  }

  // Ollama provider
  if (provider === "ollama") {
    const modelName = process.env.OLLAMA_MODEL || "qwen2.5:3b";
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 180000);

    return {
      name: "ollama",
      enabled: true,
      modelName,
      generate: async ({ prompt, temperature = 0.3 } = {}) => {
        return await ollamaGenerate({
          model: modelName,
          prompt,
          temperature,
          timeoutMs,
        });
      },
    };
  }

  // Future: openai/deepseek providers here
  return {
    name: "disabled",
    enabled: false,
    modelName: null,
    generate: async () => {
      throw new Error(`Unknown AI_PROVIDER=${provider}`);
    },
  };
}
