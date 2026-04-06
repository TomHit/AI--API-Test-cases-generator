function uniqueList(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function normalizeText(value) {
  return String(value || "").trim();
}

function mergePrimitiveLists(baseList = [], docList = [], limit = 20) {
  return uniqueList([...(baseList || []), ...(docList || [])]).slice(0, limit);
}

function mergeScoredLists(
  baseList = [],
  docList = [],
  key = "name",
  scoreKey = "score",
  limit = 15,
) {
  const mergedMap = new Map();

  for (const item of [...(baseList || []), ...(docList || [])]) {
    if (!item || !item[key]) continue;

    const existing = mergedMap.get(item[key]);
    if (!existing) {
      mergedMap.set(item[key], {
        ...item,
        [scoreKey]: Number(item[scoreKey] || 0),
      });
      continue;
    }

    mergedMap.set(item[key], {
      ...existing,
      [scoreKey]: Number(existing[scoreKey] || 0) + Number(item[scoreKey] || 0),
    });
  }

  return [...mergedMap.values()]
    .sort((a, b) => Number(b[scoreKey] || 0) - Number(a[scoreKey] || 0))
    .slice(0, limit);
}

function humanizeFlowName(name = "") {
  return String(name || "").replaceAll("_", " ");
}

function mergeWorkflow(baseWorkflow = [], docFlows = []) {
  const normalizedBase = Array.isArray(baseWorkflow) ? baseWorkflow : [];

  const enrichedHints = Array.isArray(docFlows)
    ? docFlows
        .map((f) => {
          if (!f?.action) return null;

          const action = f.action.replaceAll("_", " ");
          const object = f.object ? ` ${f.object}` : "";

          return `${action}${object}`;
        })
        .filter(Boolean)
    : [];

  return {
    system_workflow: normalizedBase,
    business_flow_hints: uniqueList(enrichedHints).slice(0, 10),
  };
}

function mergeSummary(baseSummary = "", docSummary = "", docSignals = {}) {
  const cleanBase = String(baseSummary || "").trim();
  const cleanDoc = String(docSummary || "").trim();

  const flows = (docSignals?.flows || [])
    .slice(0, 4)
    .map((f) => {
      if (!f?.action) return null;

      const action = f.action.replaceAll("_", " ");
      const object = f.object ? ` ${f.object}` : "";

      return `${action}${object}`;
    })
    .filter(Boolean)
    .join(", ");

  const hasStrongDocContext =
    (docSignals?.flows || []).length > 0 ||
    (docSignals?.user_stories || []).length > 0;

  if (!hasStrongDocContext) {
    return cleanBase;
  }

  return [cleanBase, cleanDoc, flows ? `Business flow includes ${flows}.` : ""]
    .filter(Boolean)
    .join(" ");
}

function mergeMissing(
  baseMissing = [],
  docValidations = [],
  docConstraints = [],
  docEdgeCases = [],
) {
  const merged = [...(baseMissing || [])];

  const lowerJoined = [
    ...(docValidations || []),
    ...(docConstraints || []),
    ...(docEdgeCases || []),
  ]
    .join(" ")
    .toLowerCase();

  if (lowerJoined.includes("rate limit") && !merged.includes("rate_limiting")) {
    merged.push("rate_limiting");
  }

  if (
    (lowerJoined.includes("file size") || lowerJoined.includes("file type")) &&
    !merged.includes("file_type_validation")
  ) {
    merged.push("file_type_validation");
  }

  if (
    (lowerJoined.includes("file size") || lowerJoined.includes("max size")) &&
    !merged.includes("file_size_limits")
  ) {
    merged.push("file_size_limits");
  }

  if (
    (lowerJoined.includes("retry") || lowerJoined.includes("duplicate")) &&
    !merged.includes("idempotency_controls")
  ) {
    merged.push("idempotency_controls");
  }

  return uniqueList(merged).slice(0, 20);
}

function buildContextHighlights(base = {}, docSignals = {}) {
  const highlights = [];

  if (base?.projectCard?.project_type) {
    highlights.push(`Detected as ${base.projectCard.project_type}`);
  }

  if (base?.projectCard?.business_domain_label) {
    highlights.push(`Domain: ${base.projectCard.business_domain_label}`);
  }

  const flowNames = (docSignals?.flows || [])
    .slice(0, 4)
    .map((f) => {
      if (!f?.action) return null;
      return `${f.action.replaceAll("_", " ")}${f.object ? ` ${f.object}` : ""}`;
    })
    .filter(Boolean);
  if (flowNames.length > 0) {
    highlights.push(`Business flows: ${flowNames.join(", ")}`);
  }

  if ((docSignals?.user_stories || []).length > 0) {
    highlights.push(`User stories detected`);
  }

  if ((docSignals?.acceptance_criteria || []).length > 0) {
    highlights.push(`Acceptance criteria present`);
  }

  return highlights;
}

export function mergeProjectContext(baseAnalysis = {}, docSignals = {}) {
  const baseProjectCard = baseAnalysis?.projectCard || {};
  const baseClassification = baseAnalysis?.classification || {};
  const baseSummary = baseAnalysis?.summary || "";

  const mergedWorkflow = mergeWorkflow(
    baseProjectCard.workflow || baseClassification.workflow || [],
    docSignals?.flows || [],
  );

  const mergedRiskTags = mergePrimitiveLists(
    baseProjectCard.risk_tags || [],
    (docSignals?.risks || []).map((item) => item?.name).filter(Boolean),
    20,
  );

  const mergedMissing = mergeMissing(
    baseProjectCard.missing || [],
    docSignals?.validations || [],
    docSignals?.constraints || [],
    docSignals?.edge_cases || [],
  );

  const enrichedProjectCard = {
    ...baseProjectCard,

    // Keep OpenAPI/system truth locked
    project_type: baseProjectCard.project_type,
    system_family: baseProjectCard.system_family,
    subtype: baseProjectCard.subtype,
    business_domain: baseProjectCard.business_domain,
    business_domain_label: baseProjectCard.business_domain_label,
    workflow: baseProjectCard.workflow,

    // Add enrichment beside core truth
    context_workflow: mergedWorkflow,
    risk_tags: mergedRiskTags,
    missing: mergedMissing,

    doc_summary: docSignals?.summary || "",
    user_stories: (docSignals?.user_stories || []).slice(0, 15),
    acceptance_criteria: (docSignals?.acceptance_criteria || []).slice(0, 25),
    validations: (docSignals?.validations || []).slice(0, 25),
    constraints: (docSignals?.constraints || []).slice(0, 20),
    edge_cases: (docSignals?.edge_cases || []).slice(0, 20),
    feature_hints: (docSignals?.feature_hints || []).slice(0, 20),

    doc_risks: docSignals?.risks || [],
    doc_flows: docSignals?.flows || [],
    doc_stats: docSignals?.stats || {},

    context_highlights: buildContextHighlights(baseAnalysis, docSignals),
  };

  const mergedSummary = mergeSummary(
    baseSummary,
    docSignals?.summary,
    docSignals || "",
  );

  return {
    status: baseAnalysis?.status || "completed",
    summary: mergedSummary,
    confidence: baseAnalysis?.confidence || baseProjectCard?.confidence || 0,

    signals: baseAnalysis?.signals || {},
    classification: baseClassification,

    projectCard: enrichedProjectCard,

    enrichment: {
      source: "document_context",
      applied: Boolean(docSignals?.hasContent),
      doc_summary: docSignals?.summary || "",
      flows: docSignals?.flows || [],
      risks: docSignals?.risks || [],
      validations: docSignals?.validations || [],
      constraints: docSignals?.constraints || [],
      edge_cases: docSignals?.edge_cases || [],
      user_stories: docSignals?.user_stories || [],
      acceptance_criteria: docSignals?.acceptance_criteria || [],
      feature_hints: docSignals?.feature_hints || [],
      stats: docSignals?.stats || {},
    },
  };
}
