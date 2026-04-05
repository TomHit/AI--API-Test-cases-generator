export function detectMissing(signals = {}) {
  const missing = [];

  const endpointCount = Array.isArray(signals.endpoints)
    ? signals.endpoints.length
    : 0;

  const hasAISignals =
    Boolean(signals.hasChat) ||
    Boolean(signals.hasSearch) ||
    Boolean(signals.hasPredict) ||
    Boolean(signals.hasPromptLikeInput) ||
    Boolean(signals.hasConversationFlow) ||
    Boolean(signals.hasRetrievalFlow) ||
    Boolean(signals.hasLLMClues) ||
    Boolean(signals.hasAIDescription);

  const hasRetrievalSignals =
    Boolean(signals.hasSearch) || Boolean(signals.hasRetrievalFlow);

  const hasConversationSignals =
    Boolean(signals.hasChat) || Boolean(signals.hasConversationFlow);

  const hasFileFlow =
    Boolean(signals.hasUpload) || Boolean(signals.hasFileInput);

  const hasOperationalApi = endpointCount > 0;

  // Common API hygiene
  if (!signals.hasAuth && hasOperationalApi) {
    missing.push("authentication");
  }

  if (hasOperationalApi) {
    missing.push("rate_limiting");
    missing.push("input_validation");
  }

  if (hasFileFlow) {
    missing.push("file_type_validation");
    missing.push("file_size_limits");
  }

  // AI / LLM / RAG specific controls
  if (hasAISignals) {
    missing.push("output_guardrails");
    missing.push("safety_policy");
  }

  if (hasConversationSignals) {
    missing.push("conversation_boundary_controls");
  }

  if (hasRetrievalSignals) {
    missing.push("retrieval_quality_checks");
    missing.push("source_grounding");
  }

  if (signals.hasPredict) {
    missing.push("model_versioning");
    missing.push("prediction_monitoring");
  }

  return [...new Set(missing)];
}
