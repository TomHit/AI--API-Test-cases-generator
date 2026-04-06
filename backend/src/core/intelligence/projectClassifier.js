function roundScore(value) {
  return Number((value || 0).toFixed(2));
}

function getScore(map = {}, key) {
  return Number(map?.[key] || 0);
}

function getTopEntry(scoreMap = {}) {
  const entries = Object.entries(scoreMap || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return { key: "unknown", score: 0, secondScore: 0 };
  }

  return {
    key: entries[0][0],
    score: Number(entries[0][1] || 0),
    secondScore: Number(entries[1]?.[1] || 0),
  };
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function computeConfidence(topScore, secondScore, bonuses = 0) {
  if (topScore <= 0) return 0.2;

  const separation = topScore / Math.max(topScore + secondScore, 1);
  const boosted = separation + bonuses;
  return roundScore(clamp(boosted, 0.35, 0.99));
}

function topTerms(list = [], limit = 5) {
  return Array.isArray(list) ? list.slice(0, limit).map((x) => x.term) : [];
}

function hasAnyStrongSource(signals = {}, names = []) {
  return names.some((name) => Boolean(signals?.sources?.[name]?.present));
}

function buildAllowedRiskTags(systemFamily, signals = {}) {
  const riskScores = signals?.scores?.risk || {};
  const allowed = [];

  const addIf = (riskName, threshold = 0.5) => {
    if (
      (riskScores[riskName] || 0) >= threshold &&
      !allowed.includes(riskName)
    ) {
      allowed.push(riskName);
    }
  };

  if (
    systemFamily === "transactional_api" ||
    systemFamily === "crud_business_api"
  ) {
    addIf("auth_authz", 0.5);
    addIf("input_validation", 0.5);
    addIf("rate_limiting", 0.5);
    addIf("idempotency", 0.5);
    addIf("sensitive_data_exposure", 0.5);
    addIf("webhook_integrity", 0.5);

    if (signals?.hasFileInput) addIf("file_upload_security", 0.1);

    return allowed;
  }

  if (systemFamily === "rag_system") {
    addIf("prompt_injection", 0.1);
    addIf("hallucination", 0.1);
    addIf("retrieval_mismatch", 0.1);
    addIf("document_poisoning", 0.1);
    addIf("file_upload_security", 0.1);
    addIf("input_validation", 0.1);
    addIf("rate_limiting", 0.1);

    return allowed;
  }

  if (
    systemFamily === "ai_application" ||
    systemFamily === "ml_prediction_system"
  ) {
    addIf("input_validation", 0.1);
    addIf("rate_limiting", 0.1);
    addIf("prompt_injection", 0.1);
    addIf("hallucination", 0.1);
    addIf("auth_authz", 0.1);
    addIf("file_upload_security", 0.1);

    return allowed;
  }

  addIf("auth_authz", 0.5);
  addIf("input_validation", 0.5);
  addIf("rate_limiting", 0.5);
  if (signals?.hasFileInput) addIf("file_upload_security", 0.1);

  return allowed;
}

function buildWorkflow(systemFamily, signals = {}) {
  const workflowScores = signals?.scores?.workflow || {};
  const ordered = Object.entries(workflowScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  const unique = [];
  for (const step of ordered) {
    if (!unique.includes(step)) unique.push(step);
  }

  if (systemFamily === "transactional_api") {
    const base = ["authenticate"];
    if (unique.includes("payment")) base.push("process_payment");
    else base.push("create_or_update_resource");
    base.push("retrieve_state");
    if (unique.includes("webhook")) base.push("handle_events");
    return [...new Set(base)];
  }

  if (systemFamily === "crud_business_api") {
    return ["authenticate", "create_or_update_resource", "retrieve_state"];
  }

  if (systemFamily === "rag_system") {
    const ragFlow = [];
    if (signals?.hasUpload || unique.includes("ingest")) ragFlow.push("ingest");
    ragFlow.push("retrieve");
    ragFlow.push("generate");
    return [...new Set(ragFlow)];
  }

  if (systemFamily === "ai_application") {
    const aiFlow = [];
    if (signals?.hasUpload || unique.includes("ingest")) aiFlow.push("ingest");
    if (signals?.hasSearch || unique.includes("retrieve"))
      aiFlow.push("retrieve");
    aiFlow.push("generate");
    return [...new Set(aiFlow)];
  }

  if (systemFamily === "ml_prediction_system") {
    return ["submit_input", "run_inference", "return_prediction"];
  }

  if (unique.length > 0) return unique;

  return ["analyze", "process", "respond"];
}

function pickSubtype(systemFamily, domainKey, signals = {}) {
  const resources = topTerms(signals?.topEvidence?.resource_terms, 12);
  const aiTerms = topTerms(signals?.topEvidence?.ai_terms, 12);

  if (systemFamily === "rag_system") {
    if (resources.some((x) => x.includes("document") || x.includes("file"))) {
      return "knowledge_assistant";
    }
    return "rag_api";
  }

  if (systemFamily === "ml_prediction_system") {
    return "prediction_api";
  }

  if (systemFamily === "ai_application") {
    if (aiTerms.some((x) => x.includes("assistant") || x.includes("chat"))) {
      return "conversational_ai_api";
    }
    return "llm_application_api";
  }

  if (domainKey === "banking_finance") {
    if (
      resources.some((x) =>
        [
          "payment",
          "payments",
          "payment_intents",
          "paymentintent",
          "charge",
          "charges",
          "invoice",
          "invoices",
          "subscription",
          "subscriptions",
          "payout",
          "refund",
        ].includes(x),
      )
    ) {
      return "payments_api";
    }
    return "financial_api";
  }

  if (domainKey === "retail_commerce") return "commerce_api";
  if (domainKey === "healthcare") return "healthcare_api";
  if (domainKey === "identity_access") return "identity_access_api";
  if (domainKey === "messaging") return "messaging_api";
  if (domainKey === "analytics") return "analytics_api";
  if (domainKey === "document_management") return "document_management_api";

  if ((signals?.endpoints || []).length > 0) return "generic_business_api";

  return "unknown";
}

function labelForDomain(domainKey) {
  const labels = {
    banking_finance: "Banking / Finance",
    retail_commerce: "Retail / Commerce",
    healthcare: "Healthcare",
    identity_access: "Identity / Access",
    messaging: "Messaging / Communication",
    analytics: "Analytics / BI",
    document_management: "Document Management",
    unknown: "General Software",
  };

  return labels[domainKey] || "General Software";
}

function labelForProjectType(subtype, systemFamily) {
  const labels = {
    payments_api: "Payments API",
    financial_api: "Financial API",
    commerce_api: "Commerce API",
    healthcare_api: "Healthcare API",
    identity_access_api: "Identity & Access API",
    messaging_api: "Messaging API",
    analytics_api: "Analytics API",
    document_management_api: "Document Management API",
    rag_api: "RAG API",
    knowledge_assistant: "Knowledge Assistant",
    conversational_ai_api: "Conversational AI API",
    llm_application_api: "LLM Application API",
    prediction_api: "ML Inference API",
    generic_business_api: "Business API",
    unknown: "Generic API",
  };

  if (labels[subtype]) return labels[subtype];

  const familyLabels = {
    transactional_api: "Transactional API",
    crud_business_api: "CRUD API",
    rag_system: "RAG API",
    ai_application: "AI Application API",
    ml_prediction_system: "ML Inference API",
    developer_platform: "Developer Platform API",
    unknown: "Generic API",
  };

  return familyLabels[systemFamily] || "Generic API";
}

export function detectProjectType(signals = {}) {
  const endpointCount = Array.isArray(signals.endpoints)
    ? signals.endpoints.length
    : 0;

  const domainScores = signals?.scores?.domain || {};
  const aiScores = signals?.scores?.ai || {};
  const workflowScores = signals?.scores?.workflow || {};

  const domainTop = getTopEntry(domainScores);
  const domainKey = domainTop.key === "unknown" ? "unknown" : domainTop.key;

  const ragScore = getScore(aiScores, "rag");
  const llmScore = getScore(aiScores, "llm");
  const mlScore = getScore(aiScores, "ml");

  const retrieveScore = getScore(workflowScores, "retrieve");
  const ingestScore = getScore(workflowScores, "ingest");
  const llmWorkflowScore = getScore(workflowScores, "llm");
  const predictWorkflowScore = getScore(workflowScores, "predict");
  const paymentWorkflowScore = getScore(workflowScores, "payment");
  const webhookWorkflowScore = getScore(workflowScores, "webhook");

  const openapiOnly = Boolean(signals?.flags?.openapiOnly);
  const hasDocsOrNotesOrGithub = hasAnyStrongSource(signals, [
    "docs",
    "notes",
    "github",
  ]);
  const hasStrongRagHints = Boolean(signals?.flags?.hasStrongRagHints);
  const hasStrongPaymentsHints = Boolean(
    signals?.flags?.hasStrongPaymentsHints,
  );

  let systemFamily = "unknown";
  let reasons = [];

  const adjustedRagScore = openapiOnly ? 0 : ragScore;

  if (
    hasStrongRagHints &&
    hasDocsOrNotesOrGithub &&
    adjustedRagScore >= 3 &&
    retrieveScore >= 1 &&
    (ingestScore >= 1 ||
      signals.hasUpload ||
      signals.hasFileInput ||
      llmScore >= 1 ||
      llmWorkflowScore >= 1)
  ) {
    systemFamily = "rag_system";
    reasons.push(
      "Strong non-OpenAPI RAG evidence found across notes/docs/github.",
    );
  } else if (
    mlScore >= 2 &&
    predictWorkflowScore >= 1 &&
    adjustedRagScore < 3
  ) {
    systemFamily = "ml_prediction_system";
    reasons.push("Prediction and inference signals dominate.");
  } else if (
    (llmScore >= 2 || llmWorkflowScore >= 1.5 || signals.hasChat) &&
    adjustedRagScore < 3
  ) {
    systemFamily = "ai_application";
    reasons.push(
      "LLM or conversational signals dominate without strong retrieval evidence.",
    );
  } else if (
    hasStrongPaymentsHints ||
    paymentWorkflowScore >= 2 ||
    domainKey === "banking_finance"
  ) {
    systemFamily = "transactional_api";
    reasons.push("Transactional finance/payment resource evidence dominates.");
  } else if (endpointCount > 0) {
    systemFamily = "crud_business_api";
    reasons.push(
      "Structured API endpoints detected without strong AI or transactional evidence.",
    );
  } else {
    systemFamily = "unknown";
    reasons.push("Not enough reliable evidence to determine system family.");
  }

  if (openapiOnly && systemFamily === "rag_system") {
    systemFamily = "crud_business_api";
    reasons.push(
      "OpenAPI-only input cannot be classified as RAG without explicit non-contract evidence.",
    );
  }

  if (
    openapiOnly &&
    domainKey === "banking_finance" &&
    adjustedRagScore === 0
  ) {
    systemFamily = "transactional_api";
    reasons.push(
      "OpenAPI-only finance signals override generic retrieval wording.",
    );
  }

  const subtype = pickSubtype(systemFamily, domainKey, signals);
  const projectType = labelForProjectType(subtype, systemFamily);
  const businessDomain = domainKey || "unknown";
  const businessDomainLabel = labelForDomain(businessDomain);

  const confidenceBonus =
    systemFamily === "transactional_api" && openapiOnly
      ? 0.2
      : systemFamily === "rag_system" && hasDocsOrNotesOrGithub
        ? 0.15
        : systemFamily === "ml_prediction_system"
          ? 0.12
          : 0.08;

  const confidence = computeConfidence(
    Math.max(
      domainTop.score,
      systemFamily === "rag_system"
        ? adjustedRagScore + retrieveScore + ingestScore
        : 0,
      systemFamily === "ai_application" ? llmScore + llmWorkflowScore : 0,
      systemFamily === "ml_prediction_system"
        ? mlScore + predictWorkflowScore
        : 0,
      systemFamily === "transactional_api"
        ? domainTop.score + paymentWorkflowScore + webhookWorkflowScore
        : 0,
      endpointCount > 0 ? endpointCount * 0.15 : 0,
    ),
    Math.max(
      domainTop.secondScore,
      adjustedRagScore,
      llmScore,
      mlScore,
      retrieveScore,
    ),
    confidenceBonus,
  );

  const workflow = buildWorkflow(systemFamily, signals);
  const risk_tags = buildAllowedRiskTags(systemFamily, signals);

  return {
    projectType,
    systemFamily,
    subtype,
    businessDomain,
    businessDomainLabel,
    confidence,
    analysisMode: signals?.analysisMode || "unknown",
    workflow,
    risk_tags,
    reasons,
    evidencePreview: {
      domain: topTerms(signals?.topEvidence?.domain_terms, 8),
      resources: topTerms(signals?.topEvidence?.resource_terms, 10),
      ai: topTerms(signals?.topEvidence?.ai_terms, 8),
      repo: topTerms(signals?.topEvidence?.repo_terms, 8),
    },
    sourceEvidence: {
      openapi: signals?.sources?.openapi?.present ? "strong" : "none",
      docs: signals?.sources?.docs?.present ? "present" : "none",
      github: signals?.sources?.github?.present ? "present" : "none",
      notes: signals?.sources?.notes?.present ? "present" : "none",
    },

    // Backward compatibility for any old UI code that expects a string-like type feel
    label: projectType,
    type: projectType,
  };
}
