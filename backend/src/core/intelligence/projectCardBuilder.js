import { detectMissing } from "./missingInfoDetector.js";

function roundConfidence(value) {
  return Number((Math.max(0, Math.min(1, value || 0)) * 100).toFixed(0)) / 100;
}

function getTopTerms(items = [], limit = 10) {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, limit)
    .map((item) => item.term)
    .filter(Boolean);
}

function buildSecondaryDomains(signals = {}, primaryDomain = "unknown") {
  const entries = Object.entries(signals?.scores?.domain || {})
    .filter(([domain, score]) => domain !== primaryDomain && score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

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

  return entries.map(([domain, score]) => ({
    domain,
    label: labels[domain] || "General Software",
    score: Number((score || 0).toFixed(2)),
  }));
}

function buildDomainSignals(classification = {}, signals = {}) {
  const domainTerms = getTopTerms(signals?.topEvidence?.domain_terms, 12);
  const resourceTerms = getTopTerms(signals?.topEvidence?.resource_terms, 12);

  const merged = [...domainTerms, ...resourceTerms];
  return [...new Set(merged)].slice(0, 15);
}

function buildEvidenceSummary(classification = {}, signals = {}) {
  return {
    domain_terms: getTopTerms(signals?.topEvidence?.domain_terms, 8),
    resource_terms: getTopTerms(signals?.topEvidence?.resource_terms, 10),
    ai_terms: getTopTerms(signals?.topEvidence?.ai_terms, 8),
    workflow_terms: getTopTerms(signals?.topEvidence?.workflow_terms, 8),
    risk_terms: getTopTerms(signals?.topEvidence?.risk_terms, 8),
    repo_terms: getTopTerms(signals?.topEvidence?.repo_terms, 8),
    api_patterns: getTopTerms(signals?.topEvidence?.api_patterns, 8),
  };
}

function buildSourceSummary(signals = {}, classification = {}) {
  return {
    analysis_mode:
      classification?.analysisMode || signals?.analysisMode || "unknown",
    openapi: signals?.sources?.openapi?.present ? "present" : "none",
    docs: signals?.sources?.docs?.present ? "present" : "none",
    github: signals?.sources?.github?.present ? "present" : "none",
    notes: signals?.sources?.notes?.present ? "present" : "none",
  };
}

function buildProjectHighlights(classification = {}, signals = {}) {
  const highlights = [];

  if (classification?.projectType) {
    highlights.push(`Detected as ${classification.projectType}`);
  }

  if (classification?.businessDomainLabel) {
    highlights.push(`Domain: ${classification.businessDomainLabel}`);
  }

  if (classification?.analysisMode) {
    highlights.push(
      `Mode: ${classification.analysisMode.replaceAll("_", " ")}`,
    );
  }

  const topResources = getTopTerms(signals?.topEvidence?.resource_terms, 5);
  if (topResources.length > 0) {
    highlights.push(`Key resources: ${topResources.join(", ")}`);
  }

  return highlights;
}

export function buildProjectCard({
  signals = {},
  classification = null,
  projectType = null,
}) {
  const resolvedClassification =
    classification && typeof classification === "object"
      ? classification
      : {
          projectType:
            typeof projectType === "string" && projectType.trim()
              ? projectType.trim()
              : "Generic API",
          systemFamily: "unknown",
          subtype: "unknown",
          businessDomain: "unknown",
          businessDomainLabel: "General Software",
          confidence: 0.4,
          analysisMode: signals?.analysisMode || "unknown",
          workflow: [],
          risk_tags: [],
          reasons: [],
          evidencePreview: {},
          sourceEvidence: {},
          label:
            typeof projectType === "string" && projectType.trim()
              ? projectType.trim()
              : "Generic API",
          type:
            typeof projectType === "string" && projectType.trim()
              ? projectType.trim()
              : "Generic API",
        };

  const primaryDomain = resolvedClassification.businessDomain || "unknown";
  const domainSignals = buildDomainSignals(resolvedClassification, signals);
  const secondaryDomains = buildSecondaryDomains(signals, primaryDomain);
  const missing = detectMissing(signals);
  const confidence = roundConfidence(resolvedClassification.confidence);

  return {
    project_type: resolvedClassification.projectType,
    system_family: resolvedClassification.systemFamily,
    subtype: resolvedClassification.subtype,

    business_domain: primaryDomain,
    business_domain_label: resolvedClassification.businessDomainLabel,
    subdomain:
      resolvedClassification.subtype === "unknown"
        ? primaryDomain
        : resolvedClassification.subtype,
    domain_confidence: confidence,
    domain_signals: domainSignals,
    secondary_domains: secondaryDomains,

    workflow: Array.isArray(resolvedClassification.workflow)
      ? resolvedClassification.workflow
      : [],
    risk_tags: Array.isArray(resolvedClassification.risk_tags)
      ? resolvedClassification.risk_tags
      : [],
    missing,

    confidence,

    source_evidence: buildSourceSummary(signals, resolvedClassification),
    evidence_summary: buildEvidenceSummary(resolvedClassification, signals),
    evidence_preview: resolvedClassification.evidencePreview || {},
    reasoning: Array.isArray(resolvedClassification.reasons)
      ? resolvedClassification.reasons
      : [],
    highlights: buildProjectHighlights(resolvedClassification, signals),

    endpoint_count: Array.isArray(signals?.endpoints)
      ? signals.endpoints.length
      : 0,
    auth_detected: Boolean(signals?.hasAuth),
    file_input_detected: Boolean(signals?.hasFileInput),
    text_input_detected: Boolean(signals?.hasTextInput),

    // backward compatibility
    type: resolvedClassification.projectType,
    label: resolvedClassification.projectType,
  };
}
