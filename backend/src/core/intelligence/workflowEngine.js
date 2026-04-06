function pushUnique(arr, value) {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
}

function getScore(map = {}, key) {
  return Number(map?.[key] || 0);
}

export function inferWorkflow(signals = {}) {
  const flow = [];

  const endpointCount = Array.isArray(signals?.endpoints)
    ? signals.endpoints.length
    : 0;

  const hasEndpoints = endpointCount > 0;

  // -----------------------------
  // Scores (NEW SYSTEM)
  // -----------------------------
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

  const hasFileFlow =
    Boolean(signals?.hasUpload) || Boolean(signals?.hasFileInput);

  // -----------------------------
  // SYSTEM DETECTION
  // -----------------------------
  const isRAG =
    !openapiOnly &&
    hasStrongRagHints &&
    ragScore >= 3 &&
    retrieveScore >= 1 &&
    (ingestScore >= 1 || hasFileFlow || llmScore >= 1);

  const isLLM =
    !isRAG &&
    (llmScore >= 2 || llmWorkflowScore >= 1.5 || Boolean(signals?.hasChat));

  const isML =
    mlScore >= 2 && (predictWorkflowScore >= 1 || Boolean(signals?.hasPredict));

  const isTransactional =
    hasStrongPaymentsHints ||
    paymentWorkflowScore >= 2 ||
    getScore(signals?.scores?.domain, "banking_finance") >= 4;

  // -----------------------------
  // WORKFLOW BUILDING
  // -----------------------------

  // 🧠 RAG SYSTEM
  if (isRAG) {
    if (ingestScore >= 1 || hasFileFlow) pushUnique(flow, "ingest");
    if (retrieveScore >= 1) pushUnique(flow, "retrieve");
    pushUnique(flow, "llm");
  }

  // 💬 LLM SYSTEM
  else if (isLLM) {
    pushUnique(flow, "llm");
  }

  // 🤖 ML SYSTEM
  if (isML) {
    pushUnique(flow, "predict");
  }

  // 💳 TRANSACTIONAL SYSTEM (Stripe type)
  if (isTransactional) {
    pushUnique(flow, "transaction");

    if (webhookWorkflowScore > 0) {
      pushUnique(flow, "webhook");
    }
  }

  // 🧱 FALLBACK (pure API)
  if (hasEndpoints && flow.length === 0) {
    pushUnique(flow, "crud");
  }

  return [...new Set(flow)];
}
