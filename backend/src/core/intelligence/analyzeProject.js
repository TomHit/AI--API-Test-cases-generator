import { extractSignals } from "./signalExtractor.js";
import { detectProjectType } from "./projectClassifier.js";
import { buildProjectCard } from "./projectCardBuilder.js";
import { buildProjectSummary } from "./summaryBuilder.js";
import { extractDocSignals } from "./docSignalExtractor.js";
import { mergeProjectContext } from "./mergeProjectContext.js";

export async function analyzeProject(input = {}) {
  const {
    openapi = null,
    projectNotes = "",
    githubData = null,

    // doc/jira/prd enrichment
    documentsText = "",
    prdText = "",
    jiraText = "",
    storyText = "",
    acceptanceCriteriaText = "",
    commentsText = "",
    extraTexts = [],
  } = input;

  // -------------------------
  // Base analysis (source of truth)
  // -------------------------
  const signals = extractSignals({
    openapi,
    projectNotes,
    githubData,
    documentsText,
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

  // -------------------------
  // Doc/Jira/PRD enrichment
  // -------------------------
  const docSignals = extractDocSignals({
    documentsText,
    prdText,
    jiraText,
    storyText,
    acceptanceCriteriaText,
    commentsText,
    extraTexts,
  });

  // If no doc content, return base directly
  if (!docSignals?.hasContent) {
    return baseAnalysis;
  }

  // Merge enrichment without changing system truth
  return mergeProjectContext(baseAnalysis, docSignals);
}
