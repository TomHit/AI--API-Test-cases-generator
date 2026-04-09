import { extractStorySignals } from "./storySignalExtractor.js";
import { inferStoryUnderstanding } from "./storyInferenceEngine.js";
import { buildStoryFlowRiskMap } from "./storyFlowRiskEngine.js";
import {
  renderStoryExecutiveSummary,
  renderStoryQaSummary,
} from "./storySummaryRenderers.js";

export async function analyzeUserStory(input = {}) {
  const { story = "", acceptanceCriteria = "", comments = "" } = input;

  const hasContent = [story, acceptanceCriteria, comments].some((x) =>
    String(x || "").trim(),
  );

  if (!hasContent) {
    return {
      status: "completed",
      source_type: "user_story",
      story_signals: {
        source_type: "user_story",
        has_content: false,
        raw_text: "",
        actors: [],
        intent: {
          actor_phrase: "",
          action_phrase: "",
          benefit_phrase: "",
        },
        domain_hints: [],
        action_hints: [],
        constraints: [],
      },
      canonical_summary: null,
      executive_summary: "",
      qa_summary: "",
      inference_notes: [],
    };
  }

  const signals = extractStorySignals({
    story,
    acceptanceCriteria,
    comments,
  });

  const understanding = inferStoryUnderstanding(signals);

  understanding.testing = understanding.testing || {};
  understanding.testing.flow_risk_map = buildStoryFlowRiskMap(understanding);

  const inference_notes = [];

  if ((signals?.domain_hints || []).length > 0) {
    inference_notes.push(
      `Domain inferred from story terms: ${signals.domain_hints.join(", ")}.`,
    );
  }

  if ((understanding?.workflows?.primary || []).length > 0) {
    inference_notes.push(
      "Primary workflow was inferred from story intent and domain context.",
    );
  }

  if ((understanding?.testing?.focus_areas || []).length > 0) {
    inference_notes.push(
      "Testing focus areas were inferred from likely operational behavior in the story.",
    );
  }

  const executive_summary = renderExecutiveSummary(understanding);
  const qa_summary = renderStoryQaSummary(understanding, signals);

  return {
    status: "completed",
    source_type: "user_story",
    story_signals: signals,
    explicit_story_elements: {
      actors: signals?.actors || [],
      intent: signals?.intent || {},
      domain_hints: signals?.domain_hints || [],
      action_hints: signals?.action_hints || [],
      constraints: signals?.constraints || [],
    },
    inferred_elements: {
      system_identity: understanding?.system_identity || {},
      capabilities: understanding?.capabilities || [],
      workflows: understanding?.workflows || {},
      risks: understanding?.testing?.focus_areas || [],
    },
    canonical_summary: understanding,
    executive_summary,
    qa_summary,
    inference_notes,
  };
}
