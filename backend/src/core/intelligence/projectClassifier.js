export function detectProjectType(signals = {}) {
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

  const hasModelSignals =
    Boolean(signals.hasPredict) || Boolean(signals.hasLLMClues);

  if (hasConversationSignals && hasRetrievalSignals) {
    return "RAG API";
  }

  if (hasConversationSignals && hasAISignals) {
    return "Conversational AI API";
  }

  if (hasModelSignals) {
    return "ML Inference API";
  }

  if (endpointCount > 0) {
    return "CRUD API";
  }

  return "Generic API";
}
