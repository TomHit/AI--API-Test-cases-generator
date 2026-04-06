function pushUnique(arr, value) {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
}

function getScore(map = {}, key) {
  return Number(map?.[key] || 0);
}

export function detectMissing(signals = {}) {
  const missing = [];

  const endpointCount = Array.isArray(signals?.endpoints)
    ? signals.endpoints.length
    : 0;
  const hasOperationalApi = endpointCount > 0;

  const hasAuth = Boolean(signals?.hasAuth);
  const hasFileFlow =
    Boolean(signals?.hasUpload) || Boolean(signals?.hasFileInput);

  const ragScore = getScore(signals?.scores?.ai, "rag");
  const llmScore = getScore(signals?.scores?.ai, "llm");
  const mlScore = getScore(signals?.scores?.ai, "ml");

  const retrieveScore = getScore(signals?.scores?.workflow, "retrieve");
  const ingestScore = getScore(signals?.scores?.workflow, "ingest");
  const llmWorkflowScore = getScore(signals?.scores?.workflow, "llm");
  const predictWorkflowScore = getScore(signals?.scores?.workflow, "predict");
  const paymentWorkflowScore = getScore(signals?.scores?.workflow, "payment");
  const webhookWorkflowScore = getScore(signals?.scores?.workflow, "webhook");

  const openapiOnly = Boolean(signals?.flags?.openapiOnly);
  const hasStrongRagHints = Boolean(signals?.flags?.hasStrongRagHints);
  const hasStrongPaymentsHints = Boolean(
    signals?.flags?.hasStrongPaymentsHints,
  );

  const hasRagStyleSystem =
    !openapiOnly &&
    hasStrongRagHints &&
    ragScore >= 3 &&
    retrieveScore >= 1 &&
    (ingestScore >= 1 || hasFileFlow || llmScore >= 1 || llmWorkflowScore >= 1);

  const hasLLMStyleSystem =
    !hasRagStyleSystem &&
    (llmScore >= 2 || llmWorkflowScore >= 1.5 || Boolean(signals?.hasChat));

  const hasMLStyleSystem =
    mlScore >= 2 && (predictWorkflowScore >= 1 || Boolean(signals?.hasPredict));

  const hasTransactionalApi =
    hasStrongPaymentsHints ||
    paymentWorkflowScore >= 2 ||
    getScore(signals?.scores?.domain, "banking_finance") >= 4;

  if (hasOperationalApi && !hasAuth) {
    pushUnique(missing, "authentication");
  }

  if (
    hasOperationalApi &&
    getScore(signals?.scores?.risk, "rate_limiting") < 0.5
  ) {
    pushUnique(missing, "rate_limiting");
  }

  if (
    hasOperationalApi &&
    getScore(signals?.scores?.risk, "input_validation") < 0.5
  ) {
    pushUnique(missing, "input_validation");
  }

  if (hasFileFlow) {
    pushUnique(missing, "file_type_validation");
    pushUnique(missing, "file_size_limits");
  }

  if (hasTransactionalApi) {
    if (getScore(signals?.scores?.risk, "idempotency") < 0.5) {
      pushUnique(missing, "idempotency_controls");
    }

    if (
      webhookWorkflowScore > 0 ||
      getScore(signals?.scores?.risk, "webhook_integrity") > 0
    ) {
      pushUnique(missing, "webhook_signature_verification");
    }

    if (getScore(signals?.scores?.risk, "sensitive_data_exposure") > 0) {
      pushUnique(missing, "sensitive_data_protection");
    }
  }

  if (hasRagStyleSystem) {
    pushUnique(missing, "output_guardrails");
    pushUnique(missing, "safety_policy");
    pushUnique(missing, "retrieval_quality_checks");
    pushUnique(missing, "source_grounding");
    pushUnique(missing, "citation_validation");

    if (hasFileFlow || ingestScore > 0) {
      pushUnique(missing, "document_sanitization");
    }
  }

  if (hasLLMStyleSystem) {
    pushUnique(missing, "output_guardrails");
    pushUnique(missing, "safety_policy");
  }

  if (hasMLStyleSystem) {
    pushUnique(missing, "model_versioning");
    pushUnique(missing, "prediction_monitoring");
  }

  return [...new Set(missing)];
}
