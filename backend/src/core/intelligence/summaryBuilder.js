function humanizeWorkflowStep(step = "") {
  const map = {
    authenticate: "authentication",
    create_or_update_resource: "resource creation and updates",
    retrieve_state: "state retrieval",
    handle_events: "event or webhook handling",
    ingest: "content ingestion",
    retrieve: "context retrieval",
    generate: "LLM-driven response generation",
    submit_input: "input submission",
    run_inference: "model inference",
    return_prediction: "prediction delivery",
    process_payment: "payment processing",
    analyze: "analysis",
    process: "processing",
    respond: "response generation",
    webhook: "webhook/event handling",
    payment: "payment execution",
    llm: "LLM interaction",
    predict: "prediction flow",
  };

  return map[step] || String(step || "").replaceAll("_", " ");
}

function humanizeRisk(risk = "") {
  const map = {
    auth_authz: "authentication and authorization weaknesses",
    input_validation: "input validation gaps",
    rate_limiting: "rate limiting weaknesses",
    idempotency: "idempotency handling issues",
    sensitive_data_exposure: "sensitive data exposure",
    webhook_integrity: "webhook verification and integrity issues",
    file_upload_security: "file upload security issues",
    prompt_injection: "prompt injection",
    hallucination: "hallucination or unsupported responses",
    retrieval_mismatch: "retrieval mismatch or grounding failures",
    document_poisoning: "document poisoning",
  };

  return map[risk] || String(risk || "").replaceAll("_", " ");
}

function sentenceJoin(items = [], conjunction = "and") {
  const filtered = (items || []).filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2)
    return `${filtered[0]} ${conjunction} ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(", ")}, ${conjunction} ${filtered[filtered.length - 1]}`;
}

function pickEvidence(card = {}, limit = 6) {
  const direct =
    card?.evidence_summary?.resource_terms?.length > 0
      ? card.evidence_summary.resource_terms
      : card?.domain_signals || [];

  return (direct || []).slice(0, limit);
}

function buildSystemDescription(card = {}) {
  const projectType = card.project_type || "API system";
  const domain = card.business_domain_label || "General Software";
  const systemFamily = card.system_family || "unknown";
  const sourceMode = card?.source_evidence?.analysis_mode || "unknown";

  if (systemFamily === "transactional_api") {
    return `This project appears to be a ${projectType} in the ${domain} domain.`;
  }

  if (systemFamily === "crud_business_api") {
    return `This project appears to be a structured business API in the ${domain} domain.`;
  }

  if (systemFamily === "rag_system") {
    return `This project appears to be a RAG-based system in the ${domain} domain.`;
  }

  if (systemFamily === "ai_application") {
    return `This project appears to be an AI application API in the ${domain} domain.`;
  }

  if (systemFamily === "ml_prediction_system") {
    return `This project appears to be a machine-learning inference system in the ${domain} domain.`;
  }

  if (sourceMode === "openapi_only") {
    return `This project appears to be an API-defined system in the ${domain} domain.`;
  }

  return `This project appears to be a software system in the ${domain} domain.`;
}

function buildEvidenceText(card = {}) {
  const evidence = pickEvidence(card, 6);
  const sourceEvidence = card?.source_evidence || {};
  const presentSources = [
    sourceEvidence.openapi === "present" ? "OpenAPI" : null,
    sourceEvidence.docs === "present" ? "documents" : null,
    sourceEvidence.github === "present" ? "GitHub/project code" : null,
    sourceEvidence.notes === "present" ? "project notes" : null,
  ].filter(Boolean);

  if (evidence.length === 0 && presentSources.length === 0) return "";

  if (evidence.length > 0 && presentSources.length > 0) {
    return `The classification is based on ${sentenceJoin(presentSources)} and supported by evidence such as ${sentenceJoin(evidence)}.`;
  }

  if (evidence.length > 0) {
    return `Key evidence includes ${sentenceJoin(evidence)}.`;
  }

  return `The classification is based on ${sentenceJoin(presentSources)}.`;
}

function buildWorkflowText(card = {}) {
  const workflow = Array.isArray(card.workflow) ? card.workflow : [];
  if (workflow.length === 0) return "";

  const humanized = workflow.slice(0, 5).map(humanizeWorkflowStep);
  return `The likely workflow includes ${sentenceJoin(humanized)}.`;
}

function buildRiskText(card = {}) {
  const risks = Array.isArray(card.risk_tags) ? card.risk_tags : [];
  if (risks.length === 0) return "";

  const humanized = risks.slice(0, 6).map(humanizeRisk);
  return `Primary testing concerns include ${sentenceJoin(humanized)}.`;
}

function buildMissingText(card = {}) {
  const missing = Array.isArray(card.missing) ? card.missing : [];
  if (missing.length === 0) return "";

  const normalized = missing
    .slice(0, 5)
    .map((item) => String(item).replaceAll("_", " "));
  return `Some potentially missing or unclear areas are ${sentenceJoin(normalized)}.`;
}

export function buildProjectSummary(card = {}) {
  const parts = [
    buildSystemDescription(card),
    buildEvidenceText(card),
    buildWorkflowText(card),
    buildRiskText(card),
    buildMissingText(card),
  ].filter(Boolean);

  return parts.join(" ");
}
