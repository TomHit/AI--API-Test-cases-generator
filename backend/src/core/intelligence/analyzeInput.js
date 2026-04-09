import { analyzeProject } from "./analyzeProject.js";
import { analyzeUserStory } from "./analyzeUserStory.js";

export async function analyzeInput(input = {}) {
  const hasStoryContent = [
    input?.story,
    input?.acceptanceCriteria,
    input?.comments,
    input?.storyText,
    input?.acceptanceCriteriaText,
    input?.commentsText,
  ].some((x) => String(x || "").trim());

  if (hasStoryContent) {
    return analyzeUserStory({
      story: input?.story || input?.storyText || "",
      acceptanceCriteria:
        input?.acceptanceCriteria || input?.acceptanceCriteriaText || "",
      comments: input?.comments || input?.commentsText || "",
    });
  }

  return analyzeProject(input);
}
