function pushUnique(arr, value) {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
}

function getScore(map = {}, key) {
  return Number(map?.[key] || 0);
}

export function detectRisks(signals = {}) {
  const risks = [];

  const endpointCount = Array.isArray(signals?.endpoints)
    ? signals.endpoints.length
    : 0;
  const hasOperationalApi = endpointCount > 0;

  const hasAuth = Boolean(signals?.hasAuth);
  const hasFileInput = Boolean(signals?.hasFileInput);
  const hasTextInput = Boolean(signals?.hasTextInput);
  const hasUpload = Boolean(signals?.hasUpload);

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
    (ingestScore >= 1 ||
      hasUpload ||
      hasFileInput ||
      llmScore >= 1 ||
      llmWorkflowScore >= 1);

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
    pushUnique(risks, "auth_authz");
  }

  if (hasOperationalApi) {
    pushUnique(risks, "input_validation");
    pushUnique(risks, "rate_limiting");
  }

  if (hasFileInput || hasUpload) {
    pushUnique(risks, "file_upload_security");
  }

  if (hasTransactionalApi) {
    pushUnique(risks, "idempotency");

    if (
      getScore(signals?.scores?.risk, "sensitive_data_exposure") > 0 ||
      getScore(signals?.scores?.domain, "banking_finance") >= 4
    ) {
      pushUnique(risks, "sensitive_data_exposure");
    }

    if (
      webhookWorkflowScore > 0 ||
      getScore(signals?.scores?.risk, "webhook_integrity") > 0
    ) {
      pushUnique(risks, "webhook_integrity");
    }
  }

  if (hasRagStyleSystem) {
    if (hasTextInput) pushUnique(risks, "prompt_injection");
    pushUnique(risks, "hallucination");
    pushUnique(risks, "retrieval_mismatch");

    if (hasFileInput || ingestScore > 0) {
      pushUnique(risks, "document_poisoning");
    }
  }

  if (hasLLMStyleSystem) {
    if (hasTextInput) pushUnique(risks, "prompt_injection");
    pushUnique(risks, "hallucination");
  }

  if (hasMLStyleSystem) {
    pushUnique(risks, "model_drift");
    pushUnique(risks, "prediction_reliability");
  }

  return [...new Set(risks)];
}
