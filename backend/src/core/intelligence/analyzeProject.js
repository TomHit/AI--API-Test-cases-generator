import { extractSignals } from "./signalExtractor.js";
import { detectProjectType } from "./projectClassifier.js";
import { buildProjectCard } from "./projectCardBuilder.js";
import { buildProjectSummary } from "./summaryBuilder.js";
import { extractDocSignals } from "./docSignalExtractor.js";
import { mergeProjectContext } from "./mergeProjectContext.js";
import { buildCanonicalSummary } from "./buildCanonicalSummary.js";
import { renderExecutiveSummary, renderQaSummary } from "./summaryRenderers.js";

export async function analyzeProject(input = {}) {
  const {
    openapi = null,
    projectNotes = "",
    githubData = null,
    documentsText = "",
    prdText = "",
    jiraText = "",
    storyText = "",
    acceptanceCriteriaText = "",
    commentsText = "",
    extraTexts = [],
  } = input;

  const combinedDocumentsText = [
    documentsText,
    prdText,
    jiraText,
    storyText,
    acceptanceCriteriaText,
    commentsText,
    ...(Array.isArray(extraTexts) ? extraTexts : []),
  ]
    .filter((x) => String(x || "").trim())
    .join("\n\n");

  const signals = extractSignals({
    openapi,
    projectNotes,
    githubData,
    documentsText: combinedDocumentsText,
  });

  const classification = detectProjectType(signals);

  const baseProjectCard = buildProjectCard({
    signals,
    classification,
  });

  const baseSummary = buildProjectSummary(baseProjectCard);

  const baseAnalysis = {
    status: "completed",
    summary: baseSummary,
    confidence: baseProjectCard.confidence || classification.confidence || 0,
    signals,
    classification,
    projectCard: baseProjectCard,
  };

  const docSignals = extractDocSignals({
    openapi,
    projectNotes,
    githubData,
    documentsText,
    prdText,
    jiraText,
    storyText,
    acceptanceCriteriaText,
    commentsText,
    extraTexts,
  });

  if (!docSignals?.hasContent) {
    const canonicalSummary = buildCanonicalSummary({
      baseAnalysis,
      docSignals: {},
    });

    const executiveSummary = renderExecutiveSummary(canonicalSummary);
    const qaSummary = renderQaSummary(canonicalSummary);

    return {
      ...baseAnalysis,
      canonical_summary: canonicalSummary,
      executive_summary: executiveSummary,
      qa_summary: qaSummary,
    };
  }

  const mergedAnalysis = mergeProjectContext(baseAnalysis, docSignals);

  const canonicalSummary = buildCanonicalSummary({
    baseAnalysis: mergedAnalysis,
    docSignals,
  });

  const executiveSummary = renderExecutiveSummary(canonicalSummary);
  const qaSummary = renderQaSummary(canonicalSummary);

  return {
    ...mergedAnalysis,
    canonical_summary: canonicalSummary,
    executive_summary: executiveSummary,
    qa_summary: qaSummary,
  };
}
