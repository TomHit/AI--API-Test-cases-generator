export async function ollamaGenerate({
  model = "qwen2.5:3b",
  prompt,
  temperature = 0.3,
  timeoutMs = 180000,
}) {
  const url = "http://localhost:11434/api/generate";

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: 800, // hard cap output tokens (prevents long generations)
          top_p: 0.9,
        },
        stop: ["\n\n\n", "```"],
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Ollama returned non-JSON: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(
        `Ollama error: ${res.status} ${data?.error || ""}`.trim(),
      );
    }

    return data?.response || "";
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(`Ollama timeout after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}
